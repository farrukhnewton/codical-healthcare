export type McdDocumentKind = "article" | "lcd" | "ncd";

type McdSearchRow = {
  document_uid: string;
  document_kind: McdDocumentKind;
  display_id?: string | null;
  cms_document_id?: string | null;
  cms_version_id?: string | null;
  title?: string | null;
  effective_date?: string | null;
  publication_date?: string | null;
  last_updated_date?: string | null;
  status?: string | null;
  snippet?: string | null;
  group_number?: string | null;
  relationship_type?: string | null;
  code_type?: string | null;
};

type McdSearchResponse = {
  query: string;
  kind: McdDocumentKind | null;
  results: McdSearchRow[];
};

type McdCodeResponse = {
  code: string;
  results: McdSearchRow[];
};

type McdDocumentResponse = {
  document: McdSearchRow & Record<string, any>;
  codes: Array<Record<string, any>>;
  urls: Array<Record<string, any>>;
};

type McdArticleCoverageShard = {
  documentUid: string;
  documentKind: "article";
  articleId: string;
  articleVersion: string;
  displayId: string;
  title: string;
  effectiveDate: string | null;
  endDate: string | null;
  hcpcsGroups: Record<string, Array<Record<string, string>>>;
  coveredIcdGroups: Record<string, Array<Record<string, string>>>;
  noncoveredIcdGroups: Record<string, Array<Record<string, string>>>;
  relatedLcd: Array<Record<string, string>>;
  relatedNcd: Array<Record<string, string>>;
};

function mcdBaseUrl() {
  return process.env.CLOUDFLARE_MCD_API_URL?.replace(/\/+$/, "") || "";
}

function normalizeLimit(limit: unknown, fallback = 50, max = 100) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

async function fetchMcdJson<T>(path: string, params: Record<string, string | number | undefined>, allowNotFound = false) {
  const baseUrl = mcdBaseUrl();
  if (!baseUrl) return null;

  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (allowNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Cloudflare MCD lookup failed with HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function displayIdFor(row: McdSearchRow) {
  const cmsId = row.cms_document_id || "";
  if (row.document_kind === "article") return row.display_id || (cmsId ? `A${cmsId}` : "");
  if (row.document_kind === "lcd") return row.display_id || (cmsId ? `L${cmsId}` : "");
  return cmsId || row.display_id || "";
}

export function mapMcdCoverageRow(row: McdSearchRow & Record<string, any>) {
  const displayId = displayIdFor(row);
  const cmsId = row.cms_document_id || displayId.replace(/^[AL]/i, "");
  const version = row.cms_version_id || "";
  const coverageType = row.document_kind === "lcd" ? "LCD" : row.document_kind === "ncd" ? "NCD" : "Article";

  return {
    ...row,
    id: row.document_uid,
    source: "cloudflare-mcd",
    coverageType,
    document_id: displayId,
    document_display_id: displayId,
    document_version: version,
    version,
    version_number: version,
    title: row.title || displayId,
    document_title: row.title || displayId,
    article_title: row.document_kind === "article" ? row.title || displayId : undefined,
    lcd_id: row.document_kind === "lcd" ? cmsId : undefined,
    lcd_version: row.document_kind === "lcd" ? version : undefined,
    ncd_id: row.document_kind === "ncd" ? cmsId : undefined,
    ncd_version: row.document_kind === "ncd" ? version : undefined,
    article_id: row.document_kind === "article" ? cmsId : undefined,
    article_version: row.document_kind === "article" ? version : undefined,
    effective_date: row.effective_date || null,
    last_updated: row.last_updated_date || row.publication_date || null,
    contractor_name_type: "Cloudflare MCD",
  };
}

export async function searchMcdCoverageRows(input: {
  query?: string;
  kind?: McdDocumentKind;
  limit?: unknown;
}) {
  const data = await fetchMcdJson<McdSearchResponse>("/api/mcd/search", {
    q: input.query?.trim(),
    kind: input.kind,
    limit: normalizeLimit(input.limit),
  });

  if (!data) return null;
  return (data.results || []).map(mapMcdCoverageRow);
}

export async function getMcdCodeCoverageRows(code: string, input: {
  kind?: McdDocumentKind;
  limit?: unknown;
} = {}) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) return [];

  const data = await fetchMcdJson<McdCodeResponse>("/api/mcd/code", {
    code: normalizedCode,
    limit: normalizeLimit(input.limit, 50, 200),
  });

  if (!data) return null;

  return (data.results || [])
    .filter((row) => !input.kind || row.document_kind === input.kind)
    .map(mapMcdCoverageRow);
}

export async function getMcdCoverageDocument(displayIds: string[]) {
  const uniqueCandidates = Array.from(new Set(displayIds.map((value) => value.trim()).filter(Boolean)));

  for (const displayId of uniqueCandidates) {
    const data = await fetchMcdJson<McdDocumentResponse>("/api/mcd/document", { displayId }, true);
    if (data?.document) {
      return {
        ...mapMcdCoverageRow(data.document),
        summary: data.document.summary,
        body_text: data.document.body_text,
        codes: data.codes || [],
        urls: data.urls || [],
      };
    }
  }

  return null;
}

export async function getMcdArticleCoverage(input: {
  uid?: string;
  articleId?: string;
  version?: string;
}) {
  return fetchMcdJson<McdArticleCoverageShard>("/api/mcd/article-coverage", input, true);
}

function matchingHcpcsGroups(shard: McdArticleCoverageShard, code: string) {
  const normalizedCode = code.trim().toUpperCase();
  return Object.entries(shard.hcpcsGroups || {})
    .filter(([, codes]) => codes.some((item) => String(item.code || "").trim().toUpperCase() === normalizedCode))
    .map(([groupNumber, codes]) => ({
      groupNumber,
      hcpcs: codes.filter((item) => String(item.code || "").trim().toUpperCase() === normalizedCode),
    }));
}

function sampleCodes(rows: Array<Record<string, string>>, limit = 12) {
  return rows.slice(0, limit).map((row) => ({
    code: row.code || "",
    description: row.description || "",
    range: row.range || "",
    sortOrder: row.sortOrder || "",
  }));
}

export async function getMcdCodeCoverageIntelligence(code: string, input: { limit?: unknown } = {}) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) return null;

  const coverageRows = await getMcdCodeCoverageRows(normalizedCode, {
    kind: "article",
    limit: normalizeLimit(input.limit, 8, 20),
  });

  if (!coverageRows) return null;

  const articleRows = coverageRows.filter((row: any) => row.document_kind === "article").slice(0, normalizeLimit(input.limit, 8, 20));
  const documents = await Promise.all(
    articleRows.map(async (row: any) => {
      const shard = await getMcdArticleCoverage({
        uid: row.document_uid,
        articleId: row.article_id || row.cms_document_id,
        version: row.article_version || row.cms_version_id,
      });

      if (!shard) return null;

      const groups = matchingHcpcsGroups(shard, normalizedCode).map(({ groupNumber, hcpcs }) => {
        const covered = shard.coveredIcdGroups?.[groupNumber] || [];
        const noncovered = shard.noncoveredIcdGroups?.[groupNumber] || [];

        return {
          groupNumber,
          hcpcs,
          coveredIcdCount: covered.length,
          noncoveredIcdCount: noncovered.length,
          coveredIcd: sampleCodes(covered),
          noncoveredIcd: sampleCodes(noncovered),
        };
      });

      const coveredIcdCount = groups.reduce((sum, group) => sum + group.coveredIcdCount, 0);
      const noncoveredIcdCount = groups.reduce((sum, group) => sum + group.noncoveredIcdCount, 0);

      return {
        documentUid: shard.documentUid,
        displayId: shard.displayId,
        articleId: shard.articleId,
        articleVersion: shard.articleVersion,
        title: shard.title,
        effectiveDate: shard.effectiveDate,
        endDate: shard.endDate,
        coveredIcdCount,
        noncoveredIcdCount,
        groupCount: groups.length,
        groups,
        relatedLcd: shard.relatedLcd || [],
        relatedNcd: shard.relatedNcd || [],
      };
    }),
  );

  const filteredDocuments = documents.filter(Boolean);

  return {
    source: "cloudflare-mcd",
    code: normalizedCode,
    documentCount: filteredDocuments.length,
    coveredIcdCount: filteredDocuments.reduce((sum, doc: any) => sum + doc.coveredIcdCount, 0),
    noncoveredIcdCount: filteredDocuments.reduce((sum, doc: any) => sum + doc.noncoveredIcdCount, 0),
    documents: filteredDocuments,
  };
}
