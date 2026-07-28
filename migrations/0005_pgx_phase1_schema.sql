-- PGx Phase 1 foundation. Clinical knowledge rows are seeded by the
-- application bootstrap; CMS coverage group rows remain empty until a
-- versioned CMS import is implemented.

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
  "group_type" text not null check ("group_type" in ('cpt', 'icd10')),
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
  "cpic_level" text not null check ("cpic_level" in ('A', 'B', 'C', 'D')),
  "cpt_codes" jsonb default '[]'::jsonb not null,
  "table_source" text not null,
  "recommendation" text not null,
  "source_url" text,
  "created_at" timestamp default now(),
  "updated_at" timestamp default now()
);

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

create index if not exists "pgx_cms_groups_article_code_idx"
  on "pgx_cms_groups" ("article_id", "code");
create index if not exists "pgx_cms_groups_article_group_idx"
  on "pgx_cms_groups" ("article_id", "group_number", "group_type");
create unique index if not exists "pgx_cms_groups_unique_row_idx"
  on "pgx_cms_groups" ("article_id", "group_number", "group_type", "code");
create unique index if not exists "pgx_gene_drug_pairs_gene_drug_idx"
  on "pgx_gene_drug_pairs" ("gene", "drug");
create index if not exists "pgx_analyses_user_created_idx"
  on "pgx_analyses" ("user_id", "created_at" desc);

comment on table "pgx_cms_articles" is 'Version pointers for PGx CMS sources. Coverage rows require an authoritative import.';
comment on table "pgx_cms_groups" is 'Authoritatively imported CMS article code groups; no guessed mappings are permitted.';
comment on table "pgx_genes" is 'PGx gene reference records with source lineage.';
comment on table "pgx_gene_drug_pairs" is 'Version-limited PGx evidence references; not a coverage determination.';
comment on table "pgx_analyses" is 'User-owned PGx coding decision-support analyses and claim previews.';

-- Supabase REST access fails closed. The application server uses its database
-- connection and independently enforces authenticated ownership.
alter table "pgx_cms_articles" enable row level security;
alter table "pgx_cms_groups" enable row level security;
alter table "pgx_genes" enable row level security;
alter table "pgx_gene_drug_pairs" enable row level security;
alter table "pgx_analyses" enable row level security;

-- Install the owner policy only in a Supabase-shaped database. A plain local
-- PostgreSQL migration remains valid without the auth schema/role.
do $pgx_rls$
begin
  if to_regnamespace('auth') is not null
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'drop policy if exists pgx_analyses_owner_access on public.pgx_analyses';
    execute $policy$
      create policy pgx_analyses_owner_access
      on public.pgx_analyses
      for all
      to authenticated
      using (
        exists (
          select 1 from public.users
          where users.id = pgx_analyses.user_id
            and users.supabase_id = auth.uid()::text
        )
      )
      with check (
        exists (
          select 1 from public.users
          where users.id = pgx_analyses.user_id
            and users.supabase_id = auth.uid()::text
        )
      )
    $policy$;
  end if;
end
$pgx_rls$;
