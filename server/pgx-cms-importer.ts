import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type CsvRow = Record<string, string>;

export type PgxCmsImportPlan = {
  schemaVersion: string;
  sourceRelease: string;
  sourceFreshness: "current" | "outdated" | "unknown";
  sourceHash: string;
  article: { id: string; version: string; displayId: string; title: string; publishedDate: string | null; effectiveDate: string | null; endDate: string | null };
  lcd: { id: string; version: string; displayId: string; title: string; publishedDate: string | null; effectiveDate: string | null; endDate: string | null };
  macs: Array<{ id: string; contractorId: string; contractorTypeId: string; contractorVersion: string; contractorNumber: string; contractorName: string; contractorType: string; activeStatus: "active" | "inactive" | "unknown" }>;
  jurisdictions: Array<{ id: string; macId: string; sourceStateCode: string; stateCode: string; jurisdictionCode: string | null; jurisdictionName: string; effectiveDate: string | null; endDate: string | null }>;
  documentJurisdictions: Array<{ documentType: "article" | "lcd"; documentId: string; macId: string; jurisdictionId: string }>;
  codeLinks: Array<{ id: string; documentType: "article"; documentId: string; groupNumber: number | null; codeSystem: "CPT" | "HCPCS" | "ICD10CM"; code: string; relationshipStatus: "listed" | "supported" | "not_supported"; sourceHash: string }>;
  quarantine: string[];
};

const TARGET_ARTICLE = "59915";
const TARGET_LCD = "39995";
const SOURCE_STATE_ALIASES: Record<string, string> = {
  CNMI: "MP",
  DN: "NY",
  QN: "NY",
  UN: "NY",
};

function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(prefix: string, ...parts: string[]) {
  return `${prefix}-${hash(parts.join("|"))}`;
}

export function parseCmsCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\r" || char === "\n") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift()?.map((value) => value.trim()) || [];
  return rows
    .filter((values) => values.some(Boolean))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function readCsv(filePath: string) {
  const text = fs.readFileSync(filePath, "utf8");
  return { rows: parseCmsCsv(text), text };
}

function cleanDate(value: string | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const iso = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const compact = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  return compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : null;
}

function contractorKey(row: CsvRow) {
  return [row.contractor_id, row.contractor_type_id, row.contractor_version].join("|");
}

function numericGroup(value: string | undefined) {
  const normalized = String(value || "").match(/\d+/)?.[0];
  return normalized ? Number(normalized) : null;
}

function codeType(code: string): "CPT" | "HCPCS" {
  return /^\d{5}$/.test(code) ? "CPT" : "HCPCS";
}

function normalizeSourceState(sourceCode: string) {
  const normalized = sourceCode.trim().toUpperCase();
  const stateCode = SOURCE_STATE_ALIASES[normalized] || normalized;
  return /^[A-Z]{2}$/.test(stateCode) ? stateCode : null;
}

function requiredFile(root: string, area: "current_article" | "current_lcd", name: string) {
  const folder = area === "current_article" ? "current_article_csv" : "current_lcd_csv";
  const filePath = path.join(root, area, folder, name);
  if (!fs.existsSync(filePath)) throw new Error(`Required CMS source file is missing: ${filePath}`);
  return filePath;
}

export function buildPgxCmsImportPlan(root: string): PgxCmsImportPlan {
  const sources = {
    article: readCsv(requiredFile(root, "current_article", "article.csv")),
    articleContractors: readCsv(requiredFile(root, "current_article", "article_x_contractor.csv")),
    articleHcpcs: readCsv(requiredFile(root, "current_article", "article_x_hcpc_code.csv")),
    articleIcdSupported: readCsv(requiredFile(root, "current_article", "article_x_icd10_covered.csv")),
    articleIcdNotSupported: readCsv(requiredFile(root, "current_article", "article_x_icd10_noncovered.csv")),
    lcd: readCsv(requiredFile(root, "current_lcd", "lcd.csv")),
    lcdContractors: readCsv(requiredFile(root, "current_lcd", "lcd_x_contractor.csv")),
    contractors: readCsv(requiredFile(root, "current_article", "contractor.csv")),
    contractorTypes: readCsv(requiredFile(root, "current_article", "contractor_type_lookup.csv")),
    contractorJurisdictions: readCsv(requiredFile(root, "current_article", "contractor_jurisdiction.csv")),
    states: readCsv(requiredFile(root, "current_article", "state_lookup.csv")),
  };

  const articleRows = sources.article.rows.filter((row) => row.article_id === TARGET_ARTICLE || row.display_id?.toUpperCase() === `A${TARGET_ARTICLE}`);
  const lcdRows = sources.lcd.rows.filter((row) => row.lcd_id === TARGET_LCD || row.display_id?.toUpperCase() === `L${TARGET_LCD}`);
  if (articleRows.length !== 1) throw new Error(`Expected exactly one current A${TARGET_ARTICLE} row; found ${articleRows.length}.`);
  if (lcdRows.length !== 1) throw new Error(`Expected exactly one current L${TARGET_LCD} row; found ${lcdRows.length}.`);
  const articleRow = articleRows[0];
  const lcdRow = lcdRows[0];

  const typeById = new Map(sources.contractorTypes.rows.map((row) => [row.contractor_type_id, row.description]));
  const stateById = new Map(sources.states.rows.map((row) => [row.state_id, row]));
  const macRows = sources.contractors.rows.filter((row) => /MAC/i.test(typeById.get(row.contractor_type_id) || ""));
  const macs = macRows.map((row) => ({
    id: stableId("mac", contractorKey(row)),
    contractorId: row.contractor_id,
    contractorTypeId: row.contractor_type_id,
    contractorVersion: row.contractor_version,
    contractorNumber: row.contractor_number,
    contractorName: row.contractor_bus_name,
    contractorType: typeById.get(row.contractor_type_id) || "MAC",
    activeStatus: (/active/i.test(row.status) ? "active" : /inactive|retired|terminated/i.test(row.status) ? "inactive" : "unknown") as "active" | "inactive" | "unknown",
  }));
  const macByKey = new Map(macs.map((row) => [[row.contractorId, row.contractorTypeId, row.contractorVersion].join("|"), row]));
  const quarantine: string[] = [];

  const jurisdictions = sources.contractorJurisdictions.rows.flatMap((row) => {
    const mac = macByKey.get(contractorKey(row));
    if (!mac) return [];
    const sourceState = stateById.get(row.state_id);
    const sourceStateCode = sourceState?.state_abbrev?.trim().toUpperCase() || "";
    const stateCode = normalizeSourceState(sourceStateCode);
    if (!stateCode) {
      quarantine.push(`Unknown CMS service-area code ${sourceStateCode || row.state_id} for contractor ${mac.contractorNumber}.`);
      return [];
    }
    const id = stableId("jur", mac.id, row.state_id, row.active_date, row.term_date);
    return [{
      id,
      macId: mac.id,
      sourceStateCode,
      stateCode,
      jurisdictionCode: sourceStateCode === stateCode ? null : sourceStateCode,
      jurisdictionName: sourceState?.description || stateCode,
      effectiveDate: cleanDate(row.active_date),
      endDate: cleanDate(row.term_date),
    }];
  });
  const jurisdictionsByMac = new Map<string, typeof jurisdictions>();
  for (const row of jurisdictions) jurisdictionsByMac.set(row.macId, [...(jurisdictionsByMac.get(row.macId) || []), row]);

  const targetContractorLinks = [
    ...sources.articleContractors.rows.filter((row) => row.article_id === TARGET_ARTICLE).map((row) => ({ type: "article" as const, documentId: stableId("article", TARGET_ARTICLE, articleRow.article_version), key: contractorKey(row) })),
    ...sources.lcdContractors.rows.filter((row) => row.lcd_id === TARGET_LCD).map((row) => ({ type: "lcd" as const, documentId: stableId("lcd", TARGET_LCD, lcdRow.lcd_version), key: contractorKey(row) })),
  ];
  const documentJurisdictions = targetContractorLinks.flatMap((link) => {
    const mac = macByKey.get(link.key);
    if (!mac) {
      quarantine.push(`Target ${link.type} references a contractor version that is not classified as a MAC: ${link.key}.`);
      return [];
    }
    return (jurisdictionsByMac.get(mac.id) || []).map((jurisdiction) => ({
      documentType: link.type,
      documentId: link.documentId,
      macId: mac.id,
      jurisdictionId: jurisdiction.id,
    }));
  });

  const articleDocumentId = stableId("article", TARGET_ARTICLE, articleRow.article_version);
  const codeRows = [
    ...sources.articleHcpcs.rows.filter((row) => row.article_id === TARGET_ARTICLE).map((row) => ({ code: row.hcpc_code_id, group: row.hcpc_code_group, system: codeType(row.hcpc_code_id), status: "listed" as const, raw: row })),
    ...sources.articleIcdSupported.rows.filter((row) => row.article_id === TARGET_ARTICLE).map((row) => ({ code: row.icd10_code_id, group: row.icd10_covered_group, system: "ICD10CM" as const, status: "supported" as const, raw: row })),
    ...sources.articleIcdNotSupported.rows.filter((row) => row.article_id === TARGET_ARTICLE).map((row) => ({ code: row.icd10_code_id, group: row.icd10_noncovered_group, system: "ICD10CM" as const, status: "not_supported" as const, raw: row })),
  ];
  const codeLinks = codeRows.filter((row) => row.code).map((row) => {
    const rowHash = hash(JSON.stringify(row.raw));
    return {
      id: stableId("code", articleDocumentId, row.system, row.code, String(row.group || ""), row.status),
      documentType: "article" as const,
      documentId: articleDocumentId,
      groupNumber: numericGroup(row.group),
      codeSystem: row.system,
      code: row.code.toUpperCase(),
      relationshipStatus: row.status,
      sourceHash: rowHash,
    };
  });

  const allText = Object.values(sources).map((source) => source.text);
  const schemaVersion = hash(Object.values(sources).map((source) => Object.keys(source.rows[0] || {}).join(",")).join("|"));
  const sourceHash = hash(allText.join("\n--PGX-CMS-FILE--\n"));
  const packagePaths = [
    path.join(root, "current_article", "current_article_csv.zip"),
    path.join(root, "current_lcd", "current_lcd_csv.zip"),
  ];
  const packageDates = packagePaths.filter((filePath) => fs.existsSync(filePath)).map((filePath) => fs.statSync(filePath).mtime);
  const releaseCandidates = [articleRow.last_updated, lcdRow.last_updated, articleRow.article_pub_date, lcdRow.mcd_publish_date].filter(Boolean).sort();
  const acquiredAt = packageDates.length ? new Date(Math.min(...packageDates.map((date) => date.getTime()))) : null;
  const sourceRelease = acquiredAt?.toISOString().slice(0, 10) || releaseCandidates.at(-1) || "unknown";
  const ageDays = acquiredAt ? (Date.now() - acquiredAt.getTime()) / 86_400_000 : null;
  const sourceFreshness = ageDays === null ? "unknown" : ageDays <= 45 ? "current" : "outdated";

  if (!macs.length || !jurisdictions.length) throw new Error("CMS source contract produced no MAC/jurisdiction relationships.");
  if (!documentJurisdictions.length) throw new Error("A59915/L39995 have no source-derived MAC jurisdiction relationships.");
  if (!codeLinks.length) throw new Error("A59915 produced no code relationships.");

  return {
    schemaVersion,
    sourceRelease,
    sourceFreshness,
    sourceHash,
    article: {
      id: articleDocumentId,
      version: articleRow.article_version,
      displayId: articleRow.display_id || `A${TARGET_ARTICLE}`,
      title: articleRow.title,
      publishedDate: cleanDate(articleRow.article_pub_date),
      effectiveDate: cleanDate(articleRow.article_eff_date),
      endDate: cleanDate(articleRow.article_end_date),
    },
    lcd: {
      id: stableId("lcd", TARGET_LCD, lcdRow.lcd_version),
      version: lcdRow.lcd_version,
      displayId: lcdRow.display_id || `L${TARGET_LCD}`,
      title: lcdRow.title,
      publishedDate: cleanDate(lcdRow.mcd_publish_date),
      effectiveDate: cleanDate(lcdRow.rev_eff_date || lcdRow.orig_det_eff_date),
      endDate: cleanDate(lcdRow.rev_end_date || lcdRow.ent_det_end_date),
    },
    macs,
    jurisdictions,
    documentJurisdictions: Array.from(new Map(documentJurisdictions.map((row) => [JSON.stringify(row), row])).values()),
    codeLinks: Array.from(new Map(codeLinks.map((row) => [row.id, row])).values()),
    quarantine,
  };
}

export function summarizePgxCmsImportPlan(plan: PgxCmsImportPlan) {
  const targetStates = Array.from(new Set(plan.documentJurisdictions.map((link) =>
    plan.jurisdictions.find((jurisdiction) => jurisdiction.id === link.jurisdictionId)?.stateCode,
  ).filter(Boolean))).sort();
  return {
    mode: "dry_run",
    sourceRelease: plan.sourceRelease,
    sourceFreshness: plan.sourceFreshness,
    sourceHash: plan.sourceHash,
    schemaVersion: plan.schemaVersion,
    documents: [plan.article.displayId, plan.lcd.displayId],
    allMacVersions: plan.macs.length,
    allMacJurisdictionRows: plan.jurisdictions.length,
    targetDocumentJurisdictionRows: plan.documentJurisdictions.length,
    targetStates,
    codeLinks: plan.codeLinks.length,
    quarantineCount: plan.quarantine.length,
  };
}
