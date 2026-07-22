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

type CrosswalkAlphabetItem = {
  letter: string;
  count: number;
};

type CrosswalkEntry = {
  code: string;
  normalizedCode: string;
  description: string;
  resultCount: number;
  coveredCount: number;
  noncoveredCount: number;
  mixedCount: number;
  alphabet?: CrosswalkAlphabetItem[];
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

type CachedShard = {
  expiresAt: number;
  data: CrosswalkShard;
};

type CachedCoverageShard = {
  expiresAt: number;
  data: CoverageShard;
};

const cache = new Map<string, CachedShard>();
const coverageCache = new Map<string, CachedCoverageShard>();
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

function coveragePrefix() {
  return (process.env.MCD_COVERAGE_PREFIX || "mcd/current/v1/coverage/articles").replace(/^\/+|\/+$/g, "");
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

async function readLocalCoverageShard(articleId: string, articleVersion: string) {
  const filePath = path.resolve("scratch", "cloudflare", "mcd-current", "coverage-shards", "articles", `${articleId}-${articleVersion}.json`);
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as CoverageShard;
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

async function readR2CoverageShard(articleId: string, articleVersion: string) {
  const client = createS3Client();
  if (!client) return null;

  const key = `${coveragePrefix()}/${articleId}-${articleVersion}.json`;
  const response = await client.send(new GetObjectCommand({
    Bucket: bucketName(),
    Key: key,
  }));

  return JSON.parse(await streamToString(response.Body)) as CoverageShard;
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

async function getCoverageShard(articleId: string, articleVersion: string) {
  const cacheKey = `${articleId}:${articleVersion}`;
  const cached = coverageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  let data: CoverageShard | null = null;

  try {
    data = await readR2CoverageShard(articleId, articleVersion);
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode;
    if (status && status !== 404) {
      console.warn("Cloudflare MCD coverage R2 lookup failed:", error?.message || error);
    }
  }

  if (!data) {
    data = await readLocalCoverageShard(articleId, articleVersion);
  }

  if (!data) return null;

  coverageCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_MS });
  return data;
}

export function normalizeCrosswalkDirection(value: unknown): CrosswalkDirection {
  const normalized = String(value || "").trim().toLowerCase();
  if (["cpt-to-icd", "procedure-to-icd", "hcpcs-to-icd", "procedure"].includes(normalized)) {
    return "cpt-to-icd";
  }
  return "icd-to-cpt";
}

function normalizeCoverageStatus(value: unknown): CoverageStatus | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (["covered", "noncovered", "mixed", "unknown"].includes(normalized)) {
    return normalized as CoverageStatus;
  }
  return null;
}

function normalizeLetter(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized ? normalized[0] : "";
}

function resultLetter(result: CrosswalkResult) {
  return normalizeLetter(result.code || result.normalizedCode);
}

function buildAlphabet(results: CrosswalkResult[]) {
  const counts = new Map<string, number>();
  for (const result of results) {
    const letter = resultLetter(result);
    if (!letter) continue;
    counts.set(letter, (counts.get(letter) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([letter, count]) => ({ letter, count }))
    .sort((a, b) => a.letter.localeCompare(b.letter));
}

function displayCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function codeDescription(row: CodeRow) {
  return row.longDescription || row.description || row.shortDescription || "";
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

function sortCrosswalkResults(results: CrosswalkResult[]) {
  return results.sort((a, b) => {
    if (a.status !== b.status) return a.status === "covered" ? -1 : b.status === "covered" ? 1 : a.status.localeCompare(b.status);
    if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
    if (b.evidenceCount !== a.evidenceCount) return b.evidenceCount - a.evidenceCount;
    return a.code.localeCompare(b.code);
  });
}

function sourceEvidenceFromCoverageShard(
  shard: CoverageShard,
  groupNumber: string,
  status: CoverageStatus,
): CrosswalkEvidence {
  return {
    displayId: shard.displayId,
    articleId: shard.articleId,
    articleVersion: shard.articleVersion,
    title: shard.title,
    groupNumber,
    status,
    effectiveDate: shard.effectiveDate,
    endDate: shard.endDate,
    relatedLcd: shard.relatedLcd || [],
    relatedNcd: shard.relatedNcd || [],
  };
}

function addExpandedResult(
  map: Map<string, CrosswalkResult>,
  row: CodeRow,
  normalizedCode: string,
  evidence: CrosswalkEvidence,
) {
  let result = map.get(normalizedCode);
  if (!result) {
    result = {
      code: displayCode(row.code),
      normalizedCode,
      description: codeDescription(row),
      status: "unknown",
      evidenceCount: 0,
      coveredEvidenceCount: 0,
      noncoveredEvidenceCount: 0,
      articleCount: 0,
      confidenceScore: 0,
      evidence: [],
    };
    map.set(normalizedCode, result);
  }

  if (!result.description) result.description = codeDescription(row);
  result.evidence.push(evidence);
}

async function expandProcedureResultsFromCoverage(entry: CrosswalkEntry, normalizedProcedure: string) {
  const refs = new Map<string, CrosswalkEvidence>();
  for (const result of entry.results || []) {
    for (const evidence of result.evidence || []) {
      if (!evidence.articleId || !evidence.articleVersion || !evidence.groupNumber) continue;
      refs.set(`${evidence.articleId}:${evidence.articleVersion}:${evidence.groupNumber}`, evidence);
    }
  }

  if (refs.size === 0) return [];

  const expanded = new Map<string, CrosswalkResult>();

  for (const ref of Array.from(refs.values())) {
    const shard = await getCoverageShard(ref.articleId, ref.articleVersion);
    if (!shard) continue;

    const procedureRows = shard.hcpcsGroups?.[ref.groupNumber] || [];
    const procedureInGroup = procedureRows.some((row) => normalizeProcedureCode(row.code) === normalizedProcedure);
    if (!procedureInGroup) continue;

    const icdGroups: Array<{ status: CoverageStatus; rows: CodeRow[] }> = [
      { status: "covered", rows: shard.coveredIcdGroups?.[ref.groupNumber] || [] },
      { status: "noncovered", rows: shard.noncoveredIcdGroups?.[ref.groupNumber] || [] },
    ];

    for (const group of icdGroups) {
      const evidence = sourceEvidenceFromCoverageShard(shard, ref.groupNumber, group.status);
      for (const row of group.rows) {
        const normalizedIcd = normalizeIcdCode(row.code);
        if (!normalizedIcd) continue;
        addExpandedResult(expanded, row, normalizedIcd, evidence);
      }
    }
  }

  const results = Array.from(expanded.values());
  for (const result of results) {
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

  return sortCrosswalkResults(results);
}

export async function getMcdCrosswalk(input: {
  direction?: unknown;
  code?: unknown;
  limit?: unknown;
  letter?: unknown;
  status?: unknown;
}) {
  const direction = normalizeCrosswalkDirection(input.direction);
  const indexDirection: IndexDirection = direction === "icd-to-cpt" ? "icd" : "procedure";
  const rawCode = String(input.code || "").trim().toUpperCase();
  const normalizedCode = direction === "icd-to-cpt"
    ? normalizeIcdCode(rawCode)
    : normalizeProcedureCode(rawCode);
  const limit = Math.min(Math.max(Number(input.limit || 24), 1), 60);
  const requestedLetter = normalizeLetter(input.letter);
  const statusFilter = normalizeCoverageStatus(input.status);

  if (!normalizedCode) {
    const error = new Error("A code is required for crosswalk lookup");
    (error as any).statusCode = 400;
    throw error;
  }

  const shard = await getShard(indexDirection, shardPrefix(normalizedCode));
  const entry = shard?.entries?.[normalizedCode] || null;
  let indexedResults = entry?.results || [];
  let expandedFromCoverage = false;

  if (entry && direction === "cpt-to-icd") {
    try {
      const expandedResults = await expandProcedureResultsFromCoverage(entry, normalizedCode);
      if (expandedResults.length > indexedResults.length) {
        indexedResults = expandedResults;
        expandedFromCoverage = true;
      }
    } catch (error: any) {
      console.warn("MCD crosswalk coverage expansion failed:", error?.message || error);
    }
  }

  const statusFilteredResults = statusFilter
    ? indexedResults.filter((result) => result.status === statusFilter)
    : indexedResults;
  const alphabet = !statusFilter && !expandedFromCoverage && entry?.alphabet?.length
    ? entry.alphabet
    : buildAlphabet(statusFilteredResults);
  const availableLetters = alphabet.map((item) => item.letter);
  const activeLetter = requestedLetter && availableLetters.includes(requestedLetter) ? requestedLetter : "";
  const filteredResults = activeLetter
    ? statusFilteredResults.filter((result) => resultLetter(result) === activeLetter)
    : statusFilteredResults;
  const results = filteredResults.slice(0, limit);
  const totalIndexedCount = expandedFromCoverage ? indexedResults.length : entry?.resultCount || indexedResults.length;
  const fullAlphabetCount = activeLetter ? alphabet.find((item) => item.letter === activeLetter)?.count : null;
  const filteredCount = statusFilter
    ? filteredResults.length
    : activeLetter
      ? fullAlphabetCount || filteredResults.length
      : totalIndexedCount;
  const coveredCount = expandedFromCoverage
    ? indexedResults.filter((item) => item.status === "covered").length
    : entry?.coveredCount || 0;
  const noncoveredCount = expandedFromCoverage
    ? indexedResults.filter((item) => item.status === "noncovered").length
    : entry?.noncoveredCount || 0;
  const mixedCount = expandedFromCoverage
    ? indexedResults.filter((item) => item.status === "mixed").length
    : entry?.mixedCount || 0;

  return {
    source: shard ? expandedFromCoverage ? "cloudflare-r2-crosswalk+coverage-expanded" : "cloudflare-r2-crosswalk" : "unavailable",
    indexVersion: shard?.version || null,
    generatedAt: shard?.generatedAt || null,
    direction,
    code: rawCode,
    normalizedCode,
    resultCount: totalIndexedCount,
    totalIndexedCount,
    storedResultCount: indexedResults.length,
    filteredCount,
    returnedCount: results.length,
    resultsCapped: totalIndexedCount > indexedResults.length,
    coveredCount,
    noncoveredCount,
    mixedCount,
    statusFilter,
    activeLetter,
    availableLetters,
    alphabet,
    description: entry?.description || "",
    results,
    note: "Coverage-derived intelligence from CMS article same-group relationships. Verify final billing decisions against source coverage documents.",
  };
}
