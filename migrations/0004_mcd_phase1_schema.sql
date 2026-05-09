-- CMS MCD Phase 1 schema: current Article, current LCD, and NCD staging + clean app tables.
-- Generated from local CSV headers in C:\Users\TekSoft\Downloads\all_data.
begin;
create extension if not exists "pgcrypto";

create table if not exists "mcd_import_batches" (
  "id" uuid primary key default gen_random_uuid(),
  "dataset_key" text not null,
  "dataset_scope" text not null,
  "source_file_name" text,
  "source_table_name" text,
  "source_path" text,
  "row_count" bigint,
  "checksum" text,
  "status" text not null default 'planned',
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "error_message" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);
create index if not exists "mcd_import_batches_dataset_status_idx" on "mcd_import_batches" ("dataset_key", "status", "created_at" desc);

create table if not exists "mcd_phase1_staging_manifest" (
  "id" uuid primary key default gen_random_uuid(),
  "dataset_key" text not null,
  "csv_table_name" text not null,
  "staging_table_name" text not null,
  "source_file_name" text not null,
  "local_upload_path" text not null,
  "expected_rows" bigint not null,
  "expected_columns" integer not null,
  "headers" jsonb not null,
  "notes" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "mcd_phase1_staging_manifest_unique" unique ("dataset_key", "csv_table_name")
);
alter table "mcd_phase1_staging_manifest" add column if not exists "notes" text;

create table if not exists "stg_mcd_current_article_article" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "article_type" text,
  "title" text,
  "article_pub_date" text,
  "article_eff_date" text,
  "article_end_date" text,
  "description" text,
  "other_comments" text,
  "sad_url" text,
  "status" text,
  "last_updated" text,
  "history_exp" text,
  "key_article" text,
  "icd9_covered_para" text,
  "icd9_noncovered_para" text,
  "revenue_para" text,
  "thirty_percent" text,
  "article_rev_end_date" text,
  "source_article_id" text,
  "date_retired" text,
  "keywords" text,
  "icd10_doc" text,
  "add_icd10_info" text,
  "cms_cov_policy" text,
  "display_id" text,
  "reference_article" text,
  "import_batch_id" uuid,
  "source_file" text default 'article.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article" enable row level security;
create index if not exists "stg_mcd_current_article_article_article_version_idx" on "stg_mcd_current_article_article" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_display_id_idx" on "stg_mcd_current_article_article" ("display_id");

create table if not exists "stg_mcd_current_article_article_future_retire" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "retire_dt" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_future_retire.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_future_retire" enable row level security;

create table if not exists "stg_mcd_current_article_article_related_documents" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "related_num" text,
  "r_article_id" text,
  "r_article_version" text,
  "r_lcd_id" text,
  "r_lcd_version" text,
  "r_contractor_id" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_related_documents.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_related_documents" enable row level security;
create index if not exists "stg_mcd_current_article_article_related_documents_657aeace" on "stg_mcd_current_article_article_related_documents" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_related_documents_e8272a3d" on "stg_mcd_current_article_article_related_documents" ("r_lcd_id");
create index if not exists "stg_mcd_current_article_article_related_documents_b7315011" on "stg_mcd_current_article_article_related_documents" ("r_article_id");

create table if not exists "stg_mcd_current_article_article_related_ncd_documents" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "related_num" text,
  "r_ncd_id" text,
  "r_ncd_version" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_related_ncd_documents.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_related_ncd_documents" enable row level security;
create index if not exists "stg_mcd_current_article_article_related_ncd_docum_d76c2b32" on "stg_mcd_current_article_article_related_ncd_documents" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_related_ncd_docum_e5b830cc" on "stg_mcd_current_article_article_related_ncd_documents" ("r_ncd_id");

create table if not exists "stg_mcd_current_article_article_related_source_icd9" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "related_num" text,
  "source_article_id" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_related_source_icd9.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_related_source_icd9" enable row level security;
create index if not exists "stg_mcd_current_article_article_related_source_ic_387fc8b3" on "stg_mcd_current_article_article_related_source_icd9" ("article_id", "article_version");

create table if not exists "stg_mcd_current_article_article_type_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "article_type_id" text,
  "description" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_type_lookup.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_type_lookup" enable row level security;

create table if not exists "stg_mcd_current_article_article_url_type_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "url_type_id" text,
  "description" text,
  "sort_order" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_url_type_lookup.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_url_type_lookup" enable row level security;

create table if not exists "stg_mcd_current_article_article_x_bill_code" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "bill_code_id" text,
  "bill_code_version" text,
  "last_updated" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_bill_code.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_bill_code" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_bill_code_artic_f261edf2" on "stg_mcd_current_article_article_x_bill_code" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_bill_code_bill_d22b94e4" on "stg_mcd_current_article_article_x_bill_code" ("bill_code_id");

create table if not exists "stg_mcd_current_article_article_x_code_table" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "article_type" text,
  "code_table_row" text,
  "brand_name" text,
  "eff_date" text,
  "end_date" text,
  "comments" text,
  "hcpc_code_id" text,
  "hcpc_code_version" text,
  "last_updated" text,
  "short_description" text,
  "long_description" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_code_table.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_code_table" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_code_table_arti_6b0e0db8" on "stg_mcd_current_article_article_x_code_table" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_code_table_hcpc_c1a839ba" on "stg_mcd_current_article_article_x_code_table" ("hcpc_code_id");

create table if not exists "stg_mcd_current_article_article_x_contractor" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "article_type" text,
  "contractor_id" text,
  "contractor_type_id" text,
  "contractor_version" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_contractor.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_contractor" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_contractor_arti_bd447127" on "stg_mcd_current_article_article_x_contractor" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_contractor_cont_a7b7ae31" on "stg_mcd_current_article_article_x_contractor" ("contractor_id");

create table if not exists "stg_mcd_current_article_article_x_hcpc_code" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "hcpc_code_id" text,
  "hcpc_code_version" text,
  "hcpc_code_group" text,
  "range" text,
  "last_updated" text,
  "long_description" text,
  "short_description" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_hcpc_code.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_hcpc_code" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_hcpc_code_artic_d62bf000" on "stg_mcd_current_article_article_x_hcpc_code" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_hcpc_code_artic_4db526ef" on "stg_mcd_current_article_article_x_hcpc_code" ("article_id", "article_version", "hcpc_code_group");
create index if not exists "stg_mcd_current_article_article_x_hcpc_code_hcpc_65299cd1" on "stg_mcd_current_article_article_x_hcpc_code" ("hcpc_code_id");

create table if not exists "stg_mcd_current_article_article_x_hcpc_code_group" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "hcpc_code_group" text,
  "paragraph" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_hcpc_code_group.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_hcpc_code_group" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_hcpc_code_group_590eb959" on "stg_mcd_current_article_article_x_hcpc_code_group" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_hcpc_code_group_f98bf55b" on "stg_mcd_current_article_article_x_hcpc_code_group" ("article_id", "article_version", "hcpc_code_group");

create table if not exists "stg_mcd_current_article_article_x_hcpc_modifier" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "hcpc_modifier_code_id" text,
  "hcpc_modifier_code_version" text,
  "hcpc_modifier_group" text,
  "last_updated" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_hcpc_modifier.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_hcpc_modifier" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_hcpc_modifier_a_c49a21b5" on "stg_mcd_current_article_article_x_hcpc_modifier" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_hcpc_modifier_h_389fca68" on "stg_mcd_current_article_article_x_hcpc_modifier" ("hcpc_modifier_code_id");

create table if not exists "stg_mcd_current_article_article_x_hcpc_modifier_group" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "hcpc_modifier_group" text,
  "paragraph" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_hcpc_modifier_group.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_hcpc_modifier_group" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_hcpc_modifier_g_3e0c9a7c" on "stg_mcd_current_article_article_x_hcpc_modifier_group" ("article_id", "article_version");

create table if not exists "stg_mcd_current_article_article_x_icd10_covered" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "icd10_code_id" text,
  "icd10_code_version" text,
  "icd10_covered_group" text,
  "range" text,
  "last_updated" text,
  "sort_order" text,
  "description" text,
  "asterisk" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_icd10_covered.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_icd10_covered" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_icd10_covered_a_39e63c7e" on "stg_mcd_current_article_article_x_icd10_covered" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_icd10_covered_a_abb36c7b" on "stg_mcd_current_article_article_x_icd10_covered" ("article_id", "article_version", "icd10_covered_group");
create index if not exists "stg_mcd_current_article_article_x_icd10_covered_i_6cab0dd4" on "stg_mcd_current_article_article_x_icd10_covered" ("icd10_code_id");

create table if not exists "stg_mcd_current_article_article_x_icd10_covered_group" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "icd10_covered_group" text,
  "paragraph" text,
  "last_updated" text,
  "icd10_covered_ast" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_icd10_covered_group.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_icd10_covered_group" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_icd10_covered_g_325152b3" on "stg_mcd_current_article_article_x_icd10_covered_group" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_icd10_covered_g_8897fec9" on "stg_mcd_current_article_article_x_icd10_covered_group" ("article_id", "article_version", "icd10_covered_group");

create table if not exists "stg_mcd_current_article_article_x_icd10_noncovered" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "icd10_code_id" text,
  "icd10_code_version" text,
  "icd10_noncovered_group" text,
  "range" text,
  "last_updated" text,
  "sort_order" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_icd10_noncovered.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_icd10_noncovered" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_icd10_noncovere_504c99ea" on "stg_mcd_current_article_article_x_icd10_noncovered" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_icd10_noncovere_72161aa1" on "stg_mcd_current_article_article_x_icd10_noncovered" ("article_id", "article_version", "icd10_noncovered_group");
create index if not exists "stg_mcd_current_article_article_x_icd10_noncovere_1c4fce48" on "stg_mcd_current_article_article_x_icd10_noncovered" ("icd10_code_id");

create table if not exists "stg_mcd_current_article_article_x_icd10_noncovered_group" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "icd10_noncovered_group" text,
  "paragraph" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_icd10_noncovered_group.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_icd10_noncovered_group" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_icd10_noncovere_46e16267" on "stg_mcd_current_article_article_x_icd10_noncovered_group" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_icd10_noncovere_09f7a69d" on "stg_mcd_current_article_article_x_icd10_noncovered_group" ("article_id", "article_version", "icd10_noncovered_group");

create table if not exists "stg_mcd_current_article_article_x_icd10_pcs_code" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "range" text,
  "last_updated" text,
  "sort_order" text,
  "icd10_pcs_code_id" text,
  "icd10_pcs_code_version" text,
  "icd10_pcs_code_group" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_icd10_pcs_code.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_icd10_pcs_code" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_icd10_pcs_code_a0bd4355" on "stg_mcd_current_article_article_x_icd10_pcs_code" ("article_id", "article_version");

create table if not exists "stg_mcd_current_article_article_x_icd10_pcs_code_group" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "last_updated" text,
  "icd10_pcs_code_group" text,
  "paragraph" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_icd10_pcs_code_group.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_icd10_pcs_code_group" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_icd10_pcs_code_6471aef2" on "stg_mcd_current_article_article_x_icd10_pcs_code_group" ("article_id", "article_version");

create table if not exists "stg_mcd_current_article_article_x_other_coding_group" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "other_coding_group" text,
  "paragraph" text,
  "codes" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_other_coding_group.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_other_coding_group" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_other_coding_gr_c8036238" on "stg_mcd_current_article_article_x_other_coding_group" ("article_id", "article_version");

create table if not exists "stg_mcd_current_article_article_x_primary_jurisdiction" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "state_id" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_primary_jurisdiction.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_primary_jurisdiction" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_primary_jurisdi_a32add15" on "stg_mcd_current_article_article_x_primary_jurisdiction" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_primary_jurisdi_56853369" on "stg_mcd_current_article_article_x_primary_jurisdiction" ("state_id");

create table if not exists "stg_mcd_current_article_article_x_response_to_comment" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "rtc_num" text,
  "comment" text,
  "response" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_response_to_comment.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_response_to_comment" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_response_to_com_d9a36eec" on "stg_mcd_current_article_article_x_response_to_comment" ("article_id", "article_version");

create table if not exists "stg_mcd_current_article_article_x_revenue_code" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "revenue_code_id" text,
  "revenue_code_version" text,
  "range" text,
  "last_updated" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_revenue_code.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_revenue_code" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_revenue_code_ar_663bae90" on "stg_mcd_current_article_article_x_revenue_code" ("article_id", "article_version");
create index if not exists "stg_mcd_current_article_article_x_revenue_code_re_21628672" on "stg_mcd_current_article_article_x_revenue_code" ("revenue_code_id");

create table if not exists "stg_mcd_current_article_article_x_revision_history" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "rev_hist_num" text,
  "rev_hist_date" text,
  "rev_hist_exp" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_revision_history.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_revision_history" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_revision_histor_225abef3" on "stg_mcd_current_article_article_x_revision_history" ("article_id", "article_version");

create table if not exists "stg_mcd_current_article_article_x_sticky_note" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "sticky_note_version" text,
  "sticky_note" text,
  "sticky_note_dt" text,
  "sticky_note_posting_dt" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_sticky_note.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_sticky_note" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_sticky_note_art_e592a3d3" on "stg_mcd_current_article_article_x_sticky_note" ("article_id", "article_version");

create table if not exists "stg_mcd_current_article_article_x_urls" (
  "id" uuid primary key default gen_random_uuid(),
  "article_id" text,
  "article_version" text,
  "url_type_id" text,
  "url_id" text,
  "url" text,
  "url_name" text,
  "sort_order" text,
  "last_updated" text,
  "url_description" text,
  "import_batch_id" uuid,
  "source_file" text default 'article_x_urls.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_article_x_urls" enable row level security;
create index if not exists "stg_mcd_current_article_article_x_urls_article_version_idx" on "stg_mcd_current_article_article_x_urls" ("article_id", "article_version");

create table if not exists "stg_mcd_current_article_contractor" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_id" text,
  "contractor_type_id" text,
  "contractor_version" text,
  "contractor_bus_name" text,
  "contractor_number" text,
  "dmerc_rgn" text,
  "address1" text,
  "address2" text,
  "address3" text,
  "city" text,
  "state_id" text,
  "zipcode" text,
  "phone" text,
  "fax" text,
  "status" text,
  "last_updated" text,
  "url" text,
  "email" text,
  "ignore" text,
  "status_flag" text,
  "cmd_name" text,
  "cmd_title" text,
  "contractor_subtype_id" text,
  "import_batch_id" uuid,
  "source_file" text default 'contractor.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_contractor" enable row level security;
create index if not exists "stg_mcd_current_article_contractor_contractor_id_idx" on "stg_mcd_current_article_contractor" ("contractor_id");
create index if not exists "stg_mcd_current_article_contractor_state_id_idx" on "stg_mcd_current_article_contractor" ("state_id");

create table if not exists "stg_mcd_current_article_contractor_jurisdiction" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_id" text,
  "contractor_type_id" text,
  "contractor_version" text,
  "state_id" text,
  "last_updated" text,
  "active_date" text,
  "term_date" text,
  "import_batch_id" uuid,
  "source_file" text default 'contractor_jurisdiction.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_contractor_jurisdiction" enable row level security;
create index if not exists "stg_mcd_current_article_contractor_jurisdiction_c_82352d84" on "stg_mcd_current_article_contractor_jurisdiction" ("contractor_id");
create index if not exists "stg_mcd_current_article_contractor_jurisdiction_s_e8dd1e09" on "stg_mcd_current_article_contractor_jurisdiction" ("state_id");

create table if not exists "stg_mcd_current_article_contractor_oversight" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_id" text,
  "contractor_type_id" text,
  "contractor_version" text,
  "region_id" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'contractor_oversight.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_contractor_oversight" enable row level security;
create index if not exists "stg_mcd_current_article_contractor_oversight_cont_9ae380c5" on "stg_mcd_current_article_contractor_oversight" ("contractor_id");

create table if not exists "stg_mcd_current_article_contractor_subtype_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_subtype_id" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'contractor_subtype_lookup.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_contractor_subtype_lookup" enable row level security;

create table if not exists "stg_mcd_current_article_contractor_type_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_type_id" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'contractor_type_lookup.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_contractor_type_lookup" enable row level security;

create table if not exists "stg_mcd_current_article_dmerc_region_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "region_id" text,
  "description" text,
  "psc_description" text,
  "mac_description" text,
  "super_mac_description" text,
  "import_batch_id" uuid,
  "source_file" text default 'dmerc_region_lookup.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_dmerc_region_lookup" enable row level security;

create table if not exists "stg_mcd_current_article_region_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "region_id" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'region_lookup.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_region_lookup" enable row level security;

create table if not exists "stg_mcd_current_article_state_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "state_id" text,
  "state_abbrev" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'state_lookup.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_state_lookup" enable row level security;
create index if not exists "stg_mcd_current_article_state_lookup_state_id_idx" on "stg_mcd_current_article_state_lookup" ("state_id");

create table if not exists "stg_mcd_current_article_state_x_region" (
  "id" uuid primary key default gen_random_uuid(),
  "state_id" text,
  "region_id" text,
  "import_batch_id" uuid,
  "source_file" text default 'state_x_region.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_state_x_region" enable row level security;
create index if not exists "stg_mcd_current_article_state_x_region_state_id_idx" on "stg_mcd_current_article_state_x_region" ("state_id");

create table if not exists "stg_mcd_current_article_update_period" (
  "id" uuid primary key default gen_random_uuid(),
  "period_id" text,
  "begin_date" text,
  "dis_end_date" text,
  "import_batch_id" uuid,
  "source_file" text default 'update_period.csv',
  "source_dataset" text default 'current_article',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_article_update_period" enable row level security;

create table if not exists "stg_mcd_current_lcd_contractor" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_id" text,
  "contractor_type_id" text,
  "contractor_version" text,
  "contractor_bus_name" text,
  "contractor_number" text,
  "dmerc_rgn" text,
  "address1" text,
  "address2" text,
  "address3" text,
  "city" text,
  "state_id" text,
  "zipcode" text,
  "phone" text,
  "fax" text,
  "status" text,
  "last_updated" text,
  "url" text,
  "email" text,
  "ignore" text,
  "status_flag" text,
  "cmd_name" text,
  "cmd_title" text,
  "contractor_subtype_id" text,
  "import_batch_id" uuid,
  "source_file" text default 'contractor.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_contractor" enable row level security;
create index if not exists "stg_mcd_current_lcd_contractor_contractor_id_idx" on "stg_mcd_current_lcd_contractor" ("contractor_id");
create index if not exists "stg_mcd_current_lcd_contractor_state_id_idx" on "stg_mcd_current_lcd_contractor" ("state_id");

create table if not exists "stg_mcd_current_lcd_contractor_jurisdiction" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_id" text,
  "contractor_type_id" text,
  "contractor_version" text,
  "state_id" text,
  "last_updated" text,
  "active_date" text,
  "term_date" text,
  "import_batch_id" uuid,
  "source_file" text default 'contractor_jurisdiction.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_contractor_jurisdiction" enable row level security;
create index if not exists "stg_mcd_current_lcd_contractor_jurisdiction_contr_04dd20d7" on "stg_mcd_current_lcd_contractor_jurisdiction" ("contractor_id");
create index if not exists "stg_mcd_current_lcd_contractor_jurisdiction_state_id_idx" on "stg_mcd_current_lcd_contractor_jurisdiction" ("state_id");

create table if not exists "stg_mcd_current_lcd_contractor_oversight" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_id" text,
  "contractor_type_id" text,
  "contractor_version" text,
  "region_id" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'contractor_oversight.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_contractor_oversight" enable row level security;
create index if not exists "stg_mcd_current_lcd_contractor_oversight_contractor_id_idx" on "stg_mcd_current_lcd_contractor_oversight" ("contractor_id");

create table if not exists "stg_mcd_current_lcd_contractor_subtype_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_subtype_id" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'contractor_subtype_lookup.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_contractor_subtype_lookup" enable row level security;

create table if not exists "stg_mcd_current_lcd_contractor_type_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_type_id" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'contractor_type_lookup.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_contractor_type_lookup" enable row level security;

create table if not exists "stg_mcd_current_lcd_dmerc_region_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "region_id" text,
  "description" text,
  "psc_description" text,
  "mac_description" text,
  "super_mac_description" text,
  "import_batch_id" uuid,
  "source_file" text default 'dmerc_region_lookup.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_dmerc_region_lookup" enable row level security;

create table if not exists "stg_mcd_current_lcd_draft_contact_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "contact_id" text,
  "email_address" text,
  "first_name" text,
  "middle_initial" text,
  "last_name" text,
  "phone" text,
  "address1" text,
  "address2" text,
  "address3" text,
  "city" text,
  "state_id" text,
  "zipcode" text,
  "last_updated" text,
  "p_ext" text,
  "import_batch_id" uuid,
  "source_file" text default 'draft_contact_lookup.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_draft_contact_lookup" enable row level security;
create index if not exists "stg_mcd_current_lcd_draft_contact_lookup_state_id_idx" on "stg_mcd_current_lcd_draft_contact_lookup" ("state_id");

create table if not exists "stg_mcd_current_lcd_lcd" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "title" text,
  "determination_number" text,
  "orig_det_eff_date" text,
  "ent_det_end_date" text,
  "rev_eff_date" text,
  "rev_end_date" text,
  "indication" text,
  "diagnoses_support" text,
  "icd9_dont_support_para" text,
  "icd9_dont_support_ast" text,
  "diagnoses_dont_support" text,
  "coding_guidelines" text,
  "doc_reqs" text,
  "appendices" text,
  "util_guide" text,
  "source_info" text,
  "adv_meeting" text,
  "comment_start_dt" text,
  "comment_end_dt" text,
  "notice_start_dt" text,
  "rev_hist_num" text,
  "history_exp" text,
  "last_reviewed_on" text,
  "status" text,
  "last_updated" text,
  "cms_cov_policy" text,
  "display_id" text,
  "draft_contact" text,
  "revenue_para" text,
  "thirty_percent" text,
  "keywords" text,
  "associated_info" text,
  "notice_end_dt" text,
  "date_retired" text,
  "draft_released_date" text,
  "source_lcd_id" text,
  "add_icd10_info" text,
  "icd10_doc" text,
  "synopsis_changes" text,
  "bibliography" text,
  "summary_of_evidence" text,
  "analysis_of_evidence" text,
  "mcd_publish_date" text,
  "issue" text,
  "issue_change" text,
  "mac_initiated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_lcd_version_idx" on "stg_mcd_current_lcd_lcd" ("lcd_id", "lcd_version");
create index if not exists "stg_mcd_current_lcd_lcd_display_id_idx" on "stg_mcd_current_lcd_lcd" ("display_id");

create table if not exists "stg_mcd_current_lcd_lcd_future_retire" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "retire_dt" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_future_retire.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_future_retire" enable row level security;

create table if not exists "stg_mcd_current_lcd_lcd_related_documents" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "related_num" text,
  "r_article_id" text,
  "r_article_version" text,
  "r_lcd_id" text,
  "r_lcd_version" text,
  "r_contractor_id" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_related_documents.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_related_documents" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_related_documents_lcd_version_idx" on "stg_mcd_current_lcd_lcd_related_documents" ("lcd_id", "lcd_version");
create index if not exists "stg_mcd_current_lcd_lcd_related_documents_r_lcd_id_idx" on "stg_mcd_current_lcd_lcd_related_documents" ("r_lcd_id");
create index if not exists "stg_mcd_current_lcd_lcd_related_documents_r_article_id_idx" on "stg_mcd_current_lcd_lcd_related_documents" ("r_article_id");

create table if not exists "stg_mcd_current_lcd_lcd_related_ncd_documents" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "related_num" text,
  "r_ncd_id" text,
  "r_ncd_version" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_related_ncd_documents.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_related_ncd_documents" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_related_ncd_documents_lcd_072b9ca4" on "stg_mcd_current_lcd_lcd_related_ncd_documents" ("lcd_id", "lcd_version");
create index if not exists "stg_mcd_current_lcd_lcd_related_ncd_documents_r_ncd_id_idx" on "stg_mcd_current_lcd_lcd_related_ncd_documents" ("r_ncd_id");

create table if not exists "stg_mcd_current_lcd_lcd_related_source_icd9" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "related_num" text,
  "source_lcd_id" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_related_source_icd9.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_related_source_icd9" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_related_source_icd9_lcd_v_2b8cd83d" on "stg_mcd_current_lcd_lcd_related_source_icd9" ("lcd_id", "lcd_version");

create table if not exists "stg_mcd_current_lcd_lcd_url_type_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "url_type_id" text,
  "description" text,
  "sort_order" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_url_type_lookup.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_url_type_lookup" enable row level security;

create table if not exists "stg_mcd_current_lcd_lcd_x_advisory_committee" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "meeting_id" text,
  "meeting_date" text,
  "meeting_info" text,
  "sort_order" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_advisory_committee.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_advisory_committee" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_advisory_committee_lcd_2183f54c" on "stg_mcd_current_lcd_lcd_x_advisory_committee" ("lcd_id", "lcd_version");

create table if not exists "stg_mcd_current_lcd_lcd_x_contractor" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "contractor_id" text,
  "contractor_type_id" text,
  "contractor_version" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_contractor.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_contractor" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_contractor_lcd_version_idx" on "stg_mcd_current_lcd_lcd_x_contractor" ("lcd_id", "lcd_version");
create index if not exists "stg_mcd_current_lcd_lcd_x_contractor_contractor_id_idx" on "stg_mcd_current_lcd_lcd_x_contractor" ("contractor_id");

create table if not exists "stg_mcd_current_lcd_lcd_x_hcpc_code" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "hcpc_code_id" text,
  "hcpc_code_version" text,
  "hcpc_code_group" text,
  "range" text,
  "last_updated" text,
  "long_description" text,
  "short_description" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_hcpc_code.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_hcpc_code" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_hcpc_code_lcd_version_idx" on "stg_mcd_current_lcd_lcd_x_hcpc_code" ("lcd_id", "lcd_version");
create index if not exists "stg_mcd_current_lcd_lcd_x_hcpc_code_lcd_group_hcpc_idx" on "stg_mcd_current_lcd_lcd_x_hcpc_code" ("lcd_id", "lcd_version", "hcpc_code_group");
create index if not exists "stg_mcd_current_lcd_lcd_x_hcpc_code_hcpc_code_id_idx" on "stg_mcd_current_lcd_lcd_x_hcpc_code" ("hcpc_code_id");

create table if not exists "stg_mcd_current_lcd_lcd_x_hcpc_code_group" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "hcpc_code_group" text,
  "paragraph" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_hcpc_code_group.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_hcpc_code_group" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_hcpc_code_group_lcd_version_idx" on "stg_mcd_current_lcd_lcd_x_hcpc_code_group" ("lcd_id", "lcd_version");
create index if not exists "stg_mcd_current_lcd_lcd_x_hcpc_code_group_lcd_gro_01a87ecf" on "stg_mcd_current_lcd_lcd_x_hcpc_code_group" ("lcd_id", "lcd_version", "hcpc_code_group");

create table if not exists "stg_mcd_current_lcd_lcd_x_primary_jurisdiction" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "state_id" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_primary_jurisdiction.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_primary_jurisdiction" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_primary_jurisdiction_lc_cedf0bde" on "stg_mcd_current_lcd_lcd_x_primary_jurisdiction" ("lcd_id", "lcd_version");
create index if not exists "stg_mcd_current_lcd_lcd_x_primary_jurisdiction_st_8149daef" on "stg_mcd_current_lcd_lcd_x_primary_jurisdiction" ("state_id");

create table if not exists "stg_mcd_current_lcd_lcd_x_reason_change" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "reason_change_id" text,
  "reason_change_version" text,
  "last_updated" text,
  "reason_change_other" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_reason_change.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_reason_change" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_reason_change_lcd_version_idx" on "stg_mcd_current_lcd_lcd_x_reason_change" ("lcd_id", "lcd_version");

create table if not exists "stg_mcd_current_lcd_lcd_x_requestor_letters" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "letter_id" text,
  "requestor_name" text,
  "letter_path" text,
  "size" text,
  "sort_order" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_requestor_letters.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_requestor_letters" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_requestor_letters_lcd_v_4ef5215e" on "stg_mcd_current_lcd_lcd_x_requestor_letters" ("lcd_id", "lcd_version");

create table if not exists "stg_mcd_current_lcd_lcd_x_revision_history" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "rev_hist_num" text,
  "rev_hist_date" text,
  "rev_hist_exp" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_revision_history.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_revision_history" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_revision_history_lcd_version_idx" on "stg_mcd_current_lcd_lcd_x_revision_history" ("lcd_id", "lcd_version");

create table if not exists "stg_mcd_current_lcd_lcd_x_sticky_note" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "sticky_note_version" text,
  "sticky_note" text,
  "sticky_note_dt" text,
  "sticky_note_posting_dt" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_sticky_note.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_sticky_note" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_sticky_note_lcd_version_idx" on "stg_mcd_current_lcd_lcd_x_sticky_note" ("lcd_id", "lcd_version");

create table if not exists "stg_mcd_current_lcd_lcd_x_synopsis_changes_fields" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "synopsis_changes_field_id" text,
  "last_updated" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_synopsis_changes_fields.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_synopsis_changes_fields" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_synopsis_changes_fields_f62adc33" on "stg_mcd_current_lcd_lcd_x_synopsis_changes_fields" ("lcd_id", "lcd_version");

create table if not exists "stg_mcd_current_lcd_lcd_x_urls" (
  "id" uuid primary key default gen_random_uuid(),
  "lcd_id" text,
  "lcd_version" text,
  "url_type_id" text,
  "url_id" text,
  "url" text,
  "url_name" text,
  "sort_order" text,
  "last_updated" text,
  "url_description" text,
  "import_batch_id" uuid,
  "source_file" text default 'lcd_x_urls.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_lcd_x_urls" enable row level security;
create index if not exists "stg_mcd_current_lcd_lcd_x_urls_lcd_version_idx" on "stg_mcd_current_lcd_lcd_x_urls" ("lcd_id", "lcd_version");

create table if not exists "stg_mcd_current_lcd_reason_change_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "reason_change_id" text,
  "reason_change_version" text,
  "description" text,
  "last_updated" text,
  "sort_order" text,
  "import_batch_id" uuid,
  "source_file" text default 'reason_change_lookup.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_reason_change_lookup" enable row level security;

create table if not exists "stg_mcd_current_lcd_region_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "region_id" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'region_lookup.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_region_lookup" enable row level security;

create table if not exists "stg_mcd_current_lcd_state_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "state_id" text,
  "state_abbrev" text,
  "description" text,
  "import_batch_id" uuid,
  "source_file" text default 'state_lookup.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_state_lookup" enable row level security;
create index if not exists "stg_mcd_current_lcd_state_lookup_state_id_idx" on "stg_mcd_current_lcd_state_lookup" ("state_id");

create table if not exists "stg_mcd_current_lcd_state_x_region" (
  "id" uuid primary key default gen_random_uuid(),
  "state_id" text,
  "region_id" text,
  "import_batch_id" uuid,
  "source_file" text default 'state_x_region.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_state_x_region" enable row level security;
create index if not exists "stg_mcd_current_lcd_state_x_region_state_id_idx" on "stg_mcd_current_lcd_state_x_region" ("state_id");

create table if not exists "stg_mcd_current_lcd_synopsis_changes_fields_lookup" (
  "id" uuid primary key default gen_random_uuid(),
  "synopsis_changes_field_id" text,
  "field_name" text,
  "field_anchor" text,
  "mcd_field_name" text,
  "mcd_field_anchor" text,
  "import_batch_id" uuid,
  "source_file" text default 'synopsis_changes_fields_lookup.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_synopsis_changes_fields_lookup" enable row level security;

create table if not exists "stg_mcd_current_lcd_update_period" (
  "id" uuid primary key default gen_random_uuid(),
  "period_id" text,
  "begin_date" text,
  "dis_end_date" text,
  "import_batch_id" uuid,
  "source_file" text default 'update_period.csv',
  "source_dataset" text default 'current_lcd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_current_lcd_update_period" enable row level security;

create table if not exists "stg_mcd_ncd_ncd_bnft_ctgry_ref" (
  "id" uuid primary key default gen_random_uuid(),
  "bnft_ctgry_cd" text,
  "bnft_ctgry_desc" text,
  "import_batch_id" uuid,
  "source_file" text default 'ncd_bnft_ctgry_ref.csv',
  "source_dataset" text default 'ncd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_ncd_ncd_bnft_ctgry_ref" enable row level security;

create table if not exists "stg_mcd_ncd_ncd_pblctn_ref" (
  "id" uuid primary key default gen_random_uuid(),
  "pblctn_cd" text,
  "pblctn_num" text,
  "pblctn_title" text,
  "import_batch_id" uuid,
  "source_file" text default 'ncd_pblctn_ref.csv',
  "source_dataset" text default 'ncd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_ncd_ncd_pblctn_ref" enable row level security;

create table if not exists "stg_mcd_ncd_ncd_trkg" (
  "id" uuid primary key default gen_random_uuid(),
  "NCD_id" text,
  "NCD_vrsn_num" text,
  "natl_cvrg_type" text,
  "cvrg_lvl_cd" text,
  "NCD_mnl_sect" text,
  "NCD_mnl_sect_title" text,
  "NCD_efctv_dt" text,
  "NCD_impltn_dt" text,
  "NCD_trmntn_dt" text,
  "itm_srvc_desc" text,
  "indctn_lmtn" text,
  "xref_txt" text,
  "othr_txt" text,
  "trnsmtl_num" text,
  "trnsmtl_issnc_dt" text,
  "trnsmtl_url" text,
  "chg_rqst_num" text,
  "pblctn_cd" text,
  "rev_hstry" text,
  "under_rvw" text,
  "creatd_tmstmp" text,
  "last_updt_tmstmp" text,
  "last_clrnc_tmstmp" text,
  "NCD_lab" text,
  "ncd_keyword" text,
  "NCD_AMA" text,
  "import_batch_id" uuid,
  "source_file" text default 'ncd_trkg.csv',
  "source_dataset" text default 'ncd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_ncd_ncd_trkg" enable row level security;
create index if not exists "stg_mcd_ncd_ncd_trkg_ncd_version_idx" on "stg_mcd_ncd_ncd_trkg" ("NCD_id", "NCD_vrsn_num");

create table if not exists "stg_mcd_ncd_ncd_trkg_bnft_xref" (
  "id" uuid primary key default gen_random_uuid(),
  "NCD_id" text,
  "NCD_vrsn_num" text,
  "bnft_ctgry_cd" text,
  "creatd_tmstmp" text,
  "last_updt_tmstmp" text,
  "import_batch_id" uuid,
  "source_file" text default 'ncd_trkg_bnft_xref.csv',
  "source_dataset" text default 'ncd',
  "imported_at" timestamptz not null default now(),
  "raw_row_hash" text
);
alter table "stg_mcd_ncd_ncd_trkg_bnft_xref" enable row level security;
create index if not exists "stg_mcd_ncd_ncd_trkg_bnft_xref_ncd_version_idx" on "stg_mcd_ncd_ncd_trkg_bnft_xref" ("NCD_id", "NCD_vrsn_num");

create table if not exists "mcd_contractors" (
  "id" uuid primary key default gen_random_uuid(),
  "cms_contractor_id" text not null,
  "contractor_type_id" text,
  "contractor_version" text,
  "contractor_number" text,
  "contractor_name" text not null,
  "contractor_type" text,
  "contractor_subtype" text,
  "dmerc_region" text,
  "state_id" text,
  "state_code" text,
  "status" text,
  "url" text,
  "email" text,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "mcd_contractors_cms_key_unique" unique ("cms_contractor_id", "contractor_type_id", "contractor_version")
);

create table if not exists "mcd_states" (
  "id" uuid primary key default gen_random_uuid(),
  "cms_state_id" text not null unique,
  "state_code" text,
  "state_name" text,
  "region_id" text,
  "region_name" text,
  "dmerc_region_id" text,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create table if not exists "mcd_contractor_jurisdictions" (
  "id" uuid primary key default gen_random_uuid(),
  "contractor_id" uuid references "mcd_contractors" ("id") on delete cascade,
  "cms_contractor_id" text not null,
  "contractor_type_id" text,
  "contractor_version" text,
  "cms_state_id" text,
  "state_code" text,
  "active_date" date,
  "term_date" date,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create table if not exists "mcd_documents" (
  "id" uuid primary key default gen_random_uuid(),
  "document_type" text not null,
  "cms_document_id" text not null,
  "display_id" text,
  "version" text,
  "title" text not null,
  "article_type" text,
  "status" text,
  "is_current" boolean not null default true,
  "is_retired" boolean not null default false,
  "source_dataset" text not null,
  "effective_date" date,
  "end_date" date,
  "retirement_date" date,
  "future_retirement_date" date,
  "publication_date" date,
  "last_reviewed_on" date,
  "last_updated_at" timestamptz,
  "mcd_publish_date" date,
  "keywords" text,
  "summary_text" text,
  "full_text" text,
  "raw_data" jsonb not null default '{}'::jsonb,
  "search_text" text,
  "search_vector" tsvector generated always as (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("display_id", '') || ' ' || coalesce("keywords", '') || ' ' || coalesce("search_text", ''))) stored,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "mcd_documents_source_unique" unique ("document_type", "cms_document_id", "version", "source_dataset")
);

create table if not exists "mcd_document_contractors" (
  "id" uuid primary key default gen_random_uuid(),
  "document_id" uuid references "mcd_documents" ("id") on delete cascade,
  "contractor_id" uuid references "mcd_contractors" ("id") on delete set null,
  "cms_contractor_id" text not null,
  "contractor_type_id" text,
  "contractor_version" text,
  "source_dataset" text not null,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create table if not exists "mcd_document_jurisdictions" (
  "id" uuid primary key default gen_random_uuid(),
  "document_id" uuid references "mcd_documents" ("id") on delete cascade,
  "cms_state_id" text,
  "state_code" text,
  "source_dataset" text not null,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create table if not exists "mcd_document_urls" (
  "id" uuid primary key default gen_random_uuid(),
  "document_id" uuid references "mcd_documents" ("id") on delete cascade,
  "url_type" text,
  "url" text not null,
  "title" text,
  "source_dataset" text not null,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create table if not exists "mcd_document_relationships" (
  "id" uuid primary key default gen_random_uuid(),
  "source_document_id" uuid references "mcd_documents" ("id") on delete cascade,
  "source_document_type" text not null,
  "source_cms_document_id" text not null,
  "source_version" text,
  "target_document_type" text not null,
  "target_cms_document_id" text,
  "target_display_id" text,
  "target_version" text,
  "target_contractor_id" text,
  "relationship_type" text not null,
  "related_num" text,
  "source_dataset" text not null,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create table if not exists "mcd_document_revisions" (
  "id" uuid primary key default gen_random_uuid(),
  "document_id" uuid references "mcd_documents" ("id") on delete cascade,
  "document_type" text not null,
  "cms_document_id" text not null,
  "version" text,
  "revision_number" text,
  "revision_date" date,
  "revision_text" text,
  "source_dataset" text not null,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create table if not exists "mcd_code_groups" (
  "id" uuid primary key default gen_random_uuid(),
  "document_id" uuid references "mcd_documents" ("id") on delete cascade,
  "document_type" text not null,
  "cms_document_id" text not null,
  "version" text,
  "code_type" text not null,
  "group_number" text not null,
  "group_title" text,
  "paragraph_text" text,
  "asterisk_text" text,
  "source_dataset" text not null,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  constraint "mcd_code_groups_source_unique" unique ("document_type", "cms_document_id", "version", "code_type", "group_number", "source_dataset")
);

create table if not exists "mcd_document_codes" (
  "id" bigserial primary key,
  "document_id" uuid references "mcd_documents" ("id") on delete cascade,
  "document_type" text not null,
  "cms_document_id" text not null,
  "display_id" text,
  "version" text,
  "source_dataset" text not null,
  "code_type" text not null,
  "code" text not null,
  "code_version" text,
  "code_description" text,
  "short_description" text,
  "relationship_type" text not null,
  "group_number" text,
  "range_flag" text,
  "sort_order" integer,
  "asterisk" text,
  "effective_date" date,
  "end_date" date,
  "raw_data" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create table if not exists "mcd_coverage_rules" (
  "id" bigserial primary key,
  "article_document_id" uuid references "mcd_documents" ("id") on delete cascade,
  "related_lcd_document_id" uuid references "mcd_documents" ("id") on delete set null,
  "related_ncd_document_id" uuid references "mcd_documents" ("id") on delete set null,
  "article_id" text not null,
  "article_version" text not null,
  "article_display_id" text,
  "cpt_hcpcs_code" text,
  "cpt_hcpcs_description" text,
  "icd10_code" text,
  "icd10_description" text,
  "icd10_relationship" text not null,
  "modifier_code" text,
  "revenue_code" text,
  "bill_code" text,
  "group_number" text,
  "group_text" text,
  "contractor_id" uuid references "mcd_contractors" ("id") on delete set null,
  "cms_contractor_id" text,
  "state_code" text,
  "jurisdiction_code" text,
  "effective_date" date,
  "end_date" date,
  "is_current" boolean not null default true,
  "evidence_level" text not null default 'article_group',
  "source_dataset" text not null,
  "raw_evidence" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create table if not exists "mcd_icd_cpt_crosswalk" (
  "id" bigserial primary key,
  "icd10_code" text not null,
  "icd10_description" text,
  "cpt_hcpcs_code" text not null,
  "cpt_hcpcs_description" text,
  "relationship_type" text not null,
  "confidence_score" numeric(5,4) not null default 0.5000,
  "confidence_reason" text,
  "evidence_level" text not null,
  "article_document_id" uuid references "mcd_documents" ("id") on delete set null,
  "lcd_document_id" uuid references "mcd_documents" ("id") on delete set null,
  "ncd_document_id" uuid references "mcd_documents" ("id") on delete set null,
  "article_display_id" text,
  "lcd_display_id" text,
  "ncd_display_id" text,
  "contractor_id" uuid references "mcd_contractors" ("id") on delete set null,
  "cms_contractor_id" text,
  "state_code" text,
  "jurisdiction_code" text,
  "group_number" text,
  "effective_date" date,
  "end_date" date,
  "is_current" boolean not null default true,
  "source_count" integer not null default 1,
  "raw_evidence" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create table if not exists "mcd_search_index" (
  "id" bigserial primary key,
  "document_id" uuid references "mcd_documents" ("id") on delete cascade,
  "document_type" text not null,
  "display_id" text,
  "cms_document_id" text,
  "version" text,
  "title" text not null,
  "contractor_names" jsonb not null default '[]'::jsonb,
  "state_codes" jsonb not null default '[]'::jsonb,
  "codes" jsonb not null default '[]'::jsonb,
  "search_text" text,
  "rank_boost" numeric(8,4) not null default 1,
  "is_current" boolean not null default true,
  "effective_date" date,
  "end_date" date,
  "search_vector" tsvector generated always as (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("display_id", '') || ' ' || coalesce("cms_document_id", '') || ' ' || coalesce("search_text", ''))) stored,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);
create index if not exists "mcd_contractors_number_idx" on "mcd_contractors" ("contractor_number");
create index if not exists "mcd_contractors_name_idx" on "mcd_contractors" ("contractor_name");
create index if not exists "mcd_states_state_code_idx" on "mcd_states" ("state_code");
create index if not exists "mcd_contractor_jurisdictions_state_idx" on "mcd_contractor_jurisdictions" ("state_code", "cms_contractor_id");
create index if not exists "mcd_documents_type_display_idx" on "mcd_documents" ("document_type", "display_id");
create index if not exists "mcd_documents_type_current_idx" on "mcd_documents" ("document_type", "is_current", "status");
create index if not exists "mcd_documents_search_vector_idx" on "mcd_documents" using gin ("search_vector");
create index if not exists "mcd_doc_contractors_document_idx" on "mcd_document_contractors" ("document_id");
create index if not exists "mcd_doc_contractors_cms_idx" on "mcd_document_contractors" ("cms_contractor_id");
create index if not exists "mcd_doc_jurisdictions_document_idx" on "mcd_document_jurisdictions" ("document_id");
create index if not exists "mcd_doc_jurisdictions_state_idx" on "mcd_document_jurisdictions" ("state_code");
create index if not exists "mcd_doc_relationships_source_idx" on "mcd_document_relationships" ("source_document_type", "source_cms_document_id", "source_version");
create index if not exists "mcd_doc_relationships_target_idx" on "mcd_document_relationships" ("target_document_type", "target_cms_document_id", "target_version");
create index if not exists "mcd_doc_revisions_document_idx" on "mcd_document_revisions" ("document_id", "revision_date" desc);
create index if not exists "mcd_code_groups_document_idx" on "mcd_code_groups" ("document_id", "code_type", "group_number");
create index if not exists "mcd_document_codes_code_idx" on "mcd_document_codes" ("code_type", "code");
create index if not exists "mcd_document_codes_document_idx" on "mcd_document_codes" ("document_id", "code_type", "group_number");
create index if not exists "mcd_document_codes_display_idx" on "mcd_document_codes" ("document_type", "display_id");
create index if not exists "mcd_coverage_rules_cpt_icd_idx" on "mcd_coverage_rules" ("cpt_hcpcs_code", "icd10_code", "icd10_relationship");
create index if not exists "mcd_coverage_rules_icd_cpt_idx" on "mcd_coverage_rules" ("icd10_code", "cpt_hcpcs_code", "icd10_relationship");
create index if not exists "mcd_coverage_rules_article_idx" on "mcd_coverage_rules" ("article_id", "article_version", "group_number");
create index if not exists "mcd_coverage_rules_state_idx" on "mcd_coverage_rules" ("state_code", "is_current");
create index if not exists "mcd_crosswalk_icd_idx" on "mcd_icd_cpt_crosswalk" ("icd10_code", "relationship_type", "is_current");
create index if not exists "mcd_crosswalk_cpt_idx" on "mcd_icd_cpt_crosswalk" ("cpt_hcpcs_code", "relationship_type", "is_current");
create index if not exists "mcd_crosswalk_icd_cpt_idx" on "mcd_icd_cpt_crosswalk" ("icd10_code", "cpt_hcpcs_code", "relationship_type");
create index if not exists "mcd_crosswalk_state_idx" on "mcd_icd_cpt_crosswalk" ("state_code", "is_current");
create index if not exists "mcd_search_index_type_current_idx" on "mcd_search_index" ("document_type", "is_current");
create index if not exists "mcd_search_index_display_idx" on "mcd_search_index" ("display_id");
create index if not exists "mcd_search_index_vector_idx" on "mcd_search_index" using gin ("search_vector");

alter table "mcd_import_batches" enable row level security;
alter table "mcd_phase1_staging_manifest" enable row level security;
alter table "mcd_contractors" enable row level security;
alter table "mcd_states" enable row level security;
alter table "mcd_contractor_jurisdictions" enable row level security;
alter table "mcd_documents" enable row level security;
alter table "mcd_document_contractors" enable row level security;
alter table "mcd_document_jurisdictions" enable row level security;
alter table "mcd_document_urls" enable row level security;
alter table "mcd_document_relationships" enable row level security;
alter table "mcd_document_revisions" enable row level security;
alter table "mcd_code_groups" enable row level security;
alter table "mcd_document_codes" enable row level security;
alter table "mcd_coverage_rules" enable row level security;
alter table "mcd_icd_cpt_crosswalk" enable row level security;
alter table "mcd_search_index" enable row level security;

insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article', 'stg_mcd_current_article_article', 'article.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article.csv', 2002, 27, '["article_id","article_version","article_type","title","article_pub_date","article_eff_date","article_end_date","description","other_comments","sad_url","status","last_updated","history_exp","key_article","icd9_covered_para","icd9_noncovered_para","revenue_para","thirty_percent","article_rev_end_date","source_article_id","date_retired","keywords","icd10_doc","add_icd10_info","cms_cov_policy","display_id","reference_article"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_future_retire', 'stg_mcd_current_article_article_future_retire', 'article_future_retire.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_future_retire.csv', 46, 2, '["article_id","retire_dt"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_related_documents', 'stg_mcd_current_article_article_related_documents', 'article_related_documents.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_related_documents.csv', 6572, 9, '["article_id","article_version","related_num","r_article_id","r_article_version","r_lcd_id","r_lcd_version","r_contractor_id","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_related_ncd_documents', 'stg_mcd_current_article_article_related_ncd_documents', 'article_related_ncd_documents.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_related_ncd_documents.csv', 4690, 6, '["article_id","article_version","related_num","r_ncd_id","r_ncd_version","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_related_source_icd9', 'stg_mcd_current_article_article_related_source_icd9', 'article_related_source_icd9.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_related_source_icd9.csv', 136, 5, '["article_id","article_version","related_num","source_article_id","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_type_lookup', 'stg_mcd_current_article_article_type_lookup', 'article_type_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_type_lookup.csv', 6, 3, '["article_type_id","description","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_url_type_lookup', 'stg_mcd_current_article_article_url_type_lookup', 'article_url_type_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_url_type_lookup.csv', 4, 4, '["url_type_id","description","sort_order","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_bill_code', 'stg_mcd_current_article_article_x_bill_code', 'article_x_bill_code.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_bill_code.csv', 1209, 6, '["article_id","article_version","bill_code_id","bill_code_version","last_updated","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_code_table', 'stg_mcd_current_article_article_x_code_table', 'article_x_code_table.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_code_table.csv', 1497, 13, '["article_id","article_version","article_type","code_table_row","brand_name","eff_date","end_date","comments","hcpc_code_id","hcpc_code_version","last_updated","short_description","long_description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_contractor', 'stg_mcd_current_article_article_x_contractor', 'article_x_contractor.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_contractor.csv', 27064, 7, '["article_id","article_version","article_type","contractor_id","contractor_type_id","contractor_version","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_hcpc_code', 'stg_mcd_current_article_article_x_hcpc_code', 'article_x_hcpc_code.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_hcpc_code.csv', 18158, 9, '["article_id","article_version","hcpc_code_id","hcpc_code_version","hcpc_code_group","range","last_updated","long_description","short_description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_hcpc_code_group', 'stg_mcd_current_article_article_x_hcpc_code_group', 'article_x_hcpc_code_group.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_hcpc_code_group.csv', 1875, 5, '["article_id","article_version","hcpc_code_group","paragraph","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_hcpc_modifier', 'stg_mcd_current_article_article_x_hcpc_modifier', 'article_x_hcpc_modifier.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_hcpc_modifier.csv', 491, 7, '["article_id","article_version","hcpc_modifier_code_id","hcpc_modifier_code_version","hcpc_modifier_group","last_updated","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_hcpc_modifier_group', 'stg_mcd_current_article_article_x_hcpc_modifier_group', 'article_x_hcpc_modifier_group.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_hcpc_modifier_group.csv', 1139, 5, '["article_id","article_version","hcpc_modifier_group","paragraph","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_icd10_covered', 'stg_mcd_current_article_article_x_icd10_covered', 'article_x_icd10_covered.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_covered.csv', 431120, 10, '["article_id","article_version","icd10_code_id","icd10_code_version","icd10_covered_group","range","last_updated","sort_order","description","asterisk"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_icd10_covered_group', 'stg_mcd_current_article_article_x_icd10_covered_group', 'article_x_icd10_covered_group.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_covered_group.csv', 2373, 6, '["article_id","article_version","icd10_covered_group","paragraph","last_updated","icd10_covered_ast"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_icd10_noncovered', 'stg_mcd_current_article_article_x_icd10_noncovered', 'article_x_icd10_noncovered.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_noncovered.csv', 45352, 9, '["article_id","article_version","icd10_code_id","icd10_code_version","icd10_noncovered_group","range","last_updated","sort_order","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_icd10_noncovered_group', 'stg_mcd_current_article_article_x_icd10_noncovered_group', 'article_x_icd10_noncovered_group.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_noncovered_group.csv', 1215, 5, '["article_id","article_version","icd10_noncovered_group","paragraph","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_icd10_pcs_code', 'stg_mcd_current_article_article_x_icd10_pcs_code', 'article_x_icd10_pcs_code.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_pcs_code.csv', 73, 9, '["article_id","article_version","range","last_updated","sort_order","icd10_pcs_code_id","icd10_pcs_code_version","icd10_pcs_code_group","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_icd10_pcs_code_group', 'stg_mcd_current_article_article_x_icd10_pcs_code_group', 'article_x_icd10_pcs_code_group.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_pcs_code_group.csv', 1160, 5, '["article_id","article_version","last_updated","icd10_pcs_code_group","paragraph"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_other_coding_group', 'stg_mcd_current_article_article_x_other_coding_group', 'article_x_other_coding_group.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_other_coding_group.csv', 1087, 6, '["article_id","article_version","other_coding_group","paragraph","codes","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_primary_jurisdiction', 'stg_mcd_current_article_article_x_primary_jurisdiction', 'article_x_primary_jurisdiction.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_primary_jurisdiction.csv', 259, 4, '["article_id","article_version","state_id","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_response_to_comment', 'stg_mcd_current_article_article_x_response_to_comment', 'article_x_response_to_comment.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_response_to_comment.csv', 7150, 6, '["article_id","article_version","rtc_num","comment","response","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_revenue_code', 'stg_mcd_current_article_article_x_revenue_code', 'article_x_revenue_code.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_revenue_code.csv', 2761, 7, '["article_id","article_version","revenue_code_id","revenue_code_version","range","last_updated","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_revision_history', 'stg_mcd_current_article_article_x_revision_history', 'article_x_revision_history.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_revision_history.csv', 10867, 6, '["article_id","article_version","rev_hist_num","rev_hist_date","rev_hist_exp","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_sticky_note', 'stg_mcd_current_article_article_x_sticky_note', 'article_x_sticky_note.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_sticky_note.csv', 34, 6, '["article_id","article_version","sticky_note_version","sticky_note","sticky_note_dt","sticky_note_posting_dt"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'article_x_urls', 'stg_mcd_current_article_article_x_urls', 'article_x_urls.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_urls.csv', 4904, 9, '["article_id","article_version","url_type_id","url_id","url","url_name","sort_order","last_updated","url_description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'contractor', 'stg_mcd_current_article_contractor', 'contractor.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\contractor.csv', 120, 23, '["contractor_id","contractor_type_id","contractor_version","contractor_bus_name","contractor_number","dmerc_rgn","address1","address2","address3","city","state_id","zipcode","phone","fax","status","last_updated","url","email","ignore","status_flag","cmd_name","cmd_title","contractor_subtype_id"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'contractor_jurisdiction', 'stg_mcd_current_article_contractor_jurisdiction', 'contractor_jurisdiction.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\contractor_jurisdiction.csv', 291, 7, '["contractor_id","contractor_type_id","contractor_version","state_id","last_updated","active_date","term_date"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'contractor_oversight', 'stg_mcd_current_article_contractor_oversight', 'contractor_oversight.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\contractor_oversight.csv', 120, 5, '["contractor_id","contractor_type_id","contractor_version","region_id","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'contractor_subtype_lookup', 'stg_mcd_current_article_contractor_subtype_lookup', 'contractor_subtype_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\contractor_subtype_lookup.csv', 4, 2, '["contractor_subtype_id","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'contractor_type_lookup', 'stg_mcd_current_article_contractor_type_lookup', 'contractor_type_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\contractor_type_lookup.csv', 13, 2, '["contractor_type_id","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'dmerc_region_lookup', 'stg_mcd_current_article_dmerc_region_lookup', 'dmerc_region_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\dmerc_region_lookup.csv', 14, 5, '["region_id","description","psc_description","mac_description","super_mac_description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'region_lookup', 'stg_mcd_current_article_region_lookup', 'region_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\region_lookup.csv', 11, 2, '["region_id","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'state_lookup', 'stg_mcd_current_article_state_lookup', 'state_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\state_lookup.csv', 63, 3, '["state_id","state_abbrev","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'state_x_region', 'stg_mcd_current_article_state_x_region', 'state_x_region.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\state_x_region.csv', 63, 2, '["state_id","region_id"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_article', 'update_period', 'stg_mcd_current_article_update_period', 'update_period.csv', 'C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\update_period.csv', 1196, 3, '["period_id","begin_date","dis_end_date"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'contractor', 'stg_mcd_current_lcd_contractor', 'contractor.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\contractor.csv', 120, 23, '["contractor_id","contractor_type_id","contractor_version","contractor_bus_name","contractor_number","dmerc_rgn","address1","address2","address3","city","state_id","zipcode","phone","fax","status","last_updated","url","email","ignore","status_flag","cmd_name","cmd_title","contractor_subtype_id"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'contractor_jurisdiction', 'stg_mcd_current_lcd_contractor_jurisdiction', 'contractor_jurisdiction.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\contractor_jurisdiction.csv', 291, 7, '["contractor_id","contractor_type_id","contractor_version","state_id","last_updated","active_date","term_date"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'contractor_oversight', 'stg_mcd_current_lcd_contractor_oversight', 'contractor_oversight.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\contractor_oversight.csv', 120, 5, '["contractor_id","contractor_type_id","contractor_version","region_id","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'contractor_subtype_lookup', 'stg_mcd_current_lcd_contractor_subtype_lookup', 'contractor_subtype_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\contractor_subtype_lookup.csv', 4, 2, '["contractor_subtype_id","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'contractor_type_lookup', 'stg_mcd_current_lcd_contractor_type_lookup', 'contractor_type_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\contractor_type_lookup.csv', 13, 2, '["contractor_type_id","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'dmerc_region_lookup', 'stg_mcd_current_lcd_dmerc_region_lookup', 'dmerc_region_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\dmerc_region_lookup.csv', 14, 5, '["region_id","description","psc_description","mac_description","super_mac_description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'draft_contact_lookup', 'stg_mcd_current_lcd_draft_contact_lookup', 'draft_contact_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\draft_contact_lookup.csv', 166, 14, '["contact_id","email_address","first_name","middle_initial","last_name","phone","address1","address2","address3","city","state_id","zipcode","last_updated","p_ext"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd', 'stg_mcd_current_lcd_lcd', 'lcd.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd.csv', 940, 48, '["lcd_id","lcd_version","title","determination_number","orig_det_eff_date","ent_det_end_date","rev_eff_date","rev_end_date","indication","diagnoses_support","icd9_dont_support_para","icd9_dont_support_ast","diagnoses_dont_support","coding_guidelines","doc_reqs","appendices","util_guide","source_info","adv_meeting","comment_start_dt","comment_end_dt","notice_start_dt","rev_hist_num","history_exp","last_reviewed_on","status","last_updated","cms_cov_policy","display_id","draft_contact","revenue_para","thirty_percent","keywords","associated_info","notice_end_dt","date_retired","draft_released_date","source_lcd_id","add_icd10_info","icd10_doc","synopsis_changes","bibliography","summary_of_evidence","analysis_of_evidence","mcd_publish_date","issue","issue_change","mac_initiated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_future_retire', 'stg_mcd_current_lcd_lcd_future_retire', 'lcd_future_retire.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_future_retire.csv', 51, 2, '["lcd_id","retire_dt"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_related_documents', 'stg_mcd_current_lcd_lcd_related_documents', 'lcd_related_documents.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_related_documents.csv', 5463, 9, '["lcd_id","lcd_version","related_num","r_article_id","r_article_version","r_lcd_id","r_lcd_version","r_contractor_id","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_related_ncd_documents', 'stg_mcd_current_lcd_lcd_related_ncd_documents', 'lcd_related_ncd_documents.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_related_ncd_documents.csv', 2472, 6, '["lcd_id","lcd_version","related_num","r_ncd_id","r_ncd_version","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_related_source_icd9', 'stg_mcd_current_lcd_lcd_related_source_icd9', 'lcd_related_source_icd9.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_related_source_icd9.csv', 48, 5, '["lcd_id","lcd_version","related_num","source_lcd_id","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_url_type_lookup', 'stg_mcd_current_lcd_lcd_url_type_lookup', 'lcd_url_type_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_url_type_lookup.csv', 1, 4, '["url_type_id","description","sort_order","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_advisory_committee', 'stg_mcd_current_lcd_lcd_x_advisory_committee', 'lcd_x_advisory_committee.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_advisory_committee.csv', 129, 7, '["lcd_id","lcd_version","meeting_id","meeting_date","meeting_info","sort_order","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_contractor', 'stg_mcd_current_lcd_lcd_x_contractor', 'lcd_x_contractor.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_contractor.csv', 12856, 6, '["lcd_id","lcd_version","contractor_id","contractor_type_id","contractor_version","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_hcpc_code', 'stg_mcd_current_lcd_lcd_x_hcpc_code', 'lcd_x_hcpc_code.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_hcpc_code.csv', 2396, 9, '["lcd_id","lcd_version","hcpc_code_id","hcpc_code_version","hcpc_code_group","range","last_updated","long_description","short_description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_hcpc_code_group', 'stg_mcd_current_lcd_lcd_x_hcpc_code_group', 'lcd_x_hcpc_code_group.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_hcpc_code_group.csv', 114, 5, '["lcd_id","lcd_version","hcpc_code_group","paragraph","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_primary_jurisdiction', 'stg_mcd_current_lcd_lcd_x_primary_jurisdiction', 'lcd_x_primary_jurisdiction.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_primary_jurisdiction.csv', 242, 4, '["lcd_id","lcd_version","state_id","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_reason_change', 'stg_mcd_current_lcd_lcd_x_reason_change', 'lcd_x_reason_change.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_reason_change.csv', 953, 6, '["lcd_id","lcd_version","reason_change_id","reason_change_version","last_updated","reason_change_other"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_requestor_letters', 'stg_mcd_current_lcd_lcd_x_requestor_letters', 'lcd_x_requestor_letters.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv_upload_ready\lcd_x_requestor_letters.csv', 40, 8, '["lcd_id","lcd_version","letter_id","requestor_name","letter_path","size","sort_order","last_updated"]'::jsonb, 'Original CMS current_lcd lcd_x_requestor_letters.csv has no header row; upload the generated header-corrected copy at local_upload_path.') on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_revision_history', 'stg_mcd_current_lcd_lcd_x_revision_history', 'lcd_x_revision_history.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_revision_history.csv', 7823, 6, '["lcd_id","lcd_version","rev_hist_num","rev_hist_date","rev_hist_exp","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_sticky_note', 'stg_mcd_current_lcd_lcd_x_sticky_note', 'lcd_x_sticky_note.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_sticky_note.csv', 34, 6, '["lcd_id","lcd_version","sticky_note_version","sticky_note","sticky_note_dt","sticky_note_posting_dt"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_synopsis_changes_fields', 'stg_mcd_current_lcd_lcd_x_synopsis_changes_fields', 'lcd_x_synopsis_changes_fields.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_synopsis_changes_fields.csv', 34, 4, '["lcd_id","lcd_version","synopsis_changes_field_id","last_updated"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'lcd_x_urls', 'stg_mcd_current_lcd_lcd_x_urls', 'lcd_x_urls.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_urls.csv', 128, 9, '["lcd_id","lcd_version","url_type_id","url_id","url","url_name","sort_order","last_updated","url_description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'reason_change_lookup', 'stg_mcd_current_lcd_reason_change_lookup', 'reason_change_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\reason_change_lookup.csv', 108, 5, '["reason_change_id","reason_change_version","description","last_updated","sort_order"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'region_lookup', 'stg_mcd_current_lcd_region_lookup', 'region_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\region_lookup.csv', 11, 2, '["region_id","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'state_lookup', 'stg_mcd_current_lcd_state_lookup', 'state_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\state_lookup.csv', 63, 3, '["state_id","state_abbrev","description"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'state_x_region', 'stg_mcd_current_lcd_state_x_region', 'state_x_region.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\state_x_region.csv', 63, 2, '["state_id","region_id"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'synopsis_changes_fields_lookup', 'stg_mcd_current_lcd_synopsis_changes_fields_lookup', 'synopsis_changes_fields_lookup.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\synopsis_changes_fields_lookup.csv', 17, 5, '["synopsis_changes_field_id","field_name","field_anchor","mcd_field_name","mcd_field_anchor"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('current_lcd', 'update_period', 'stg_mcd_current_lcd_update_period', 'update_period.csv', 'C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\update_period.csv', 1196, 3, '["period_id","begin_date","dis_end_date"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('ncd', 'ncd_bnft_ctgry_ref', 'stg_mcd_ncd_ncd_bnft_ctgry_ref', 'ncd_bnft_ctgry_ref.csv', 'C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv\ncd_bnft_ctgry_ref.csv', 78, 2, '["bnft_ctgry_cd","bnft_ctgry_desc"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('ncd', 'ncd_pblctn_ref', 'stg_mcd_ncd_ncd_pblctn_ref', 'ncd_pblctn_ref.csv', 'C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv\ncd_pblctn_ref.csv', 42, 3, '["pblctn_cd","pblctn_num","pblctn_title"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('ncd', 'ncd_trkg', 'stg_mcd_ncd_ncd_trkg', 'ncd_trkg.csv', 'C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv\ncd_trkg.csv', 357, 26, '["NCD_id","NCD_vrsn_num","natl_cvrg_type","cvrg_lvl_cd","NCD_mnl_sect","NCD_mnl_sect_title","NCD_efctv_dt","NCD_impltn_dt","NCD_trmntn_dt","itm_srvc_desc","indctn_lmtn","xref_txt","othr_txt","trnsmtl_num","trnsmtl_issnc_dt","trnsmtl_url","chg_rqst_num","pblctn_cd","rev_hstry","under_rvw","creatd_tmstmp","last_updt_tmstmp","last_clrnc_tmstmp","NCD_lab","ncd_keyword","NCD_AMA"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
insert into "mcd_phase1_staging_manifest" ("dataset_key", "csv_table_name", "staging_table_name", "source_file_name", "local_upload_path", "expected_rows", "expected_columns", "headers", "notes") values ('ncd', 'ncd_trkg_bnft_xref', 'stg_mcd_ncd_ncd_trkg_bnft_xref', 'ncd_trkg_bnft_xref.csv', 'C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv\ncd_trkg_bnft_xref.csv', 599, 5, '["NCD_id","NCD_vrsn_num","bnft_ctgry_cd","creatd_tmstmp","last_updt_tmstmp"]'::jsonb, null) on conflict ("dataset_key", "csv_table_name") do update set "staging_table_name" = excluded."staging_table_name", "source_file_name" = excluded."source_file_name", "local_upload_path" = excluded."local_upload_path", "expected_rows" = excluded."expected_rows", "expected_columns" = excluded."expected_columns", "headers" = excluded."headers", "notes" = excluded."notes", "updated_at" = now();
commit;
