-- PGx reference seed compatibility schema.
-- Keeps the Phase 1 columns for application compatibility while adding the
-- explicit reference-data fields used by the versioned seed files.

create table if not exists "pgx_cpt_codes" (
  "id" text primary key not null,
  "code" text not null unique,
  "description" text not null,
  "tier" text not null check ("tier" in ('panel', 'tier1', 'tier2', 'unlisted')),
  "min_genes" integer,
  "medicare_rate" numeric(10, 2),
  "rate_year" integer not null,
  "rate_status" text not null check ("rate_status" in ('published', 'by_report')),
  "rate_source_url" text not null,
  "article_id" text not null,
  "source_url" text not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

alter table "pgx_genes"
  add column if not exists "full_name" text,
  add column if not exists "cpt_codes" jsonb default '[]'::jsonb not null,
  add column if not exists "phenotype_options" jsonb default '[]'::jsonb not null;

update "pgx_genes"
set "full_name" = coalesce("full_name", "display_name")
where "full_name" is null;

alter table "pgx_gene_drug_pairs"
  add column if not exists "gene_symbol" text,
  add column if not exists "drug_name" text,
  add column if not exists "fda_label_type" text;

update "pgx_gene_drug_pairs"
set "gene_symbol" = coalesce("gene_symbol", "gene"),
    "drug_name" = coalesce("drug_name", "drug")
where "gene_symbol" is null or "drug_name" is null;

create unique index if not exists "pgx_gene_drug_pairs_symbol_drug_idx"
  on "pgx_gene_drug_pairs" ("gene_symbol", "drug_name");

create index if not exists "pgx_cpt_codes_article_idx"
  on "pgx_cpt_codes" ("article_id", "code");

alter table "pgx_cpt_codes" enable row level security;

comment on table "pgx_cpt_codes" is '2026 CLFS reference amounts and A59915 linkage; a fee schedule amount does not establish coverage.';
comment on column "pgx_gene_drug_pairs"."fda_label_type" is 'FDA PGx testing category reported by the CPIC API when available; null does not mean no FDA labeling.';
