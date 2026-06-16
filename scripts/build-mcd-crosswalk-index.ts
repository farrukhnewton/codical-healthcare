import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type CoverageStatus = "covered" | "noncovered" | "mixed" | "unknown";

type CodeRow = {
  code?: string;
  description?: string;
  shortDescription?: string;
  longDescription?: string;
  range?: string;
};

type CoverageShard = {
  documentUid: string;
  articleId: string;
  articleVersion: string;
  displayId: string;
  title: string;
  effectiveDate: string | null;
  endDate: string | null;
  hcpcsGroups: Record<string, CodeRow[]>;
  coveredIcdGroups: Record<string, CodeRow[]>;
  noncoveredIcdGroups: Record<string, CodeRow[]>;
  relatedLcd?: Array<Record<string, string>>;
  relatedNcd?: Array<Record<string, string>>;
};

type CrosswalkEvidence = {
  displayId: string;
  articleId: string;
  articleVersion: string;
  title: string;
  groupNumber: string;
  status: CoverageStatus;
  effectiveDate: string | null;
  endDate: string | null;
  relatedLcd: Array<Record<string, string>>;
  relatedNcd: Array<Record<string, string>>;
};

type CrosswalkAggregate = {
  code: string;
  normalizedCode: string;
  description: string;
  status: CoverageStatus;
  evidenceCount: number;
  coveredEvidenceCount: number;
  noncoveredEvidenceCount: number;
  articleCount: number;
  confidenceScore: number;
  evidence: CrosswalkEvidence[];
};

type CrosswalkEntry = {
  code: string;
  normalizedCode: string;
  description: string;
  resultCount: number;
  coveredCount: number;
  noncoveredCount: number;
  mixedCount: number;
  results: CrosswalkAggregate[];
};

type MutableCrosswalkEntry = CrosswalkEntry & {
  resultMap: Map<string, CrosswalkAggregate>;
};

type Direction = "icd" | "procedure";

const args = new Set(process.argv.slice(2));
const shouldExecute = args.has("--execute");
const buildOnly = args.has("--build-only");
const sourceRoot = path.resolve(readFlag("--source") || "scratch/cloudflare/mcd-current/coverage-shards/articles");
const localRoot = path.resolve(readFlag("--out") || "scratch/cloudflare/mcd-crosswalk-index");
const bucket = process.env.R2_BUCKET_MCD_RAW || "codical-mcd-raw";
const prefix = normalizePrefix(readFlag("--prefix") || process.env.MCD_CROSSWALK_PREFIX || "mcd/current/v1/crosswalk");
const uploadConcurrency = Number(readFlag("--concurrency") || process.env.MCD_CROSSWALK_UPLOAD_CONCURRENCY || 16);
const version = readFlag("--version") || "current-v1";

function readFlag(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function normalizePrefix(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function normalizeProcedureCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeIcdCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/\./g, "").replace(/[^A-Z0-9]/g, "");
}

function displayCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function codeDescription(row: CodeRow) {
  return row.longDescription || row.description || row.shortDescription || "";
}

function shardPrefix(normalizedCode: string) {
  return (normalizedCode.slice(0, 4) || "____").padEnd(4, "_");
}

function statusFromCounts(covered: number, noncovered: number): CoverageStatus {
  if (covered > 0 && noncovered > 0) return "mixed";
  if (covered > 0) return "covered";
  if (noncovered > 0) return "noncovered";
  return "unknown";
}

function confidenceScore(evidenceCount: number, articleCount: number, status: CoverageStatus) {
  const base = status === "covered" ? 0.94 : status === "noncovered" ? 0.92 : status === "mixed" ? 0.89 : 0.72;
  return Math.min(0.99, Number((base + Math.min(evidenceCount, 12) * 0.003 + Math.min(articleCount, 4) * 0.004).toFixed(4)));
}

function collectShardFiles(root: string) {
  if (!fs.existsSync(root)) {
    throw new Error(`Coverage shard source does not exist: ${root}`);
  }

  return fs.readdirSync(root)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(root, file))
    .sort((a, b) => a.localeCompare(b));
}

function ensureAggregate(map: Map<string, MutableCrosswalkEntry>, code: string, normalizedCode: string, description: string) {
  let entry = map.get(normalizedCode);
  if (!entry) {
    entry = {
      code,
      normalizedCode,
      description,
      resultCount: 0,
      coveredCount: 0,
      noncoveredCount: 0,
      mixedCount: 0,
      results: [],
      resultMap: new Map<string, CrosswalkAggregate>(),
    };
    map.set(normalizedCode, entry);
  }

  if (!entry.description && description) entry.description = description;
  return entry;
}

function addPair(
  sourceEntry: MutableCrosswalkEntry,
  targetRow: CodeRow,
  targetNormalizedCode: string,
  evidence: CrosswalkEvidence,
) {
  let aggregate = sourceEntry.resultMap.get(targetNormalizedCode);
  if (!aggregate) {
    aggregate = {
      code: displayCode(targetRow.code),
      normalizedCode: targetNormalizedCode,
      description: codeDescription(targetRow),
      status: "unknown",
      evidenceCount: 0,
      coveredEvidenceCount: 0,
      noncoveredEvidenceCount: 0,
      articleCount: 0,
      confidenceScore: 0,
      evidence: [],
    };
    sourceEntry.resultMap.set(targetNormalizedCode, aggregate);
  }

  if (!aggregate.description) aggregate.description = codeDescription(targetRow);
  aggregate.evidence.push(evidence);
}

function finalizeEntry(entry: MutableCrosswalkEntry, resultLimit = 20) {
  entry.results = Array.from(entry.resultMap.values());

  for (const result of entry.results) {
    const articleIds = new Set(result.evidence.map((item) => `${item.articleId}:${item.articleVersion}`));
    result.coveredEvidenceCount = result.evidence.filter((item) => item.status === "covered").length;
    result.noncoveredEvidenceCount = result.evidence.filter((item) => item.status === "noncovered").length;
    result.evidenceCount = result.evidence.length;
    result.articleCount = articleIds.size;
    result.status = statusFromCounts(result.coveredEvidenceCount, result.noncoveredEvidenceCount);
    result.confidenceScore = confidenceScore(result.evidenceCount, result.articleCount, result.status);
    result.evidence = result.evidence
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "covered" ? -1 : b.status === "covered" ? 1 : 0;
        return a.displayId.localeCompare(b.displayId);
      })
      .slice(0, 1);
  }

  entry.results = entry.results
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "covered" ? -1 : b.status === "covered" ? 1 : a.status.localeCompare(b.status);
      if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
      if (b.evidenceCount !== a.evidenceCount) return b.evidenceCount - a.evidenceCount;
      return a.code.localeCompare(b.code);
    })
    .slice(0, resultLimit);

  entry.resultCount = entry.results.length;
  entry.coveredCount = entry.results.filter((item) => item.status === "covered").length;
  entry.noncoveredCount = entry.results.filter((item) => item.status === "noncovered").length;
  entry.mixedCount = entry.results.filter((item) => item.status === "mixed").length;
  delete (entry as Partial<MutableCrosswalkEntry>).resultMap;
}

function writeDirectionShards(direction: Direction, entries: Map<string, MutableCrosswalkEntry>) {
  const outputDir = path.join(localRoot, direction);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const grouped = new Map<string, CrosswalkEntry[]>();
  for (const entry of entries.values()) {
    finalizeEntry(entry);
    const key = shardPrefix(entry.normalizedCode);
    const list = grouped.get(key) || [];
    list.push(entry);
    grouped.set(key, list);
  }

  let largestShard = { prefix: "", entryCount: 0, sizeBytes: 0 };
  for (const [key, list] of grouped.entries()) {
    list.sort((a, b) => a.normalizedCode.localeCompare(b.normalizedCode));
    const payload = {
      version,
      direction,
      prefix: key,
      generatedAt: new Date().toISOString(),
      source: "cms-mcd-current-article-r2-shards",
      entries: Object.fromEntries(list.map((entry) => [entry.normalizedCode, entry])),
    };
    const text = JSON.stringify(payload);
    const sizeBytes = Buffer.byteLength(text);
    if (sizeBytes > largestShard.sizeBytes) {
      largestShard = { prefix: key, entryCount: list.length, sizeBytes };
    }
    fs.writeFileSync(path.join(outputDir, `${key}.json`), text);
  }

  return {
    entryCount: entries.size,
    shardCount: grouped.size,
    largestShard,
  };
}

function buildIndex() {
  const files = collectShardFiles(sourceRoot);
  const icdEntries = new Map<string, MutableCrosswalkEntry>();
  const procedureEntries = new Map<string, MutableCrosswalkEntry>();
  let sourcePairs = 0;

  for (const [fileIndex, filePath] of files.entries()) {
    const shard = JSON.parse(fs.readFileSync(filePath, "utf8")) as CoverageShard;

    for (const [groupNumber, procedureRows] of Object.entries(shard.hcpcsGroups || {})) {
      const icdGroups: Array<{ status: CoverageStatus; rows: CodeRow[] }> = [
        { status: "covered", rows: shard.coveredIcdGroups?.[groupNumber] || [] },
        { status: "noncovered", rows: shard.noncoveredIcdGroups?.[groupNumber] || [] },
      ];

      for (const procedureRow of procedureRows) {
        const procedureCode = displayCode(procedureRow.code);
        const normalizedProcedure = normalizeProcedureCode(procedureCode);
        if (!normalizedProcedure) continue;
        const procedureEntry = ensureAggregate(procedureEntries, procedureCode, normalizedProcedure, codeDescription(procedureRow));

        for (const group of icdGroups) {
          for (const icdRow of group.rows) {
            const icdCode = displayCode(icdRow.code);
            const normalizedIcd = normalizeIcdCode(icdCode);
            if (!normalizedIcd) continue;

            const evidence: CrosswalkEvidence = {
              displayId: shard.displayId,
              articleId: shard.articleId,
              articleVersion: shard.articleVersion,
              title: shard.title,
              groupNumber,
              status: group.status,
              effectiveDate: shard.effectiveDate,
              endDate: shard.endDate,
              relatedLcd: shard.relatedLcd || [],
              relatedNcd: shard.relatedNcd || [],
            };

            const icdEntry = ensureAggregate(icdEntries, icdCode, normalizedIcd, codeDescription(icdRow));
            addPair(icdEntry, procedureRow, normalizedProcedure, evidence);
            addPair(procedureEntry, icdRow, normalizedIcd, evidence);
            sourcePairs++;
          }
        }
      }
    }

    if ((fileIndex + 1) % 250 === 0) {
      console.log(`Processed ${(fileIndex + 1).toLocaleString()} article shards`);
    }
  }

  fs.mkdirSync(localRoot, { recursive: true });
  const icd = writeDirectionShards("icd", icdEntries);
  const procedure = writeDirectionShards("procedure", procedureEntries);

  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    sourceRoot,
    bucket,
    prefix,
    sourceArticleShards: files.length,
    sourcePairs,
    icd,
    procedure,
  };

  fs.writeFileSync(path.join(localRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

function collectOutputFiles(directory: string) {
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

function assertUploadConfig() {
  const missing = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_MCD_RAW"].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment keys for upload: ${missing.join(", ")}`);
  }

  if (!Number.isFinite(uploadConcurrency) || uploadConcurrency < 1 || uploadConcurrency > 64) {
    throw new Error(`Invalid upload concurrency: ${uploadConcurrency}`);
  }
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function uploadFiles(files: { filePath: string; objectKey: string; sizeBytes: number }[]) {
  assertUploadConfig();
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
      if (uploaded % 25 === 0 || uploaded === 1 || uploaded === files.length) {
        console.log(`Uploaded ${uploaded.toLocaleString()} files`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(uploadConcurrency, files.length) }, () => worker()));
}

async function main() {
  const manifest = args.has("--skip-build")
    ? JSON.parse(fs.readFileSync(path.join(localRoot, "manifest.json"), "utf8"))
    : buildIndex();
  const files = collectOutputFiles(localRoot);
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);

  console.log(JSON.stringify(manifest, null, 2));
  console.log(`\nIndex files: ${files.length.toLocaleString()}`);
  console.log(`Index size: ${formatBytes(totalBytes)}`);
  console.log(`Local root: ${localRoot}`);
  console.log(`R2 target: r2://${bucket}/${prefix}`);

  if (!shouldExecute || buildOnly) {
    console.log("\nBuild/dry run complete. Add --execute to upload the crosswalk index to R2.");
    return;
  }

  await uploadFiles([...files]);
  console.log("\nMCD crosswalk R2 index upload complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
