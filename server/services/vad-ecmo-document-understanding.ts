import type { EcmoMode, SupportApproach, SupportConfiguration, SupportKind, SupportPhase } from "../../shared/vad-ecmo-coding";

type ClinicalFile = { buffer: Buffer; mimetype?: string; originalname?: string; size?: number };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };

export type VadEcmoVisionService = {
  serviceDate?: string;
  supportKind?: SupportKind;
  phase?: SupportPhase;
  ecmoMode?: EcmoMode;
  approach?: SupportApproach;
  configuration?: SupportConfiguration;
  intraoperativeText?: string;
  cardiopulmonaryBypassText?: string;
  reportingClinician?: string;
  managementText?: string;
  interrogationText?: string;
  procedureCodes: string[];
  page: number;
  confidence: number;
  evidence: string;
};

export type VadEcmoVisionDiagnosis = { code: string; description?: string; page: number; confidence: number; evidence: string };
export type VadEcmoDocumentUnderstandingResult = {
  used: boolean;
  patientName?: string;
  dateOfBirth?: string;
  services: VadEcmoVisionService[];
  diagnoses: VadEcmoVisionDiagnosis[];
  coverageFacts: string[];
  warnings: string[];
};

const API_BASE = "https://generativelanguage.googleapis.com";
const MAX_BYTES = 14 * 1024 * 1024;
const TIMEOUT_MS = 60_000;
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const SUPPORT_KINDS = new Set<SupportKind>(["ecmo", "extracorporeal-vad", "implantable-vad", "percutaneous-vad"]);
const PHASES = new Set<SupportPhase>(["initiation", "daily-management", "insertion", "reposition", "removal", "replacement", "interrogation"]);
const MODES = new Set<EcmoMode>(["vv", "va", "unknown"]);
const APPROACHES = new Set<SupportApproach>(["peripheral-percutaneous", "peripheral-open", "central-open", "open", "percutaneous", "percutaneous-endoscopic", "external", "unknown"]);
const CONFIGURATIONS = new Set<SupportConfiguration>(["single-ventricle", "biventricular", "arterial-only", "arterial-and-venous", "unknown"]);
const clean = (value: unknown, max = 300) => String(value || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const confidence = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;
const pageNumber = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 1;
const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10)) ? clean(value, 10) : undefined;
const procedure = (value: unknown) => /^[A-Z0-9]{5,7}$/.test(clean(value, 7).toUpperCase()) ? clean(value, 7).toUpperCase() : undefined;
const diagnosis = (value: unknown) => /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(clean(value, 8).toUpperCase()) ? clean(value, 8).toUpperCase() : undefined;

const responseSchema = {
  type: "object",
  properties: {
    patientName: { type: "string" }, dateOfBirth: { type: "string" },
    services: { type: "array", items: { type: "object", properties: {
      serviceDate: { type: "string" }, supportKind: { type: "string", enum: [...SUPPORT_KINDS] }, phase: { type: "string", enum: [...PHASES] },
      ecmoMode: { type: "string", enum: [...MODES] }, approach: { type: "string", enum: [...APPROACHES] }, configuration: { type: "string", enum: [...CONFIGURATIONS] },
      intraoperativeText: { type: "string" }, cardiopulmonaryBypassText: { type: "string" }, reportingClinician: { type: "string" },
      managementText: { type: "string" }, interrogationText: { type: "string" }, procedureCodes: { type: "array", items: { type: "string" } },
      page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["procedureCodes", "page", "confidence", "evidence"] } },
    diagnoses: { type: "array", items: { type: "object", properties: {
      code: { type: "string" }, description: { type: "string" }, page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["code", "page", "confidence", "evidence"] } },
    coverageFacts: { type: "array", items: { type: "string" } },
  }, required: ["patientName", "dateOfBirth", "services", "diagnoses", "coverageFacts"],
};

function prompt() {
  return `Perform high-precision visual document understanding for a VAD/ECMO coding review. Inspect every page of operative reports, perfusion records, ECMO/VAD daily notes, device interrogation reports, cath-lab records, decannulation notes, discharge summaries, and handwritten annotations. Return only facts visibly documented. Never infer shock, respiratory failure, heart failure, ECMO mode, device configuration, cannulation access, procedure performance, eligibility, coverage, or billing codes from equipment or context.

Extract patient name and date of birth. For each dated service, capture: support kind (ECMO, extracorporeal VAD, implantable VAD, or percutaneous VAD); phase; VV versus VA only when explicit; peripheral percutaneous, peripheral open, central open, open, percutaneous, or percutaneous-endoscopic approach only when explicit; ventricular/vascular configuration; exact intraoperative and cardiopulmonary-bypass language; reporting clinician; exact initiation/daily management work; exact in-person interrogation analysis/report language; and any printed procedure codes. Extract diagnosis codes only when explicitly documented. Capture NCD-related facts such as FDA indication, NYHA class, LVEF, inotrope dependence, cardiac index, medical-management duration, temporary-support duration, team, credentialing, and decision support only as verbatim coverage facts—not verified conclusions. Include page, confidence, and evidence. Lower confidence for handwriting, copied text, contradictions, unclear dates, or ambiguous device terminology. Do not select CPT/PCS codes, apply modifiers, establish medical necessity, or generate a claim.`;
}

export function normalizeVadEcmoVisionResult(parsed: any): Omit<VadEcmoDocumentUnderstandingResult, "used"> {
  const warnings: string[] = [];
  const services: VadEcmoVisionService[] = [];
  for (const row of Array.isArray(parsed?.services) ? parsed.services : []) {
    const score = confidence(row?.confidence);
    const rawCodes: unknown[] = Array.isArray(row?.procedureCodes) ? row.procedureCodes : [];
    const item: VadEcmoVisionService = {
      serviceDate: date(row?.serviceDate),
      supportKind: SUPPORT_KINDS.has(row?.supportKind) ? row.supportKind : undefined,
      phase: PHASES.has(row?.phase) ? row.phase : undefined,
      ecmoMode: MODES.has(row?.ecmoMode) ? row.ecmoMode : undefined,
      approach: APPROACHES.has(row?.approach) ? row.approach : undefined,
      configuration: CONFIGURATIONS.has(row?.configuration) ? row.configuration : undefined,
      intraoperativeText: clean(row?.intraoperativeText) || undefined,
      cardiopulmonaryBypassText: clean(row?.cardiopulmonaryBypassText) || undefined,
      reportingClinician: clean(row?.reportingClinician, 120) || undefined,
      managementText: clean(row?.managementText) || undefined,
      interrogationText: clean(row?.interrogationText) || undefined,
      procedureCodes: [...new Set(rawCodes.map(procedure).filter((value): value is string => Boolean(value)))],
      page: pageNumber(row?.page), confidence: score, evidence: clean(row?.evidence),
    };
    if (!item.serviceDate && !item.evidence) continue;
    services.push(item);
    if (score < 0.9 || !item.serviceDate || !item.supportKind || !item.phase) warnings.push(`Page ${item.page}: device-service facts require source verification.`);
  }
  const diagnoses: VadEcmoVisionDiagnosis[] = [];
  for (const row of Array.isArray(parsed?.diagnoses) ? parsed.diagnoses : []) {
    const code = diagnosis(row?.code);
    if (!code) continue;
    const score = confidence(row?.confidence);
    diagnoses.push({ code, description: clean(row?.description, 180) || undefined, page: pageNumber(row?.page), confidence: score, evidence: clean(row?.evidence) });
    if (score < 0.9) warnings.push(`${code}: diagnosis extraction requires source verification.`);
  }
  const coverageFacts = (Array.isArray(parsed?.coverageFacts) ? parsed.coverageFacts : []).map((value: unknown) => clean(value, 400)).filter(Boolean).slice(0, 40);
  return {
    patientName: clean(parsed?.patientName, 80).replace(/\b(?:DOB|MRN|ACCOUNT|DATE)\b.*$/i, "").trim() || undefined,
    dateOfBirth: date(parsed?.dateOfBirth), services, diagnoses, coverageFacts,
    warnings: [...new Set(warnings)],
  };
}

export async function understandVadEcmoDocument(file: ClinicalFile): Promise<VadEcmoDocumentUnderstandingResult> {
  const empty: VadEcmoDocumentUnderstandingResult = { used: false, services: [], diagnoses: [], coverageFacts: [], warnings: [] };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ...empty, warnings: ["Advanced visual OCR is not configured; verify handwritten VAD/ECMO records manually."] };
  const mimeType = file.mimetype || "application/octet-stream";
  if (!ACCEPTED_MIME.has(mimeType)) return empty;
  if (file.buffer.length > MAX_BYTES) return { ...empty, warnings: ["Document exceeds the 14 MB visual OCR limit; split it into smaller files."] };
  const models = [...new Set([clean(process.env.VAD_ECMO_OCR_GEMINI_MODEL || process.env.PGX_OCR_GEMINI_MODEL || "gemini-3.6-flash", 50), "gemini-2.5-flash"])];
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
      return { used: true, ...normalizeVadEcmoVisionResult(JSON.parse(raw)) };
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? "request timed out" : clean(error instanceof Error ? error.message : error);
    } finally { clearTimeout(timeout); }
  }
  return { ...empty, warnings: [`Advanced visual OCR was unavailable (${lastError || "unknown error"}); verify the source manually.`] };
}
