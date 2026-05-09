import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.argv.includes("--allow-heavy")) {
  console.error(
    [
      "Refusing to run the full Phase 2 transform without --allow-heavy.",
      "This job materializes millions of CMS code relationships and can overload small Supabase compute sizes.",
      "Use a split/limited transform or upgrade compute before running it again.",
    ].join("\n"),
  );
  process.exit(1);
}

const CLEAN_TABLES = [
  "mcd_search_index",
  "mcd_icd_cpt_crosswalk",
  "mcd_coverage_rules",
  "mcd_document_codes",
  "mcd_code_groups",
  "mcd_document_revisions",
  "mcd_document_relationships",
  "mcd_document_urls",
  "mcd_document_jurisdictions",
  "mcd_document_contractors",
  "mcd_contractor_jurisdictions",
  "mcd_documents",
  "mcd_states",
  "mcd_contractors",
];

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function runStep(pool: pg.Pool, name: string, sql: string) {
  const started = Date.now();
  console.log(`\n${name}...`);
  await pool.query(sql);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${name} completed in ${seconds}s`);
}

async function countTable(pool: pg.Pool, table: string) {
  const result = await pool.query<{ count: string }>(`select count(*)::text as count from ${quoteIdent(table)}`);
  return Number(result.rows[0].count);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query("set statement_timeout = 0");
    await pool.query("set lock_timeout = '30s'");
    await pool.query("set synchronous_commit = off");

    await runStep(
      pool,
      "Create temporary parsing helpers",
      `
      create or replace function pg_temp.mcd_date(value text)
      returns date
      language sql
      immutable
      as $$
        select case
          when nullif(trim(value), '') is not null and trim(value) ~ '^\\d{4}-\\d{2}-\\d{2}'
          then left(trim(value), 10)::date
          else null
        end
      $$;

      create or replace function pg_temp.mcd_ts(value text)
      returns timestamptz
      language sql
      immutable
      as $$
        select case
          when nullif(trim(value), '') is not null and trim(value) ~ '^\\d{4}-\\d{2}-\\d{2}'
          then left(trim(value), 26)::timestamp at time zone 'UTC'
          else null
        end
      $$;

      create or replace function pg_temp.mcd_int(value text)
      returns integer
      language sql
      immutable
      as $$
        select case
          when nullif(trim(value), '') is not null and trim(value) ~ '^-?\\d+$'
          then trim(value)::integer
          else null
        end
      $$;

      create or replace function pg_temp.mcd_clean_text(value text)
      returns text
      language sql
      immutable
      as $$
        select nullif(
          regexp_replace(
            regexp_replace(
              replace(replace(replace(coalesce(value, ''), '&nbsp;', ' '), '&amp;', '&'), '&quot;', '"'),
              '<[^>]+>',
              ' ',
              'g'
            ),
            '\\s+',
            ' ',
            'g'
          ),
          ''
        )
      $$;
      `,
    );

    await runStep(
      pool,
      "Clear derived MCD tables",
      `truncate table ${CLEAN_TABLES.map(quoteIdent).join(", ")} restart identity cascade;`,
    );

    await runStep(
      pool,
      "Load states",
      `
      insert into "mcd_states" ("cms_state_id", "state_code", "state_name", "region_id", "region_name", "raw_data")
      select distinct on (s."state_id")
        s."state_id",
        nullif(s."state_abbrev", ''),
        nullif(s."description", ''),
        nullif(sr."region_id", ''),
        nullif(r."description", ''),
        jsonb_build_object('state', to_jsonb(s), 'state_region', to_jsonb(sr), 'region', to_jsonb(r))
      from (
        select * from "stg_mcd_current_article_state_lookup"
        union all
        select * from "stg_mcd_current_lcd_state_lookup"
      ) s
      left join (
        select * from "stg_mcd_current_article_state_x_region"
        union all
        select * from "stg_mcd_current_lcd_state_x_region"
      ) sr on sr."state_id" = s."state_id"
      left join (
        select * from "stg_mcd_current_article_region_lookup"
        union all
        select * from "stg_mcd_current_lcd_region_lookup"
      ) r on r."region_id" = sr."region_id"
      where nullif(s."state_id", '') is not null
      order by s."state_id", s."source_dataset";
      `,
    );

    await runStep(
      pool,
      "Load contractors and jurisdictions",
      `
      with contractor_source as (
        select * from "stg_mcd_current_article_contractor"
        union all
        select * from "stg_mcd_current_lcd_contractor"
      ),
      type_lookup as (
        select * from "stg_mcd_current_article_contractor_type_lookup"
        union all
        select * from "stg_mcd_current_lcd_contractor_type_lookup"
      ),
      subtype_lookup as (
        select * from "stg_mcd_current_article_contractor_subtype_lookup"
        union all
        select * from "stg_mcd_current_lcd_contractor_subtype_lookup"
      )
      insert into "mcd_contractors" (
        "cms_contractor_id", "contractor_type_id", "contractor_version", "contractor_number",
        "contractor_name", "contractor_type", "contractor_subtype", "dmerc_region", "state_id",
        "state_code", "status", "url", "email", "raw_data"
      )
      select distinct on (c."contractor_id", c."contractor_type_id", c."contractor_version")
        c."contractor_id",
        nullif(c."contractor_type_id", ''),
        nullif(c."contractor_version", ''),
        nullif(c."contractor_number", ''),
        coalesce(nullif(c."contractor_bus_name", ''), 'Contractor ' || c."contractor_id"),
        nullif(t."description", ''),
        nullif(st."description", ''),
        nullif(c."dmerc_rgn", ''),
        nullif(c."state_id", ''),
        nullif(ms."state_code", ''),
        nullif(c."status", ''),
        nullif(c."url", ''),
        nullif(c."email", ''),
        jsonb_build_object('contractor', to_jsonb(c), 'type', to_jsonb(t), 'subtype', to_jsonb(st))
      from contractor_source c
      left join type_lookup t on t."contractor_type_id" = c."contractor_type_id"
      left join subtype_lookup st on st."contractor_subtype_id" = c."contractor_subtype_id"
      left join "mcd_states" ms on ms."cms_state_id" = c."state_id"
      where nullif(c."contractor_id", '') is not null
      order by c."contractor_id", c."contractor_type_id", c."contractor_version", c."source_dataset";

      with jurisdiction_source as (
        select * from "stg_mcd_current_article_contractor_jurisdiction"
        union all
        select * from "stg_mcd_current_lcd_contractor_jurisdiction"
      )
      insert into "mcd_contractor_jurisdictions" (
        "contractor_id", "cms_contractor_id", "contractor_type_id", "contractor_version",
        "cms_state_id", "state_code", "active_date", "term_date", "raw_data"
      )
      select distinct on (j."contractor_id", j."contractor_type_id", j."contractor_version", j."state_id")
        c."id",
        j."contractor_id",
        nullif(j."contractor_type_id", ''),
        nullif(j."contractor_version", ''),
        nullif(j."state_id", ''),
        ms."state_code",
        pg_temp.mcd_date(j."active_date"),
        pg_temp.mcd_date(j."term_date"),
        to_jsonb(j)
      from jurisdiction_source j
      left join "mcd_contractors" c
        on c."cms_contractor_id" = j."contractor_id"
       and coalesce(c."contractor_type_id", '') = coalesce(j."contractor_type_id", '')
       and coalesce(c."contractor_version", '') = coalesce(j."contractor_version", '')
      left join "mcd_states" ms on ms."cms_state_id" = j."state_id"
      where nullif(j."contractor_id", '') is not null
      order by j."contractor_id", j."contractor_type_id", j."contractor_version", j."state_id", j."source_dataset";
      `,
    );

    await runStep(
      pool,
      "Load documents",
      `
      insert into "mcd_documents" (
        "document_type", "cms_document_id", "display_id", "version", "title", "article_type", "status",
        "is_current", "is_retired", "source_dataset", "effective_date", "end_date", "retirement_date",
        "publication_date", "last_updated_at", "keywords", "summary_text", "full_text", "raw_data", "search_text"
      )
      select
        'article',
        a."article_id",
        coalesce(nullif(a."display_id", ''), 'A' || a."article_id"),
        nullif(a."article_version", ''),
        coalesce(nullif(a."title", ''), 'Article ' || a."article_id"),
        nullif(atl."description", ''),
        nullif(a."status", ''),
        true,
        case when nullif(a."date_retired", '') is not null or lower(coalesce(a."status", '')) like '%retir%' then true else false end,
        'current_article',
        pg_temp.mcd_date(a."article_eff_date"),
        pg_temp.mcd_date(coalesce(nullif(a."article_end_date", ''), nullif(a."article_rev_end_date", ''))),
        pg_temp.mcd_date(a."date_retired"),
        pg_temp.mcd_date(a."article_pub_date"),
        pg_temp.mcd_ts(a."last_updated"),
        nullif(a."keywords", ''),
        pg_temp.mcd_clean_text(a."description"),
        pg_temp.mcd_clean_text(concat_ws(' ', a."description", a."other_comments", a."icd10_doc", a."add_icd10_info", a."cms_cov_policy", a."revenue_para", a."history_exp")),
        to_jsonb(a),
        pg_temp.mcd_clean_text(concat_ws(' ', a."title", a."keywords", a."description", a."icd10_doc", a."cms_cov_policy"))
      from "stg_mcd_current_article_article" a
      left join "stg_mcd_current_article_article_type_lookup" atl on atl."article_type_id" = a."article_type";

      insert into "mcd_documents" (
        "document_type", "cms_document_id", "display_id", "version", "title", "status",
        "is_current", "is_retired", "source_dataset", "effective_date", "end_date", "retirement_date",
        "last_reviewed_on", "last_updated_at", "mcd_publish_date", "keywords", "summary_text", "full_text",
        "raw_data", "search_text"
      )
      select
        'lcd',
        l."lcd_id",
        coalesce(nullif(l."display_id", ''), 'L' || l."lcd_id"),
        nullif(l."lcd_version", ''),
        coalesce(nullif(l."title", ''), 'LCD ' || l."lcd_id"),
        nullif(l."status", ''),
        true,
        case when nullif(l."date_retired", '') is not null or lower(coalesce(l."status", '')) like '%retir%' then true else false end,
        'current_lcd',
        pg_temp.mcd_date(coalesce(nullif(l."rev_eff_date", ''), nullif(l."orig_det_eff_date", ''))),
        pg_temp.mcd_date(coalesce(nullif(l."rev_end_date", ''), nullif(l."ent_det_end_date", ''))),
        pg_temp.mcd_date(l."date_retired"),
        pg_temp.mcd_date(l."last_reviewed_on"),
        pg_temp.mcd_ts(l."last_updated"),
        pg_temp.mcd_date(l."mcd_publish_date"),
        nullif(l."keywords", ''),
        pg_temp.mcd_clean_text(l."indication"),
        pg_temp.mcd_clean_text(concat_ws(' ', l."indication", l."diagnoses_support", l."diagnoses_dont_support", l."coding_guidelines", l."doc_reqs", l."source_info", l."associated_info", l."add_icd10_info", l."icd10_doc", l."synopsis_changes", l."bibliography", l."summary_of_evidence", l."analysis_of_evidence", l."cms_cov_policy")),
        to_jsonb(l),
        pg_temp.mcd_clean_text(concat_ws(' ', l."title", l."keywords", l."indication", l."diagnoses_support", l."coding_guidelines", l."summary_of_evidence"))
      from "stg_mcd_current_lcd_lcd" l;

      insert into "mcd_documents" (
        "document_type", "cms_document_id", "display_id", "version", "title", "status",
        "is_current", "is_retired", "source_dataset", "effective_date", "end_date", "publication_date",
        "last_updated_at", "keywords", "summary_text", "full_text", "raw_data", "search_text"
      )
      select
        'ncd',
        n."NCD_id",
        coalesce('NCD ' || nullif(n."NCD_mnl_sect", ''), 'NCD ' || n."NCD_id"),
        nullif(n."NCD_vrsn_num", ''),
        coalesce(nullif(n."NCD_mnl_sect_title", ''), 'NCD ' || n."NCD_id"),
        case when lower(coalesce(n."under_rvw", '')) = 'true' then 'under_review' else 'current' end,
        true,
        case when nullif(n."NCD_trmntn_dt", '') is not null then true else false end,
        'ncd',
        pg_temp.mcd_date(n."NCD_efctv_dt"),
        pg_temp.mcd_date(n."NCD_trmntn_dt"),
        pg_temp.mcd_date(n."trnsmtl_issnc_dt"),
        pg_temp.mcd_ts(n."last_updt_tmstmp"),
        nullif(n."ncd_keyword", ''),
        pg_temp.mcd_clean_text(n."itm_srvc_desc"),
        pg_temp.mcd_clean_text(concat_ws(' ', n."itm_srvc_desc", n."indctn_lmtn", n."xref_txt", n."othr_txt", n."rev_hstry", n."ncd_keyword")),
        to_jsonb(n),
        pg_temp.mcd_clean_text(concat_ws(' ', n."NCD_mnl_sect", n."NCD_mnl_sect_title", n."ncd_keyword", n."itm_srvc_desc", n."indctn_lmtn"))
      from "stg_mcd_ncd_ncd_trkg" n;
      `,
    );

    await runStep(
      pool,
      "Load document contractors, jurisdictions, URLs, relationships, and revisions",
      `
      insert into "mcd_document_contractors" ("document_id", "contractor_id", "cms_contractor_id", "contractor_type_id", "contractor_version", "source_dataset", "raw_data")
      select d."id", c."id", axc."contractor_id", nullif(axc."contractor_type_id", ''), nullif(axc."contractor_version", ''), 'current_article', to_jsonb(axc)
      from "stg_mcd_current_article_article_x_contractor" axc
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = axc."article_id" and coalesce(d."version", '') = coalesce(axc."article_version", '') and d."source_dataset" = 'current_article'
      left join "mcd_contractors" c on c."cms_contractor_id" = axc."contractor_id" and coalesce(c."contractor_type_id", '') = coalesce(axc."contractor_type_id", '') and coalesce(c."contractor_version", '') = coalesce(axc."contractor_version", '');

      insert into "mcd_document_contractors" ("document_id", "contractor_id", "cms_contractor_id", "contractor_type_id", "contractor_version", "source_dataset", "raw_data")
      select d."id", c."id", lxc."contractor_id", nullif(lxc."contractor_type_id", ''), nullif(lxc."contractor_version", ''), 'current_lcd', to_jsonb(lxc)
      from "stg_mcd_current_lcd_lcd_x_contractor" lxc
      join "mcd_documents" d on d."document_type" = 'lcd' and d."cms_document_id" = lxc."lcd_id" and coalesce(d."version", '') = coalesce(lxc."lcd_version", '') and d."source_dataset" = 'current_lcd'
      left join "mcd_contractors" c on c."cms_contractor_id" = lxc."contractor_id" and coalesce(c."contractor_type_id", '') = coalesce(lxc."contractor_type_id", '') and coalesce(c."contractor_version", '') = coalesce(lxc."contractor_version", '');

      insert into "mcd_document_jurisdictions" ("document_id", "cms_state_id", "state_code", "source_dataset", "raw_data")
      select d."id", axj."state_id", s."state_code", 'current_article', to_jsonb(axj)
      from "stg_mcd_current_article_article_x_primary_jurisdiction" axj
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = axj."article_id" and coalesce(d."version", '') = coalesce(axj."article_version", '')
      left join "mcd_states" s on s."cms_state_id" = axj."state_id";

      insert into "mcd_document_jurisdictions" ("document_id", "cms_state_id", "state_code", "source_dataset", "raw_data")
      select d."id", lxj."state_id", s."state_code", 'current_lcd', to_jsonb(lxj)
      from "stg_mcd_current_lcd_lcd_x_primary_jurisdiction" lxj
      join "mcd_documents" d on d."document_type" = 'lcd' and d."cms_document_id" = lxj."lcd_id" and coalesce(d."version", '') = coalesce(lxj."lcd_version", '')
      left join "mcd_states" s on s."cms_state_id" = lxj."state_id";

      insert into "mcd_document_urls" ("document_id", "url_type", "url", "title", "source_dataset", "raw_data")
      select d."id", au."url_type_id", au."url", nullif(coalesce(au."url_name", au."url_description"), ''), 'current_article', to_jsonb(au)
      from "stg_mcd_current_article_article_x_urls" au
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = au."article_id" and coalesce(d."version", '') = coalesce(au."article_version", '')
      where nullif(au."url", '') is not null and au."url" <> 'http://';

      insert into "mcd_document_urls" ("document_id", "url_type", "url", "title", "source_dataset", "raw_data")
      select d."id", lu."url_type_id", lu."url", nullif(coalesce(lu."url_name", lu."url_description"), ''), 'current_lcd', to_jsonb(lu)
      from "stg_mcd_current_lcd_lcd_x_urls" lu
      join "mcd_documents" d on d."document_type" = 'lcd' and d."cms_document_id" = lu."lcd_id" and coalesce(d."version", '') = coalesce(lu."lcd_version", '')
      where nullif(lu."url", '') is not null and lu."url" <> 'http://';

      insert into "mcd_document_relationships" ("source_document_id", "source_document_type", "source_cms_document_id", "source_version", "target_document_type", "target_cms_document_id", "target_version", "target_contractor_id", "relationship_type", "related_num", "source_dataset", "raw_data")
      select d."id", 'article', r."article_id", r."article_version", 'lcd', nullif(r."r_lcd_id", ''), nullif(r."r_lcd_version", ''), nullif(r."r_contractor_id", ''), 'related_lcd', nullif(r."related_num", ''), 'current_article', to_jsonb(r)
      from "stg_mcd_current_article_article_related_documents" r
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = r."article_id" and coalesce(d."version", '') = coalesce(r."article_version", '')
      where nullif(r."r_lcd_id", '') is not null;

      insert into "mcd_document_relationships" ("source_document_id", "source_document_type", "source_cms_document_id", "source_version", "target_document_type", "target_cms_document_id", "target_version", "target_contractor_id", "relationship_type", "related_num", "source_dataset", "raw_data")
      select d."id", 'article', r."article_id", r."article_version", 'article', nullif(r."r_article_id", ''), nullif(r."r_article_version", ''), nullif(r."r_contractor_id", ''), 'related_article', nullif(r."related_num", ''), 'current_article', to_jsonb(r)
      from "stg_mcd_current_article_article_related_documents" r
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = r."article_id" and coalesce(d."version", '') = coalesce(r."article_version", '')
      where nullif(r."r_article_id", '') is not null;

      insert into "mcd_document_relationships" ("source_document_id", "source_document_type", "source_cms_document_id", "source_version", "target_document_type", "target_cms_document_id", "target_version", "relationship_type", "related_num", "source_dataset", "raw_data")
      select d."id", 'article', r."article_id", r."article_version", 'ncd', nullif(r."r_ncd_id", ''), nullif(r."r_ncd_version", ''), 'related_ncd', nullif(r."related_num", ''), 'current_article', to_jsonb(r)
      from "stg_mcd_current_article_article_related_ncd_documents" r
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = r."article_id" and coalesce(d."version", '') = coalesce(r."article_version", '')
      where nullif(r."r_ncd_id", '') is not null;

      insert into "mcd_document_relationships" ("source_document_id", "source_document_type", "source_cms_document_id", "source_version", "target_document_type", "target_cms_document_id", "target_version", "target_contractor_id", "relationship_type", "related_num", "source_dataset", "raw_data")
      select d."id", 'lcd', r."lcd_id", r."lcd_version", 'article', nullif(r."r_article_id", ''), nullif(r."r_article_version", ''), nullif(r."r_contractor_id", ''), 'related_article', nullif(r."related_num", ''), 'current_lcd', to_jsonb(r)
      from "stg_mcd_current_lcd_lcd_related_documents" r
      join "mcd_documents" d on d."document_type" = 'lcd' and d."cms_document_id" = r."lcd_id" and coalesce(d."version", '') = coalesce(r."lcd_version", '')
      where nullif(r."r_article_id", '') is not null;

      insert into "mcd_document_relationships" ("source_document_id", "source_document_type", "source_cms_document_id", "source_version", "target_document_type", "target_cms_document_id", "target_version", "relationship_type", "related_num", "source_dataset", "raw_data")
      select d."id", 'lcd', r."lcd_id", r."lcd_version", 'ncd', nullif(r."r_ncd_id", ''), nullif(r."r_ncd_version", ''), 'related_ncd', nullif(r."related_num", ''), 'current_lcd', to_jsonb(r)
      from "stg_mcd_current_lcd_lcd_related_ncd_documents" r
      join "mcd_documents" d on d."document_type" = 'lcd' and d."cms_document_id" = r."lcd_id" and coalesce(d."version", '') = coalesce(r."lcd_version", '')
      where nullif(r."r_ncd_id", '') is not null;

      insert into "mcd_document_revisions" ("document_id", "document_type", "cms_document_id", "version", "revision_number", "revision_date", "revision_text", "source_dataset", "raw_data")
      select d."id", 'article', r."article_id", r."article_version", nullif(r."rev_hist_num", ''), pg_temp.mcd_date(r."rev_hist_date"), pg_temp.mcd_clean_text(r."rev_hist_exp"), 'current_article', to_jsonb(r)
      from "stg_mcd_current_article_article_x_revision_history" r
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = r."article_id" and coalesce(d."version", '') = coalesce(r."article_version", '');

      insert into "mcd_document_revisions" ("document_id", "document_type", "cms_document_id", "version", "revision_number", "revision_date", "revision_text", "source_dataset", "raw_data")
      select d."id", 'lcd', r."lcd_id", r."lcd_version", nullif(r."rev_hist_num", ''), pg_temp.mcd_date(r."rev_hist_date"), pg_temp.mcd_clean_text(r."rev_hist_exp"), 'current_lcd', to_jsonb(r)
      from "stg_mcd_current_lcd_lcd_x_revision_history" r
      join "mcd_documents" d on d."document_type" = 'lcd' and d."cms_document_id" = r."lcd_id" and coalesce(d."version", '') = coalesce(r."lcd_version", '');

      insert into "mcd_document_revisions" ("document_id", "document_type", "cms_document_id", "version", "revision_number", "revision_date", "revision_text", "source_dataset", "raw_data")
      select d."id", 'ncd', n."NCD_id", n."NCD_vrsn_num", nullif(n."trnsmtl_num", ''), pg_temp.mcd_date(n."trnsmtl_issnc_dt"), pg_temp.mcd_clean_text(n."rev_hstry"), 'ncd', to_jsonb(n)
      from "stg_mcd_ncd_ncd_trkg" n
      join "mcd_documents" d on d."document_type" = 'ncd' and d."cms_document_id" = n."NCD_id" and coalesce(d."version", '') = coalesce(n."NCD_vrsn_num", '')
      where nullif(n."rev_hstry", '') is not null;
      `,
    );

    await runStep(
      pool,
      "Load code groups and document-code rows",
      `
      insert into "mcd_code_groups" ("document_id", "document_type", "cms_document_id", "version", "code_type", "group_number", "paragraph_text", "asterisk_text", "source_dataset", "raw_data")
      select d."id", 'article', g."article_id", g."article_version", 'cpt_hcpcs', g."hcpc_code_group", pg_temp.mcd_clean_text(g."paragraph"), null, 'current_article', to_jsonb(g)
      from "stg_mcd_current_article_article_x_hcpc_code_group" g
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = g."article_id" and coalesce(d."version", '') = coalesce(g."article_version", '');

      insert into "mcd_code_groups" ("document_id", "document_type", "cms_document_id", "version", "code_type", "group_number", "paragraph_text", "asterisk_text", "source_dataset", "raw_data")
      select d."id", 'article', g."article_id", g."article_version", 'icd10_covered', g."icd10_covered_group", pg_temp.mcd_clean_text(g."paragraph"), pg_temp.mcd_clean_text(g."icd10_covered_ast"), 'current_article', to_jsonb(g)
      from "stg_mcd_current_article_article_x_icd10_covered_group" g
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = g."article_id" and coalesce(d."version", '') = coalesce(g."article_version", '');

      insert into "mcd_code_groups" ("document_id", "document_type", "cms_document_id", "version", "code_type", "group_number", "paragraph_text", "source_dataset", "raw_data")
      select d."id", 'article', g."article_id", g."article_version", 'icd10_noncovered', g."icd10_noncovered_group", pg_temp.mcd_clean_text(g."paragraph"), 'current_article', to_jsonb(g)
      from "stg_mcd_current_article_article_x_icd10_noncovered_group" g
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = g."article_id" and coalesce(d."version", '') = coalesce(g."article_version", '');

      insert into "mcd_code_groups" ("document_id", "document_type", "cms_document_id", "version", "code_type", "group_number", "paragraph_text", "source_dataset", "raw_data")
      select d."id", 'article', g."article_id", g."article_version", 'modifier', g."hcpc_modifier_group", pg_temp.mcd_clean_text(g."paragraph"), 'current_article', to_jsonb(g)
      from "stg_mcd_current_article_article_x_hcpc_modifier_group" g
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = g."article_id" and coalesce(d."version", '') = coalesce(g."article_version", '');

      insert into "mcd_code_groups" ("document_id", "document_type", "cms_document_id", "version", "code_type", "group_number", "paragraph_text", "source_dataset", "raw_data")
      select d."id", 'article', g."article_id", g."article_version", 'icd10_pcs', g."icd10_pcs_code_group", pg_temp.mcd_clean_text(g."paragraph"), 'current_article', to_jsonb(g)
      from "stg_mcd_current_article_article_x_icd10_pcs_code_group" g
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = g."article_id" and coalesce(d."version", '') = coalesce(g."article_version", '');

      insert into "mcd_code_groups" ("document_id", "document_type", "cms_document_id", "version", "code_type", "group_number", "paragraph_text", "source_dataset", "raw_data")
      select d."id", 'article', g."article_id", g."article_version", 'other_coding', g."other_coding_group", pg_temp.mcd_clean_text(concat_ws(' ', g."paragraph", g."codes")), 'current_article', to_jsonb(g)
      from "stg_mcd_current_article_article_x_other_coding_group" g
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = g."article_id" and coalesce(d."version", '') = coalesce(g."article_version", '');

      insert into "mcd_code_groups" ("document_id", "document_type", "cms_document_id", "version", "code_type", "group_number", "paragraph_text", "source_dataset", "raw_data")
      select d."id", 'lcd', g."lcd_id", g."lcd_version", 'cpt_hcpcs', g."hcpc_code_group", pg_temp.mcd_clean_text(g."paragraph"), 'current_lcd', to_jsonb(g)
      from "stg_mcd_current_lcd_lcd_x_hcpc_code_group" g
      join "mcd_documents" d on d."document_type" = 'lcd' and d."cms_document_id" = g."lcd_id" and coalesce(d."version", '') = coalesce(g."lcd_version", '');

      insert into "mcd_document_codes" ("document_id", "document_type", "cms_document_id", "display_id", "version", "source_dataset", "code_type", "code", "code_version", "code_description", "short_description", "relationship_type", "group_number", "range_flag", "raw_data")
      select d."id", 'article', h."article_id", d."display_id", h."article_version", 'current_article', 'cpt_hcpcs', h."hcpc_code_id", nullif(h."hcpc_code_version", ''), nullif(h."long_description", ''), nullif(h."short_description", ''), 'listed', nullif(h."hcpc_code_group", ''), nullif(h."range", ''), to_jsonb(h)
      from "stg_mcd_current_article_article_x_hcpc_code" h
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = h."article_id" and coalesce(d."version", '') = coalesce(h."article_version", '');

      insert into "mcd_document_codes" ("document_id", "document_type", "cms_document_id", "display_id", "version", "source_dataset", "code_type", "code", "code_version", "code_description", "relationship_type", "group_number", "range_flag", "sort_order", "asterisk", "raw_data")
      select d."id", 'article', i."article_id", d."display_id", i."article_version", 'current_article', 'icd10_cm', i."icd10_code_id", nullif(i."icd10_code_version", ''), nullif(i."description", ''), 'covered', nullif(i."icd10_covered_group", ''), nullif(i."range", ''), pg_temp.mcd_int(i."sort_order"), nullif(i."asterisk", ''), to_jsonb(i)
      from "stg_mcd_current_article_article_x_icd10_covered" i
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = i."article_id" and coalesce(d."version", '') = coalesce(i."article_version", '');

      insert into "mcd_document_codes" ("document_id", "document_type", "cms_document_id", "display_id", "version", "source_dataset", "code_type", "code", "code_version", "code_description", "relationship_type", "group_number", "range_flag", "sort_order", "raw_data")
      select d."id", 'article', i."article_id", d."display_id", i."article_version", 'current_article', 'icd10_cm', i."icd10_code_id", nullif(i."icd10_code_version", ''), nullif(i."description", ''), 'noncovered', nullif(i."icd10_noncovered_group", ''), nullif(i."range", ''), pg_temp.mcd_int(i."sort_order"), to_jsonb(i)
      from "stg_mcd_current_article_article_x_icd10_noncovered" i
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = i."article_id" and coalesce(d."version", '') = coalesce(i."article_version", '');

      insert into "mcd_document_codes" ("document_id", "document_type", "cms_document_id", "display_id", "version", "source_dataset", "code_type", "code", "code_version", "code_description", "relationship_type", "group_number", "range_flag", "raw_data")
      select d."id", 'article', i."article_id", d."display_id", i."article_version", 'current_article', 'icd10_pcs', i."icd10_pcs_code_id", nullif(i."icd10_pcs_code_version", ''), nullif(i."description", ''), 'listed', nullif(i."icd10_pcs_code_group", ''), nullif(i."range", ''), to_jsonb(i)
      from "stg_mcd_current_article_article_x_icd10_pcs_code" i
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = i."article_id" and coalesce(d."version", '') = coalesce(i."article_version", '');

      insert into "mcd_document_codes" ("document_id", "document_type", "cms_document_id", "display_id", "version", "source_dataset", "code_type", "code", "code_version", "code_description", "relationship_type", "group_number", "raw_data")
      select d."id", 'article', m."article_id", d."display_id", m."article_version", 'current_article', 'modifier', m."hcpc_modifier_code_id", nullif(m."hcpc_modifier_code_version", ''), nullif(m."description", ''), 'listed', nullif(m."hcpc_modifier_group", ''), to_jsonb(m)
      from "stg_mcd_current_article_article_x_hcpc_modifier" m
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = m."article_id" and coalesce(d."version", '') = coalesce(m."article_version", '');

      insert into "mcd_document_codes" ("document_id", "document_type", "cms_document_id", "display_id", "version", "source_dataset", "code_type", "code", "code_version", "code_description", "relationship_type", "range_flag", "raw_data")
      select d."id", 'article', r."article_id", d."display_id", r."article_version", 'current_article', 'revenue', r."revenue_code_id", nullif(r."revenue_code_version", ''), nullif(r."description", ''), 'listed', nullif(r."range", ''), to_jsonb(r)
      from "stg_mcd_current_article_article_x_revenue_code" r
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = r."article_id" and coalesce(d."version", '') = coalesce(r."article_version", '');

      insert into "mcd_document_codes" ("document_id", "document_type", "cms_document_id", "display_id", "version", "source_dataset", "code_type", "code", "code_version", "code_description", "relationship_type", "raw_data")
      select d."id", 'article', b."article_id", d."display_id", b."article_version", 'current_article', 'bill', b."bill_code_id", nullif(b."bill_code_version", ''), nullif(b."description", ''), 'listed', to_jsonb(b)
      from "stg_mcd_current_article_article_x_bill_code" b
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = b."article_id" and coalesce(d."version", '') = coalesce(b."article_version", '');

      insert into "mcd_document_codes" ("document_id", "document_type", "cms_document_id", "display_id", "version", "source_dataset", "code_type", "code", "code_version", "code_description", "short_description", "relationship_type", "effective_date", "end_date", "raw_data")
      select d."id", 'article', c."article_id", d."display_id", c."article_version", 'current_article', 'code_table_hcpcs', c."hcpc_code_id", nullif(c."hcpc_code_version", ''), nullif(c."long_description", ''), nullif(c."short_description", ''), 'code_table', pg_temp.mcd_date(c."eff_date"), pg_temp.mcd_date(c."end_date"), to_jsonb(c)
      from "stg_mcd_current_article_article_x_code_table" c
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = c."article_id" and coalesce(d."version", '') = coalesce(c."article_version", '')
      where nullif(c."hcpc_code_id", '') is not null;

      insert into "mcd_document_codes" ("document_id", "document_type", "cms_document_id", "display_id", "version", "source_dataset", "code_type", "code", "code_version", "code_description", "short_description", "relationship_type", "group_number", "range_flag", "raw_data")
      select d."id", 'lcd', h."lcd_id", d."display_id", h."lcd_version", 'current_lcd', 'cpt_hcpcs', h."hcpc_code_id", nullif(h."hcpc_code_version", ''), nullif(h."long_description", ''), nullif(h."short_description", ''), 'listed', nullif(h."hcpc_code_group", ''), nullif(h."range", ''), to_jsonb(h)
      from "stg_mcd_current_lcd_lcd_x_hcpc_code" h
      join "mcd_documents" d on d."document_type" = 'lcd' and d."cms_document_id" = h."lcd_id" and coalesce(d."version", '') = coalesce(h."lcd_version", '');
      `,
    );

    await runStep(
      pool,
      "Generate article coverage rules",
      `
      with article_lcd as (
        select "article_id", "article_version", min(nullif("r_lcd_id", '')) as "r_lcd_id", min(nullif("r_lcd_version", '')) as "r_lcd_version"
        from "stg_mcd_current_article_article_related_documents"
        where nullif("r_lcd_id", '') is not null
        group by "article_id", "article_version"
      ),
      article_ncd as (
        select "article_id", "article_version", min(nullif("r_ncd_id", '')) as "r_ncd_id", min(nullif("r_ncd_version", '')) as "r_ncd_version"
        from "stg_mcd_current_article_article_related_ncd_documents"
        where nullif("r_ncd_id", '') is not null
        group by "article_id", "article_version"
      )
      insert into "mcd_coverage_rules" (
        "article_document_id", "related_lcd_document_id", "related_ncd_document_id",
        "article_id", "article_version", "article_display_id", "cpt_hcpcs_code", "cpt_hcpcs_description",
        "icd10_code", "icd10_description", "icd10_relationship", "group_number", "effective_date",
        "end_date", "is_current", "evidence_level", "source_dataset"
      )
      select
        d."id",
        lcd."id",
        ncd."id",
        a."article_id",
        a."article_version",
        d."display_id",
        h."hcpc_code_id",
        nullif(h."long_description", ''),
        i."icd10_code_id",
        nullif(i."description", ''),
        'covered',
        nullif(i."icd10_covered_group", ''),
        pg_temp.mcd_date(a."article_eff_date"),
        pg_temp.mcd_date(coalesce(nullif(a."article_end_date", ''), nullif(a."article_rev_end_date", ''))),
        true,
        'article_same_group',
        'current_article'
      from "stg_mcd_current_article_article" a
      join "stg_mcd_current_article_article_x_hcpc_code" h on h."article_id" = a."article_id" and h."article_version" = a."article_version"
      join "stg_mcd_current_article_article_x_icd10_covered" i on i."article_id" = h."article_id" and i."article_version" = h."article_version" and i."icd10_covered_group" = h."hcpc_code_group"
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = a."article_id" and coalesce(d."version", '') = coalesce(a."article_version", '')
      left join article_lcd al on al."article_id" = a."article_id" and al."article_version" = a."article_version"
      left join "mcd_documents" lcd on lcd."document_type" = 'lcd' and lcd."cms_document_id" = al."r_lcd_id" and coalesce(lcd."version", '') = coalesce(al."r_lcd_version", '')
      left join article_ncd an on an."article_id" = a."article_id" and an."article_version" = a."article_version"
      left join "mcd_documents" ncd on ncd."document_type" = 'ncd' and ncd."cms_document_id" = an."r_ncd_id" and coalesce(ncd."version", '') = coalesce(an."r_ncd_version", '');

      with article_lcd as (
        select "article_id", "article_version", min(nullif("r_lcd_id", '')) as "r_lcd_id", min(nullif("r_lcd_version", '')) as "r_lcd_version"
        from "stg_mcd_current_article_article_related_documents"
        where nullif("r_lcd_id", '') is not null
        group by "article_id", "article_version"
      ),
      article_ncd as (
        select "article_id", "article_version", min(nullif("r_ncd_id", '')) as "r_ncd_id", min(nullif("r_ncd_version", '')) as "r_ncd_version"
        from "stg_mcd_current_article_article_related_ncd_documents"
        where nullif("r_ncd_id", '') is not null
        group by "article_id", "article_version"
      )
      insert into "mcd_coverage_rules" (
        "article_document_id", "related_lcd_document_id", "related_ncd_document_id",
        "article_id", "article_version", "article_display_id", "cpt_hcpcs_code", "cpt_hcpcs_description",
        "icd10_code", "icd10_description", "icd10_relationship", "group_number", "effective_date",
        "end_date", "is_current", "evidence_level", "source_dataset"
      )
      select
        d."id",
        lcd."id",
        ncd."id",
        a."article_id",
        a."article_version",
        d."display_id",
        h."hcpc_code_id",
        nullif(h."long_description", ''),
        i."icd10_code_id",
        nullif(i."description", ''),
        'noncovered',
        nullif(i."icd10_noncovered_group", ''),
        pg_temp.mcd_date(a."article_eff_date"),
        pg_temp.mcd_date(coalesce(nullif(a."article_end_date", ''), nullif(a."article_rev_end_date", ''))),
        true,
        'article_same_group',
        'current_article'
      from "stg_mcd_current_article_article" a
      join "stg_mcd_current_article_article_x_hcpc_code" h on h."article_id" = a."article_id" and h."article_version" = a."article_version"
      join "stg_mcd_current_article_article_x_icd10_noncovered" i on i."article_id" = h."article_id" and i."article_version" = h."article_version" and i."icd10_noncovered_group" = h."hcpc_code_group"
      join "mcd_documents" d on d."document_type" = 'article' and d."cms_document_id" = a."article_id" and coalesce(d."version", '') = coalesce(a."article_version", '')
      left join article_lcd al on al."article_id" = a."article_id" and al."article_version" = a."article_version"
      left join "mcd_documents" lcd on lcd."document_type" = 'lcd' and lcd."cms_document_id" = al."r_lcd_id" and coalesce(lcd."version", '') = coalesce(al."r_lcd_version", '')
      left join article_ncd an on an."article_id" = a."article_id" and an."article_version" = a."article_version"
      left join "mcd_documents" ncd on ncd."document_type" = 'ncd' and ncd."cms_document_id" = an."r_ncd_id" and coalesce(ncd."version", '') = coalesce(an."r_ncd_version", '');
      `,
    );

    await runStep(
      pool,
      "Generate ICD-to-CPT/HCPCS crosswalk",
      `
      insert into "mcd_icd_cpt_crosswalk" (
        "icd10_code", "icd10_description", "cpt_hcpcs_code", "cpt_hcpcs_description",
        "relationship_type", "confidence_score", "confidence_reason", "evidence_level",
        "article_document_id", "article_display_id", "effective_date", "end_date", "is_current",
        "source_count", "raw_evidence"
      )
      select
        cr."icd10_code",
        min(cr."icd10_description"),
        cr."cpt_hcpcs_code",
        min(cr."cpt_hcpcs_description"),
        cr."icd10_relationship",
        case when cr."icd10_relationship" = 'covered' then 0.9500::numeric(5,4) else 0.9250::numeric(5,4) end,
        case when cr."icd10_relationship" = 'covered'
          then 'Same article/version/group match between CPT/HCPCS and CMS covered ICD-10 rows.'
          else 'Same article/version/group match between CPT/HCPCS and CMS non-covered ICD-10 rows.'
        end,
        'article_same_group',
        min(cr."article_document_id"::text)::uuid,
        min(cr."article_display_id"),
        min(cr."effective_date"),
        max(cr."end_date"),
        true,
        count(distinct cr."article_id" || '|' || cr."article_version" || '|' || coalesce(cr."group_number", ''))::integer,
        jsonb_build_object(
          'source', 'cms_mcd_current_article',
          'evidence_level', 'article_same_group',
          'source_rows', count(*),
          'sample_article_display_id', min(cr."article_display_id")
        )
      from "mcd_coverage_rules" cr
      where cr."icd10_code" is not null and cr."cpt_hcpcs_code" is not null
      group by cr."icd10_code", cr."cpt_hcpcs_code", cr."icd10_relationship";
      `,
    );

    await runStep(
      pool,
      "Build search index and analyze",
      `
      insert into "mcd_search_index" (
        "document_id", "document_type", "display_id", "cms_document_id", "version", "title",
        "contractor_names", "state_codes", "codes", "search_text", "rank_boost", "is_current",
        "effective_date", "end_date"
      )
      select
        d."id",
        d."document_type",
        d."display_id",
        d."cms_document_id",
        d."version",
        d."title",
        coalesce(contractors."names", '[]'::jsonb),
        coalesce(states."codes", '[]'::jsonb),
        coalesce(codes."codes", '[]'::jsonb),
        d."search_text",
        case d."document_type" when 'article' then 1.25 when 'lcd' then 1.15 when 'ncd' then 1.10 else 1 end,
        d."is_current",
        d."effective_date",
        d."end_date"
      from "mcd_documents" d
      left join lateral (
        select to_jsonb(array_agg(distinct c."contractor_name") filter (where c."contractor_name" is not null)) as "names"
        from "mcd_document_contractors" dc
        left join "mcd_contractors" c on c."id" = dc."contractor_id"
        where dc."document_id" = d."id"
      ) contractors on true
      left join lateral (
        select to_jsonb(array_agg(distinct j."state_code") filter (where j."state_code" is not null)) as "codes"
        from "mcd_document_jurisdictions" j
        where j."document_id" = d."id"
      ) states on true
      left join lateral (
        select to_jsonb(array_agg(distinct dc."code") filter (where dc."code" is not null)) as "codes"
        from "mcd_document_codes" dc
        where dc."document_id" = d."id"
      ) codes on true;

      analyze "mcd_contractors";
      analyze "mcd_states";
      analyze "mcd_documents";
      analyze "mcd_document_contractors";
      analyze "mcd_document_jurisdictions";
      analyze "mcd_document_relationships";
      analyze "mcd_document_revisions";
      analyze "mcd_code_groups";
      analyze "mcd_document_codes";
      analyze "mcd_coverage_rules";
      analyze "mcd_icd_cpt_crosswalk";
      analyze "mcd_search_index";
      `,
    );

    const tables = [
      "mcd_contractors",
      "mcd_states",
      "mcd_contractor_jurisdictions",
      "mcd_documents",
      "mcd_document_contractors",
      "mcd_document_jurisdictions",
      "mcd_document_relationships",
      "mcd_document_revisions",
      "mcd_code_groups",
      "mcd_document_codes",
      "mcd_coverage_rules",
      "mcd_icd_cpt_crosswalk",
      "mcd_search_index",
    ];
    const counts: Record<string, number> = {};
    for (const table of tables) {
      counts[table] = await countTable(pool, table);
    }

    console.log("\nPhase 2 clean table counts:");
    for (const [table, count] of Object.entries(counts)) {
      console.log(`${table}: ${count.toLocaleString()}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
