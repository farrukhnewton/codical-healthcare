/**
 * CMS Guidelines Service
 * Sources:
 *   1. Local CMS ICD-10-CM 2026 Official Guidelines database (authoritative)
 *   2. NLM Clinical Tables API (live code enrichment): clinicaltables.nlm.nih.gov
 */

import { CMS_GUIDELINES, type GuidelineEntry } from "./guidelines-seed";

const NLM_BASE = "https://clinicaltables.nlm.nih.gov/api";

export interface NlmCodeResult {
  code: string;
  description: string;
  source: "ICD-10-CM" | "CPT" | "HCPCS";
}

export interface CmsGuidelineResult {
  id: string;
  chapter: number;
  chapterTitle: string;
  section: string;
  title: string;
  content: string;
  codeRangeStart: string;
  codeRangeEnd: string;
  type: "ICD-10-CM" | "CPT" | "HCPCS" | "General";
  sourceUrl: string;
  tags: string[];
}

export interface GuidelinesPage {
  data: CmsGuidelineResult[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CmsStats {
  totalGuidelines: number;
  icdChapters: number;
  cptGuidelines: number;
  hcpcsGuidelines: number;
  lastSync: string;
  chapters: Array<{ chapter: number; title: string; count: number }>;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, { data: any; expires: number }>();

function getCached<T>(key: string): T | null {
  const e = cache.get(key);
  if (e && Date.now() < e.expires) return e.data as T;
  cache.delete(key);
  return null;
}
function setCache(key: string, data: any, ttl = CACHE_TTL) {
  cache.set(key, { data, expires: Date.now() + ttl });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function mapGuideline(g: GuidelineEntry): CmsGuidelineResult {
  const type: CmsGuidelineResult["type"] =
    g.codeRangeStart >= "99202" && g.codeRangeStart <= "99499" ? "CPT"
    : g.codeRangeStart.match(/^[A-V]\d{4}/) ? "HCPCS"
    : g.chapter === 0 ? "General"
    : "ICD-10-CM";

  return {
    id: `${g.chapter}-${g.section}-${slugify(g.title)}`,
    chapter: g.chapter,
    chapterTitle: g.chapterTitle,
    section: g.section,
    title: g.title,
    content: g.content,
    codeRangeStart: g.codeRangeStart,
    codeRangeEnd: g.codeRangeEnd,
    type,
    sourceUrl: g.sourceUrl,
    tags: g.tags,
  };
}

function codeInRange(code: string, start: string, end: string): boolean {
  const c = code.toUpperCase().replace(".", "");
  const s = start.toUpperCase().replace(".", "");
  const e = end.toUpperCase().replace(".", "");
  // For alphanumeric comparison, check if the code starts with the same prefix
  return c >= s && c <= (e + "ZZZZZ");
}

function scoreGuideline(g: GuidelineEntry, keyword: string): number {
  const kw = keyword.toLowerCase();
  let score = 0;
  if (g.title.toLowerCase().includes(kw)) score += 10;
  if (g.content.toLowerCase().includes(kw)) score += 5;
  if (g.tags.some(t => t.toLowerCase().includes(kw))) score += 8;
  if (g.section.toLowerCase().includes(kw)) score += 3;
  if (g.chapterTitle.toLowerCase().includes(kw)) score += 4;
  return score;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getGuidelinesStats(): CmsStats {
  const chapterMap = new Map<number, { title: string; count: number }>();

  for (const g of CMS_GUIDELINES) {
    const existing = chapterMap.get(g.chapter);
    if (existing) existing.count++;
    else chapterMap.set(g.chapter, { title: g.chapterTitle, count: 1 });
  }

  const icdChapters = new Set(CMS_GUIDELINES.filter(g => g.chapter > 0).map(g => g.chapter)).size;
  const cptGuidelines = CMS_GUIDELINES.filter(g => g.section.startsWith("CPT")).length;
  const hcpcsGuidelines = CMS_GUIDELINES.filter(g => g.section.startsWith("HCPCS")).length;

  return {
    totalGuidelines: CMS_GUIDELINES.length,
    icdChapters,
    cptGuidelines,
    hcpcsGuidelines,
    lastSync: new Date().toISOString(),
    chapters: Array.from(chapterMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ch, v]) => ({ chapter: ch, title: v.title, count: v.count })),
  };
}

export function searchGuidelines(keyword: string, page: number, pageSize: number): GuidelinesPage {
  const cacheKey = `search:${keyword}:${page}:${pageSize}`;
  const cached = getCached<GuidelinesPage>(cacheKey);
  if (cached) return cached;

  let results: GuidelineEntry[];

  if (!keyword.trim()) {
    results = CMS_GUIDELINES;
  } else {
    const kw = keyword.toLowerCase();
    results = CMS_GUIDELINES
      .filter(g => scoreGuideline(g, kw) > 0)
      .sort((a, b) => scoreGuideline(b, keyword.toLowerCase()) - scoreGuideline(a, keyword.toLowerCase()));
  }

  const total = results.length;
  const start = (page - 1) * pageSize;
  const pageData = results.slice(start, start + pageSize);

  const result: GuidelinesPage = {
    data: pageData.map(mapGuideline),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };

  setCache(cacheKey, result, 5 * 60 * 1000);
  return result;
}

export function getGuidelinesByChapter(chapter: number, page: number, pageSize: number): GuidelinesPage {
  const cacheKey = `chapter:${chapter}:${page}:${pageSize}`;
  const cached = getCached<GuidelinesPage>(cacheKey);
  if (cached) return cached;

  const filtered = CMS_GUIDELINES.filter(g => g.chapter === chapter);
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const result: GuidelinesPage = {
    data: filtered.slice(start, start + pageSize).map(mapGuideline),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
  setCache(cacheKey, result);
  return result;
}

export function getGuidelinesByType(type: "ICD-10-CM" | "CPT" | "HCPCS" | "General", page: number, pageSize: number): GuidelinesPage {
  const cacheKey = `type:${type}:${page}:${pageSize}`;
  const cached = getCached<GuidelinesPage>(cacheKey);
  if (cached) return cached;

  const mapped = CMS_GUIDELINES.map(mapGuideline);
  const filtered = type === "General"
    ? mapped.filter(g => g.type === "General" || g.chapter === 0)
    : mapped.filter(g => g.type === type);

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const result: GuidelinesPage = {
    data: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
  setCache(cacheKey, result);
  return result;
}

export function getGuidelinesForCode(code: string): CmsGuidelineResult[] {
  const cacheKey = `code:${code.toUpperCase()}`;
  const cached = getCached<CmsGuidelineResult[]>(cacheKey);
  if (cached) return cached;

  const codeUpper = code.toUpperCase();

  // Direct range match first
  const rangeMatches = CMS_GUIDELINES.filter(g =>
    codeInRange(codeUpper, g.codeRangeStart, g.codeRangeEnd)
  );

  // Also search tags and content for the code pattern
  const codePrefix = codeUpper.substring(0, 3);
  const tagMatches = CMS_GUIDELINES.filter(g =>
    !rangeMatches.includes(g) && (
      g.tags.some(t => t.toUpperCase().includes(codeUpper) || t.toUpperCase().includes(codePrefix)) ||
      g.content.includes(codeUpper) ||
      g.content.includes(code.toUpperCase())
    )
  );

  const results = [...rangeMatches, ...tagMatches].map(mapGuideline);
  setCache(cacheKey, results, 10 * 60 * 1000);
  return results;
}

// NLM Clinical Tables API — live code enrichment
async function fetchNlm(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`NLM API ${res.status}`);
    return await res.json();
  } catch (e: any) {
    clearTimeout(timer);
    throw e;
  }
}

export async function searchNlmCodes(query: string, type: "icd10cm" | "cpt"): Promise<NlmCodeResult[]> {
  const cacheKey = `nlm:${type}:${query}`;
  const cached = getCached<NlmCodeResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const endpoint = type === "icd10cm"
      ? `${NLM_BASE}/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(query)}&maxList=20`
      : `${NLM_BASE}/cpt/v3/search?sf=code,name&terms=${encodeURIComponent(query)}&maxList=20`;

    const data = await fetchNlm(endpoint);
    // NLM response: [total, codes[], extraFields, displayData[[code, desc], ...]]
    const display: string[][] = data[3] || [];
    const results: NlmCodeResult[] = display.map(([code, desc]) => ({
      code,
      description: desc,
      source: type === "icd10cm" ? "ICD-10-CM" : "CPT",
    }));

    setCache(cacheKey, results, 30 * 60 * 1000);
    return results;
  } catch {
    return [];
  }
}

export async function enrichCodeFromNlm(code: string): Promise<NlmCodeResult | null> {
  const cacheKey = `nlm:enrich:${code}`;
  const entry = cache.get(cacheKey);
  if (entry && Date.now() < entry.expires) return entry.data as NlmCodeResult | null;

  try {
    // Determine type by code pattern
    const isIcd = /^[A-TV-Z][0-9]/.test(code.toUpperCase());
    const type = isIcd ? "icd10cm" : "cpt";
    const url = `${NLM_BASE}/${type}/v3/search?sf=code,name&terms=${encodeURIComponent(code)}&maxList=5`;

    const data = await fetchNlm(url);
    const display: string[][] = data[3] || [];

    // Find exact match
    const exact = display.find(([c]) => c.toUpperCase() === code.toUpperCase());
    if (exact) {
      const result: NlmCodeResult = {
        code: exact[0],
        description: exact[1],
        source: isIcd ? "ICD-10-CM" : "CPT",
      };
      setCache(cacheKey, result, 60 * 60 * 1000);
      return result;
    }

    setCache(cacheKey, null, 30 * 60 * 1000);
    return null;
  } catch {
    return null;
  }
}
