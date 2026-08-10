import { BURN_REGIONS, type BurnDepth, type BurnRegionId, type BurnServiceType, type BurnSurface, type SiteGroup } from "../../shared/burn-coding";

type ClinicalFile = { buffer: Buffer; mimetype?: string; originalname?: string; size?: number };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };

export type BurnVisionDiagnosis = { code: string; description?: string; page: number; confidence: number; evidence: string };
export type BurnVisionRegion = { regionId: BurnRegionId; burnDepth: BurnDepth; percentBurned?: number; surface?: BurnSurface; page: number; confidence: number; evidence: string };
export type BurnVisionProcedure = { type: BurnServiceType; performed: boolean; siteGroup?: SiteGroup; areaCm2?: number; page: number; confidence: number; evidence: string };
export type BurnDocumentUnderstandingResult = {
  used: boolean;
  patientName?: string;
  patientAge?: number;
  serviceDate?: string;
  diagnoses: BurnVisionDiagnosis[];
  regions: BurnVisionRegion[];
  procedures: BurnVisionProcedure[];
  documentedTotalTbsa?: number;
  documentedThirdDegreeTbsa?: number;
  product?: { name?: string; hcpcs?: string; packageSizeCm2?: number; appliedAreaCm2?: number; discardedAreaCm2?: number };
  warnings: string[];
};

const API_BASE = "https://generativelanguage.googleapis.com";
const MAX_BYTES = 14 * 1024 * 1024;
const TIMEOUT_MS = 60_000;
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const PROCEDURES = new Set<BurnServiceType>(["assessment_only", "local_burn_treatment", "escharotomy", "surgical_preparation", "split_thickness_autograft", "full_thickness_autograft", "skin_substitute_sheet", "npwt", "non_burn_debridement"]);
const SITE_GROUPS = new Set<SiteGroup>(["trunk_limbs", "special_sites", "scalp_arms_legs", "nose_ears_eyelids_lips"]);
const REGION_ALIASES: Record<string, BurnRegionId> = Object.fromEntries([
  ...Object.entries(BURN_REGIONS).map(([id, row]) => [row.label.toLowerCase(), id]),
  ["anterior torso", "anterior_trunk"], ["front trunk", "anterior_trunk"], ["chest", "anterior_trunk"], ["abdomen", "anterior_trunk"],
  ["posterior torso", "posterior_trunk"], ["back", "posterior_trunk"], ["genitalia", "perineum"], ["perineal", "perineum"],
  ["right calf", "right_leg"], ["left calf", "left_leg"], ["right lower extremity", "right_leg"], ["left lower extremity", "left_leg"],
] as Array<[string, BurnRegionId]>);

const responseSchema = {
  type: "object",
  properties: {
    patientName: { type: "string" }, patientAge: { type: "number" }, serviceDate: { type: "string" },
    diagnoses: { type: "array", items: { type: "object", properties: { code: { type: "string" }, description: { type: "string" }, page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" } }, required: ["code", "description", "page", "confidence", "evidence"] } },
    burnRegions: { type: "array", items: { type: "object", properties: {
      region: { type: "string" }, depth: { type: "integer" }, percentOfRegion: { type: "number" }, surface: { type: "string" }, page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["region", "depth", "surface", "page", "confidence", "evidence"] } },
    documentedTotalTbsa: { type: "number" }, documentedThirdDegreeTbsa: { type: "number" },
    procedures: { type: "array", items: { type: "object", properties: {
      type: { type: "string", enum: Array.from(PROCEDURES) }, performed: { type: "boolean" }, siteGroup: { type: "string" }, areaCm2: { type: "number" }, page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["type", "performed", "page", "confidence", "evidence"] } },
    product: { type: "object", properties: { name: { type: "string" }, hcpcs: { type: "string" }, packageSizeCm2: { type: "number" }, appliedAreaCm2: { type: "number" }, discardedAreaCm2: { type: "number" } } },
  },
  required: ["patientName", "diagnoses", "burnRegions", "procedures"],
};

function clean(value: unknown, max = 240) { return String(value || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
function confidence(value: unknown) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }
function positiveNumber(value: unknown, max: number) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : undefined; }
function page(value: unknown, sourcePage?: number) { if (sourcePage) return sourcePage; const n = Number(value); return Number.isInteger(n) && n > 0 ? n : 1; }
function normalizePatientName(value: unknown) { const name = clean(value, 80).replace(/\b(?:DOB|MRN|ACCOUNT|DATE)\b.*$/i, "").trim(); return /^[A-Za-z][A-Za-z'., -]{2,79}$/.test(name) ? name : undefined; }
function normalizeIcd(value: unknown) { const code = clean(value, 12).toUpperCase().replace(/[^A-Z0-9.]/g, ""); return /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code) ? code : ""; }
function normalizeRegion(value: unknown): BurnRegionId | undefined {
  const key = clean(value, 60).toLowerCase().replace(/[_-]+/g, " ");
  return REGION_ALIASES[key] || (key.replace(/\s+/g, "_") in BURN_REGIONS ? key.replace(/\s+/g, "_") as BurnRegionId : undefined);
}
function normalizeSurface(value: unknown): BurnSurface | undefined {
  const surface = clean(value, 40).toLowerCase();
  if (["anterior", "front", "ventral"].includes(surface)) return "anterior";
  if (["posterior", "back", "dorsal"].includes(surface)) return "posterior";
  if (["circumferential", "both", "anterior and posterior"].includes(surface)) return "circumferential";
  return undefined;
}

function prompt(sourcePage?: number) {
  return `You are performing high-precision visual document understanding for a burn-coding review. ${sourcePage ? `This image is isolated page ${sourcePage}.` : "Inspect every page."}
Return only patient-specific facts visibly documented in this clinical note or operative report. Carefully inspect cursive handwriting, annotations, diagrams, checkmarks, and circled entries. Do not infer a diagnosis, procedure, depth, area, or TBSA from context.

Extract only the patient's full name, age (not DOB), service/procedure date, explicitly documented ICD-10-CM diagnoses, burn regions, depth, percent of that specific region affected, documented total TBSA, and performed procedures. First-degree/superficial, partial-thickness/second-degree, and full-thickness/third-degree map to depth 1, 2, and 3. Never turn a total TBSA into a per-region percentage. If the note gives a wound location without percent of region, omit percentOfRegion.

For procedures, distinguish planned/considered from actually performed. performed=true only when the record documents completion. Map to: local_burn_treatment, escharotomy, surgical_preparation, split_thickness_autograft, full_thickness_autograft, skin_substitute_sheet, npwt, non_burn_debridement, or assessment_only. Capture exact treated area in cm2 and the compatible siteGroup only when visible. Capture skin-substitute product/package/applied/discarded facts exactly. Evidence must be a short paraphrase identifying the visible mark or phrase, not a long quotation. Lower confidence for ambiguous handwriting.`;
}

export function normalizeBurnVisionResult(parsed: any, sourcePage?: number): Omit<BurnDocumentUnderstandingResult, "used"> {
  const warnings: string[] = [];
  const diagnoses: BurnVisionDiagnosis[] = [];
  const seenCodes = new Set<string>();
  for (const row of Array.isArray(parsed?.diagnoses) ? parsed.diagnoses : []) {
    const code = normalizeIcd(row?.code);
    if (!code || seenCodes.has(code)) continue;
    const score = confidence(row?.confidence);
    diagnoses.push({ code, description: clean(row?.description, 140) || undefined, page: page(row?.page, sourcePage), confidence: score, evidence: clean(row?.evidence) });
    if (score < .8) warnings.push(`Possible handwritten diagnosis ${code} needs source verification.`);
    seenCodes.add(code);
  }
  const regions: BurnVisionRegion[] = [];
  const seenRegions = new Set<string>();
  for (const row of Array.isArray(parsed?.burnRegions) ? parsed.burnRegions : []) {
    const regionId = normalizeRegion(row?.region);
    const depth = Number(row?.depth) as BurnDepth;
    if (!regionId || ![1, 2, 3].includes(depth)) continue;
    const key = `${regionId}-${depth}`;
    if (seenRegions.has(key)) continue;
    const score = confidence(row?.confidence);
    regions.push({ regionId, burnDepth: depth, percentBurned: positiveNumber(row?.percentOfRegion, 100), surface: normalizeSurface(row?.surface), page: page(row?.page, sourcePage), confidence: score, evidence: clean(row?.evidence) });
    if (score < .75) warnings.push(`${BURN_REGIONS[regionId].label} extraction needs source verification.`);
    seenRegions.add(key);
  }
  const procedures: BurnVisionProcedure[] = [];
  for (const row of Array.isArray(parsed?.procedures) ? parsed.procedures : []) {
    const type = clean(row?.type, 40) as BurnServiceType;
    if (!PROCEDURES.has(type)) continue;
    const siteGroup = SITE_GROUPS.has(row?.siteGroup as SiteGroup) ? row.siteGroup as SiteGroup : undefined;
    procedures.push({ type, performed: row?.performed === true, siteGroup, areaCm2: positiveNumber(row?.areaCm2, 1_000_000), page: page(row?.page, sourcePage), confidence: confidence(row?.confidence), evidence: clean(row?.evidence) });
  }
  const patientAge = positiveNumber(parsed?.patientAge, 120);
  const serviceDate = /^\d{4}-\d{2}-\d{2}$/.test(clean(parsed?.serviceDate, 10)) ? clean(parsed.serviceDate, 10) : undefined;
  const product = parsed?.product && typeof parsed.product === "object" ? {
    name: clean(parsed.product.name, 100) || undefined, hcpcs: clean(parsed.product.hcpcs, 12).toUpperCase() || undefined,
    packageSizeCm2: positiveNumber(parsed.product.packageSizeCm2, 1_000_000), appliedAreaCm2: positiveNumber(parsed.product.appliedAreaCm2, 1_000_000), discardedAreaCm2: positiveNumber(parsed.product.discardedAreaCm2, 1_000_000),
  } : undefined;
  return { patientName: normalizePatientName(parsed?.patientName), patientAge, serviceDate, diagnoses, regions, procedures, documentedTotalTbsa: positiveNumber(parsed?.documentedTotalTbsa, 100), documentedThirdDegreeTbsa: positiveNumber(parsed?.documentedThirdDegreeTbsa, 100), product, warnings };
}

export function isBurnDocumentUnderstandingConfigured() { return Boolean(process.env.GEMINI_API_KEY); }

export async function understandBurnDocument(file: ClinicalFile, options: { sourcePage?: number } = {}): Promise<BurnDocumentUnderstandingResult> {
  const empty: BurnDocumentUnderstandingResult = { used: false, diagnoses: [], regions: [], procedures: [], warnings: [] };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ...empty, warnings: ["Advanced visual OCR is not configured; verify handwriting manually."] };
  const mimeType = file.mimetype || "application/octet-stream";
  if (!ACCEPTED_MIME.has(mimeType)) return empty;
  if (file.buffer.length > MAX_BYTES) return { ...empty, warnings: ["Document exceeds the 14 MB visual OCR limit; split it or use page images."] };
  const models = Array.from(new Set([clean(process.env.BURN_OCR_GEMINI_MODEL || process.env.PGX_OCR_GEMINI_MODEL || "gemini-3.6-flash", 50), "gemini-2.5-flash"]));
  let lastError = "";
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, signal: controller.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt(options.sourcePage) }, { inlineData: { mimeType, data: file.buffer.toString("base64") } }] }], generationConfig: { temperature: .03, maxOutputTokens: 5000, responseMimeType: "application/json", responseSchema } }),
      });
      const payload = await response.json().catch(() => ({})) as GeminiResponse;
      if (!response.ok) { lastError = clean(payload.error?.message || `HTTP ${response.status}`); continue; }
      const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
      if (!raw) { lastError = "empty model response"; continue; }
      return { used: true, ...normalizeBurnVisionResult(JSON.parse(raw), options.sourcePage) };
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? "request timed out" : clean(error instanceof Error ? error.message : error);
    } finally { clearTimeout(timeout); }
  }
  return { ...empty, warnings: [`Advanced visual OCR was unavailable (${lastError || "unknown error"}); verify handwriting manually.`] };
}
