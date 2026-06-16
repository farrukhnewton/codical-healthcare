import fs from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

type CrosswalkDirection = "icd-to-cpt" | "cpt-to-icd";
type IndexDirection = "icd" | "procedure";
type CoverageStatus = "covered" | "noncovered" | "mixed" | "unknown";

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

type CrosswalkResult = {
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
  results: CrosswalkResult[];
};

type CrosswalkShard = {
  version: string;
  direction: IndexDirection;
  prefix: string;
  generatedAt: string;
  source: string;
  entries: Record<string, CrosswalkEntry>;
};

type CachedShard = {
  expiresAt: number;
  data: CrosswalkShard;
};

const cache = new Map<string, CachedShard>();
const CACHE_MS = 1000 * 60 * 30;

function normalizeProcedureCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeIcdCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/\./g, "").replace(/[^A-Z0-9]/g, "");
}

function shardPrefix(normalizedCode: string) {
  return (normalizedCode.slice(0, 4) || "____").padEnd(4, "_");
}

function crosswalkPrefix() {
  return (process.env.MCD_CROSSWALK_PREFIX || "mcd/current/v1/crosswalk").replace(/^\/+|\/+$/g, "");
}

function bucketName() {
  return process.env.R2_BUCKET_MCD_RAW || "codical-mcd-raw";
}

function createS3Client() {
  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function streamToString(body: any) {
  if (!body) return "";
  if (typeof body.transformToString === "function") return body.transformToString();

  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readLocalShard(indexDirection: IndexDirection, prefix: string) {
  const filePath = path.resolve("scratch", "cloudflare", "mcd-crosswalk-index", indexDirection, `${prefix}.json`);
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as CrosswalkShard;
  } catch {
    return null;
  }
}

async function readR2Shard(indexDirection: IndexDirection, prefix: string) {
  const client = createS3Client();
  if (!client) return null;

  const key = `${crosswalkPrefix()}/${indexDirection}/${prefix}.json`;
  const response = await client.send(new GetObjectCommand({
    Bucket: bucketName(),
    Key: key,
  }));

  return JSON.parse(await streamToString(response.Body)) as CrosswalkShard;
}

async function getShard(indexDirection: IndexDirection, prefix: string) {
  const cacheKey = `${indexDirection}:${prefix}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  let data: CrosswalkShard | null = null;

  try {
    data = await readR2Shard(indexDirection, prefix);
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode;
    if (status && status !== 404) {
      console.warn("Cloudflare MCD crosswalk R2 lookup failed:", error?.message || error);
    }
  }

  if (!data) {
    data = await readLocalShard(indexDirection, prefix);
  }

  if (!data) return null;

  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_MS });
  return data;
}

export function normalizeCrosswalkDirection(value: unknown): CrosswalkDirection {
  const normalized = String(value || "").trim().toLowerCase();
  if (["cpt-to-icd", "procedure-to-icd", "hcpcs-to-icd", "procedure"].includes(normalized)) {
    return "cpt-to-icd";
  }
  return "icd-to-cpt";
}

export async function getMcdCrosswalk(input: {
  direction?: unknown;
  code?: unknown;
  limit?: unknown;
}) {
  const direction = normalizeCrosswalkDirection(input.direction);
  const indexDirection: IndexDirection = direction === "icd-to-cpt" ? "icd" : "procedure";
  const rawCode = String(input.code || "").trim().toUpperCase();
  const normalizedCode = direction === "icd-to-cpt"
    ? normalizeIcdCode(rawCode)
    : normalizeProcedureCode(rawCode);
  const limit = Math.min(Math.max(Number(input.limit || 24), 1), 60);

  if (!normalizedCode) {
    const error = new Error("A code is required for crosswalk lookup");
    (error as any).statusCode = 400;
    throw error;
  }

  const shard = await getShard(indexDirection, shardPrefix(normalizedCode));
  const entry = shard?.entries?.[normalizedCode] || null;
  const results = (entry?.results || []).slice(0, limit);

  return {
    source: shard ? "cloudflare-r2-crosswalk" : "unavailable",
    indexVersion: shard?.version || null,
    generatedAt: shard?.generatedAt || null,
    direction,
    code: rawCode,
    normalizedCode,
    resultCount: entry?.resultCount || 0,
    returnedCount: results.length,
    coveredCount: entry?.coveredCount || 0,
    noncoveredCount: entry?.noncoveredCount || 0,
    mixedCount: entry?.mixedCount || 0,
    description: entry?.description || "",
    results,
    note: "Coverage-derived intelligence from CMS article same-group relationships. Verify final billing decisions against source coverage documents.",
  };
}
