type Env = {
  MCD_DB: D1Database;
  MCD_RAW_BUCKET: R2Bucket;
};

const COVERAGE_PREFIX = "mcd/current/v1/coverage/articles";
const CROSSWALK_PREFIX = "mcd/current/v1/crosswalk";

type CrosswalkDirection = "icd-to-cpt" | "cpt-to-icd";
type IndexDirection = "icd" | "procedure";
type CoverageStatus = "covered" | "noncovered" | "mixed" | "unknown";

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
  evidence: unknown[];
};

type CrosswalkEntry = {
  code: string;
  normalizedCode: string;
  description: string;
  resultCount: number;
  coveredCount: number;
  noncoveredCount: number;
  mixedCount: number;
  alphabet?: Array<{ letter: string; count: number }>;
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "cache-control": status === 200 ? "public, max-age=120" : "no-store",
    },
  });
}

function normalizeCode(value: string | null) {
  return (value || "").trim().toUpperCase();
}

function normalizeProcedureCode(value: string | null) {
  return normalizeCode(value).replace(/[^A-Z0-9]/g, "");
}

function normalizeIcdCode(value: string | null) {
  return normalizeCode(value).replace(/\./g, "").replace(/[^A-Z0-9]/g, "");
}

function normalizeCrosswalkDirection(value: string | null): CrosswalkDirection {
  const normalized = (value || "").trim().toLowerCase();
  if (["cpt-to-icd", "procedure-to-icd", "hcpcs-to-icd", "procedure"].includes(normalized)) {
    return "cpt-to-icd";
  }
  return "icd-to-cpt";
}

function normalizeCoverageStatus(value: string | null): CoverageStatus | null {
  const normalized = (value || "").trim().toLowerCase();
  if (["covered", "noncovered", "mixed", "unknown"].includes(normalized)) {
    return normalized as CoverageStatus;
  }
  return null;
}

function normalizeLetter(value: string | null) {
  const normalized = normalizeCode(value).replace(/[^A-Z0-9]/g, "");
  return normalized ? normalized[0] : "";
}

function shardPrefix(normalizedCode: string) {
  return (normalizedCode.slice(0, 4) || "____").padEnd(4, "_");
}

function resultLetter(result: CrosswalkResult) {
  return normalizeLetter(result.code || result.normalizedCode || "");
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

function limitParam(value: string | null, fallback = 25, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function parseArticleShardKey(uid: string | null, articleId: string | null, version: string | null) {
  if (articleId && version) return `${COVERAGE_PREFIX}/${articleId}-${version}.json`;
  const match = (uid || "").match(/^article:([^:]+):([^:]+):/);
  return match ? `${COVERAGE_PREFIX}/${match[1]}-${match[2]}.json` : "";
}

async function handleSearch(env: Env, url: URL) {
  const query = (url.searchParams.get("q") || "").trim();
  const kind = (url.searchParams.get("kind") || "").trim().toLowerCase();
  const limit = limitParam(url.searchParams.get("limit"));

  if (!query) {
    const stmt = kind
      ? env.MCD_DB.prepare(
          `select document_uid, document_kind, display_id, cms_document_id, cms_version_id, title, effective_date, publication_date, status
           from mcd_documents
           where document_kind = ?
           order by title
           limit ?`,
        ).bind(kind, limit)
      : env.MCD_DB.prepare(
          `select document_uid, document_kind, display_id, cms_document_id, cms_version_id, title, effective_date, publication_date, status
           from mcd_documents
           order by document_kind, title
           limit ?`,
        ).bind(limit);

    const results = await stmt.all();
    return json({ query, kind: kind || null, results: results.results || [] });
  }

  const ftsQuery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `${term.replace(/["*]/g, "")}*`)
    .join(" ");

  const stmt = kind
    ? env.MCD_DB.prepare(
        `select d.document_uid, d.document_kind, d.display_id, d.cms_document_id, d.cms_version_id, d.title,
                d.effective_date, d.publication_date, d.status,
                snippet(mcd_search_fts, 4, '', '', '...', 18) as snippet
         from mcd_search_fts
         join mcd_documents d on d.document_uid = mcd_search_fts.document_uid
         where mcd_search_fts match ? and d.document_kind = ?
         limit ?`,
      ).bind(ftsQuery, kind, limit)
    : env.MCD_DB.prepare(
        `select d.document_uid, d.document_kind, d.display_id, d.cms_document_id, d.cms_version_id, d.title,
                d.effective_date, d.publication_date, d.status,
                snippet(mcd_search_fts, 4, '', '', '...', 18) as snippet
         from mcd_search_fts
         join mcd_documents d on d.document_uid = mcd_search_fts.document_uid
         where mcd_search_fts match ?
         limit ?`,
      ).bind(ftsQuery, limit);

  const results = await stmt.all();
  return json({ query, kind: kind || null, results: results.results || [] });
}

async function handleCode(env: Env, url: URL) {
  const code = normalizeCode(url.searchParams.get("code"));
  const limit = limitParam(url.searchParams.get("limit"), 25, 200);

  if (!code) return json({ message: "code is required" }, 400);

  const results = await env.MCD_DB.prepare(
    `select d.document_uid, d.document_kind, d.display_id, d.cms_document_id, d.cms_version_id, d.title,
            d.effective_date, d.publication_date, d.status, dc.group_number, dc.relationship_type, c.code_type
     from mcd_codes c
     join mcd_document_codes dc on dc.code_uid = c.code_uid
     join mcd_documents d on d.document_uid = dc.document_uid
     where c.normalized_code = ?
     order by d.document_kind, d.display_id
     limit ?`,
  )
    .bind(code, limit)
    .all();

  return json({ code, results: results.results || [] });
}

async function handleDocument(env: Env, url: URL) {
  const uid = url.searchParams.get("uid");
  const displayId = url.searchParams.get("displayId");

  if (!uid && !displayId) return json({ message: "uid or displayId is required" }, 400);

  const document = uid
    ? await env.MCD_DB.prepare(`select * from mcd_documents where document_uid = ? limit 1`).bind(uid).first()
    : await env.MCD_DB.prepare(`select * from mcd_documents where upper(display_id) = upper(?) limit 1`).bind(displayId).first();

  if (!document) return json({ message: "Document not found" }, 404);

  const codes = await env.MCD_DB.prepare(
    `select c.code_type, c.code, c.short_description, dc.relationship_type, dc.group_number
     from mcd_document_codes dc
     join mcd_codes c on c.code_uid = dc.code_uid
     where dc.document_uid = ?
     order by c.code_type, c.code
     limit 500`,
  )
    .bind(document.document_uid)
    .all();

  const urls = await env.MCD_DB.prepare(`select url_type, url, label from mcd_document_urls where document_uid = ? limit 50`)
    .bind(document.document_uid)
    .all();

  return json({ document, codes: codes.results || [], urls: urls.results || [] });
}

async function handleArticleCoverage(env: Env, url: URL) {
  const key = parseArticleShardKey(url.searchParams.get("uid"), url.searchParams.get("articleId"), url.searchParams.get("version"));
  if (!key) return json({ message: "uid or articleId+version is required" }, 400);

  const object = await env.MCD_RAW_BUCKET.get(key);
  if (!object) return json({ message: "Coverage shard not found" }, 404);

  return json(await object.json());
}

async function handleCrosswalk(env: Env, url: URL) {
  const direction = normalizeCrosswalkDirection(url.searchParams.get("direction"));
  const indexDirection: IndexDirection = direction === "icd-to-cpt" ? "icd" : "procedure";
  const rawCode = normalizeCode(url.searchParams.get("code"));
  const normalizedCode = direction === "icd-to-cpt"
    ? normalizeIcdCode(rawCode)
    : normalizeProcedureCode(rawCode);
  const limit = limitParam(url.searchParams.get("limit"), 24, 60);
  const requestedLetter = normalizeLetter(url.searchParams.get("letter"));
  const statusFilter = normalizeCoverageStatus(url.searchParams.get("status"));

  if (!normalizedCode) return json({ message: "A code is required for crosswalk lookup" }, 400);

  const key = `${CROSSWALK_PREFIX}/${indexDirection}/${shardPrefix(normalizedCode)}.json`;
  const object = await env.MCD_RAW_BUCKET.get(key);
  if (!object) return json({ message: "Medicare crosswalk index is temporarily unavailable." }, 404);

  const shard = await object.json<CrosswalkShard>();
  const entry = shard.entries?.[normalizedCode] || null;
  const indexedResults = entry?.results || [];
  const statusFilteredResults = statusFilter
    ? indexedResults.filter((result) => result.status === statusFilter)
    : indexedResults;
  const alphabet = !statusFilter && entry?.alphabet?.length
    ? entry.alphabet
    : buildAlphabet(statusFilteredResults);
  const availableLetters = alphabet.map((item) => item.letter);
  const activeLetter = requestedLetter && availableLetters.includes(requestedLetter) ? requestedLetter : "";
  const filteredResults = activeLetter
    ? statusFilteredResults.filter((result) => resultLetter(result) === activeLetter)
    : statusFilteredResults;
  const results = filteredResults.slice(0, limit);
  const totalIndexedCount = entry?.resultCount || indexedResults.length;
  const fullAlphabetCount = activeLetter ? alphabet.find((item) => item.letter === activeLetter)?.count : null;
  const filteredCount = statusFilter
    ? filteredResults.length
    : activeLetter
      ? fullAlphabetCount || filteredResults.length
      : totalIndexedCount;

  return json({
    source: "cloudflare-r2-crosswalk",
    indexVersion: shard.version || null,
    generatedAt: shard.generatedAt || null,
    direction,
    code: rawCode,
    normalizedCode,
    resultCount: entry?.resultCount || 0,
    totalIndexedCount,
    storedResultCount: indexedResults.length,
    filteredCount,
    returnedCount: results.length,
    resultsCapped: totalIndexedCount > indexedResults.length,
    coveredCount: entry?.coveredCount || 0,
    noncoveredCount: entry?.noncoveredCount || 0,
    mixedCount: entry?.mixedCount || 0,
    statusFilter,
    activeLetter,
    availableLetters,
    alphabet,
    description: entry?.description || "",
    results,
    note: "Coverage-derived intelligence from CMS article same-group relationships. Verify final billing decisions against source coverage documents.",
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return json({});
    if (url.pathname === "/health") {
      return json({ ok: true, service: "codical-mcd-api", source: "cloudflare-d1-r2" });
    }

    try {
      if (url.pathname === "/api/mcd/search") return handleSearch(env, url);
      if (url.pathname === "/api/mcd/code") return handleCode(env, url);
      if (url.pathname === "/api/mcd/document") return handleDocument(env, url);
      if (url.pathname === "/api/mcd/article-coverage") return handleArticleCoverage(env, url);
      if (url.pathname === "/api/mcd/crosswalk") return handleCrosswalk(env, url);
      return json({ message: "Not found" }, 404);
    } catch (error) {
      return json({ message: error instanceof Error ? error.message : "Unexpected MCD API error" }, 500);
    }
  },
};
