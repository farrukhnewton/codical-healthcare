import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type FileEntry = {
  absolutePath: string;
  relativePath: string;
  objectKey: string;
  sizeBytes: number;
};

const args = new Set(process.argv.slice(2));
const shouldExecute = args.has("--execute");
const rootArg = readFlag("--root");
const bucketArg = readFlag("--bucket");
const prefixArg = readFlag("--prefix");
const limitArg = readFlag("--limit");

const sourceRoot = path.resolve(rootArg || process.env.MCD_LOCAL_DATA_ROOT || "C:\\Users\\TekSoft\\Downloads\\all_data");
const bucket = bucketArg || process.env.R2_BUCKET_MCD_RAW || "codical-mcd-raw";
const prefix = normalizePrefix(prefixArg || "cms-mcd/raw");
const limit = limitArg ? Number(limitArg) : undefined;

function readFlag(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function normalizePrefix(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function wranglerCommand() {
  return process.execPath;
}

function wranglerArgs(args: string[]) {
  return [path.resolve("node_modules", "wrangler", "bin", "wrangler.js"), ...args];
}

function collectFiles(root: string): FileEntry[] {
  const files: FileEntry[] = [];

  function walk(directory: string) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, item.name);
      if (item.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!item.isFile()) continue;

      const relativePath = path.relative(root, absolutePath);
      const objectKey = `${prefix}/${relativePath.split(path.sep).join("/")}`;
      files.push({
        absolutePath,
        relativePath,
        objectKey,
        sizeBytes: fs.statSync(absolutePath).size,
      });
    }
  }

  walk(root);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function detectContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".csv":
      return "text/csv";
    case ".json":
      return "application/json";
    case ".zip":
      return "application/zip";
    case ".pdf":
      return "application/pdf";
    case ".mdb":
      return "application/octet-stream";
    case ".txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function uploadFile(file: FileEntry, index: number, total: number) {
  const target = `${bucket}/${file.objectKey}`;
  const uploadArgs = [
    "r2",
    "object",
    "put",
    target,
    "--remote",
    "--file",
    file.absolutePath,
    "--content-type",
    detectContentType(file.absolutePath),
  ];

  console.log(`[${index}/${total}] ${file.relativePath} -> r2://${target} (${formatBytes(file.sizeBytes)})`);
  const result = spawnSync(wranglerCommand(), wranglerArgs(uploadArgs), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) throw result.error;

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  if (result.status !== 0) {
    throw new Error(`Upload failed for ${file.relativePath}`);
  }
}

if (!fs.existsSync(sourceRoot)) {
  console.error(`CMS source folder does not exist: ${sourceRoot}`);
  process.exit(1);
}

let files = collectFiles(sourceRoot);
if (limit !== undefined) {
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error(`Invalid --limit value: ${limitArg}`);
    process.exit(1);
  }
  files = files.slice(0, limit);
}

const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
const manifest = {
  generatedAt: new Date().toISOString(),
  mode: shouldExecute ? "execute" : "dry-run",
  sourceRoot,
  bucket,
  prefix,
  fileCount: files.length,
  totalBytes,
  totalSize: formatBytes(totalBytes),
  files,
};

fs.mkdirSync(path.resolve("scratch", "cloudflare"), { recursive: true });
const manifestPath = path.resolve("scratch", "cloudflare", `mcd-r2-upload-manifest-${Date.now()}.json`);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Source: ${sourceRoot}`);
console.log(`Target: r2://${bucket}/${prefix}`);
console.log(`Files: ${files.length}`);
console.log(`Total: ${formatBytes(totalBytes)}`);
console.log(`Manifest: ${manifestPath}`);

if (!shouldExecute) {
  console.log("\nDry run only. Run npm run r2:upload-mcd to upload these files.");
  process.exit(0);
}

for (let i = 0; i < files.length; i++) {
  uploadFile(files[i], i + 1, files.length);
}

console.log("\nR2 upload completed.");
