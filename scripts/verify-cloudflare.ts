import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";

const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME || "codical_mcd";
const expectedAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || "7dc964fd2f9e2385f0eca8850ddfc76e";

const requiredEnv = [
  "CLOUDFLARE_D1_DATABASE_ID",
  "R2_BUCKET_MCD_RAW",
  "R2_BUCKET_USER_FILES",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];

function wranglerCommand() {
  return process.execPath;
}

function wranglerArgs(args: string[]) {
  return [path.resolve("node_modules", "wrangler", "bin", "wrangler.js"), ...args];
}

function run(label: string, args: string[]) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(wranglerCommand(), wranglerArgs(args), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (stdout.trim()) {
    console.log(stdout.trim());
  }
  if (stderr.trim()) {
    console.error(stderr.trim());
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }

  return result.stdout;
}

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing Cloudflare environment keys: ${missing.join(", ")}`);
  process.exit(1);
}

if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.warn(`CLOUDFLARE_ACCOUNT_ID is not set in .env; using wrangler.toml account ${expectedAccountId}.`);
}

try {
  const whoami = run("Wrangler account", ["whoami"]);
  if (!whoami.includes(expectedAccountId)) {
    throw new Error(`Logged-in Wrangler account does not include expected account ${expectedAccountId}.`);
  }

  run("D1 info", ["d1", "info", databaseName]);
  run("D1 query", ["d1", "execute", databaseName, "--remote", "--command", "SELECT 1 AS ok"]);
  run("R2 buckets", ["r2", "bucket", "list"]);

  console.log("\nCloudflare verification passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
