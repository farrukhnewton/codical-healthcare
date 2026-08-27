import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { PGX_CMS_GROUPS, PGX_CPT_CODES, PGX_GENE_DRUG_PAIRS, PGX_GENES, PGX_TIER_1_MAP } from "./pgx-engine";
import { ensureRevenueIntegritySchema } from "./services/revenue-integrity/schema";

const { Pool } = pg;
const BOOTSTRAP_SCHEMA_VERSION = "2026-07-22-pgx-phase1";
const PGX_2026_CLFS_RATES: Record<string, number | null> = {
  "81225": 291.36,
  "81226": 450.91,
  "81227": 174.81,
  "81231": 174.81,
  "81232": 174.81,
  "81241": 73.37,
  "81247": 174.81,
  "81283": 73.37,
  "81306": 291.36,
  "81328": 174.81,
  "81335": 174.81,
  "81350": 234,
  "81355": 88.2,
  "81401": 137,
  "81406": 282.88,
  "81418": 917.08,
  "81479": null,
};

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

const OPTIONAL_INDEX_ERROR_CODES = new Set([
  "42501", // insufficient_privilege
  "42704", // undefined_object, e.g. extension/operator class unavailable
  "58P01", // undefined_file, e.g. extension files unavailable
]);

const icdSeedData = [
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications", guideline: "Use additional code to identify control using insulin or oral hypoglycemic drugs when documented." },
  { code: "I10", description: "Essential (primary) hypertension", guideline: "Use for hypertension not further specified as secondary or involving heart or kidney disease." },
  { code: "Z00.00", description: "Encounter for general adult medical examination without abnormal findings" },
  { code: "J45.909", description: "Unspecified asthma, uncomplicated" },
  { code: "M54.50", description: "Low back pain, unspecified" },
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  { code: "R07.9", description: "Chest pain, unspecified" },
  { code: "K21.9", description: "Gastro-esophageal reflux disease without esophagitis" },
  { code: "F41.9", description: "Anxiety disorder, unspecified" },
  { code: "E78.5", description: "Hyperlipidemia, unspecified" },
];

const cptSeedData = [
  { code: "99213", description: "Office or other outpatient visit for the evaluation and management of an established patient, low level", category: "Evaluation and Management" },
  { code: "99214", description: "Office or other outpatient visit for the evaluation and management of an established patient, moderate level", category: "Evaluation and Management" },
  { code: "99203", description: "Office or other outpatient visit for the evaluation and management of a new patient, low level", category: "Evaluation and Management" },
  { code: "99204", description: "Office or other outpatient visit for the evaluation and management of a new patient, moderate level", category: "Evaluation and Management" },
  { code: "93000", description: "Electrocardiogram, routine ECG with at least 12 leads; with interpretation and report", category: "Cardiovascular" },
  { code: "71046", description: "Radiologic examination, chest; 2 views", category: "Radiology" },
  { code: "80053", description: "Comprehensive metabolic panel", category: "Pathology and Laboratory" },
  { code: "85025", description: "Blood count; complete CBC, automated and automated differential WBC count", category: "Pathology and Laboratory" },
  { code: "36415", description: "Collection of venous blood by venipuncture", category: "Pathology and Laboratory" },
  { code: "90658", description: "Influenza virus vaccine, trivalent", category: "Medicine" },
];

const hcpcsSeedData = [
  { code: "G0439", description: "Annual wellness visit, includes a personalized prevention plan of service, subsequent visit", category: "Screening and Wellness" },
  { code: "G2211", description: "Visit complexity inherent to evaluation and management associated with medical care services", category: "Evaluation and Management" },
  { code: "G0444", description: "Annual depression screening, 15 minutes", category: "Screening and Wellness" },
  { code: "A0429", description: "Ambulance service, basic life support, emergency transport", category: "Ambulance" },
  { code: "A0425", description: "Ground mileage, per statute mile", category: "Ambulance" },
  { code: "J1745", description: "Injection, infliximab, excludes biosimilar, 10 mg", category: "Drugs Administered Other Than Oral Method" },
  { code: "J3490", description: "Unclassified drugs", category: "Drugs Administered Other Than Oral Method" },
  { code: "E0431", description: "Portable gaseous oxygen system, rental", category: "Durable Medical Equipment" },
  { code: "E1390", description: "Oxygen concentrator, single delivery port, capable of delivering 85 percent or greater oxygen concentration", category: "Durable Medical Equipment" },
  { code: "V2020", description: "Frames, purchases", category: "Vision Services" },
];

const payerSeedData = [
  { name: "UnitedHealthcare", shortName: "UHC", policyPortalUrl: "https://www.uhcprovider.com/en/policies-protocols/commercial-policies/commercial-medical-drug-policies.html", paPortalUrl: "https://www.uhcprovider.com/en/prior-auth.html" },
  { name: "Aetna", shortName: "Aetna", policyPortalUrl: "https://www.aetna.com/cpb/medical/data/cpb_num.html", paPortalUrl: "https://www.aetna.com/health-care-professionals/prior-authorization.html" },
  { name: "Cigna", shortName: "Cigna", policyPortalUrl: "https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/index.html", paPortalUrl: "https://www.cigna.com/health-care-professionals/prior-authorization-precertification" },
  { name: "Humana", shortName: "Humana", policyPortalUrl: "https://mcp.humana.com/tad/tad_new/home.aspx?type=provider", paPortalUrl: "https://provider.humana.com/coverage-claims/prior-authorizations" },
  { name: "Anthem Blue Cross", shortName: "Anthem", policyPortalUrl: "https://www.anthem.com/provider/medical-policies-clinical-guidelines/", paPortalUrl: "https://web.anthem.com/provider/prior-authorization" },
  { name: "Kaiser Permanente", shortName: "Kaiser", policyPortalUrl: "https://healthy.kaiserpermanente.org/health-wellness/health-encyclopedia/medical-policies", paPortalUrl: "https://provider.kaiserpermanente.org/" },
  { name: "Centene", shortName: "Centene", policyPortalUrl: "https://www.centene.com/health-plans/medical-policies.html", paPortalUrl: "https://www.centene.com/" },
  { name: "Molina Healthcare", shortName: "Molina", policyPortalUrl: "https://www.molinahealthcare.com/providers/common/medicaid/manual/pages/medpol.aspx", paPortalUrl: "https://provider.molinahealthcare.com/" },
  { name: "Blue Cross Blue Shield (National)", shortName: "BCBS", policyPortalUrl: "https://www.bcbs.com/medical-policy", paPortalUrl: "https://www.bcbs.com/prior-authorization" },
  { name: "Tricare", shortName: "Tricare", policyPortalUrl: "https://manuals.health.mil/pages/v3/DownloadManuals.aspx", paPortalUrl: "https://www.tricare-west.com/content/hnw/home/provider/auth.html" },
  { name: "CareSource", shortName: "CareSource", policyPortalUrl: "https://www.caresource.com/providers/tools-resources/medical-policies/", paPortalUrl: "https://www.caresource.com/providers/tools-resources/prior-authorization/" },
  { name: "Highmark", shortName: "Highmark", policyPortalUrl: "https://medicalpolicy.highmarkbluecrossblueshield.com/", paPortalUrl: "https://hb.highmark.com/" },
  { name: "Independence Blue Cross", shortName: "IBX", policyPortalUrl: "https://www.ibx.com/providers/guidelines-and-resources/medical-policy", paPortalUrl: "https://www.ibx.com/providers/authorization" },
  { name: "HCSC", shortName: "HCSC", policyPortalUrl: "https://www.hcsc.com/provider/clinical-guidelines", paPortalUrl: "https://www.hcsc.com/" },
  { name: "Blue Shield of California", shortName: "BSCA", policyPortalUrl: "https://www.blueshieldca.com/provider/guidelines/medical-policy/index.sp", paPortalUrl: "https://www.blueshieldca.com/provider/authorizations/" },
  { name: "Florida Blue", shortName: "FloridaBlue", policyPortalUrl: "https://www.floridablue.com/providers/medical-policies", paPortalUrl: "https://www.floridablue.com/providers/authorizations" },
  { name: "Horizon BCBS", shortName: "Horizon", policyPortalUrl: "https://www.horizonblue.com/providers/policies-procedures/medical-policy", paPortalUrl: "https://www.horizonblue.com/providers/authorizations" },
  { name: "WellCare", shortName: "WellCare", policyPortalUrl: "https://www.wellcare.com/Providers/Clinical-Guidelines", paPortalUrl: "https://www.wellcare.com/" },
  { name: "Amerigroup", shortName: "Amerigroup", policyPortalUrl: "https://provider.amerigroup.com/provider/medical-policies", paPortalUrl: "https://provider.amerigroup.com/authorizations" },
  { name: "Oscar Health", shortName: "Oscar", policyPortalUrl: "https://www.hioscar.com/providers/policies", paPortalUrl: "https://www.hioscar.com/providers/prior-authorization" },
];

const serialIdTables = [
  "assignments",
  "attachments",
  "audit_logs",
  "cached_guidelines",
  "clinical_notes",
  "cms_guidelines",
  "commercial_payers",
  "conversations",
  "encounters",
  "favorites",
  "friend_requests",
  "guidelines",
  "hcpcs_codes",
  "icd10_code_notes",
  "icd10_codes",
  "message_reactions",
  "messages",
  "participants",
  "patients",
  "payer_policies",
  "saved_ai_files",
  "users",
  "voice_transcriptions",
];

function assertSafeIdentifier(identifier: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe database identifier: ${identifier}`);
  }
}

async function ensureBootstrapStateTable() {
  await pool.query(`
    create table if not exists "app_bootstrap_state" (
      "key" text primary key not null,
      "value" text not null,
      "updated_at" timestamp default now()
    )
  `);
}

async function hasCurrentBootstrapVersion() {
  const result = await pool.query<{ value: string }>(
    `select "value" from "app_bootstrap_state" where "key" = 'schema_version' limit 1`,
  );

  return result.rows[0]?.value === BOOTSTRAP_SCHEMA_VERSION;
}

async function markCurrentBootstrapVersion() {
  await pool.query(
    `insert into "app_bootstrap_state" ("key", "value", "updated_at")
     values ('schema_version', $1, now())
     on conflict ("key") do update
     set "value" = excluded."value",
         "updated_at" = now()`,
    [BOOTSTRAP_SCHEMA_VERSION],
  );
}

async function createBaseTables() {
  await pool.query(`
    create table if not exists "users" (
      "id" serial primary key not null,
      "supabase_id" text unique,
      "username" text not null unique,
      "email" text,
      "full_name" text,
      "avatar_url" text,
      "role" text default 'coder' not null,
      "is_online" boolean default false,
      "last_seen" timestamp default now(),
      "created_at" timestamp default now()
    );

    create table if not exists "icd10_codes" (
      "id" serial primary key not null,
      "code" text not null unique,
      "description" text not null,
      "type" text
    );

    create table if not exists "cpt_codes" (
      "id" bigint primary key not null,
      "code" text not null unique,
      "description" text not null,
      "category" text,
      "Procedure Details" text,
      "type" text
    );

    create table if not exists "hcpcs_codes" (
      "id" serial primary key not null,
      "code" text not null unique,
      "description" text not null,
      "category" text,
      "description_1" text,
      "type" text
    );

    create table if not exists "guidelines" (
      "id" serial primary key not null,
      "code" text not null,
      "guideline_text" text not null,
      "source_url" text,
      "last_updated" timestamp default now()
    );

    create table if not exists "cached_guidelines" (
      "id" serial primary key not null,
      "code" text not null unique,
      "guideline_text" text not null,
      "version" text not null,
      "date" text not null,
      "fetched_at" timestamp default now()
    );

    create table if not exists "icd10_code_notes" (
      "id" serial primary key not null,
      "code" text not null unique,
      "description" text,
      "parent_code" text,
      "chapter_name" text,
      "chapter_desc" text,
      "section_id" text,
      "section_desc" text,
      "includes" jsonb default '[]'::jsonb not null,
      "inclusion_terms" jsonb default '[]'::jsonb not null,
      "excludes1" jsonb default '[]'::jsonb not null,
      "excludes2" jsonb default '[]'::jsonb not null,
      "code_first" jsonb default '[]'::jsonb not null,
      "use_additional_code" jsonb default '[]'::jsonb not null,
      "code_also" jsonb default '[]'::jsonb not null,
      "seven_chr_note" text,
      "seven_chr_def" jsonb default '[]'::jsonb not null,
      "fiscal_year" text,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create table if not exists "commercial_payers" (
      "id" serial primary key not null,
      "name" text not null unique,
      "short_name" text,
      "logo_url" text,
      "policy_portal_url" text,
      "pa_portal_url" text,
      "phone" text,
      "created_at" timestamp default now()
    );

    create table if not exists "payer_policies" (
      "id" serial primary key not null,
      "payer_id" integer not null,
      "title" text not null,
      "policy_number" text,
      "document_type" text default 'medical_policy' not null,
      "status" text default 'indexed' not null,
      "effective_date" text,
      "last_published_at" text,
      "cpt_codes" jsonb default '[]'::jsonb not null,
      "hcpcs_codes" jsonb default '[]'::jsonb not null,
      "drug_codes" jsonb default '[]'::jsonb not null,
      "requirements_text" text not null,
      "is_billable" boolean default true,
      "source_url" text,
      "source_host" text,
      "last_fetched_at" timestamp,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

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
    );

    create table if not exists "saved_ai_files" (
      "id" serial primary key not null,
      "user_id" integer not null,
      "module" text not null,
      "file_name" text not null,
      "patient_name" text,
      "content" text not null,
      "source_text" text,
      "structured_data" jsonb default '{}'::jsonb not null,
      "expires_at" timestamp not null,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create table if not exists "favorites" (
      "id" serial primary key not null,
      "user_id" integer not null,
      "code_type" text not null,
      "code" text not null,
      "description" text not null,
      "created_at" timestamp default now()
    );

    create table if not exists "conversations" (
      "id" serial primary key not null,
      "name" text,
      "is_group" boolean default false,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create table if not exists "participants" (
      "id" serial primary key not null,
      "conversation_id" integer not null,
      "user_id" integer not null,
      "joined_at" timestamp default now(),
      "last_read_at" timestamp default now(),
      "is_admin" boolean default false
    );

    create table if not exists "messages" (
      "id" serial primary key not null,
      "conversation_id" integer not null,
      "sender_id" integer,
      "content" text,
      "message_type" text default 'text',
      "is_edited" boolean default false,
      "is_deleted" boolean default false,
      "reply_to_id" integer,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create table if not exists "message_reactions" (
      "id" serial primary key not null,
      "message_id" integer not null,
      "user_id" integer not null,
      "emoji" text not null,
      "created_at" timestamp default now()
    );

    create table if not exists "friend_requests" (
      "id" serial primary key not null,
      "sender_id" integer not null,
      "receiver_id" integer not null,
      "status" text default 'pending',
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create table if not exists "attachments" (
      "id" serial primary key not null,
      "message_id" integer not null,
      "file_name" text not null,
      "file_type" text not null,
      "file_size" integer not null,
      "file_url" text not null,
      "thumbnail_url" text,
      "extracted_text" text,
      "created_at" timestamp default now()
    );

    create table if not exists "patients" (
      "id" serial primary key not null,
      "emr_id" text not null,
      "emr_type" text not null,
      "first_name" text not null,
      "last_name" text not null,
      "dob" text,
      "gender" text,
      "email" text,
      "phone" text,
      "mrn" text,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create table if not exists "encounters" (
      "id" serial primary key not null,
      "patient_id" integer not null,
      "emr_id" text not null,
      "emr_type" text not null,
      "date" timestamp not null,
      "provider_name" text,
      "encounter_type" text,
      "status" text default 'pending',
      "billing_status" text default 'not_billed',
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create table if not exists "assignments" (
      "id" serial primary key not null,
      "encounter_id" integer not null,
      "user_id" integer not null,
      "assigned_at" timestamp default now(),
      "status" text default 'assigned'
    );

    create table if not exists "audit_logs" (
      "id" serial primary key not null,
      "user_id" integer,
      "action" text not null,
      "entity_type" text,
      "entity_id" text,
      "details" jsonb,
      "timestamp" timestamp default now()
    );

    create table if not exists "clinical_notes" (
      "id" serial primary key not null,
      "encounter_id" integer not null,
      "content" text not null,
      "note_type" text default 'soap',
      "created_at" timestamp default now()
    );

    create table if not exists "cms_guidelines" (
      "id" serial primary key not null,
      "chapter" integer not null,
      "chapter_title" text not null,
      "code_range_start" text not null,
      "code_range_end" text not null,
      "section" text not null,
      "title" text not null,
      "content" text not null,
      "source_url" text not null,
      "tags" jsonb default '[]'::jsonb not null,
      "source_document" text,
      "fiscal_year" text,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create index if not exists "payer_policies_payer_id_idx" on "payer_policies" ("payer_id");
    create index if not exists "payer_policies_created_at_idx" on "payer_policies" ("created_at");
    create unique index if not exists "payer_policies_payer_source_url_idx" on "payer_policies" ("payer_id", "source_url") where "source_url" is not null;
  `);
}

async function ensureSerialDefaults() {
  for (const table of serialIdTables) {
    assertSafeIdentifier(table);
    const sequence = `${table}_id_seq`;

    await pool.query(`
      create sequence if not exists "${sequence}" owned by "${table}"."id";
      alter table "${table}" alter column "id" set default nextval('"${sequence}"'::regclass);
      select setval(
        '"${sequence}"',
        coalesce((select max("id") from "${table}"), 0) + 1,
        false
      );
    `);
  }
}

async function ensurePerformanceIndexes() {
  await pool.query(`
    create index if not exists "participants_user_id_idx" on "participants" ("user_id");
    create index if not exists "participants_conversation_id_idx" on "participants" ("conversation_id");
    create index if not exists "messages_conversation_created_at_idx" on "messages" ("conversation_id", "created_at" desc);
    create index if not exists "messages_sender_id_idx" on "messages" ("sender_id");
    create index if not exists "conversations_updated_at_idx" on "conversations" ("updated_at" desc);
    create index if not exists "users_supabase_id_idx" on "users" ("supabase_id") where "supabase_id" is not null;
    create index if not exists "users_email_idx" on "users" ("email") where "email" is not null;
    create index if not exists "favorites_user_id_idx" on "favorites" ("user_id");
    create index if not exists "guidelines_code_idx" on "guidelines" ("code");
  `);

  try {
    await pool.query(`
      create extension if not exists pg_trgm;
      create index if not exists "icd10_codes_code_trgm_idx" on "icd10_codes" using gin ("code" gin_trgm_ops);
      create index if not exists "icd10_codes_description_trgm_idx" on "icd10_codes" using gin ("description" gin_trgm_ops);
      create index if not exists "cpt_codes_code_trgm_idx" on "cpt_codes" using gin ("code" gin_trgm_ops);
      create index if not exists "cpt_codes_description_trgm_idx" on "cpt_codes" using gin ("description" gin_trgm_ops);
      create index if not exists "hcpcs_codes_code_trgm_idx" on "hcpcs_codes" using gin ("code" gin_trgm_ops);
      create index if not exists "hcpcs_codes_description_trgm_idx" on "hcpcs_codes" using gin ("description" gin_trgm_ops);
    `);
  } catch (error: any) {
    if (OPTIONAL_INDEX_ERROR_CODES.has(error?.code)) {
      console.warn("Skipping optional trigram search indexes:", error.message);
      return;
    }

    throw error;
  }
}

async function ensurePgxSchema() {
  await pool.query(`
    create table if not exists "pgx_cms_articles" (
      "id" text primary key not null,
      "article_id" text not null unique,
      "title" text not null,
      "lcd_id" text,
      "version" text,
      "source_url" text,
      "last_synced_at" timestamp,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create table if not exists "pgx_cms_groups" (
      "id" text primary key not null,
      "article_id" text not null references "pgx_cms_articles" ("article_id") on update cascade on delete restrict,
      "group_number" integer not null,
      "group_type" text not null,
      "code" text not null,
      "description" text,
      "source_url" text,
      "updated_at" timestamp default now()
    );

    create table if not exists "pgx_genes" (
      "id" text primary key not null,
      "symbol" text not null unique,
      "display_name" text not null,
      "default_cpt" text,
      "phenotype_notes" text,
      "source_url" text,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create table if not exists "pgx_gene_drug_pairs" (
      "id" text primary key not null,
      "gene" text not null,
      "drug" text not null,
      "drug_class" text,
      "cpic_level" text not null,
      "cpt_codes" jsonb default '[]'::jsonb not null,
      "table_source" text not null,
      "recommendation" text not null,
      "source_url" text,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create table if not exists "pgx_cpt_codes" (
      "id" text primary key not null,
      "code" text not null unique,
      "description" text not null,
      "tier" text not null,
      "min_genes" integer,
      "medicare_rate" numeric(10, 2),
      "rate_year" integer not null,
      "rate_status" text not null,
      "rate_source_url" text not null,
      "article_id" text not null,
      "source_url" text not null,
      "created_at" timestamptz default now() not null,
      "updated_at" timestamptz default now() not null
    );

    alter table "pgx_genes" add column if not exists "full_name" text;
    alter table "pgx_genes" add column if not exists "cpt_codes" jsonb default '[]'::jsonb not null;
    alter table "pgx_genes" add column if not exists "phenotype_options" jsonb default '[]'::jsonb not null;
    alter table "pgx_gene_drug_pairs" add column if not exists "gene_symbol" text;
    alter table "pgx_gene_drug_pairs" add column if not exists "drug_name" text;
    alter table "pgx_gene_drug_pairs" add column if not exists "fda_label_type" text;

    create table if not exists "pgx_analyses" (
      "id" text primary key not null,
      "user_id" integer not null references "users" ("id") on delete cascade,
      "patient_name" text,
      "lab_name" text,
      "primary_icd10" text,
      "drug_names" jsonb default '[]'::jsonb not null,
      "extracted_data" jsonb default '{}'::jsonb not null,
      "analysis_result" jsonb default '{}'::jsonb not null,
      "claim_json" jsonb default '{}'::jsonb not null,
      "claim_narrative" text,
      "r2_objects" jsonb default '[]'::jsonb not null,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );

    create index if not exists "pgx_cms_groups_article_code_idx" on "pgx_cms_groups" ("article_id", "code");
    create index if not exists "pgx_cms_groups_article_group_idx" on "pgx_cms_groups" ("article_id", "group_number", "group_type");
    create unique index if not exists "pgx_cms_groups_unique_row_idx" on "pgx_cms_groups" ("article_id", "group_number", "group_type", "code");
    create unique index if not exists "pgx_gene_drug_pairs_gene_drug_idx" on "pgx_gene_drug_pairs" ("gene", "drug");
    create unique index if not exists "pgx_gene_drug_pairs_symbol_drug_idx" on "pgx_gene_drug_pairs" ("gene_symbol", "drug_name");
    create index if not exists "pgx_cpt_codes_article_idx" on "pgx_cpt_codes" ("article_id", "code");
    create index if not exists "pgx_analyses_user_created_idx" on "pgx_analyses" ("user_id", "created_at" desc);
  `);
}

export async function seedPgxReferenceData() {
  await pool.query(
    `insert into "pgx_cms_articles" ("id", "article_id", "title", "lcd_id", "version", "source_url", "last_synced_at", "updated_at")
     values ($1, $2, $3, $4, $5, $6, now(), now())
     on conflict ("id") do update
     set "title" = excluded."title",
         "lcd_id" = excluded."lcd_id",
         "version" = excluded."version",
         "source_url" = excluded."source_url",
         "last_synced_at" = excluded."last_synced_at",
         "updated_at" = now()
     where "pgx_cms_articles"."version" is null
        or "pgx_cms_articles"."version" = 'starter-local'`,
    [
      "a59915",
      "A59915",
      "Billing and Coding: Pharmacogenomic Testing",
      "L39995",
      "26",
      "https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26",
    ],
  );

  for (const group of PGX_CMS_GROUPS) {
    const id = `${group.articleId.toLowerCase()}-${group.groupNumber}-${group.groupType}-${group.code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    await pool.query(
      `insert into "pgx_cms_groups" ("id", "article_id", "group_number", "group_type", "code", "description", "source_url", "updated_at")
       values ($1, $2, $3, $4, $5, $6, $7, now())
       on conflict ("id") do update
       set "description" = excluded."description",
           "source_url" = excluded."source_url",
           "updated_at" = now()`,
      [id, group.articleId, group.groupNumber, group.groupType, group.code, group.description || null, "https://www.cms.gov/medicare-coverage-database/"],
    );
  }

  for (const gene of PGX_GENES) {
    await pool.query(
      `insert into "pgx_genes" ("id", "symbol", "display_name", "full_name", "default_cpt", "cpt_codes", "phenotype_options", "phenotype_notes", "source_url", "updated_at")
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, now())
       on conflict ("id") do update
       set "display_name" = excluded."display_name",
           "full_name" = coalesce("pgx_genes"."full_name", excluded."full_name"),
           "default_cpt" = excluded."default_cpt",
           "cpt_codes" = case when "pgx_genes"."cpt_codes" = '[]'::jsonb then excluded."cpt_codes" else "pgx_genes"."cpt_codes" end,
           "phenotype_options" = case when "pgx_genes"."phenotype_options" = '[]'::jsonb then excluded."phenotype_options" else "pgx_genes"."phenotype_options" end,
           "phenotype_notes" = excluded."phenotype_notes",
           "source_url" = excluded."source_url",
           "updated_at" = now()`,
      [
        gene.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        gene,
        gene,
        gene,
        PGX_TIER_1_MAP[gene] || null,
        JSON.stringify(PGX_TIER_1_MAP[gene] ? [PGX_TIER_1_MAP[gene], "81418"] : gene === "GLP1R" ? ["81479"] : ["81401", "81418"]),
        JSON.stringify(["Result Reported", "Indeterminate"]),
        "Pharmacogenomics starter gene. Verify current CPIC/FDA and payer guidance before final billing.",
        "https://cpicpgx.org/guidelines/",
      ],
    );
  }

  for (const pair of PGX_GENE_DRUG_PAIRS) {
    const id = `${pair.gene.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${pair.drug.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    await pool.query(
      `insert into "pgx_gene_drug_pairs"
       ("id", "gene", "gene_symbol", "drug", "drug_name", "drug_class", "cpic_level", "cpt_codes", "table_source", "recommendation", "source_url", "updated_at")
       values ($1, $2, $2, $3, $3, $4, $5, $6::jsonb, $7, $8, $9, now())
       on conflict ("id") do update
       set "drug_class" = excluded."drug_class",
           "gene_symbol" = excluded."gene_symbol",
           "drug_name" = excluded."drug_name",
           "cpic_level" = excluded."cpic_level",
           "cpt_codes" = excluded."cpt_codes",
           "table_source" = excluded."table_source",
           "recommendation" = excluded."recommendation",
           "source_url" = excluded."source_url",
           "updated_at" = now()`,
      [
        id,
        pair.gene,
        pair.drug,
        pair.drugClass,
        pair.cpicLevel,
        JSON.stringify(pair.cptCodes),
        pair.tableSource,
        pair.recommendation,
        pair.sourceUrl,
      ],
    );
  }

  for (const item of PGX_CPT_CODES) {
    const medicareRate = PGX_2026_CLFS_RATES[item.code] ?? null;
    await pool.query(
      `insert into "pgx_cpt_codes"
       ("id", "code", "description", "tier", "min_genes", "medicare_rate", "rate_year", "rate_status", "rate_source_url", "article_id", "source_url", "updated_at")
       values ($1, $2, $3, $4, $5, $6, 2026, $7, $8, 'A59915', $9, now())
       on conflict ("id") do update
       set "description" = excluded."description",
           "tier" = excluded."tier",
           "min_genes" = excluded."min_genes",
           "medicare_rate" = excluded."medicare_rate",
           "rate_year" = excluded."rate_year",
           "rate_status" = excluded."rate_status",
           "rate_source_url" = excluded."rate_source_url",
           "article_id" = excluded."article_id",
           "source_url" = excluded."source_url",
           "updated_at" = now()`,
      [
        `cpt-${item.code}`,
        item.code,
        item.description,
        item.tier,
        item.minGenes || null,
        medicareRate,
        medicareRate === null ? "by_report" : "published",
        "https://www.cms.gov/files/zip/26clabq3.zip",
        "https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26",
      ],
    );
    await pool.query(
      `insert into "cpt_codes" ("id", "code", "description", "category", "type")
       select $1, $2, $3, $4, '2026'
       where not exists (
         select 1 from "cpt_codes" where "code" = $2
       )
       and not exists (
         select 1 from "cpt_codes" where "id" = $1
       )`,
      [Number(item.code), item.code, item.description, "Molecular Pathology / Pharmacogenomics"],
    );
  }
}

export async function seedReferenceData() {
  await pool.query(
    `insert into "users" ("username", "role")
     select 'coder1', 'coder'
     where not exists (
       select 1 from "users" where "username" = 'coder1'
     )`,
  );

  for (const item of icdSeedData) {
    await pool.query(
      `update "icd10_codes"
       set "description" = $2,
           "type" = coalesce("type", '2026')
       where "code" = $1`,
      [item.code, item.description],
    );
    await pool.query(
      `insert into "icd10_codes" ("code", "description", "type")
       select $1, $2, '2026'
       where not exists (
         select 1 from "icd10_codes" where "code" = $1
       )`,
      [item.code, item.description],
    );

    if (item.guideline) {
      await pool.query(
        `insert into "guidelines" ("code", "guideline_text", "source_url")
         select $1, $2, $3
         where not exists (
           select 1 from "guidelines"
           where "code" = $1 and "guideline_text" = $2
         )`,
        [item.code, item.guideline, "https://www.cms.gov/medicare/coding-billing/icd-10-codes"],
      );
    }
  }

  for (const item of cptSeedData) {
    await pool.query(
      `update "cpt_codes"
       set "description" = $2,
           "category" = $3,
           "type" = coalesce("type", '2026')
       where "code" = $1`,
      [item.code, item.description, item.category],
    );
    await pool.query(
      `insert into "cpt_codes" ("id", "code", "description", "category", "type")
       select $1, $2, $3, $4, '2026'
       where not exists (
         select 1 from "cpt_codes" where "code" = $2
       )
       and not exists (
         select 1 from "cpt_codes" where "id" = $1
       )`,
      [Number(item.code), item.code, item.description, item.category],
    );
  }

  for (const item of hcpcsSeedData) {
    await pool.query(
      `update "hcpcs_codes"
       set "description" = $2,
           "category" = $3,
           "type" = coalesce("type", '2026')
       where "code" = $1`,
      [item.code, item.description, item.category],
    );
    await pool.query(
      `insert into "hcpcs_codes" ("code", "description", "category", "type")
       select $1, $2, $3, '2026'
       where not exists (
         select 1 from "hcpcs_codes" where "code" = $1
       )`,
      [item.code, item.description, item.category],
    );
  }

  for (const payer of payerSeedData) {
    await pool.query(
      `update "commercial_payers"
       set "short_name" = $2,
           "policy_portal_url" = $3,
           "pa_portal_url" = $4
       where "name" = $1`,
      [payer.name, payer.shortName, payer.policyPortalUrl, payer.paPortalUrl],
    );
    await pool.query(
      `insert into "commercial_payers" ("name", "short_name", "policy_portal_url", "pa_portal_url")
       select $1, $2, $3, $4
       where not exists (
         select 1 from "commercial_payers" where "name" = $1
       )`,
      [payer.name, payer.shortName, payer.policyPortalUrl, payer.paPortalUrl],
    );
  }
}

export async function ensureDatabaseSchema() {
  await ensureBootstrapStateTable();

  if (await hasCurrentBootstrapVersion()) {
    await ensureRevenueIntegritySchema(pool);
    await ensurePgxSchema();
    await seedPgxReferenceData();
    return;
  }

  await createBaseTables();
  await ensureSerialDefaults();
  await ensurePerformanceIndexes();
  await ensureRevenueIntegritySchema(pool);
  await ensurePgxSchema();

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

  await pool.query(`
    create table if not exists "saved_ai_files" (
      "id" serial primary key not null,
      "user_id" integer not null,
      "module" text not null,
      "file_name" text not null,
      "patient_name" text,
      "content" text not null,
      "source_text" text,
      "structured_data" jsonb default '{}'::jsonb not null,
      "expires_at" timestamp not null,
      "created_at" timestamp default now(),
      "updated_at" timestamp default now()
    );
    alter table "saved_ai_files" add column if not exists "patient_name" text;
    alter table "saved_ai_files" add column if not exists "source_text" text;
    alter table "saved_ai_files" add column if not exists "structured_data" jsonb default '{}'::jsonb not null;
    alter table "saved_ai_files" add column if not exists "expires_at" timestamp;
    update "saved_ai_files" set "expires_at" = coalesce("created_at", now()) + interval '30 days' where "expires_at" is null;
    alter table "saved_ai_files" alter column "expires_at" set not null;
    create index if not exists "saved_ai_files_user_module_created_at_idx" on "saved_ai_files" ("user_id", "module", "created_at" desc);
    create index if not exists "saved_ai_files_expires_at_idx" on "saved_ai_files" ("expires_at");
  `);

  await pool.query(`
    alter table "saved_ai_files" enable row level security;
    do $$
    begin
      if exists (select 1 from pg_namespace where nspname = 'auth') then
        execute 'drop policy if exists "saved_ai_files_select_own" on "saved_ai_files"';
        execute 'drop policy if exists "saved_ai_files_insert_own" on "saved_ai_files"';
        execute 'drop policy if exists "saved_ai_files_update_own" on "saved_ai_files"';
        execute 'drop policy if exists "saved_ai_files_delete_own" on "saved_ai_files"';
        execute 'create policy "saved_ai_files_select_own" on "saved_ai_files" for select using (exists (select 1 from "users" u where u."id" = "saved_ai_files"."user_id" and u."supabase_id" = auth.uid()::text))';
        execute 'create policy "saved_ai_files_insert_own" on "saved_ai_files" for insert with check (exists (select 1 from "users" u where u."id" = "saved_ai_files"."user_id" and u."supabase_id" = auth.uid()::text))';
        execute 'create policy "saved_ai_files_update_own" on "saved_ai_files" for update using (exists (select 1 from "users" u where u."id" = "saved_ai_files"."user_id" and u."supabase_id" = auth.uid()::text)) with check (exists (select 1 from "users" u where u."id" = "saved_ai_files"."user_id" and u."supabase_id" = auth.uid()::text))';
        execute 'create policy "saved_ai_files_delete_own" on "saved_ai_files" for delete using (exists (select 1 from "users" u where u."id" = "saved_ai_files"."user_id" and u."supabase_id" = auth.uid()::text))';
      end if;
    end $$;
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

  await seedReferenceData();
  await seedPgxReferenceData();
  await markCurrentBootstrapVersion();
}
