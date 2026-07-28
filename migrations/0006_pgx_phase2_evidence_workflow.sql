-- PGx Phase 2: secure intake, versioned evidence, jurisdiction-aware coverage,
-- claim preview, export controls, and immutable audit history.
-- Forward-only: Phase 1 tables are extended in place and no clinical rows are deleted.

create table if not exists "pgx_tenants" (
  "id" text primary key not null,
  "display_name" text not null,
  "phi_enabled" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table if not exists "pgx_tenant_memberships" (
  "tenant_id" text not null references "pgx_tenants" ("id") on delete restrict,
  "user_id" integer not null references "users" ("id") on delete cascade,
  "role" text not null check ("role" in ('reviewer', 'coder', 'admin')),
  "created_at" timestamptz default now() not null,
  primary key ("tenant_id", "user_id")
);

alter table "pgx_analyses" add column if not exists "tenant_id" text references "pgx_tenants" ("id") on delete restrict;
alter table "pgx_analyses" add column if not exists "idempotency_key" text;
alter table "pgx_analyses" add column if not exists "deleted_at" timestamptz;
create unique index if not exists "pgx_analyses_tenant_user_idempotency_idx"
  on "pgx_analyses" ("tenant_id", "user_id", "idempotency_key") where "idempotency_key" is not null;

create table if not exists "pgx_source_documents" (
  "id" text primary key not null,
  "tenant_id" text not null,
  "user_id" integer not null,
  "analysis_id" text references "pgx_analyses" ("id") on delete restrict,
  "document_role" text not null check ("document_role" in ('lab_report', 'requisition', 'supporting')),
  "object_key" text not null,
  "sha256" text not null,
  "mime_type" text not null,
  "byte_size" bigint not null check ("byte_size" between 1 and 20971520),
  "page_count" integer check ("page_count" between 1 and 250),
  "intake_status" text not null check ("intake_status" in ('accepted', 'quarantined', 'rejected', 'deleted')),
  "malware_scan_status" text not null default 'pending' check ("malware_scan_status" in ('pending', 'clean', 'quarantined', 'unavailable')),
  "retention_until" timestamptz,
  "deleted_at" timestamptz,
  "created_at" timestamptz default now() not null,
  foreign key ("tenant_id", "user_id") references "pgx_tenant_memberships" ("tenant_id", "user_id") on delete restrict,
  unique ("tenant_id", "user_id", "sha256")
);
create unique index if not exists "pgx_source_documents_object_key_idx" on "pgx_source_documents" ("object_key");
create index if not exists "pgx_source_documents_owner_created_idx" on "pgx_source_documents" ("tenant_id", "user_id", "created_at" desc);

create table if not exists "pgx_extraction_runs" (
  "id" text primary key not null,
  "tenant_id" text not null,
  "user_id" integer not null,
  "analysis_id" text references "pgx_analyses" ("id") on delete restrict,
  "source_document_id" text not null references "pgx_source_documents" ("id") on delete restrict,
  "provider" text not null,
  "method" text not null check ("method" in ('native_pdf_text', 'local_ocr', 'approved_external_ocr', 'manual_entry', 'hybrid')),
  "provider_version" text,
  "status" text not null check ("status" in ('pending', 'running', 'completed', 'failed', 'superseded')),
  "input_hash" text not null,
  "schema_version" text not null,
  "error_code" text,
  "started_at" timestamptz default now() not null,
  "completed_at" timestamptz,
  foreign key ("tenant_id", "user_id") references "pgx_tenant_memberships" ("tenant_id", "user_id") on delete restrict,
  unique ("tenant_id", "source_document_id", "input_hash", "provider", "provider_version")
);

create table if not exists "pgx_extracted_fields" (
  "id" text primary key not null,
  "tenant_id" text not null,
  "user_id" integer not null,
  "extraction_run_id" text not null references "pgx_extraction_runs" ("id") on delete restrict,
  "field_name" text not null,
  "raw_text" text,
  "normalized_value" jsonb,
  "source_page" integer,
  "source_region" jsonb,
  "method" text not null,
  "confidence" numeric(5,4) check ("confidence" between 0 and 1),
  "review_status" text not null check ("review_status" in ('extracted', 'low_confidence', 'needs_review', 'approved', 'rejected', 'superseded')),
  "reviewer_override" jsonb,
  "reviewer_user_id" integer references "users" ("id") on delete restrict,
  "reviewed_at" timestamptz,
  "created_at" timestamptz default now() not null,
  foreign key ("tenant_id", "user_id") references "pgx_tenant_memberships" ("tenant_id", "user_id") on delete restrict
);
create index if not exists "pgx_extracted_fields_run_status_idx" on "pgx_extracted_fields" ("extraction_run_id", "review_status");

create table if not exists "pgx_review_decisions" (
  "id" text primary key not null,
  "tenant_id" text not null,
  "user_id" integer not null,
  "analysis_id" text not null references "pgx_analyses" ("id") on delete restrict,
  "field_id" text references "pgx_extracted_fields" ("id") on delete restrict,
  "decision" text not null check ("decision" in ('approved', 'rejected', 'superseded')),
  "reason" text not null,
  "replacement_value" jsonb,
  "created_at" timestamptz default now() not null,
  foreign key ("tenant_id", "user_id") references "pgx_tenant_memberships" ("tenant_id", "user_id") on delete restrict
);

create table if not exists "pgx_knowledge_sources" (
  "id" text primary key not null,
  "source_type" text not null check ("source_type" in ('CMS', 'CPIC', 'FDA', 'ICD10CM', 'CPT', 'HCPCS')),
  "source_identifier" text not null,
  "source_url_or_reference" text not null,
  "license_reference" text,
  "created_at" timestamptz default now() not null,
  unique ("source_type", "source_identifier")
);

create table if not exists "pgx_knowledge_versions" (
  "id" text primary key not null,
  "source_id" text not null references "pgx_knowledge_sources" ("id") on delete restrict,
  "source_version" text not null,
  "published_date" date,
  "effective_date" date,
  "end_date" date,
  "content_hash" text not null,
  "active_status" text not null check ("active_status" in ('future', 'active', 'retired', 'superseded')),
  "superseded_by" text references "pgx_knowledge_versions" ("id") on delete restrict,
  "review_status" text not null check ("review_status" in ('pending', 'verified', 'quarantined', 'rejected')),
  "imported_at" timestamptz default now() not null,
  unique ("source_id", "source_version", "content_hash")
);

create table if not exists "pgx_macs" (
  "id" text primary key not null,
  "contractor_number" text not null,
  "contractor_name" text not null,
  "contract_type" text,
  "active_status" text not null check ("active_status" in ('active', 'inactive', 'unknown')),
  "source_version_id" text not null references "pgx_knowledge_versions" ("id") on delete restrict,
  unique ("contractor_number", "source_version_id")
);

create table if not exists "pgx_jurisdictions" (
  "id" text primary key not null,
  "jurisdiction_code" text,
  "jurisdiction_name" text,
  "source_state_code" text not null check ("source_state_code" ~ '^[A-Z]{2,4}$'),
  "state_code" text not null check ("state_code" ~ '^[A-Z]{2}$'),
  "effective_date" date,
  "end_date" date,
  "source_version_id" text not null references "pgx_knowledge_versions" ("id") on delete restrict,
  unique ("jurisdiction_code", "state_code", "source_version_id")
);

create table if not exists "pgx_mac_jurisdictions" (
  "mac_id" text not null references "pgx_macs" ("id") on delete restrict,
  "jurisdiction_id" text not null references "pgx_jurisdictions" ("id") on delete restrict,
  "effective_date" date,
  "end_date" date,
  primary key ("mac_id", "jurisdiction_id")
);

create table if not exists "pgx_cms_import_runs" (
  "id" text primary key not null,
  "mode" text not null check ("mode" in ('fixture', 'dry_run', 'bounded_live', 'production')),
  "source_release" text not null,
  "source_hash" text not null,
  "schema_version" text not null,
  "status" text not null check ("status" in ('running', 'validated', 'quarantined', 'failed', 'committed')),
  "document_count" integer default 0 not null,
  "relationship_count" integer default 0 not null,
  "quarantine_count" integer default 0 not null,
  "requested_by_user_id" integer references "users" ("id") on delete restrict,
  "started_at" timestamptz default now() not null,
  "completed_at" timestamptz,
  unique ("source_release", "source_hash", "mode")
);

-- Keep the Phase 1 article table as the unique current-version pointer because
-- pgx_cms_groups references article_id. Append-only history lives separately.
alter table "pgx_cms_articles" add column if not exists "knowledge_version_id" text references "pgx_knowledge_versions" ("id") on delete restrict;
alter table "pgx_cms_articles" add column if not exists "import_run_id" text references "pgx_cms_import_runs" ("id") on delete restrict;
alter table "pgx_cms_articles" add column if not exists "content_hash" text;
alter table "pgx_cms_articles" add column if not exists "published_date" date;
alter table "pgx_cms_articles" add column if not exists "effective_date" date;
alter table "pgx_cms_articles" add column if not exists "end_date" date;
alter table "pgx_cms_articles" add column if not exists "active_status" text;
alter table "pgx_cms_articles" add column if not exists "review_status" text;
create unique index if not exists "pgx_cms_articles_version_hash_idx"
  on "pgx_cms_articles" ("article_id", coalesce("version", ''), "content_hash") where "content_hash" is not null;

create table if not exists "pgx_cms_article_versions" (
  "id" text primary key not null,
  "article_id" text not null,
  "version" text not null,
  "title" text not null,
  "lcd_id" text,
  "knowledge_version_id" text not null references "pgx_knowledge_versions" ("id") on delete restrict,
  "import_run_id" text not null references "pgx_cms_import_runs" ("id") on delete restrict,
  "content_hash" text not null,
  "source_url" text not null,
  "published_date" date,
  "effective_date" date,
  "end_date" date,
  "active_status" text not null check ("active_status" in ('future', 'active', 'retired', 'superseded')),
  "review_status" text not null check ("review_status" in ('pending', 'verified', 'quarantined', 'rejected')),
  "created_at" timestamptz default now() not null,
  unique ("article_id", "version", "content_hash")
);

create table if not exists "pgx_cms_lcds" (
  "id" text primary key not null,
  "lcd_id" text not null,
  "version" text not null,
  "title" text not null,
  "knowledge_version_id" text not null references "pgx_knowledge_versions" ("id") on delete restrict,
  "import_run_id" text not null references "pgx_cms_import_runs" ("id") on delete restrict,
  "content_hash" text not null,
  "source_url" text not null,
  "published_date" date,
  "effective_date" date,
  "end_date" date,
  "active_status" text not null check ("active_status" in ('future', 'active', 'retired', 'superseded')),
  "review_status" text not null check ("review_status" in ('pending', 'verified', 'quarantined', 'rejected')),
  "created_at" timestamptz default now() not null,
  unique ("lcd_id", "version", "content_hash")
);

create table if not exists "pgx_cms_document_jurisdictions" (
  "document_type" text not null check ("document_type" in ('article', 'lcd')),
  "document_id" text not null,
  "mac_id" text not null references "pgx_macs" ("id") on delete restrict,
  "jurisdiction_id" text not null references "pgx_jurisdictions" ("id") on delete restrict,
  "import_run_id" text not null references "pgx_cms_import_runs" ("id") on delete restrict,
  primary key ("document_type", "document_id", "mac_id", "jurisdiction_id", "import_run_id")
);

create table if not exists "pgx_cms_code_links" (
  "id" text primary key not null,
  "document_type" text not null check ("document_type" in ('article', 'lcd')),
  "document_id" text not null,
  "group_number" integer,
  "code_system" text not null check ("code_system" in ('CPT', 'HCPCS', 'ICD10CM')),
  "code" text not null,
  "relationship_status" text not null check ("relationship_status" in ('listed', 'supported', 'not_supported', 'manual_review')),
  "effective_date" date,
  "end_date" date,
  "import_run_id" text not null references "pgx_cms_import_runs" ("id") on delete restrict,
  "source_hash" text not null,
  unique ("document_type", "document_id", "group_number", "code_system", "code", "import_run_id")
);
create index if not exists "pgx_cms_code_links_lookup_idx" on "pgx_cms_code_links" ("code_system", "code", "document_type", "document_id");

create table if not exists "pgx_cpic_guidelines" (
  "id" text primary key not null,
  "knowledge_version_id" text not null references "pgx_knowledge_versions" ("id") on delete restrict,
  "gene" text not null,
  "drug" text not null,
  "cpic_level" text check ("cpic_level" in ('A', 'B', 'C', 'D')),
  "evidence_status" text not null check ("evidence_status" in ('verified', 'pending', 'retired', 'quarantined')),
  "source_reference" text not null,
  "superseded_by" text references "pgx_cpic_guidelines" ("id") on delete restrict,
  unique ("knowledge_version_id", "gene", "drug")
);

create table if not exists "pgx_fda_evidence" (
  "id" text primary key not null,
  "knowledge_version_id" text not null references "pgx_knowledge_versions" ("id") on delete restrict,
  "gene" text not null,
  "drug" text not null,
  "evidence_status" text not null check ("evidence_status" in ('verified', 'pending', 'retired', 'quarantined')),
  "source_reference" text not null,
  "superseded_by" text references "pgx_fda_evidence" ("id") on delete restrict,
  unique ("knowledge_version_id", "gene", "drug")
);

create table if not exists "pgx_coverage_reviews" (
  "id" text primary key not null,
  "tenant_id" text not null,
  "user_id" integer not null,
  "analysis_id" text not null references "pgx_analyses" ("id") on delete restrict,
  "service_date" date not null,
  "state_code" text not null check ("state_code" ~ '^[A-Z]{2}$'),
  "mac_id" text references "pgx_macs" ("id") on delete restrict,
  "decision_state" text not null check ("decision_state" in ('supported', 'not_supported', 'insufficient_evidence', 'jurisdiction_not_configured', 'source_outdated', 'manual_review')),
  "source_version_ids" jsonb default '[]'::jsonb not null,
  "rationale" text not null,
  "reviewed_by_user_id" integer references "users" ("id") on delete restrict,
  "reviewed_at" timestamptz,
  "created_at" timestamptz default now() not null,
  foreign key ("tenant_id", "user_id") references "pgx_tenant_memberships" ("tenant_id", "user_id") on delete restrict
);
create index if not exists "pgx_coverage_reviews_analysis_idx" on "pgx_coverage_reviews" ("tenant_id", "analysis_id", "created_at" desc);

create table if not exists "pgx_claim_previews" (
  "id" text primary key not null,
  "tenant_id" text not null,
  "user_id" integer not null,
  "analysis_id" text not null references "pgx_analyses" ("id") on delete restrict,
  "coverage_review_id" text references "pgx_coverage_reviews" ("id") on delete restrict,
  "preview_payload" jsonb not null,
  "evidence_version_ids" jsonb default '[]'::jsonb not null,
  "manual_review_required" boolean default true not null,
  "charge_amount" numeric(12,2),
  "submission_status" text not null default 'preview_only' check ("submission_status" = 'preview_only'),
  "idempotency_key" text not null,
  "created_at" timestamptz default now() not null,
  foreign key ("tenant_id", "user_id") references "pgx_tenant_memberships" ("tenant_id", "user_id") on delete restrict,
  check ("charge_amount" is null),
  unique ("tenant_id", "user_id", "idempotency_key")
);

create table if not exists "pgx_exports" (
  "id" text primary key not null,
  "tenant_id" text not null,
  "user_id" integer not null,
  "analysis_id" text not null references "pgx_analyses" ("id") on delete restrict,
  "claim_preview_id" text references "pgx_claim_previews" ("id") on delete restrict,
  "format" text not null check ("format" in ('pdf', 'csv', 'json')),
  "object_key" text,
  "status" text not null check ("status" in ('requested', 'ready', 'expired', 'deleted', 'failed')),
  "expires_at" timestamptz not null,
  "created_at" timestamptz default now() not null,
  foreign key ("tenant_id", "user_id") references "pgx_tenant_memberships" ("tenant_id", "user_id") on delete restrict
);

create table if not exists "pgx_audit_events" (
  "id" text primary key not null,
  "tenant_id" text not null,
  "user_id" integer not null,
  "analysis_id" text references "pgx_analyses" ("id") on delete restrict,
  "event_type" text not null,
  "entity_type" text not null,
  "entity_id" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "previous_event_hash" text,
  "event_hash" text not null,
  "created_at" timestamptz default now() not null,
  foreign key ("tenant_id", "user_id") references "pgx_tenant_memberships" ("tenant_id", "user_id") on delete restrict,
  unique ("tenant_id", "event_hash")
);
create index if not exists "pgx_audit_events_analysis_created_idx" on "pgx_audit_events" ("tenant_id", "analysis_id", "created_at");

create or replace function pgx_reject_immutable_change() returns trigger
language plpgsql as $$
begin
  raise exception 'immutable PGx history cannot be updated or deleted';
end;
$$;

drop trigger if exists pgx_audit_events_immutable on "pgx_audit_events";
create trigger pgx_audit_events_immutable before update or delete on "pgx_audit_events"
for each row execute function pgx_reject_immutable_change();
drop trigger if exists pgx_import_runs_immutable on "pgx_cms_import_runs";
create trigger pgx_import_runs_immutable before delete on "pgx_cms_import_runs"
for each row execute function pgx_reject_immutable_change();

do $pgx_enable_rls$
declare table_name text;
begin
  foreach table_name in array array[
    'pgx_tenants','pgx_tenant_memberships','pgx_source_documents','pgx_extraction_runs',
    'pgx_extracted_fields','pgx_review_decisions','pgx_knowledge_sources','pgx_knowledge_versions',
    'pgx_macs','pgx_jurisdictions','pgx_mac_jurisdictions','pgx_cms_import_runs','pgx_cms_article_versions','pgx_cms_lcds',
    'pgx_cms_document_jurisdictions','pgx_cms_code_links','pgx_cpic_guidelines','pgx_fda_evidence',
    'pgx_coverage_reviews','pgx_claim_previews','pgx_exports','pgx_audit_events'
  ] loop
    execute format('alter table %I enable row level security', table_name);
  end loop;
end
$pgx_enable_rls$;

-- Direct Supabase access to global evidence tables remains closed. Owner
-- policies are installed only for user-scoped tables when Supabase auth exists.
do $pgx_owner_policies$
declare table_name text;
begin
  if to_regnamespace('auth') is not null
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'drop policy if exists pgx_tenant_memberships_self_read on public.pgx_tenant_memberships';
    execute $policy$
      create policy pgx_tenant_memberships_self_read
      on public.pgx_tenant_memberships for select to authenticated
      using (exists (select 1 from public.users u where u.id = pgx_tenant_memberships.user_id and u.supabase_id = auth.uid()::text))
    $policy$;
    execute 'drop policy if exists pgx_tenants_member_read on public.pgx_tenants';
    execute $policy$
      create policy pgx_tenants_member_read
      on public.pgx_tenants for select to authenticated
      using (exists (select 1 from public.pgx_tenant_memberships m where m.tenant_id = pgx_tenants.id))
    $policy$;
    execute 'drop policy if exists pgx_analyses_owner_access on public.pgx_analyses';
    execute $policy$
      create policy pgx_analyses_owner_access
      on public.pgx_analyses for all to authenticated
      using (
        exists (select 1 from public.users u where u.id = pgx_analyses.user_id and u.supabase_id = auth.uid()::text)
        and (pgx_analyses.tenant_id is null or exists (
          select 1 from public.pgx_tenant_memberships m
          where m.tenant_id = pgx_analyses.tenant_id and m.user_id = pgx_analyses.user_id
        ))
      )
      with check (
        exists (select 1 from public.users u where u.id = pgx_analyses.user_id and u.supabase_id = auth.uid()::text)
        and (pgx_analyses.tenant_id is null or exists (
          select 1 from public.pgx_tenant_memberships m
          where m.tenant_id = pgx_analyses.tenant_id and m.user_id = pgx_analyses.user_id
        ))
      )
    $policy$;
    foreach table_name in array array[
      'pgx_source_documents','pgx_extraction_runs','pgx_extracted_fields','pgx_review_decisions',
      'pgx_coverage_reviews','pgx_claim_previews','pgx_exports','pgx_audit_events'
    ] loop
      execute format('drop policy if exists %I on %I', table_name || '_owner_access', table_name);
      execute format(
        'create policy %I on %I for all to authenticated using (exists (select 1 from public.users u where u.id = %I.user_id and u.supabase_id = auth.uid()::text) and exists (select 1 from public.pgx_tenant_memberships m where m.tenant_id = %I.tenant_id and m.user_id = %I.user_id)) with check (exists (select 1 from public.users u where u.id = %I.user_id and u.supabase_id = auth.uid()::text) and exists (select 1 from public.pgx_tenant_memberships m where m.tenant_id = %I.tenant_id and m.user_id = %I.user_id))',
        table_name || '_owner_access', table_name,
        table_name, table_name, table_name,
        table_name, table_name, table_name
      );
    end loop;
  end if;
end
$pgx_owner_policies$;

comment on table "pgx_cms_import_runs" is 'Append-only CMS importer run history; production mode requires explicit release approval.';
comment on table "pgx_cms_document_jurisdictions" is 'Source-derived document applicability. Never infer nationwide coverage from a document ID alone.';
comment on table "pgx_coverage_reviews" is 'Jurisdiction/date/source-qualified decision support; not a payment guarantee.';
comment on table "pgx_claim_previews" is 'Preview only. Database constraints prohibit charge values and claim submission state.';
comment on table "pgx_audit_events" is 'Immutable, hash-chained PGx security and workflow audit history; metadata must exclude PHI.';
