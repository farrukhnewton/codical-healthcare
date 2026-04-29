import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureDatabaseSchema() {
  const { rows } = await pool.query<{ exists: boolean }>(`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'attachments'
        and column_name = 'extracted_text'
    ) as exists
  `);

  if (!rows[0]?.exists) {
    await pool.query(`alter table "attachments" add column if not exists "extracted_text" text`);
  }
}
