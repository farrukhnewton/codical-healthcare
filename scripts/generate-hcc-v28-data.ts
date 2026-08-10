import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function records(filePath: string): Record<string, string>[] {
  const rows = parseCsv(readFileSync(filePath, "utf8"));
  const headers = rows.shift() || [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header.trim(), (row[index] || "").trim()])));
}

const sourceDir = path.resolve(process.argv[2] || "server/data/hcc/2026");
const outputPath = path.resolve(process.argv[3] || "server/hcc-cms-v28-data.ts");
const files = {
  mappings: "ICD10_CC_mappings_CMS_HCC_2026_v28.csv",
  continued: "V28_CE_Relative_Factors.csv",
  newEnrollee: "V28_NE_Relative_Factors.csv",
  categories: "V28_Diagnosis_Categories.csv",
  hierarchies: "V28_HCC_Hierarchies.csv",
  interactions: "V28_Interactions.csv",
};

const sourceHashes = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, createHash("sha256").update(readFileSync(path.join(sourceDir, file))).digest("hex")]));
const mappings: Record<string, Array<Record<string, unknown>>> = {};
for (const row of records(path.join(sourceDir, files.mappings))) {
  const code = row.ICD10.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const cc = Number(row.CC);
  if (!code || !Number.isFinite(cc)) continue;
  (mappings[code] ||= []).push({
    cc,
    ...(row.MCE_AGE_CONDITION ? { mceAgeCondition: row.MCE_AGE_CONDITION } : {}),
    ...(row.AGE_EDIT_CONDITION ? { ageEditCondition: row.AGE_EDIT_CONDITION } : {}),
    ...(row.SEX_EDIT_CONDITION ? { sexEditCondition: Number(row.SEX_EDIT_CONDITION) } : {}),
  });
}

const hierarchyRows = records(path.join(sourceDir, files.hierarchies));
const hierarchies = Object.fromEntries(hierarchyRows.map((row) => [row.HCC, Object.entries(row).filter(([key, value]) => key !== "HCC" && value).map(([, value]) => Number(value.replace("HCC", ""))).filter(Number.isFinite)]));
const categoryRows = records(path.join(sourceDir, files.categories));
const diagnosisCategories = Object.fromEntries(categoryRows.map((row) => [row.diag_category, Object.entries(row).filter(([key, value]) => key !== "diag_category" && value).map(([, value]) => Number(value.replace("HCC", ""))).filter(Number.isFinite)]));
const interactions = records(path.join(sourceDir, files.interactions)).filter((row) => row.interaction).map((row) => ({ name: row.interaction.trim(), variable1: row.var_1.trim(), variable2: row.var_2.trim() }));

const continuedRows = records(path.join(sourceDir, files.continued));
const continuedSegments = ["COMMUNITY_NA", "COMMUNITY_PBA", "COMMUNITY_FBA", "COMMUNITY_ND", "COMMUNITY_PBD", "COMMUNITY_FBD", "INSTITUTIONAL"];
const continuedCoefficients = Object.fromEntries(continuedSegments.map((segment) => [segment, Object.fromEntries(continuedRows.filter((row) => row.Variable && row[segment] !== "").map((row) => [row.Variable.trim(), Number(row[segment])]))]));
const newRows = records(path.join(sourceDir, files.newEnrollee));
const newEnrolleeCoefficients = Object.fromEntries(["NE", "NE_SNP"].map((segment) => [segment, Object.fromEntries(newRows.filter((row) => row.Variable && row[segment] !== "").map((row) => [row.Variable.trim(), Number(row[segment])]))]));
const labels = Object.fromEntries([...continuedRows.map((row) => [row.Variable?.trim(), row.Label?.trim()]), ...newRows.map((row) => [row.Variable?.trim(), row["New Enrollees"]?.trim()])].filter(([key]) => key));

const payload = { paymentYear: 2026, modelVersion: "2024 CMS-HCC V28 / PY 2026 final T package v3", mappings, hierarchies, diagnosisCategories, interactions, continuedCoefficients, newEnrolleeCoefficients, labels, sourceHashes };
writeFileSync(outputPath, `// Generated from the official CMS PY 2026 final V28 Python package. Do not edit by hand.\nimport type { HccModelData } from "../shared/hcc-coding";\nexport const CMS_HCC_V28_2026: HccModelData = ${JSON.stringify(payload)};\n`);
console.log(`Generated ${outputPath} with ${Object.keys(mappings).length} diagnosis mappings.`);
