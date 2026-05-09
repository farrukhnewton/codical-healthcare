import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

const { Pool } = pg;

type NcciKind = "practitioner" | "outpatient";
type NcciEditTuple = [modifierIndicator: string, effectiveDate: string, deletionDate: string, rationale: string];

type ShardManifest = {
  version: string;
  generatedAt: string;
  bucket: string;
  prefix: string;
  source: string;
  datasets: Record<
    NcciKind,
    {
      table: string;
      rowCount: number;
      duplicatePairs: number;
      shardCount: number;
      largestShard: { code: string; editCount: number };
    }
  >;
};

const args = new Set(process.argv.slice(2));
const shouldExecute = args.has("--execute");
const shouldBuildOnly = args.has("--build-only");
const selectedKind = readFlag("--kind") as NcciKind | "both" | undefined;
const batchSize = Number(readFlag("--batch-size") || process.env.NCCI_EXPORT_BATCH_SIZE || 50000);
const uploadConcurrency = Number(readFlag("--concurrency") || process.env.NCCI_UPLOAD_CONCURRENCY || 24);
const version = readFlag("--version") || "v1";
const localRoot = path.resolve(readFlag("--out") || "scratch/ncci-r2-shards");
const bucket = process.env.R2_BUCKET_MCD_RAW || "codical-mcd-raw";
const prefix = normalizePrefix(readFlag("--prefix") || `ncci/${version}`);

const tableByKind: Record<NcciKind, string> = {
  practitioner: "ncci_practitioner",
  outpatient: "ncci_outpatient",
};

function readFlag(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function normalizePrefix(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function normalizeCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function shardFileName(code: string) {
  return `${encodeURIComponent(code)}.json`;
}

function shardObjectKey(kind: NcciKind, code: string) {
  return `${prefix}/${kind}/${shardFileName(code)}`;
}

function assertSafeConfig() {
  const missing = [
    "DATABASE_URL",
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_MCD_RAW",
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment keys: ${missing.join(", ")}`);
  }

  if (!Number.isFinite(batchSize) || batchSize < 1000) {
    throw new Error(`Invalid batch size: ${batchSize}`);
  }

  if (!Number.isFinite(uploadConcurrency) || uploadConcurrency < 1 || uploadConcurrency > 64) {
    throw new Error(`Invalid upload concurrency: ${uploadConcurrency}`);
  }
}

function createPool() {
  const pooled = new URL(process.env.DATABASE_URL || "");
  const ref = pooled.username.split(".")[1] || "jqfucofhwlqqmhkpihnc";

  return new Pool({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: pooled.pathname.replace(/^\//, "") || "postgres",
    user: "postgres",
    password: decodeURIComponent(pooled.password),
    connectionTimeoutMillis: 30000,
    query_timeout: 300000,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });
}

function createS3Client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
}

async function exportKind(pool: pg.Pool, kind: NcciKind) {
  const table = tableByKind[kind];
  const shards = new Map<string, Record<string, NcciEditTuple>>();
  let lastId = 0;
  let rowCount = 0;
  let duplicatePairs = 0;

  console.log(`\nExporting ${table} in batches of ${batchSize}...`);

  for (;;) {
    const result = await pool.query<{
      id: number;
      col1_code: string;
      col2_code: string;
      effective_date: string | null;
      deletion_date: string | null;
      modifier_indicator: string | null;
      rationale: string | null;
    }>(
      `select id, col1_code, col2_code, effective_date, deletion_date, modifier_indicator, rationale
       from ${table}
       where id > $1
       order by id
       limit $2`,
      [lastId, batchSize],
    );

    if (result.rows.length === 0) {
      break;
    }

    for (const row of result.rows) {
      lastId = row.id;
      const col1 = normalizeCode(row.col1_code);
      const col2 = normalizeCode(row.col2_code);

      if (!col1 || !col2) continue;

      let edits = shards.get(col1);
      if (!edits) {
        edits = {};
        shards.set(col1, edits);
      }

      if (edits[col2]) {
        duplicatePairs++;
        continue;
      }

      edits[col2] = [
        row.modifier_indicator || "",
        row.effective_date || "",
        row.deletion_date || "",
        row.rationale || "",
      ];
      rowCount++;
    }

    if (rowCount % 250000 < batchSize) {
      console.log(`${kind}: processed ${rowCount.toLocaleString()} usable rows, ${shards.size.toLocaleString()} shards`);
    }
  }

  const kindDir = path.join(localRoot, kind);
  fs.rmSync(kindDir, { recursive: true, force: true });
  fs.mkdirSync(kindDir, { recursive: true });

  let largestShard = { code: "", editCount: 0 };

  for (const [code, edits] of shards.entries()) {
    const editCount = Object.keys(edits).length;
    if (editCount > largestShard.editCount) {
      largestShard = { code, editCount };
    }

    const payload = {
      version,
      kind,
      col1: code,
      count: editCount,
      edits,
    };

    fs.writeFileSync(path.join(kindDir, shardFileName(code)), JSON.stringify(payload));
  }

  return {
    table,
    rowCount,
    duplicatePairs,
    shardCount: shards.size,
    largestShard,
  };
}

function collectFiles(directory: string) {
  const files: { filePath: string; objectKey: string; sizeBytes: number }[] = [];

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(filePath);
        continue;
      }
      if (!entry.isFile()) continue;

      const relative = path.relative(localRoot, filePath).split(path.sep).join("/");
      files.push({
        filePath,
        objectKey: `${prefix}/${relative}`,
        sizeBytes: fs.statSync(filePath).size,
      });
    }
  }

  walk(directory);
  return files.sort((a, b) => a.objectKey.localeCompare(b.objectKey));
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function uploadFiles(files: { filePath: string; objectKey: string; sizeBytes: number }[]) {
  const client = createS3Client();
  let uploaded = 0;

  async function worker() {
    for (;;) {
      const file = files.shift();
      if (!file) return;

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: file.objectKey,
          Body: fs.createReadStream(file.filePath),
          ContentType: "application/json",
          CacheControl: "private, max-age=86400",
        }),
      );

      uploaded++;
      if (uploaded % 500 === 0 || uploaded === 1) {
        console.log(`Uploaded ${uploaded.toLocaleString()} files`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(uploadConcurrency, files.length) }, () => worker()));
}

async function main() {
  assertSafeConfig();

  const kinds: NcciKind[] =
    selectedKind && selectedKind !== "both"
      ? [selectedKind]
      : ["practitioner", "outpatient"];

  if (kinds.some((kind) => !tableByKind[kind])) {
    throw new Error(`Invalid --kind value. Use practitioner, outpatient, or both.`);
  }

  fs.mkdirSync(localRoot, { recursive: true });

  const manifest: ShardManifest = {
    version,
    generatedAt: new Date().toISOString(),
    bucket,
    prefix,
    source: "supabase:ncci_practitioner,ncci_outpatient",
    datasets: {} as ShardManifest["datasets"],
  };

  if (!args.has("--skip-build")) {
    const pool = createPool();
    try {
      for (const kind of kinds) {
        manifest.datasets[kind] = await exportKind(pool, kind);
      }
    } finally {
      await pool.end().catch(() => undefined);
    }

    fs.writeFileSync(path.join(localRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  }

  const files = collectFiles(localRoot);
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  console.log(`\nShard files: ${files.length.toLocaleString()}`);
  console.log(`Shard size: ${formatBytes(totalBytes)}`);
  console.log(`Local root: ${localRoot}`);
  console.log(`R2 target: r2://${bucket}/${prefix}`);

  if (!shouldExecute || shouldBuildOnly) {
    console.log("\nBuild/dry run complete. Add --execute to upload shards to R2.");
    return;
  }

  await uploadFiles([...files]);
  console.log("\nNCCI R2 shard upload complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
