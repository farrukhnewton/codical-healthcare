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
  await pool.query(`
    create table if not exists "voice_transcriptions" (
      "id" serial primary key not null,
      "user_id" text,
      "patient_name" text,
      "patient_age" text,
      "date_of_visit" text,
      "chief_complaint" text,
      "diagnosis" text,
      "medications" text,
      "dosage" text,
      "doctor_name" text,
      "doctor_notes" text,
      "followup_date" text,
      "raw_transcript" text,
      "confidence_score" text,
      "audio_file_name" text,
      "created_at" timestamp default now()
    )
  `);

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

  await pool.query(`
    alter table "payer_policies" add column if not exists "document_type" text default 'medical_policy' not null;
    alter table "payer_policies" add column if not exists "status" text default 'indexed' not null;
    alter table "payer_policies" add column if not exists "last_published_at" text;
    alter table "payer_policies" add column if not exists "hcpcs_codes" jsonb default '[]'::jsonb not null;
    alter table "payer_policies" add column if not exists "drug_codes" jsonb default '[]'::jsonb not null;
    alter table "payer_policies" add column if not exists "source_host" text;
    alter table "payer_policies" add column if not exists "last_fetched_at" timestamp;
    alter table "payer_policies" add column if not exists "updated_at" timestamp default now();
    create index if not exists "payer_policies_payer_id_idx" on "payer_policies" ("payer_id");
    create index if not exists "payer_policies_created_at_idx" on "payer_policies" ("created_at");
    create unique index if not exists "payer_policies_payer_source_url_idx" on "payer_policies" ("payer_id", "source_url") where "source_url" is not null;
    update "commercial_payers" set "policy_portal_url" = 'https://www.uhcprovider.com/en/policies-protocols/commercial-policies/commercial-medical-drug-policies.html' where "short_name" = 'UHC';
    update "commercial_payers" set "policy_portal_url" = 'https://www.aetna.com/cpb/medical/data/cpb_num.html' where "short_name" = 'Aetna';
    update "commercial_payers" set "policy_portal_url" = 'https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/index.html' where "short_name" = 'Cigna';
    update "commercial_payers" set "policy_portal_url" = 'https://mcp.humana.com/tad/tad_new/home.aspx?type=provider', "pa_portal_url" = 'https://provider.humana.com/coverage-claims/prior-authorizations' where "short_name" = 'Humana';
    drop table if exists "cms_dataset_registry";
  `);
}
