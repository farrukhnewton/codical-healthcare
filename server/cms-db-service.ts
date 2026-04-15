import { db } from "./db";
import { cmsGuidelines } from "@shared/schema";
import { asc, eq, sql } from "drizzle-orm";

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

function mapRow(g: typeof cmsGuidelines.$inferSelect): CmsGuidelineResult {
  const type: CmsGuidelineResult["type"] = g.chapter === 0 ? "General" : "ICD-10-CM";
  return {
    id: String(g.id),
    chapter: g.chapter,
    chapterTitle: g.chapterTitle,
    section: g.section,
    title: g.title,
    content: g.content,
    codeRangeStart: g.codeRangeStart,
    codeRangeEnd: g.codeRangeEnd,
    type,
    sourceUrl: g.sourceUrl,
    tags: Array.isArray(g.tags) ? g.tags as string[] : [],
  };
}

function codeInRange(code: string, start: string, end: string): boolean {
  const c = code.toUpperCase().replace(/\./g, "");
  const s = start.toUpperCase().replace(/\./g, "");
  const e = end.toUpperCase().replace(/\./g, "");
  return c >= s && c <= (e + "ZZZZZ");
}

function scoreGuideline(g: CmsGuidelineResult, keyword: string): number {
  const kw = keyword.toLowerCase();
  let score = 0;
  if (g.title.toLowerCase().includes(kw)) score += 10;
  if (g.content.toLowerCase().includes(kw)) score += 5;
  if (g.tags.some(t => t.toLowerCase().includes(kw))) score += 8;
  if (g.section.toLowerCase().includes(kw)) score += 3;
  if (g.chapterTitle.toLowerCase().includes(kw)) score += 4;
  return score;
}

async function getAll(): Promise<CmsGuidelineResult[]> {
  const rows = await db.select().from(cmsGuidelines).orderBy(asc(cmsGuidelines.chapter), asc(cmsGuidelines.section));
  return rows.map(mapRow);
}

export async function getGuidelinesStatsDb(): Promise<CmsStats> {
  const rows = await getAll();
  const chapterMap = new Map<number, { title: string; count: number }>();

  for (const g of rows) {
    const existing = chapterMap.get(g.chapter);
    if (existing) existing.count++;
    else chapterMap.set(g.chapter, { title: g.chapterTitle, count: 1 });
  }

  return {
    totalGuidelines: rows.length,
    icdChapters: new Set(rows.map(g => g.chapter)).size,
    cptGuidelines: 0,
    hcpcsGuidelines: 0,
    lastSync: new Date().toISOString(),
    chapters: Array.from(chapterMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([chapter, v]) => ({ chapter, title: v.title, count: v.count })),
  };
}

export async function searchGuidelinesDb(keyword: string, page: number, pageSize: number): Promise<GuidelinesPage> {
  let rows = await getAll();

  if (keyword.trim()) {
    rows = rows
      .filter(g => scoreGuideline(g, keyword) > 0)
      .sort((a, b) => scoreGuideline(b, keyword) - scoreGuideline(a, keyword));
  }

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

export async function getGuidelinesByChapterDb(chapter: number, page: number, pageSize: number): Promise<GuidelinesPage> {
  const rows = await db.select().from(cmsGuidelines).where(eq(cmsGuidelines.chapter, chapter)).orderBy(asc(cmsGuidelines.section));
  const mapped = rows.map(mapRow);
  const total = mapped.length;
  const start = (page - 1) * pageSize;
  return {
    data: mapped.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

export async function getGuidelinesByTypeDb(type: "ICD-10-CM" | "CPT" | "HCPCS" | "General", page: number, pageSize: number): Promise<GuidelinesPage> {
  let rows = await getAll();
  rows = rows.filter(g => g.type === type);
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

export async function getGuidelinesForCodeDb(code: string): Promise<CmsGuidelineResult[]> {
  const rows = await getAll();
  const codeUpper = code.toUpperCase();
  const normalized = codeUpper.replace(/\./g, "");
  const family3 = normalized.slice(0, 3);
  const family4 = normalized.slice(0, 4);

  const enriched = rows.map(g => {
    const content = g.content.toUpperCase();
    const title = g.title.toUpperCase();
    const tags = g.tags.map(t => t.toUpperCase());
    const inRange = codeInRange(codeUpper, g.codeRangeStart, g.codeRangeEnd);

    const exact =
      content.includes(codeUpper) ||
      title.includes(codeUpper) ||
      tags.some(t => t === codeUpper || t.includes(codeUpper));

    const normalizedExact =
      (!exact) && (
        content.includes(normalized) ||
        title.includes(normalized) ||
        tags.some(t => t === normalized || t.includes(normalized))
      );

    const familyMatch =
      content.includes(family4) ||
      title.includes(family4) ||
      tags.some(t => t.includes(family4)) ||
      content.includes(family3) ||
      title.includes(family3) ||
      tags.some(t => t.includes(family3));

    return { g, exact, normalizedExact, familyMatch, inRange };
  });

  const exactMatches = enriched.filter(x => x.exact || x.normalizedExact).map(x => x.g);
  if (exactMatches.length > 0) {
    return exactMatches.slice(0, 8);
  }

  const familyMatches = enriched
    .filter(x => x.familyMatch && x.inRange)
    .map(x => x.g)
    .sort((a, b) => a.chapter - b.chapter || a.section.localeCompare(b.section));

  if (familyMatches.length > 0) {
    return familyMatches.slice(0, 6);
  }

  const chapterFallback = enriched
    .filter(x => x.inRange)
    .map(x => x.g)
    .sort((a, b) => a.chapter - b.chapter || a.section.localeCompare(b.section));

  return chapterFallback.slice(0, 1);
}
