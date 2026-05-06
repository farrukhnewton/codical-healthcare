import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;
const BOOTSTRAP_SCHEMA_VERSION = "2026-05-06-performance-indexes-v2";

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
    return;
  }

  await createBaseTables();
  await ensureSerialDefaults();
  await ensurePerformanceIndexes();

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

  await seedReferenceData();
  await markCurrentBootstrapVersion();
}
