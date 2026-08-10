import type { InfusionCategory, InfusionMethod } from "../../shared/infusion-coding";

type ClinicalFile = { buffer: Buffer; mimetype?: string; originalname?: string; size?: number };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };

export type InfusionVisionAdministration = {
  drugName: string;
  hcpcsCode?: string;
  dose?: number;
  doseUnit?: string;
  discardedDose?: number;
  category?: InfusionCategory;
  method?: InfusionMethod;
  startTime?: string;
  stopTime?: string;
  accessSite?: string;
  page: number;
  confidence: number;
  evidence: string;
};

export type InfusionDocumentUnderstandingResult = {
  used: boolean;
  patientName?: string;
  serviceDate?: string;
  administrations: InfusionVisionAdministration[];
  warnings: string[];
};

const API_BASE = "https://generativelanguage.googleapis.com";
const MAX_BYTES = 14 * 1024 * 1024;
const TIMEOUT_MS = 60_000;
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const CATEGORIES = new Set<InfusionCategory>(["chemotherapy", "therapeutic", "hydration"]);
const METHODS = new Set<InfusionMethod>(["infusion", "push", "injection"]);
const clean = (value: unknown, max = 180) => String(value || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const confidence = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;
const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;
const pageNumber = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 1;
const time = (value: unknown) => /^([01]\d|2[0-3]):[0-5]\d$/.test(clean(value, 5)) ? clean(value, 5) : undefined;
const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10)) ? clean(value, 10) : undefined;

const responseSchema = {
  type: "object",
  properties: {
    patientName: { type: "string" }, serviceDate: { type: "string" },
    administrations: { type: "array", items: { type: "object", properties: {
      drugName: { type: "string" }, hcpcsCode: { type: "string" }, dose: { type: "number" }, doseUnit: { type: "string" }, discardedDose: { type: "number" },
      category: { type: "string", enum: [...CATEGORIES] }, method: { type: "string", enum: [...METHODS] }, startTime: { type: "string" }, stopTime: { type: "string" },
      accessSite: { type: "string" }, page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["drugName", "page", "confidence", "evidence"] } },
  },
  required: ["patientName", "serviceDate", "administrations"],
};

function prompt() {
  return `Perform high-precision visual document understanding for an infusion-coding review. Inspect every page, including handwritten medication administration records, nursing flowsheets, orders, pump records, and circled or corrected entries. Return only facts visibly documented for the patient; do not infer a drug, dose, route, time, access site, waste amount, or drug classification.

Extract the patient's full name, service date, and each actually administered drug or fluid. For each administration capture the exact name, HCPCS only when printed, administered dose and unit, documented discarded dose, method (infusion, push, or injection), exact 24-hour start/stop time, access site, page, confidence, and a short evidence paraphrase. Use category chemotherapy only when the record explicitly identifies chemotherapy/high-complexity administration; use hydration only for therapeutic hydration; otherwise therapeutic. Do not convert orders or planned medications into administrations. Lower confidence for handwriting, corrections, missing timestamps, or ambiguous units. Never calculate billing codes or units.`;
}

export function normalizeInfusionVisionResult(parsed: any): Omit<InfusionDocumentUnderstandingResult, "used"> {
  const administrations: InfusionVisionAdministration[] = [];
  const warnings: string[] = [];
  for (const row of Array.isArray(parsed?.administrations) ? parsed.administrations : []) {
    const drugName = clean(row?.drugName, 100);
    if (!drugName) continue;
    const category = CATEGORIES.has(row?.category) ? row.category as InfusionCategory : undefined;
    const method = METHODS.has(row?.method) ? row.method as InfusionMethod : undefined;
    const score = confidence(row?.confidence);
    const item: InfusionVisionAdministration = {
      drugName,
      hcpcsCode: /^[A-Z0-9]{5}$/.test(clean(row?.hcpcsCode, 5).toUpperCase()) ? clean(row.hcpcsCode, 5).toUpperCase() : undefined,
      dose: positive(row?.dose), doseUnit: clean(row?.doseUnit, 16).toUpperCase() || undefined, discardedDose: positive(row?.discardedDose),
      category, method, startTime: time(row?.startTime), stopTime: time(row?.stopTime), accessSite: clean(row?.accessSite, 50) || undefined,
      page: pageNumber(row?.page), confidence: score, evidence: clean(row?.evidence, 240),
    };
    administrations.push(item);
    if (score < 0.85 || !item.startTime || (!item.stopTime && item.method !== "injection") || !item.dose || !item.doseUnit) warnings.push(`${drugName}: extracted values require source verification before coding.`);
  }
  const patientName = clean(parsed?.patientName, 80).replace(/\b(?:DOB|MRN|ACCOUNT|DATE)\b.*$/i, "").trim() || undefined;
  return { patientName, serviceDate: date(parsed?.serviceDate), administrations, warnings: [...new Set(warnings)] };
}

export function isInfusionDocumentUnderstandingConfigured() { return Boolean(process.env.GEMINI_API_KEY); }

export async function understandInfusionDocument(file: ClinicalFile): Promise<InfusionDocumentUnderstandingResult> {
  const empty: InfusionDocumentUnderstandingResult = { used: false, administrations: [], warnings: [] };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ...empty, warnings: ["Advanced visual OCR is not configured; verify handwritten flowsheets manually."] };
  const mimeType = file.mimetype || "application/octet-stream";
  if (!ACCEPTED_MIME.has(mimeType)) return empty;
  if (file.buffer.length > MAX_BYTES) return { ...empty, warnings: ["Document exceeds the 14 MB visual OCR limit; split it into smaller files."] };
  const models = [...new Set([clean(process.env.INFUSION_OCR_GEMINI_MODEL || process.env.PGX_OCR_GEMINI_MODEL || "gemini-3.6-flash", 50), "gemini-2.5-flash"])];
  let lastError = "";
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, signal: controller.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt() }, { inlineData: { mimeType, data: file.buffer.toString("base64") } }] }], generationConfig: { temperature: 0.02, maxOutputTokens: 6000, responseMimeType: "application/json", responseSchema } }),
      });
      const payload = await response.json().catch(() => ({})) as GeminiResponse;
      if (!response.ok) { lastError = clean(payload.error?.message || `HTTP ${response.status}`); continue; }
      const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
      if (!raw) { lastError = "empty model response"; continue; }
      return { used: true, ...normalizeInfusionVisionResult(JSON.parse(raw)) };
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? "request timed out" : clean(error instanceof Error ? error.message : error);
    } finally { clearTimeout(timeout); }
  }
  return { ...empty, warnings: [`Advanced visual OCR was unavailable (${lastError || "unknown error"}); verify the source manually.`] };
}
