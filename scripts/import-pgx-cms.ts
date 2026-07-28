import "dotenv/config";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { buildPgxCmsImportPlan, summarizePgxCmsImportPlan } from "../server/pgx-cms-importer";

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const rootIndex = args.indexOf("--root");
const root = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : process.env.MCD_LOCAL_DATA_ROOT || "C:\\Users\\TekSoft\\Downloads\\all_data");
const plan = buildPgxCmsImportPlan(root);
const summary = summarizePgxCmsImportPlan(plan);

if (!execute) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const target = String(process.env.PGX_CMS_IMPORT_ENV || "").trim().toLowerCase();
const databaseUrl = process.env.PGX_CMS_DATABASE_URL;
if (!databaseUrl) throw new Error("PGX_CMS_DATABASE_URL is required for an import; DATABASE_URL is intentionally not used as a fallback.");
if (!new Set(["staging", "production"]).has(target)) throw new Error("PGX_CMS_IMPORT_ENV must be staging or production.");
if (process.env.PGX_CMS_IMPORT_APPROVED !== "true") throw new Error("PGX_CMS_IMPORT_APPROVED=true is required for any remote import.");
if (target === "production" && (!args.includes("--confirm-production") || process.env.PGX_CMS_PRODUCTION_CONFIRMED !== "true")) {
  throw new Error("Production import requires the CLI confirmation flag and PGX_CMS_PRODUCTION_CONFIRMED=true after the in-session production release gate.");
}
if (plan.quarantine.length > 0) throw new Error(`CMS import has ${plan.quarantine.length} quarantined relationship(s); execution fails closed.`);
if (plan.sourceFreshness !== "current") throw new Error(`CMS source freshness is ${plan.sourceFreshness}; refresh the official downloads before remote import.`);

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
const sourceId = "cms-mcd-local-coverage";
const versionId = `cms-${plan.sourceHash}`;
const runId = randomUUID();
const sourceUrl = "https://www.cms.gov/medicare-coverage-database/downloads/downloads.aspx";

function activeStatus(effectiveDate: string | null, endDate: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (effectiveDate && effectiveDate > today) return "future";
  if (endDate && endDate < today) return "retired";
  return "active";
}

async function query(text: string, values: unknown[] = []) {
  return client.query(text, values);
}

await client.connect();
try {
  const existing = await query(
    `select id, status from pgx_cms_import_runs where source_release=$1 and source_hash=$2 and mode=$3 limit 1`,
    [plan.sourceRelease, plan.sourceHash, target === "production" ? "production" : "bounded_live"],
  );
  if (existing.rows[0]) {
    console.log(JSON.stringify({ ...summary, mode: target, status: "duplicate_noop", runId: existing.rows[0].id }, null, 2));
    process.exitCode = 0;
  } else {
  await query("begin");
  await query(
    `insert into pgx_knowledge_sources (id, source_type, source_identifier, source_url_or_reference)
     values ($1, 'CMS', 'MCD_LOCAL_COVERAGE_DOWNLOADS', $2)
     on conflict (source_type, source_identifier) do update set source_url_or_reference = excluded.source_url_or_reference`,
    [sourceId, sourceUrl],
  );
  await query(
    `insert into pgx_knowledge_versions
       (id, source_id, source_version, published_date, effective_date, content_hash, active_status, review_status)
     values ($1, $2, $3, null, null, $4, 'active', 'verified')
     on conflict (source_id, source_version, content_hash) do nothing`,
    [versionId, sourceId, plan.sourceRelease, plan.sourceHash],
  );
  await query(
    `insert into pgx_cms_import_runs
       (id, mode, source_release, source_hash, schema_version, status, document_count, relationship_count, quarantine_count)
     values ($1, $2, $3, $4, $5, 'running', 2, $6, 0)`,
    [runId, target === "production" ? "production" : "bounded_live", plan.sourceRelease, plan.sourceHash, plan.schemaVersion, plan.documentJurisdictions.length + plan.codeLinks.length],
  );

  for (const mac of plan.macs) {
    await query(
      `insert into pgx_macs (id, contractor_number, contractor_name, contract_type, active_status, source_version_id)
       values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing`,
      [mac.id, mac.contractorNumber, mac.contractorName, mac.contractorType, mac.activeStatus, versionId],
    );
  }
  for (const jurisdiction of plan.jurisdictions) {
    await query(
      `insert into pgx_jurisdictions
         (id, jurisdiction_code, jurisdiction_name, source_state_code, state_code, effective_date, end_date, source_version_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing`,
      [jurisdiction.id, jurisdiction.jurisdictionCode, jurisdiction.jurisdictionName, jurisdiction.sourceStateCode, jurisdiction.stateCode, jurisdiction.effectiveDate, jurisdiction.endDate, versionId],
    );
    await query(
      `insert into pgx_mac_jurisdictions (mac_id, jurisdiction_id, effective_date, end_date)
       values ($1,$2,$3,$4) on conflict (mac_id, jurisdiction_id) do nothing`,
      [jurisdiction.macId, jurisdiction.id, jurisdiction.effectiveDate, jurisdiction.endDate],
    );
  }

  await query(
    `insert into pgx_cms_article_versions
       (id, article_id, version, title, lcd_id, knowledge_version_id, import_run_id, content_hash, source_url, published_date, effective_date, end_date, active_status, review_status)
     values ($1,'59915',$2,$3,'39995',$4,$5,$6,$7,$8,$9,$10,$11,'verified')
     on conflict (article_id, version, content_hash) do nothing`,
    [plan.article.id, plan.article.version, plan.article.title, versionId, runId, plan.sourceHash, `https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915`, plan.article.publishedDate, plan.article.effectiveDate, plan.article.endDate, activeStatus(plan.article.effectiveDate, plan.article.endDate)],
  );
  await query(
    `insert into pgx_cms_lcds
       (id, lcd_id, version, title, knowledge_version_id, import_run_id, content_hash, source_url, published_date, effective_date, end_date, active_status, review_status)
     values ($1,'39995',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'verified')
     on conflict (lcd_id, version, content_hash) do nothing`,
    [plan.lcd.id, plan.lcd.version, plan.lcd.title, versionId, runId, plan.sourceHash, `https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdId=39995`, plan.lcd.publishedDate, plan.lcd.effectiveDate, plan.lcd.endDate, activeStatus(plan.lcd.effectiveDate, plan.lcd.endDate)],
  );

  for (const link of plan.documentJurisdictions) {
    await query(
      `insert into pgx_cms_document_jurisdictions (document_type, document_id, mac_id, jurisdiction_id, import_run_id)
       values ($1,$2,$3,$4,$5) on conflict do nothing`,
      [link.documentType, link.documentId, link.macId, link.jurisdictionId, runId],
    );
  }
  for (const link of plan.codeLinks) {
    await query(
      `insert into pgx_cms_code_links
         (id, document_type, document_id, group_number, code_system, code, relationship_status, import_run_id, source_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
      [link.id, link.documentType, link.documentId, link.groupNumber, link.codeSystem, link.code, link.relationshipStatus, runId, link.sourceHash],
    );
  }
  await query("update pgx_cms_import_runs set status='committed', completed_at=now() where id=$1", [runId]);
  await query("commit");
  console.log(JSON.stringify({ ...summary, mode: target, status: "committed", runId }, null, 2));
  }
} catch (error) {
  if (!process.exitCode) await query("rollback");
  throw error;
} finally {
  await client.end();
}
