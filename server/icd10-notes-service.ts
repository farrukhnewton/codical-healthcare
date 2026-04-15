import { db } from "./db";
import { icd10CodeNotes } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface Icd10CodeNotesResult {
  code: string;
  description: string | null;
  parentCode: string | null;
  chapterName: string | null;
  chapterDesc: string | null;
  sectionId: string | null;
  sectionDesc: string | null;
  includes: string[];
  inclusionTerms: string[];
  excludes1: string[];
  excludes2: string[];
  codeFirst: string[];
  useAdditionalCode: string[];
  codeAlso: string[];
  sevenChrNote: string | null;
  sevenChrDef: Array<{ char: string; meaning: string }>;
}

export async function getIcd10CodeNotes(code: string): Promise<Icd10CodeNotesResult | null> {
  const normalized = code.toUpperCase();
  let rows = await db.select().from(icd10CodeNotes).where(eq(icd10CodeNotes.code, normalized)).limit(1);

  if (!rows[0]) {
    rows = await db.select().from(icd10CodeNotes)
      .where(sql`replace(upper(${icd10CodeNotes.code}), ., ) = ${normalized.replace(/\./g, )}`)
      .limit(1);
  }

  const row = rows[0];
  if (!row) return null;

  return {
    code: row.code,
    description: row.description,
    parentCode: row.parentCode,
    chapterName: row.chapterName,
    chapterDesc: row.chapterDesc,
    sectionId: row.sectionId,
    sectionDesc: row.sectionDesc,
    includes: Array.isArray(row.includes) ? row.includes as string[] : [],
    inclusionTerms: Array.isArray(row.inclusionTerms) ? row.inclusionTerms as string[] : [],
    excludes1: Array.isArray(row.excludes1) ? row.excludes1 as string[] : [],
    excludes2: Array.isArray(row.excludes2) ? row.excludes2 as string[] : [],
    codeFirst: Array.isArray(row.codeFirst) ? row.codeFirst as string[] : [],
    useAdditionalCode: Array.isArray(row.useAdditionalCode) ? row.useAdditionalCode as string[] : [],
    codeAlso: Array.isArray(row.codeAlso) ? row.codeAlso as string[] : [],
    sevenChrNote: row.sevenChrNote,
    sevenChrDef: Array.isArray(row.sevenChrDef) ? row.sevenChrDef as Array<{ char: string; meaning: string }> : [],
  };
}
