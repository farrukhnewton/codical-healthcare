import type { NicuCareLevel } from "../../shared/nicu-coding";

type ClinicalFile = { buffer: Buffer; mimetype?: string; originalname?: string; size?: number };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };

export type NicuVisionDay = {
  serviceDate?: string;
  presentWeightGrams?: number;
  careLevel?: NicuCareLevel;
  criticalStatusText?: string;
  intensiveServicesText?: string;
  recoveringLowBirthWeightText?: string;
  directingProvider?: string;
  providerRole?: "physician" | "npp" | "unknown";
  bedsideExamText?: string;
  planDirectionText?: string;
  dischargeMinutes?: number;
  procedureCodes: string[];
  page: number;
  confidence: number;
  evidence: string;
};

export type NicuVisionDiagnosis = {
  code: string;
  description?: string;
  page: number;
  confidence: number;
  evidence: string;
};

export type NicuDocumentUnderstandingResult = {
  used: boolean;
  patientName?: string;
  dateOfBirth?: string;
  admissionDate?: string;
  birthWeightGrams?: number;
  days: NicuVisionDay[];
  diagnoses: NicuVisionDiagnosis[];
  warnings: string[];
};

const API_BASE = "https://generativelanguage.googleapis.com";
const MAX_BYTES = 14 * 1024 * 1024;
const TIMEOUT_MS = 60_000;
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const CARE_LEVELS = new Set<NicuCareLevel>(["critical", "intensive", "routine", "discharge", "comfort-care"]);
const clean = (value: unknown, max = 200) => String(value || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const confidence = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;
const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : undefined;
const pageNumber = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 1;
const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10)) ? clean(value, 10) : undefined;
const procedure = (value: unknown) => /^[A-Z0-9]{5}$/.test(clean(value, 5).toUpperCase()) ? clean(value, 5).toUpperCase() : undefined;
const diagnosis = (value: unknown) => /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(clean(value, 8).toUpperCase()) ? clean(value, 8).toUpperCase() : undefined;

const responseSchema = {
  type: "object",
  properties: {
    patientName: { type: "string" }, dateOfBirth: { type: "string" }, admissionDate: { type: "string" }, birthWeightGrams: { type: "number" },
    days: { type: "array", items: { type: "object", properties: {
      serviceDate: { type: "string" }, presentWeightGrams: { type: "number" }, careLevel: { type: "string", enum: [...CARE_LEVELS] },
      criticalStatusText: { type: "string" }, intensiveServicesText: { type: "string" }, recoveringLowBirthWeightText: { type: "string" },
      directingProvider: { type: "string" }, providerRole: { type: "string", enum: ["physician", "npp", "unknown"] },
      bedsideExamText: { type: "string" }, planDirectionText: { type: "string" }, dischargeMinutes: { type: "number" },
      procedureCodes: { type: "array", items: { type: "string" } }, page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["procedureCodes", "page", "confidence", "evidence"] } },
    diagnoses: { type: "array", items: { type: "object", properties: {
      code: { type: "string" }, description: { type: "string" }, page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["code", "page", "confidence", "evidence"] } },
  },
  required: ["patientName", "dateOfBirth", "admissionDate", "days", "diagnoses"],
};

function prompt() {
  return `Perform high-precision visual document understanding for a neonatal inpatient coding review. Inspect every page, including handwritten daily progress notes, flowsheets, weight records, transfer records, procedure logs, discharge notes, signatures, and corrected entries. Return only facts visibly documented for this patient. Never infer critical illness, intensive-care status, recovering-low-birth-weight status, provider eligibility, diagnosis codes, procedures, or billing codes from treatment, location, gestational age, weight, or equipment.

Extract patient name, date of birth, admission date, birth weight only when explicitly labeled, and each dated daily service record. For every day, capture the printed service date, present/current body weight in grams only when clearly labeled for that day, expressly stated care level, exact language supporting critical status or intensive services, exact language identifying a recovering low-birth-weight infant, directing provider and credential, bedside examination language, plan-of-care direction language, documented discharge-management minutes, and procedure codes only when printed. Extract ICD-10-CM diagnoses only when a provider explicitly documents the code or diagnosis-to-code pairing. Include page, confidence, and a short evidence paraphrase. Lower confidence for handwriting, copied-forward text, conflicting weights/dates, ambiguous signatures, or unclear units. Do not select CPT, apply modifiers, establish medical necessity, or generate a claim.`;
}

export function normalizeNicuVisionResult(parsed: any): Omit<NicuDocumentUnderstandingResult, "used"> {
  const warnings: string[] = [];
  const days: NicuVisionDay[] = [];
  for (const row of Array.isArray(parsed?.days) ? parsed.days : []) {
    const score = confidence(row?.confidence);
    const providerRole = ["physician", "npp", "unknown"].includes(row?.providerRole) ? row.providerRole : undefined;
    const careLevel = CARE_LEVELS.has(row?.careLevel) ? row.careLevel as NicuCareLevel : undefined;
    const rawProcedureCodes: unknown[] = Array.isArray(row?.procedureCodes) ? row.procedureCodes : [];
    const procedureCodes = rawProcedureCodes.map((value: unknown) => procedure(value)).filter((value): value is string => typeof value === "string");
    const item: NicuVisionDay = {
      serviceDate: date(row?.serviceDate), presentWeightGrams: positive(row?.presentWeightGrams), careLevel,
      criticalStatusText: clean(row?.criticalStatusText, 300) || undefined,
      intensiveServicesText: clean(row?.intensiveServicesText, 300) || undefined,
      recoveringLowBirthWeightText: clean(row?.recoveringLowBirthWeightText, 200) || undefined,
      directingProvider: clean(row?.directingProvider, 100) || undefined, providerRole,
      bedsideExamText: clean(row?.bedsideExamText, 300) || undefined, planDirectionText: clean(row?.planDirectionText, 300) || undefined,
      dischargeMinutes: positive(row?.dischargeMinutes),
      procedureCodes: [...new Set(procedureCodes)],
      page: pageNumber(row?.page), confidence: score, evidence: clean(row?.evidence, 300),
    };
    if (!item.serviceDate && !item.evidence) continue;
    days.push(item);
    if (score < 0.9 || !item.serviceDate || !item.directingProvider || !item.presentWeightGrams) warnings.push(`Page ${item.page}: extracted NICU facts require source verification before daily code selection.`);
  }
  const diagnoses: NicuVisionDiagnosis[] = [];
  for (const row of Array.isArray(parsed?.diagnoses) ? parsed.diagnoses : []) {
    const code = diagnosis(row?.code);
    if (!code) continue;
    const score = confidence(row?.confidence);
    diagnoses.push({ code, description: clean(row?.description, 180) || undefined, page: pageNumber(row?.page), confidence: score, evidence: clean(row?.evidence, 300) });
    if (score < 0.9) warnings.push(`${code}: diagnosis extraction requires source verification.`);
  }
  const patientName = clean(parsed?.patientName, 80).replace(/\b(?:DOB|MRN|ACCOUNT|DATE)\b.*$/i, "").trim() || undefined;
  return {
    patientName,
    dateOfBirth: date(parsed?.dateOfBirth),
    admissionDate: date(parsed?.admissionDate),
    birthWeightGrams: positive(parsed?.birthWeightGrams),
    days,
    diagnoses,
    warnings: [...new Set(warnings)],
  };
}

export function isNicuDocumentUnderstandingConfigured() { return Boolean(process.env.GEMINI_API_KEY); }

export async function understandNicuDocument(file: ClinicalFile): Promise<NicuDocumentUnderstandingResult> {
  const empty: NicuDocumentUnderstandingResult = { used: false, days: [], diagnoses: [], warnings: [] };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ...empty, warnings: ["Advanced visual OCR is not configured; verify handwritten NICU records manually."] };
  const mimeType = file.mimetype || "application/octet-stream";
  if (!ACCEPTED_MIME.has(mimeType)) return empty;
  if (file.buffer.length > MAX_BYTES) return { ...empty, warnings: ["Document exceeds the 14 MB visual OCR limit; split it into smaller files."] };
  const models = [...new Set([clean(process.env.NICU_OCR_GEMINI_MODEL || process.env.PGX_OCR_GEMINI_MODEL || "gemini-3.6-flash", 50), "gemini-2.5-flash"])];
  let lastError = "";
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, signal: controller.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt() }, { inlineData: { mimeType, data: file.buffer.toString("base64") } }] }], generationConfig: { temperature: 0.02, maxOutputTokens: 7000, responseMimeType: "application/json", responseSchema } }),
      });
      const payload = await response.json().catch(() => ({})) as GeminiResponse;
      if (!response.ok) { lastError = clean(payload.error?.message || `HTTP ${response.status}`); continue; }
      const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
      if (!raw) { lastError = "empty model response"; continue; }
      return { used: true, ...normalizeNicuVisionResult(JSON.parse(raw)) };
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? "request timed out" : clean(error instanceof Error ? error.message : error);
    } finally { clearTimeout(timeout); }
  }
  return { ...empty, warnings: [`Advanced visual OCR was unavailable (${lastError || "unknown error"}); verify the source manually.`] };
}
