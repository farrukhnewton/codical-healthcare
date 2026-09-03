import type { Pool } from "pg";

export async function ensureRevenueIntegritySchema(pool: Pool) {
  await pool.query(`
    create table if not exists "revenue_organizations" (
      "id" text primary key not null,
      "slug" text not null unique,
      "name" text not null,
      "status" text not null default 'onboarding',
      "clearinghouse_provider" text not null default 'stedi',
      "created_by" integer references "users" ("id") on delete set null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now()
    );

    create table if not exists "revenue_organization_members" (
      "id" serial primary key not null,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "user_id" integer not null references "users" ("id") on delete cascade,
      "role" text not null default 'analyst',
      "status" text not null default 'active',
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      unique ("organization_id", "user_id")
    );

    create table if not exists "revenue_claims" (
      "id" text primary key not null,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "patient_id" integer references "patients" ("id") on delete set null,
      "encounter_id" integer references "encounters" ("id") on delete set null,
      "patient_control_number" text not null,
      "claim_type" text not null default 'professional',
      "status" text not null default 'draft',
      "payer_id" text not null,
      "payer_name" text not null,
      "payer_claim_control_number" text,
      "service_from" text not null,
      "service_to" text,
      "billing_provider_npi" text not null,
      "rendering_provider_npi" text,
      "diagnosis_codes" jsonb not null default '[]'::jsonb,
      "total_charge" numeric(14,2) not null default 0,
      "expected_amount" numeric(14,2),
      "paid_amount" numeric(14,2) not null default 0,
      "integrity_score" integer not null default 0,
      "risk_level" text not null default 'unscored',
      "clearinghouse_provider" text not null default 'stedi',
      "external_claim_id" text,
      "assigned_to" integer references "users" ("id") on delete set null,
      "created_by" integer references "users" ("id") on delete set null,
      "version" integer not null default 1,
      "metadata" jsonb not null default '{}'::jsonb,
      "submitted_at" timestamptz,
      "last_transaction_at" timestamptz,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      unique ("organization_id", "patient_control_number")
    );

    create table if not exists "revenue_claim_lines" (
      "id" serial primary key not null,
      "claim_id" text not null references "revenue_claims" ("id") on delete cascade,
      "line_number" integer not null,
      "procedure_code" text not null,
      "description" text,
      "modifiers" jsonb not null default '[]'::jsonb,
      "diagnosis_pointers" jsonb not null default '[]'::jsonb,
      "place_of_service" text,
      "units" numeric(10,3) not null default 1,
      "charge_amount" numeric(14,2) not null default 0,
      "expected_amount" numeric(14,2),
      "paid_amount" numeric(14,2) not null default 0,
      "status" text not null default 'draft',
      "metadata" jsonb not null default '{}'::jsonb,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      unique ("claim_id", "line_number")
    );

    create table if not exists "revenue_claim_events" (
      "id" serial primary key not null,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "claim_id" text references "revenue_claims" ("id") on delete cascade,
      "event_type" text not null,
      "source" text not null,
      "external_event_id" text,
      "idempotency_key" text,
      "payload_hash" text,
      "raw_object_key" text,
      "summary" jsonb not null default '{}'::jsonb,
      "occurred_at" timestamptz not null,
      "received_at" timestamptz not null default now(),
      "created_at" timestamptz not null default now()
    );

    create table if not exists "revenue_work_items" (
      "id" serial primary key not null,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "claim_id" text not null references "revenue_claims" ("id") on delete cascade,
      "claim_line_id" integer references "revenue_claim_lines" ("id") on delete cascade,
      "category" text not null,
      "issue_code" text not null,
      "title" text not null,
      "description" text not null,
      "recommended_action" text not null,
      "status" text not null default 'open',
      "severity" text not null default 'medium',
      "priority_score" integer not null default 0,
      "recoverable_amount" numeric(14,2),
      "assigned_to" integer references "users" ("id") on delete set null,
      "due_at" timestamptz,
      "started_at" timestamptz,
      "resolved_at" timestamptz,
      "resolved_by" integer references "users" ("id") on delete set null,
      "resolution_note" text,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now()
    );

    create table if not exists "revenue_evidence_links" (
      "id" serial primary key not null,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "claim_id" text not null references "revenue_claims" ("id") on delete cascade,
      "claim_line_id" integer references "revenue_claim_lines" ("id") on delete cascade,
      "evidence_type" text not null,
      "source_ref" text not null,
      "source_label" text,
      "excerpt" text,
      "source_location" jsonb not null default '{}'::jsonb,
      "rule_ref" text,
      "source_url" text,
      "effective_from" text,
      "effective_to" text,
      "confidence" numeric(5,4),
      "created_at" timestamptz not null default now()
    );

    create table if not exists "revenue_clearinghouse_connections" (
      "id" serial primary key not null,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "provider" text not null default 'stedi',
      "mode" text not null default 'test',
      "status" text not null default 'not_configured',
      "credential_ref" text,
      "submitter_id" text,
      "webhook_destination_id" text,
      "capabilities" jsonb not null default '[]'::jsonb,
      "live_submission_enabled" boolean not null default false,
      "last_health_check_at" timestamptz,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      unique ("organization_id", "provider")
    );

    create table if not exists "revenue_claim_transmissions" (
      "id" serial primary key,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "claim_id" text not null unique references "revenue_claims" ("id") on delete cascade,
      "schema_version" text not null default 'stedi-837p-v3',
      "transmission_data" jsonb not null,
      "source" text not null default 'manual_verified',
      "verified_by" integer references "users" ("id") on delete set null,
      "verified_at" timestamptz,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now()
    );

    create table if not exists "revenue_claim_submissions" (
      "id" serial primary key,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "claim_id" text not null references "revenue_claims" ("id") on delete cascade,
      "provider" text not null default 'stedi',
      "mode" text not null,
      "status" text not null default 'queued',
      "idempotency_key" text not null,
      "payload_hash" text not null,
      "external_transaction_id" text,
      "correlation_id" text,
      "response_summary" jsonb not null default '{}'::jsonb,
      "last_error" text,
      "submitted_by" integer references "users" ("id") on delete set null,
      "submitted_at" timestamptz,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      unique ("organization_id", "provider", "idempotency_key")
    );

    create table if not exists "revenue_webhook_events" (
      "id" serial primary key,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "provider" text not null default 'stedi',
      "event_id" text not null,
      "event_type" text not null,
      "transaction_type" text,
      "transaction_id" text,
      "status" text not null default 'queued',
      "attempts" integer not null default 0,
      "next_attempt_at" timestamptz not null default now(),
      "lease_expires_at" timestamptz,
      "last_error" text,
      "payload" jsonb not null,
      "occurred_at" timestamptz not null,
      "received_at" timestamptz not null default now(),
      "processed_at" timestamptz,
      unique ("organization_id", "provider", "event_id")
    );

    create table if not exists "revenue_remittances" (
      "id" serial primary key,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "claim_id" text references "revenue_claims" ("id") on delete set null,
      "provider" text not null default 'stedi',
      "transaction_id" text not null,
      "patient_control_number" text not null,
      "payer_claim_control_number" text,
      "claim_status_code" text,
      "total_charge" numeric(14,2) not null default 0,
      "paid_amount" numeric(14,2) not null default 0,
      "patient_responsibility_amount" numeric(14,2) not null default 0,
      "summary" jsonb not null default '{}'::jsonb,
      "received_at" timestamptz not null default now(),
      unique ("organization_id", "provider", "transaction_id", "patient_control_number")
    );

    create table if not exists "revenue_line_remittances" (
      "id" serial primary key,
      "remittance_id" integer not null references "revenue_remittances" ("id") on delete cascade,
      "claim_line_id" integer references "revenue_claim_lines" ("id") on delete set null,
      "line_item_control_number" text,
      "procedure_code" text,
      "charge_amount" numeric(14,2) not null default 0,
      "paid_amount" numeric(14,2) not null default 0,
      "allowed_amount" numeric(14,2),
      "adjustments" jsonb not null default '[]'::jsonb,
      "created_at" timestamptz not null default now()
    );

    create table if not exists "revenue_connector_cursors" (
      "id" serial primary key,
      "organization_id" text not null references "revenue_organizations" ("id") on delete cascade,
      "provider" text not null,
      "response_cursor" text not null default '0',
      "era_cursor" text not null default '0',
      "last_polled_at" timestamptz,
      "last_error" text,
      "metadata" jsonb not null default '{}'::jsonb,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      unique ("organization_id", "provider")
    );

    alter table "revenue_webhook_events" add column if not exists "lease_expires_at" timestamptz;
    alter table "revenue_work_items" add column if not exists "started_at" timestamptz;
    alter table "revenue_work_items" add column if not exists "resolved_by" integer references "users" ("id") on delete set null;
    alter table "revenue_work_items" add column if not exists "resolution_note" text;

    create index if not exists "revenue_organization_members_user_idx" on "revenue_organization_members" ("user_id");
    create index if not exists "revenue_claims_org_status_idx" on "revenue_claims" ("organization_id", "status");
    create index if not exists "revenue_claims_org_created_idx" on "revenue_claims" ("organization_id", "created_at" desc);
    create index if not exists "revenue_claims_external_claim_idx" on "revenue_claims" ("external_claim_id") where "external_claim_id" is not null;
    create index if not exists "revenue_claim_lines_procedure_idx" on "revenue_claim_lines" ("procedure_code");
    create index if not exists "revenue_claim_events_claim_occurred_idx" on "revenue_claim_events" ("claim_id", "occurred_at" desc);
    create index if not exists "revenue_claim_events_org_received_idx" on "revenue_claim_events" ("organization_id", "received_at" desc);
    create unique index if not exists "revenue_claim_events_org_source_external_idx" on "revenue_claim_events" ("organization_id", "source", "external_event_id") where "external_event_id" is not null;
    create index if not exists "revenue_work_items_org_status_priority_idx" on "revenue_work_items" ("organization_id", "status", "priority_score" desc);
    create index if not exists "revenue_work_items_claim_status_idx" on "revenue_work_items" ("claim_id", "status");
    create index if not exists "revenue_evidence_links_claim_idx" on "revenue_evidence_links" ("claim_id");
    create index if not exists "revenue_claim_transmissions_org_idx" on "revenue_claim_transmissions" ("organization_id");
    create index if not exists "revenue_claim_submissions_claim_created_idx" on "revenue_claim_submissions" ("claim_id", "created_at" desc);
    create index if not exists "revenue_webhook_events_queue_idx" on "revenue_webhook_events" ("status", "next_attempt_at");
    create index if not exists "revenue_remittances_claim_idx" on "revenue_remittances" ("claim_id");
    create index if not exists "revenue_line_remittances_remittance_idx" on "revenue_line_remittances" ("remittance_id");
    create index if not exists "revenue_line_remittances_claim_line_idx" on "revenue_line_remittances" ("claim_line_id");
    create index if not exists "revenue_connector_cursors_org_provider_idx" on "revenue_connector_cursors" ("organization_id", "provider");

    alter table "revenue_organizations" enable row level security;
    alter table "revenue_organization_members" enable row level security;
    alter table "revenue_claims" enable row level security;
    alter table "revenue_claim_lines" enable row level security;
    alter table "revenue_claim_events" enable row level security;
    alter table "revenue_work_items" enable row level security;
    alter table "revenue_evidence_links" enable row level security;
    alter table "revenue_clearinghouse_connections" enable row level security;
    alter table "revenue_claim_transmissions" enable row level security;
    alter table "revenue_claim_submissions" enable row level security;
    alter table "revenue_webhook_events" enable row level security;
    alter table "revenue_remittances" enable row level security;
    alter table "revenue_line_remittances" enable row level security;
    alter table "revenue_connector_cursors" enable row level security;
  `);
}
