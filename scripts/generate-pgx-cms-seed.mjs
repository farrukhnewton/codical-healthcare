import fs from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/generate-pgx-cms-seed.mjs <article_x_icd10_covered.csv> <output.sql>");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift();
  return rows.filter((candidate) => candidate.length === headers.length).map((candidate) =>
    Object.fromEntries(headers.map((header, index) => [header, candidate[index]])),
  );
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const groups = new Set(["2", "3", "4", "5", "10"]);
const rows = parseCsv(fs.readFileSync(inputPath, "utf8"))
  .filter((row) => row.article_id === "59915" && row.article_version === "26" && groups.has(row.icd10_covered_group));

if (rows.length !== 298) {
  throw new Error(`Expected 298 A59915 v26 ICD-10 rows; found ${rows.length}`);
}

const cptRows = [
  [2, "81225", "CYP2C19 common-variant analysis"], [2, "81418", "Drug-metabolism panel"],
  [3, "81226", "CYP2D6 common-variant analysis"], [3, "81418", "Drug-metabolism panel"],
  [4, "81226", "CYP2D6 common-variant analysis"], [4, "81418", "Drug-metabolism panel"],
  [5, "81227", "CYP2C9 common-variant analysis"],
  [10, "81306", "NUDT15 common-variant analysis"], [10, "81335", "TPMT common-variant analysis"],
];
const values = cptRows.map(([group, code, description]) =>
  `  ('a59915-${group}-cpt-${code}', 'A59915', ${group}, 'cpt', '${code}', ${quote(description)}, 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now())`,
);
for (const row of rows) {
  const group = Number(row.icd10_covered_group);
  const code = row.icd10_code_id;
  const idCode = code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  values.push(
    `  ('a59915-${group}-icd10-${idCode}', 'A59915', ${group}, 'icd10', ${quote(code)}, ${quote(row.description)}, 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now())`,
  );
}

const sql = [
  "-- Generated from CMS current_article article_x_icd10_covered.csv.",
  "-- Article A59915 version 26; selected Groups 2, 3, 4, 5, and 10.",
  "begin;",
  "",
  "insert into public.pgx_cms_articles",
  "  (id, article_id, title, lcd_id, version, source_url, last_synced_at, updated_at)",
  "values",
  "  ('a59915', 'A59915', 'Billing and Coding: Pharmacogenomic Testing', 'L39995', '26',",
  "   'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now(), now())",
  "on conflict (article_id) do nothing;",
  "",
  "delete from public.pgx_cms_groups",
  "where article_id = 'A59915' and group_number in (2, 3, 4, 5, 10);",
  "",
  "insert into public.pgx_cms_groups",
  "  (id, article_id, group_number, group_type, code, description, source_url, updated_at)",
  "values",
  `${values.join(",\n")};`,
  "",
  "commit;",
  "",
].join("\n");

fs.writeFileSync(outputPath, sql, "utf8");
console.log(`Wrote ${values.length} rows (${rows.length} ICD-10 + ${cptRows.length} CPT) to ${outputPath}`);
