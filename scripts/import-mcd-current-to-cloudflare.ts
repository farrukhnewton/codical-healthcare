import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type CsvRow = Record<string, string>;
type SqlRow = Array<string | number | null>;

const args = new Set(process.argv.slice(2));
const shouldExecute = args.has("--execute");
const shouldSkipD1 = args.has("--skip-d1");
const shouldSkipR2 = args.has("--skip-r2");
const shouldIncludeDocumentContractors = args.has("--include-document-contractors");

const sourceRoot = path.resolve(readFlag("--root") || process.env.MCD_LOCAL_DATA_ROOT || "C:\\Users\\TekSoft\\Downloads\\all_data");
const scratchRoot = path.resolve("scratch", "cloudflare", "mcd-current");
const d1DatabaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME || "codical_mcd";
const r2Bucket = process.env.R2_BUCKET_MCD_RAW || "codical-mcd-raw";
const r2Prefix = normalizePrefix(readFlag("--prefix") || "mcd/current/v1");
const uploadConcurrency = Number(readFlag("--concurrency") || 16);

function readFlag(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function normalizePrefix(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function assertSafeConfig() {
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`CMS source folder does not exist: ${sourceRoot}`);
  }

  if (!shouldSkipR2) {
    const missing = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_MCD_RAW"].filter(
      (key) => !process.env[key],
    );
    if (missing.length > 0) {
      throw new Error(`Missing R2 environment keys: ${missing.join(", ")}`);
    }
  }
}

function csvPath(...segments: string[]) {
  return path.join(sourceRoot, ...segments);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === "\"") {
      if (inQuotes && text[i + 1] === "\"") {
        field += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function readCsv(filePath: string): CsvRow[] {
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  const headers = rows.shift();
  if (!headers) return [];

  return rows
    .filter((row) => row.some((value) => value !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function normalizeText(value: unknown) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function trimText(value: unknown, maxLength: number) {
  const text = normalizeText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function cleanDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return text;
}

function normalizeCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function hcpcsCodeType(code: string) {
  return /^\d{5}$/.test(code) ? "CPT" : "HCPCS";
}

function codeUid(codeType: string, code: string) {
  return `${codeType}:${normalizeCode(code)}`;
}

function articleUid(row: CsvRow) {
  return `article:${row.article_id}:${row.article_version}:current_article`;
}

function lcdUid(row: CsvRow) {
  return `lcd:${row.lcd_id}:${row.lcd_version}:current_lcd`;
}

function ncdUid(row: CsvRow) {
  return `ncd:${row.NCD_id}:${row.NCD_vrsn_num}:ncd`;
}

function groupUid(documentUid: string, kind: string, groupNumber: string) {
  return `${documentUid}:${kind}:${groupNumber || "ungrouped"}`;
}

function sqlValue(value: string | number | null) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function pushInsert(sql: string[], table: string, columns: string[], rows: SqlRow[]) {
  const maxStatementLength = 90_000;
  let batch: SqlRow[] = [];
  let currentLength = 0;

  function flush() {
    if (batch.length === 0) return;
    sql.push(
      `INSERT OR REPLACE INTO ${table} (${columns.map((column) => `"${column}"`).join(", ")}) VALUES\n` +
        batch.map((row) => `(${row.map(sqlValue).join(", ")})`).join(",\n") +
        ";",
    );
    batch = [];
    currentLength = 0;
  }

  for (const row of rows) {
    const rowSql = `(${row.map(sqlValue).join(", ")})`;
    if (batch.length > 0 && currentLength + rowSql.length > maxStatementLength) {
      flush();
    }
    batch.push(row);
    currentLength += rowSql.length;
  }

  flush();
}

function uniqueByKey<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = getKey(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return Array.from(map.values());
}

function createS3Client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
}

function wranglerCommand() {
  return process.execPath;
}

function wranglerArgs(args: string[]) {
  return [path.resolve("node_modules", "wrangler", "bin", "wrangler.js"), ...args];
}

function runWrangler(args: string[]) {
  const result = spawnSync(wranglerCommand(), wranglerArgs(args), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.stdout) console.log(result.stdout.trim());
  if (result.stderr) console.error(result.stderr.trim());
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler failed with exit code ${result.status}`);
}

function buildLookup(rows: CsvRow[], keyFields: string[]) {
  const map = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = keyFields.map((field) => row[field] || "").join(":");
    const existing = map.get(key);
    if (existing) existing.push(row);
    else map.set(key, [row]);
  }
  return map;
}

function fileSizeLabel(bytes: number) {
  if (bytes > 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function uploadDirectory(directory: string, objectPrefix: string) {
  const files: { filePath: string; objectKey: string; sizeBytes: number }[] = [];

  function walk(current: string) {
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, item.name);
      if (item.isDirectory()) {
        walk(filePath);
        continue;
      }
      if (!item.isFile()) continue;
      files.push({
        filePath,
        objectKey: `${objectPrefix}/${path.relative(directory, filePath).split(path.sep).join("/")}`,
        sizeBytes: fs.statSync(filePath).size,
      });
    }
  }

  walk(directory);
  files.sort((a, b) => a.objectKey.localeCompare(b.objectKey));

  const client = createS3Client();
  let uploaded = 0;
  const queue = [...files];

  async function worker() {
    for (;;) {
      const file = queue.shift();
      if (!file) return;
      await client.send(
        new PutObjectCommand({
          Bucket: r2Bucket,
          Key: file.objectKey,
          Body: fs.createReadStream(file.filePath),
          ContentType: "application/json",
          CacheControl: "private, max-age=86400",
        }),
      );
      uploaded++;
      if (uploaded === 1 || uploaded % 250 === 0) {
        console.log(`Uploaded ${uploaded.toLocaleString()} MCD shard files`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(uploadConcurrency, files.length) }, () => worker()));
  return {
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
  };
}

function buildCoverageShards(input: {
  articles: CsvRow[];
  articleHcpcs: CsvRow[];
  articleCoveredIcd: CsvRow[];
  articleNoncoveredIcd: CsvRow[];
  articleRelatedLcd: CsvRow[];
  articleRelatedNcd: CsvRow[];
}) {
  const shardDir = path.join(scratchRoot, "coverage-shards", "articles");
  fs.rmSync(shardDir, { recursive: true, force: true });
  fs.mkdirSync(shardDir, { recursive: true });

  const hcpcsByArticle = buildLookup(input.articleHcpcs, ["article_id", "article_version"]);
  const coveredByArticle = buildLookup(input.articleCoveredIcd, ["article_id", "article_version"]);
  const noncoveredByArticle = buildLookup(input.articleNoncoveredIcd, ["article_id", "article_version"]);
  const relatedLcdByArticle = buildLookup(input.articleRelatedLcd, ["article_id", "article_version"]);
  const relatedNcdByArticle = buildLookup(input.articleRelatedNcd, ["article_id", "article_version"]);

  let totalBytes = 0;
  for (const article of input.articles) {
    const key = [article.article_id, article.article_version].join(":");
    const uid = articleUid(article);

    const hcpcsGroups: Record<string, Array<Record<string, string>>> = {};
    for (const row of hcpcsByArticle.get(key) || []) {
      const group = row.hcpc_code_group || "ungrouped";
      (hcpcsGroups[group] ||= []).push({
        code: normalizeCode(row.hcpc_code_id),
        codeVersion: row.hcpc_code_version || "",
        range: row.range || "",
        shortDescription: row.short_description || "",
        longDescription: row.long_description || "",
      });
    }

    const coveredIcdGroups: Record<string, Array<Record<string, string>>> = {};
    for (const row of coveredByArticle.get(key) || []) {
      const group = row.icd10_covered_group || "ungrouped";
      (coveredIcdGroups[group] ||= []).push({
        code: normalizeCode(row.icd10_code_id),
        codeVersion: row.icd10_code_version || "",
        range: row.range || "",
        sortOrder: row.sort_order || "",
        description: row.description || "",
        asterisk: row.asterisk || "",
      });
    }

    const noncoveredIcdGroups: Record<string, Array<Record<string, string>>> = {};
    for (const row of noncoveredByArticle.get(key) || []) {
      const group = row.icd10_noncovered_group || "ungrouped";
      (noncoveredIcdGroups[group] ||= []).push({
        code: normalizeCode(row.icd10_code_id),
        codeVersion: row.icd10_code_version || "",
        range: row.range || "",
        sortOrder: row.sort_order || "",
        description: row.description || "",
      });
    }

    const payload = {
      version: "current-v1",
      documentUid: uid,
      documentKind: "article",
      articleId: article.article_id,
      articleVersion: article.article_version,
      displayId: article.display_id || `A${article.article_id}`,
      title: normalizeText(article.title),
      effectiveDate: cleanDate(article.article_eff_date),
      endDate: cleanDate(article.article_end_date),
      hcpcsGroups,
      coveredIcdGroups,
      noncoveredIcdGroups,
      relatedLcd: (relatedLcdByArticle.get(key) || []).map((row) => ({
        lcdId: row.r_lcd_id || "",
        lcdVersion: row.r_lcd_version || "",
        contractorId: row.r_contractor_id || "",
      })),
      relatedNcd: (relatedNcdByArticle.get(key) || []).map((row) => ({
        ncdId: row.r_ncd_id || "",
        ncdVersion: row.r_ncd_version || "",
      })),
    };

    const filePath = path.join(shardDir, `${article.article_id}-${article.article_version}.json`);
    const text = JSON.stringify(payload);
    fs.writeFileSync(filePath, text);
    totalBytes += Buffer.byteLength(text);
  }

  return {
    shardDir: path.join(scratchRoot, "coverage-shards"),
    articleShardCount: input.articles.length,
    totalBytes,
  };
}

async function main() {
  assertSafeConfig();
  fs.mkdirSync(scratchRoot, { recursive: true });

  console.log("Reading current CMS CSV files...");
  const articles = readCsv(csvPath("current_article", "current_article_csv", "article.csv"));
  const articleTypes = new Map(
    readCsv(csvPath("current_article", "current_article_csv", "article_type_lookup.csv")).map((row) => [
      row.article_type_id,
      row.description,
    ]),
  );
  const articleHcpcs = readCsv(csvPath("current_article", "current_article_csv", "article_x_hcpc_code.csv"));
  const articleHcpcsGroups = readCsv(csvPath("current_article", "current_article_csv", "article_x_hcpc_code_group.csv"));
  const articleCoveredGroups = readCsv(csvPath("current_article", "current_article_csv", "article_x_icd10_covered_group.csv"));
  const articleNoncoveredGroups = readCsv(csvPath("current_article", "current_article_csv", "article_x_icd10_noncovered_group.csv"));
  const articleCoveredIcd = readCsv(csvPath("current_article", "current_article_csv", "article_x_icd10_covered.csv"));
  const articleNoncoveredIcd = readCsv(csvPath("current_article", "current_article_csv", "article_x_icd10_noncovered.csv"));
  const articleContractors = readCsv(csvPath("current_article", "current_article_csv", "article_x_contractor.csv"));
  const articleJurisdictions = readCsv(csvPath("current_article", "current_article_csv", "article_x_primary_jurisdiction.csv"));
  const articleUrls = readCsv(csvPath("current_article", "current_article_csv", "article_x_urls.csv"));
  const articleRelatedDocs = readCsv(csvPath("current_article", "current_article_csv", "article_related_documents.csv"));
  const articleRelatedNcd = readCsv(csvPath("current_article", "current_article_csv", "article_related_ncd_documents.csv"));

  const lcds = readCsv(csvPath("current_lcd", "current_lcd_csv", "lcd.csv"));
  const lcdHcpcs = readCsv(csvPath("current_lcd", "current_lcd_csv", "lcd_x_hcpc_code.csv"));
  const lcdHcpcsGroups = readCsv(csvPath("current_lcd", "current_lcd_csv", "lcd_x_hcpc_code_group.csv"));
  const lcdContractors = readCsv(csvPath("current_lcd", "current_lcd_csv", "lcd_x_contractor.csv"));
  const lcdJurisdictions = readCsv(csvPath("current_lcd", "current_lcd_csv", "lcd_x_primary_jurisdiction.csv"));
  const lcdUrls = readCsv(csvPath("current_lcd", "current_lcd_csv", "lcd_x_urls.csv"));
  const lcdRelatedDocs = readCsv(csvPath("current_lcd", "current_lcd_csv", "lcd_related_documents.csv"));
  const lcdRelatedNcd = readCsv(csvPath("current_lcd", "current_lcd_csv", "lcd_related_ncd_documents.csv"));

  const ncds = readCsv(csvPath("ncd", "ncd_csv", "ncd_trkg.csv"));
  const contractorRows = uniqueByKey(
    [
      ...readCsv(csvPath("current_article", "current_article_csv", "contractor.csv")),
      ...readCsv(csvPath("current_lcd", "current_lcd_csv", "contractor.csv")),
    ],
    (row) => [row.contractor_id, row.contractor_type_id, row.contractor_version].join(":"),
  );
  const stateRows = uniqueByKey(
    [
      ...readCsv(csvPath("current_article", "current_article_csv", "state_lookup.csv")),
      ...readCsv(csvPath("current_lcd", "current_lcd_csv", "state_lookup.csv")),
    ],
    (row) => row.state_id,
  );

  const docsByCmsKey = new Map<string, string>();
  for (const row of articles) docsByCmsKey.set(`article:${row.article_id}:${row.article_version}`, articleUid(row));
  for (const row of lcds) docsByCmsKey.set(`lcd:${row.lcd_id}:${row.lcd_version}`, lcdUid(row));
  for (const row of ncds) docsByCmsKey.set(`ncd:${row.NCD_id}:${row.NCD_vrsn_num}`, ncdUid(row));

  const codeRows = new Map<string, SqlRow>();
  const addHcpcsCode = (code: string, longDescription: string, shortDescription: string) => {
    const normalized = normalizeCode(code);
    if (!normalized) return;
    const type = hcpcsCodeType(normalized);
    const uid = codeUid(type, normalized);
    if (!codeRows.has(uid)) {
      codeRows.set(uid, [uid, type, normalized, normalized, shortDescription || null, longDescription || null, null, null, null]);
    }
  };
  for (const row of [...articleHcpcs, ...lcdHcpcs]) {
    addHcpcsCode(row.hcpc_code_id, row.long_description, row.short_description);
  }

  const sourceRows: SqlRow[] = [
    ["current_article", "current_article", "current", "article", csvPath("current_article"), 37, articles.length, null],
    ["current_lcd", "current_lcd", "current", "lcd", csvPath("current_lcd"), 30, lcds.length, null],
    ["ncd", "ncd", "current", "ncd", csvPath("ncd"), 4, ncds.length, null],
  ];

  const contractorSqlRows: SqlRow[] = contractorRows.map((row) => [
    `contractor:${row.contractor_id}:${row.contractor_type_id}:${row.contractor_version}`,
    row.contractor_number || null,
    normalizeText(row.contractor_bus_name) || `Contractor ${row.contractor_id}`,
    row.contractor_type_id || null,
    row.contractor_subtype_id || null,
    row.dmerc_rgn || null,
    null,
  ]);

  const jurisdictionSqlRows: SqlRow[] = stateRows.map((row) => [
    `state:${row.state_id}`,
    row.state_id || null,
    normalizeText(row.description) || row.state_code || row.state_id,
    row.state_code || row.state_abbrev || row.abbreviation || null,
    null,
    null,
    null,
  ]);

  const documentRows: SqlRow[] = [
    ...articles.map((row) => [
      articleUid(row),
      "article",
      row.article_id,
      row.article_version,
      "current_article",
      1,
      normalizeText(row.title) || `Article ${row.article_id}`,
      row.status || null,
      articleTypes.get(row.article_type) || row.article_type || null,
      null,
      cleanDate(row.article_eff_date),
      cleanDate(row.article_end_date),
      cleanDate(row.date_retired),
      cleanDate(row.last_updated),
      cleanDate(row.article_pub_date),
      null,
      trimText(row.description || row.cms_cov_policy || row.other_comments, 1000),
      trimText([row.description, row.other_comments, row.cms_cov_policy, row.icd10_doc, row.add_icd10_info, row.revenue_para].join(" "), 3500),
      null,
      new Date().toISOString(),
      new Date().toISOString(),
      row.display_id || `A${row.article_id}`,
      row.keywords || null,
    ]),
    ...lcds.map((row) => [
      lcdUid(row),
      "lcd",
      row.lcd_id,
      row.lcd_version,
      "current_lcd",
      1,
      normalizeText(row.title) || `LCD ${row.lcd_id}`,
      row.status || null,
      "LCD",
      null,
      cleanDate(row.orig_det_eff_date || row.rev_eff_date),
      cleanDate(row.ent_det_end_date || row.rev_end_date),
      cleanDate(row.date_retired),
      cleanDate(row.last_updated),
      cleanDate(row.mcd_publish_date),
      null,
      trimText(row.indication || row.summary_of_evidence || row.cms_cov_policy, 1000),
      trimText([row.indication, row.diagnoses_support, row.diagnoses_dont_support, row.coding_guidelines, row.summary_of_evidence, row.analysis_of_evidence, row.cms_cov_policy].join(" "), 3500),
      null,
      new Date().toISOString(),
      new Date().toISOString(),
      row.display_id || `L${row.lcd_id}`,
      row.keywords || null,
    ]),
    ...ncds.map((row) => [
      ncdUid(row),
      "ncd",
      row.NCD_id,
      row.NCD_vrsn_num,
      "ncd",
      row.NCD_trmntn_dt ? 0 : 1,
      normalizeText(row.NCD_mnl_sect_title || row.itm_srvc_desc) || `NCD ${row.NCD_id}`,
      row.under_rvw === "True" ? "under_review" : "current",
      row.natl_cvrg_type || "NCD",
      null,
      cleanDate(row.NCD_efctv_dt),
      cleanDate(row.NCD_trmntn_dt),
      cleanDate(row.NCD_trmntn_dt),
      cleanDate(row.last_updt_tmstmp),
      cleanDate(row.trnsmtl_issnc_dt),
      row.NCD_mnl_sect || null,
      trimText(row.indctn_lmtn || row.itm_srvc_desc || row.othr_txt, 1000),
      trimText([row.itm_srvc_desc, row.indctn_lmtn, row.xref_txt, row.othr_txt, row.rev_hstry, row.ncd_keyword].join(" "), 3500),
      null,
      new Date().toISOString(),
      new Date().toISOString(),
      row.NCD_mnl_sect ? `NCD ${row.NCD_mnl_sect}` : `NCD ${row.NCD_id}`,
      row.ncd_keyword || null,
    ]),
  ];

  const documentContractorRows: SqlRow[] = [];
  for (const row of articleContractors) {
    const documentUid = docsByCmsKey.get(`article:${row.article_id}:${row.article_version}`);
    if (!documentUid) continue;
    documentContractorRows.push([
      documentUid,
      `contractor:${row.contractor_id}:${row.contractor_type_id}:${row.contractor_version}`,
      "current_article",
    ]);
  }
  for (const row of lcdContractors) {
    const documentUid = docsByCmsKey.get(`lcd:${row.lcd_id}:${row.lcd_version}`);
    if (!documentUid) continue;
    documentContractorRows.push([
      documentUid,
      `contractor:${row.contractor_id}:${row.contractor_type_id}:${row.contractor_version}`,
      "current_lcd",
    ]);
  }

  const documentJurisdictionRows: SqlRow[] = [];
  for (const row of articleJurisdictions) {
    const documentUid = docsByCmsKey.get(`article:${row.article_id}:${row.article_version}`);
    if (!documentUid || !row.state_id) continue;
    documentJurisdictionRows.push([documentUid, `state:${row.state_id}`, "current_article"]);
  }
  for (const row of lcdJurisdictions) {
    const documentUid = docsByCmsKey.get(`lcd:${row.lcd_id}:${row.lcd_version}`);
    if (!documentUid || !row.state_id) continue;
    documentJurisdictionRows.push([documentUid, `state:${row.state_id}`, "current_lcd"]);
  }

  const codeGroupRows: SqlRow[] = [];
  for (const row of articleHcpcsGroups) {
    const documentUid = docsByCmsKey.get(`article:${row.article_id}:${row.article_version}`);
    if (!documentUid) continue;
    codeGroupRows.push([groupUid(documentUid, "hcpcs", row.hcpc_code_group), documentUid, "hcpcs", row.hcpc_code_group || null, null, trimText(row.paragraph, 1500), null]);
  }
  for (const row of articleCoveredGroups) {
    const documentUid = docsByCmsKey.get(`article:${row.article_id}:${row.article_version}`);
    if (!documentUid) continue;
    codeGroupRows.push([groupUid(documentUid, "icd10_covered", row.icd10_covered_group), documentUid, "icd10", row.icd10_covered_group || null, "covered", trimText(row.paragraph, 1500), null]);
  }
  for (const row of articleNoncoveredGroups) {
    const documentUid = docsByCmsKey.get(`article:${row.article_id}:${row.article_version}`);
    if (!documentUid) continue;
    codeGroupRows.push([groupUid(documentUid, "icd10_noncovered", row.icd10_noncovered_group), documentUid, "icd10", row.icd10_noncovered_group || null, "noncovered", trimText(row.paragraph, 1500), null]);
  }
  for (const row of lcdHcpcsGroups) {
    const documentUid = docsByCmsKey.get(`lcd:${row.lcd_id}:${row.lcd_version}`);
    if (!documentUid) continue;
    codeGroupRows.push([groupUid(documentUid, "hcpcs", row.hcpc_code_group), documentUid, "hcpcs", row.hcpc_code_group || null, null, trimText(row.paragraph, 1500), null]);
  }

  const documentCodeRows: SqlRow[] = [];
  for (const row of articleHcpcs) {
    const documentUid = docsByCmsKey.get(`article:${row.article_id}:${row.article_version}`);
    const normalized = normalizeCode(row.hcpc_code_id);
    if (!documentUid || !normalized) continue;
    const type = hcpcsCodeType(normalized);
    documentCodeRows.push([
      documentUid,
      codeUid(type, normalized),
      groupUid(documentUid, "hcpcs", row.hcpc_code_group),
      "listed",
      null,
      row.hcpc_code_group || null,
      "current_article",
      null,
    ]);
  }
  for (const row of lcdHcpcs) {
    const documentUid = docsByCmsKey.get(`lcd:${row.lcd_id}:${row.lcd_version}`);
    const normalized = normalizeCode(row.hcpc_code_id);
    if (!documentUid || !normalized) continue;
    const type = hcpcsCodeType(normalized);
    documentCodeRows.push([
      documentUid,
      codeUid(type, normalized),
      groupUid(documentUid, "hcpcs", row.hcpc_code_group),
      "listed",
      null,
      row.hcpc_code_group || null,
      "current_lcd",
      null,
    ]);
  }

  const urlRows: SqlRow[] = [];
  for (const row of articleUrls) {
    const documentUid = docsByCmsKey.get(`article:${row.article_id}:${row.article_version}`);
    if (!documentUid || !row.url || row.url === "http://") continue;
    urlRows.push([documentUid, row.url_type_id || null, row.url, normalizeText(row.url_name || row.url_description) || null, "current_article", null]);
  }
  for (const row of lcdUrls) {
    const documentUid = docsByCmsKey.get(`lcd:${row.lcd_id}:${row.lcd_version}`);
    if (!documentUid || !row.url || row.url === "http://") continue;
    urlRows.push([documentUid, row.url_type_id || null, row.url, normalizeText(row.url_name || row.url_description) || null, "current_lcd", null]);
  }

  const relationshipRows: SqlRow[] = [];
  for (const row of articleRelatedDocs) {
    const sourceDocumentUid = docsByCmsKey.get(`article:${row.article_id}:${row.article_version}`);
    if (!sourceDocumentUid) continue;
    if (row.r_lcd_id) relationshipRows.push([sourceDocumentUid, "lcd", row.r_lcd_id, docsByCmsKey.get(`lcd:${row.r_lcd_id}:${row.r_lcd_version}`) || null, "related_lcd", "current_article", null]);
    if (row.r_article_id) relationshipRows.push([sourceDocumentUid, "article", row.r_article_id, docsByCmsKey.get(`article:${row.r_article_id}:${row.r_article_version}`) || null, "related_article", "current_article", null]);
  }
  for (const row of articleRelatedNcd) {
    const sourceDocumentUid = docsByCmsKey.get(`article:${row.article_id}:${row.article_version}`);
    if (!sourceDocumentUid || !row.r_ncd_id) continue;
    relationshipRows.push([sourceDocumentUid, "ncd", row.r_ncd_id, docsByCmsKey.get(`ncd:${row.r_ncd_id}:${row.r_ncd_version}`) || null, "related_ncd", "current_article", null]);
  }
  for (const row of lcdRelatedDocs) {
    const sourceDocumentUid = docsByCmsKey.get(`lcd:${row.lcd_id}:${row.lcd_version}`);
    if (!sourceDocumentUid || !row.r_article_id) continue;
    relationshipRows.push([sourceDocumentUid, "article", row.r_article_id, docsByCmsKey.get(`article:${row.r_article_id}:${row.r_article_version}`) || null, "related_article", "current_lcd", null]);
  }
  for (const row of lcdRelatedNcd) {
    const sourceDocumentUid = docsByCmsKey.get(`lcd:${row.lcd_id}:${row.lcd_version}`);
    if (!sourceDocumentUid || !row.r_ncd_id) continue;
    relationshipRows.push([sourceDocumentUid, "ncd", row.r_ncd_id, docsByCmsKey.get(`ncd:${row.r_ncd_id}:${row.r_ncd_version}`) || null, "related_ncd", "current_lcd", null]);
  }

  const codesByDocument = new Map<string, string[]>();
  for (const row of documentCodeRows) {
    const documentUid = String(row[0]);
    const code = String(row[1]).replace(/^[A-Z0-9]+:/, "");
    const list = codesByDocument.get(documentUid) || [];
    list.push(code);
    codesByDocument.set(documentUid, list);
  }

  const ftsRows: SqlRow[] = documentRows.map((row) => {
    const documentUid = String(row[0]);
    return [documentUid, row[1] as string, row[2] as string, row[6] as string, row[16] as string, row[17] as string, (codesByDocument.get(documentUid) || []).join(" "), ""];
  });

  const searchMetaRows: SqlRow[] = documentRows.map((row) => {
    const documentUid = String(row[0]);
    return [documentUid, new Date().toISOString(), codesByDocument.get(documentUid)?.length || 0, 1];
  });

  const coverageShards = buildCoverageShards({
    articles,
    articleHcpcs,
    articleCoveredIcd,
    articleNoncoveredIcd,
    articleRelatedLcd: articleRelatedDocs,
    articleRelatedNcd,
  });

  const sql: string[] = [
    "PRAGMA foreign_keys = OFF;",
    "DELETE FROM mcd_search_fts;",
    "DELETE FROM mcd_search_index_meta;",
    "DELETE FROM mcd_icd_cpt_crosswalk;",
    "DELETE FROM mcd_coverage_rules;",
    "DELETE FROM mcd_document_codes;",
    "DELETE FROM mcd_code_groups;",
    "DELETE FROM mcd_revision_history;",
    "DELETE FROM mcd_document_urls;",
    "DELETE FROM mcd_document_relationships;",
    "DELETE FROM mcd_document_jurisdictions;",
    "DELETE FROM mcd_document_contractors;",
    "DELETE FROM mcd_documents;",
    "DELETE FROM mcd_codes;",
    "DELETE FROM mcd_contractors;",
    "DELETE FROM mcd_jurisdictions;",
    "DELETE FROM mcd_sources;",
    "DELETE FROM mcd_import_runs;",
    "PRAGMA foreign_keys = ON;",
  ];

  pushInsert(sql, "mcd_sources", ["source_key", "dataset_key", "dataset_scope", "dataset_kind", "local_root", "file_count", "row_count", "metadata_json"], sourceRows);
  pushInsert(sql, "mcd_contractors", ["contractor_key", "contractor_number", "contractor_name", "contractor_type", "contractor_subtype", "oversight_region", "raw_json"], contractorSqlRows);
  pushInsert(sql, "mcd_jurisdictions", ["jurisdiction_key", "jurisdiction_code", "jurisdiction_name", "state_code", "region_code", "dmerc_region_code", "raw_json"], jurisdictionSqlRows);
  pushInsert(sql, "mcd_documents", ["document_uid", "document_kind", "cms_document_id", "cms_version_id", "source_key", "is_current", "title", "status", "document_type", "contractor_number", "effective_date", "end_date", "retirement_date", "last_updated_date", "publication_date", "benefit_category", "summary", "body_text", "raw_json", "created_at", "updated_at", "display_id", "keywords"], documentRows);
  if (shouldIncludeDocumentContractors) {
    pushInsert(sql, "mcd_document_contractors", ["document_uid", "contractor_key", "source_key"], uniqueByKey(documentContractorRows, (row) => `${row[0]}:${row[1]}`));
  }
  pushInsert(sql, "mcd_document_jurisdictions", ["document_uid", "jurisdiction_key", "source_key"], uniqueByKey(documentJurisdictionRows, (row) => `${row[0]}:${row[1]}`));
  pushInsert(sql, "mcd_codes", ["code_uid", "code_type", "code", "normalized_code", "short_description", "long_description", "valid_from", "valid_to", "raw_json"], Array.from(codeRows.values()));
  pushInsert(sql, "mcd_code_groups", ["group_uid", "document_uid", "group_kind", "group_number", "coverage_status", "paragraph_text", "raw_json"], uniqueByKey(codeGroupRows, (row) => String(row[0])));
  pushInsert(sql, "mcd_document_codes", ["document_uid", "code_uid", "group_uid", "relationship_type", "coverage_status", "group_number", "source_key", "raw_json"], uniqueByKey(documentCodeRows, (row) => `${row[0]}:${row[1]}:${row[3]}:${row[5]}`));
  pushInsert(sql, "mcd_document_urls", ["document_uid", "url_type", "url", "label", "source_key", "raw_json"], uniqueByKey(urlRows, (row) => `${row[0]}:${row[2]}`));
  pushInsert(sql, "mcd_document_relationships", ["source_document_uid", "related_document_kind", "related_cms_document_id", "related_document_uid", "relationship_type", "source_key", "raw_json"], uniqueByKey(relationshipRows, (row) => `${row[0]}:${row[1]}:${row[2]}:${row[4]}`));
  pushInsert(sql, "mcd_search_fts", ["document_uid", "document_kind", "cms_document_id", "title", "summary", "body_text", "codes", "contractors"], ftsRows);
  pushInsert(sql, "mcd_search_index_meta", ["document_uid", "indexed_at", "code_count", "search_rank_boost"], searchMetaRows);

  const sqlPath = path.join(scratchRoot, "mcd-current-d1-import.sql");
  fs.writeFileSync(sqlPath, `${sql.join("\n")}\n`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceRoot,
    d1DatabaseName,
    r2Bucket,
    r2Prefix,
    counts: {
      articles: articles.length,
      lcds: lcds.length,
      ncds: ncds.length,
      contractors: contractorSqlRows.length,
      jurisdictions: jurisdictionSqlRows.length,
      documents: documentRows.length,
      documentContractors: uniqueByKey(documentContractorRows, (row) => `${row[0]}:${row[1]}`).length,
      documentContractorsImported: shouldIncludeDocumentContractors,
      documentJurisdictions: uniqueByKey(documentJurisdictionRows, (row) => `${row[0]}:${row[1]}`).length,
      codes: codeRows.size,
      codeGroups: uniqueByKey(codeGroupRows, (row) => String(row[0])).length,
      documentCodes: uniqueByKey(documentCodeRows, (row) => `${row[0]}:${row[1]}:${row[3]}:${row[5]}`).length,
      urls: uniqueByKey(urlRows, (row) => `${row[0]}:${row[2]}`).length,
      relationships: uniqueByKey(relationshipRows, (row) => `${row[0]}:${row[1]}:${row[2]}:${row[4]}`).length,
      ftsRows: ftsRows.length,
      articleCoverageShards: coverageShards.articleShardCount,
      coveredIcdRowsInR2Shards: articleCoveredIcd.length,
      noncoveredIcdRowsInR2Shards: articleNoncoveredIcd.length,
    },
    sqlPath,
    sqlSize: fileSizeLabel(fs.statSync(sqlPath).size),
    coverageShardBytes: coverageShards.totalBytes,
    coverageShardSize: fileSizeLabel(coverageShards.totalBytes),
  };

  const manifestPath = path.join(scratchRoot, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));

  if (!shouldExecute) {
    console.log("\nDry run complete. Run npm run cf:import-mcd-current to import D1 data and upload R2 coverage shards.");
    return;
  }

  if (!shouldSkipD1) {
    console.log("\nImporting compact current CMS data into D1...");
    runWrangler(["d1", "execute", d1DatabaseName, "--remote", "--file", sqlPath]);
  }

  if (!shouldSkipR2) {
    console.log("\nUploading current article coverage shards to R2...");
    const uploaded = await uploadDirectory(coverageShards.shardDir, `${r2Prefix}/coverage`);
    console.log(`Uploaded ${uploaded.fileCount.toLocaleString()} files (${fileSizeLabel(uploaded.totalBytes)}) to r2://${r2Bucket}/${r2Prefix}/coverage`);
  }

  console.log("\nCurrent CMS Cloudflare import complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
