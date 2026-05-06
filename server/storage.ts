import { db } from "./db";
import {
  users,
  favorites,
  icd10Codes,
  cptCodes,
  hcpcsCodes,
  guidelines,
  type User,
  type Favorite,
  type InsertFavorite,
  type MedicalCode
} from "@shared/schema";
import { eq, or, ilike, sql } from "drizzle-orm";

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_SEARCH_CACHE_ENTRIES = 250;
const searchCache = new Map<string, { expiresAt: number; results: MedicalCode[] }>();

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getFavorites(userId: number): Promise<Favorite[]>;
  getFavorite(id: number): Promise<Favorite | undefined>;
  createFavorite(favorite: InsertFavorite): Promise<Favorite>;
  deleteFavorite(id: number): Promise<void>;

  searchCodes(query: string, typeFilter?: string): Promise<MedicalCode[]>;
  getCode(type: string, code: string): Promise<MedicalCode | undefined>;
  getGuideline(code: string): Promise<string | undefined>;
}

function formatIcd10Code(code: string): string {
  const c = String(code || "").toUpperCase().replace(/\./g, "");
  if (c.length <= 3) return c;
  return c.slice(0, 3) + "." + c.slice(3);
}

function getCachedSearch(key: string) {
  const cached = searchCache.get(key);

  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    searchCache.delete(key);
    return null;
  }

  return cached.results.slice();
}

function setCachedSearch(key: string, results: MedicalCode[]) {
  if (searchCache.size >= MAX_SEARCH_CACHE_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) {
      searchCache.delete(oldestKey);
    }
  }

  searchCache.set(key, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    results: results.slice(),
  });
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getFavorites(userId: number): Promise<Favorite[]> {
    return await db.select().from(favorites).where(eq(favorites.userId, userId));
  }

  async getFavorite(id: number): Promise<Favorite | undefined> {
    const [fav] = await db.select().from(favorites).where(eq(favorites.id, id));
    return fav;
  }

  async createFavorite(favorite: InsertFavorite): Promise<Favorite> {
    const [fav] = await db.insert(favorites).values(favorite).returning();
    return fav;
  }

  async deleteFavorite(id: number): Promise<void> {
    await db.delete(favorites).where(eq(favorites.id, id));
  }

  async searchCodes(query: string, typeFilter?: string): Promise<MedicalCode[]> {
    const normalizedType = typeFilter || "All";
    const trimmedQuery = query.trim();
    const cacheKey = `${normalizedType}:${trimmedQuery.toLowerCase()}`;
    const cached = getCachedSearch(cacheKey);

    if (cached) {
      return cached;
    }

    const searchPattern = `%${trimmedQuery}%`;
    const icdNormalized = trimmedQuery.replace(/\./g, "");
    const results: MedicalCode[] = [];

    const searchICD = async () => {
      const normalizedQuery = icdNormalized.toUpperCase();
      const isCodeLike = /^[A-Z][0-9][0-9A-Z.]*$/i.test(trimmedQuery);

      let rows;
      if (isCodeLike) {
        // Search by code prefix or normalized match
        rows = await db.select().from(icd10Codes)
          .where(or(
            ilike(icd10Codes.code, `%${normalizedQuery}%`),
            sql`replace(upper(${icd10Codes.code}), '.', '') ilike ${`%${normalizedQuery}%`}`
          ))
          .limit(50);
      } else {
        // Search by description
        rows = await db.select().from(icd10Codes)
          .where(ilike(icd10Codes.description, searchPattern))
          .limit(50);
      }

      return rows.map(r => ({
        type: "ICD-10-CM",
        code: formatIcd10Code(r.code),
        description: r.description,
        version: r.type || "2026"
      }));
    };

    const searchCPT = async () => {
      const rows = await db.select().from(cptCodes)
        .where(or(
          ilike(cptCodes.code, searchPattern),
          ilike(cptCodes.description, searchPattern)
        ))
        .limit(50);
      return rows.map(r => ({
        type: "CPT",
        code: r.code,
        description: r.description,
        category: r.category || undefined,
        procedureDetails: r.procedureDetails || undefined,
        version: r.type || "2026"
      }));
    };

    const searchHCPCS = async () => {
      const rows = await db.select().from(hcpcsCodes)
        .where(or(
          ilike(hcpcsCodes.code, searchPattern),
          ilike(hcpcsCodes.description, searchPattern)
        ))
        .limit(50);
      return rows.map(r => {
        let desc = String(r.description).replace(/^"|"$/g, '').replace(/\\"/g, '"');
        return {
          type: "HCPCS",
          code: r.code,
          description: desc,
          category: r.category || undefined,
          version: r.type || "2026"
        };
      });
    };

    if (!typeFilter || typeFilter === "All" || typeFilter === "ICD-10-CM") {
      results.push(...(await searchICD()));
    }
    if (!typeFilter || typeFilter === "All" || typeFilter === "CPT") {
      results.push(...(await searchCPT()));
    }
    if (!typeFilter || typeFilter === "All" || typeFilter === "HCPCS") {
      results.push(...(await searchHCPCS()));
    }

    setCachedSearch(cacheKey, results);
    return results;
  }

  async getCode(type: string, code: string): Promise<MedicalCode | undefined> {
    const [g] = await db.select().from(guidelines).where(eq(guidelines.code, code));
    
    if (type === "ICD-10-CM") {
      const normalizedCode = code.toUpperCase().replace(/\./g, "");
      let rows = await db.select().from(icd10Codes).where(eq(icd10Codes.code, normalizedCode)).limit(1);
      if (!rows[0]) {
        rows = await db.select().from(icd10Codes)
          .where(sql`replace(upper(${icd10Codes.code}), ., ) = ${normalizedCode}`)
          .limit(1);
      }
      const row = rows[0];
      if (!row) return undefined;
      return {
        type,
        code: formatIcd10Code(row.code),
        description: row.description,
        version: row.type || "2026",
        guideline: g ? { text: g.guidelineText, sourceUrl: g.sourceUrl || undefined, date: g.lastUpdated?.toISOString() } : undefined
      };
    } else if (type === "CPT") {
      const [row] = await db.select().from(cptCodes).where(eq(cptCodes.code, code));
      if (!row) return undefined;
      return {
        type,
        code: row.code,
        description: row.description,
        category: row.category || undefined,
        procedureDetails: row.procedureDetails || undefined,
        version: row.type || "2026",
        guideline: g ? { text: g.guidelineText, sourceUrl: g.sourceUrl || undefined, date: g.lastUpdated?.toISOString() } : undefined
      };
    } else if (type === "HCPCS") {
      const [row] = await db.select().from(hcpcsCodes).where(eq(hcpcsCodes.code, code));
      if (!row) return undefined;

      let desc = String(row.description).replace(/^"|"$/g, '').replace(/\\"/g, '"');

      return {
        type,
        code: row.code,
        description: desc,
        category: row.category || undefined,
        version: row.type || "2026",
        guideline: g ? { text: g.guidelineText, sourceUrl: g.sourceUrl || undefined, date: g.lastUpdated?.toISOString() } : undefined
      };
    }
    return undefined;
  }

  async getGuideline(code: string): Promise<string | undefined> {
    const [g] = await db.select().from(guidelines).where(eq(guidelines.code, code));
    return g?.guidelineText;
  }
}

export const storage = new DatabaseStorage();
