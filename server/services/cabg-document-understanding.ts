import type {
  CabgApproach,
  CabgConduitKind,
  CabgConduitSource,
  CabgHarvestMethod,
  CabgHarvestSource,
  CabgInflowSource,
} from "../../shared/cabg-coding";

type ClinicalFile = { buffer: Buffer; mimetype?: string; originalname?: string; size?: number };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };

export type CabgVisionTarget = {
  targetVessel?: string;
  conduitKind?: CabgConduitKind;
  conduitSource?: CabgConduitSource;
  inflowSource?: CabgInflowSource;
  approach?: CabgApproach;
  completedText?: string;
  page: number;
  confidence: number;
  evidence: string;
};
export type CabgVisionHarvest = {
  source?: CabgHarvestSource;
  method?: CabgHarvestMethod;
  performedText?: string;
  page: number;
  confidence: number;
  evidence: string;
};
export type CabgVisionDiagnosis = { code: string; description?: string; page: number; confidence: number; evidence: string };
export type CabgDocumentUnderstandingResult = {
  used: boolean;
  patientName?: string;
  dateOfBirth?: string;
  serviceDate?: string;
  primarySurgeon?: string;
  signedReportText?: string;
  targets: CabgVisionTarget[];
  harvests: CabgVisionHarvest[];
  redoFacts: string[];
  endarterectomyVessels: string[];
  diagnoses: CabgVisionDiagnosis[];
  sameDayProcedureCodes: string[];
  warnings: string[];
};

const API_BASE = "https://generativelanguage.googleapis.com";
const MAX_BYTES = 14 * 1024 * 1024;
const TIMEOUT_MS = 60_000;
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const CONDUIT_KINDS = new Set<CabgConduitKind>(["arterial", "venous", "synthetic", "nonautologous", "zooplastic"]);
const CONDUIT_SOURCES = new Set<CabgConduitSource>(["left-internal-mammary", "right-internal-mammary", "left-radial", "right-radial", "left-saphenous", "right-saphenous", "other-artery", "other-vein", "synthetic", "nonautologous", "zooplastic"]);
const INFLOW_SOURCES = new Set<CabgInflowSource>(["aorta", "left-internal-mammary", "right-internal-mammary", "coronary-artery", "thoracic-artery", "abdominal-artery", "unknown"]);
const APPROACHES = new Set<CabgApproach>(["open", "percutaneous-endoscopic", "unknown"]);
const HARVEST_METHODS = new Set<CabgHarvestMethod>(["none", "open", "endoscopic", "percutaneous"]);
const HARVEST_SOURCES = new Set<CabgHarvestSource>(["left-saphenous", "right-saphenous", "left-radial", "right-radial", "upper-extremity-vein", "femoropopliteal-vein", "internal-mammary", "other"]);
const clean = (value: unknown, max = 320) => String(value || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const confidence = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;
const pageNumber = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 1;
const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10)) ? clean(value, 10) : undefined;
const procedure = (value: unknown) => /^[A-Z0-9]{5,7}$/.test(clean(value, 7).toUpperCase()) ? clean(value, 7).toUpperCase() : undefined;
const diagnosis = (value: unknown) => /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(clean(value, 8).toUpperCase()) ? clean(value, 8).toUpperCase() : undefined;

const responseSchema = {
  type: "object",
  properties: {
    patientName: { type: "string" }, dateOfBirth: { type: "string" }, serviceDate: { type: "string" },
    primarySurgeon: { type: "string" }, signedReportText: { type: "string" },
    targets: { type: "array", items: { type: "object", properties: {
      targetVessel: { type: "string" }, conduitKind: { type: "string", enum: [...CONDUIT_KINDS] },
      conduitSource: { type: "string", enum: [...CONDUIT_SOURCES] }, inflowSource: { type: "string", enum: [...INFLOW_SOURCES] },
      approach: { type: "string", enum: [...APPROACHES] }, completedText: { type: "string" },
      page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["page", "confidence", "evidence"] } },
    harvests: { type: "array", items: { type: "object", properties: {
      source: { type: "string", enum: [...HARVEST_SOURCES] }, method: { type: "string", enum: [...HARVEST_METHODS] },
      performedText: { type: "string" }, page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["page", "confidence", "evidence"] } },
    redoFacts: { type: "array", items: { type: "string" } },
    endarterectomyVessels: { type: "array", items: { type: "string" } },
    diagnoses: { type: "array", items: { type: "object", properties: {
      code: { type: "string" }, description: { type: "string" }, page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["code", "page", "confidence", "evidence"] } },
    sameDayProcedureCodes: { type: "array", items: { type: "string" } },
  },
  required: ["patientName", "dateOfBirth", "serviceDate", "primarySurgeon", "signedReportText", "targets", "harvests", "redoFacts", "endarterectomyVessels", "diagnoses", "sameDayProcedureCodes"],
};

function prompt() {
  return [
    "Perform high-precision visual document understanding for a CABG professional and inpatient-facility coding review.",
    "Inspect every page of the signed operative report, graft diagram/grid, perfusion record, conduit-harvest note, valve report, discharge summary, and handwritten annotations.",
    "Return only facts visibly documented. Never infer a completed bypass, coronary target, conduit, inflow source, harvest technique, redo status, valve procedure, diagnosis, modifier, medical necessity, or code from context.",
    "Extract patient name, DOB, operative date, primary surgeon, and exact signature/finalization language.",
    "Create one target row for each explicitly completed distal coronary anastomosis. Capture target vessel, arterial/venous/other conduit kind, exact conduit source, inflow source, operative approach, completion wording, page, confidence, and quoted evidence.",
    "Sequential grafts must have separate rows only when each distal target is explicit. Do not count conduit pieces, proximal anastomoses, planned-but-abandoned grafts, or replaced failed grafts as completed targets.",
    "Capture each conduit harvest with side, source, open/endoscopic/percutaneous method, and exact evidence. Capture redo-operation facts and prior-operation dates, each coronary endarterectomy vessel, explicitly printed diagnosis codes, and all same-day procedure codes.",
    "Lower confidence for handwriting, diagrams without labels, contradictions, copied forward text, unclear dates, or ambiguous abbreviations. Do not select CPT or PCS codes, apply modifiers, determine an MS-DRG, or generate a claim.",
  ].join(" ");
}

export function normalizeCabgVisionResult(parsed: any): Omit<CabgDocumentUnderstandingResult, "used"> {
  const warnings: string[] = [];
  const targets: CabgVisionTarget[] = [];
  for (const row of Array.isArray(parsed?.targets) ? parsed.targets : []) {
    const score = confidence(row?.confidence);
    const item: CabgVisionTarget = {
      targetVessel: clean(row?.targetVessel, 80) || undefined,
      conduitKind: CONDUIT_KINDS.has(row?.conduitKind) ? row.conduitKind : undefined,
      conduitSource: CONDUIT_SOURCES.has(row?.conduitSource) ? row.conduitSource : undefined,
      inflowSource: INFLOW_SOURCES.has(row?.inflowSource) ? row.inflowSource : undefined,
      approach: APPROACHES.has(row?.approach) ? row.approach : undefined,
      completedText: clean(row?.completedText) || undefined,
      page: pageNumber(row?.page), confidence: score, evidence: clean(row?.evidence),
    };
    if (!item.targetVessel && !item.evidence) continue;
    targets.push(item);
    if (score < 0.9 || !item.targetVessel || !item.conduitKind || !item.conduitSource || !item.inflowSource || !item.completedText) warnings.push("Page " + item.page + ": distal-target facts require source verification.");
  }
  const harvests: CabgVisionHarvest[] = [];
  for (const row of Array.isArray(parsed?.harvests) ? parsed.harvests : []) {
    const score = confidence(row?.confidence);
    const item: CabgVisionHarvest = {
      source: HARVEST_SOURCES.has(row?.source) ? row.source : undefined,
      method: HARVEST_METHODS.has(row?.method) ? row.method : undefined,
      performedText: clean(row?.performedText) || undefined,
      page: pageNumber(row?.page), confidence: score, evidence: clean(row?.evidence),
    };
    if (!item.source && !item.evidence) continue;
    harvests.push(item);
    if (score < 0.9 || !item.source || !item.method || !item.performedText) warnings.push("Page " + item.page + ": conduit-harvest facts require source verification.");
  }
  const diagnoses: CabgVisionDiagnosis[] = [];
  for (const row of Array.isArray(parsed?.diagnoses) ? parsed.diagnoses : []) {
    const code = diagnosis(row?.code);
    if (!code) continue;
    const score = confidence(row?.confidence);
    diagnoses.push({ code, description: clean(row?.description, 180) || undefined, page: pageNumber(row?.page), confidence: score, evidence: clean(row?.evidence) });
    if (score < 0.9) warnings.push(code + ": diagnosis extraction requires source verification.");
  }
  return {
    patientName: clean(parsed?.patientName, 80).replace(/\b(?:DOB|MRN|ACCOUNT|DATE)\b.*$/i, "").trim() || undefined,
    dateOfBirth: date(parsed?.dateOfBirth),
    serviceDate: date(parsed?.serviceDate),
    primarySurgeon: clean(parsed?.primarySurgeon, 120) || undefined,
    signedReportText: clean(parsed?.signedReportText) || undefined,
    targets,
    harvests,
    redoFacts: (Array.isArray(parsed?.redoFacts) ? parsed.redoFacts : []).map((value: unknown) => clean(value, 400)).filter(Boolean).slice(0, 30),
    endarterectomyVessels: (Array.isArray(parsed?.endarterectomyVessels) ? parsed.endarterectomyVessels : []).map((value: unknown) => clean(value, 100)).filter(Boolean).slice(0, 12),
    diagnoses,
    sameDayProcedureCodes: [...new Set<string>((Array.isArray(parsed?.sameDayProcedureCodes) ? parsed.sameDayProcedureCodes : []).map((value: unknown) => procedure(value)).filter((value: string | undefined): value is string => Boolean(value)))],
    warnings: [...new Set(warnings)],
  };
}

export async function understandCabgDocument(file: ClinicalFile): Promise<CabgDocumentUnderstandingResult> {
  const empty: CabgDocumentUnderstandingResult = { used: false, targets: [], harvests: [], redoFacts: [], endarterectomyVessels: [], diagnoses: [], sameDayProcedureCodes: [], warnings: [] };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ...empty, warnings: ["Advanced visual OCR is not configured; verify handwritten CABG records manually."] };
  const mimeType = file.mimetype || "application/octet-stream";
  if (!ACCEPTED_MIME.has(mimeType)) return empty;
  if (file.buffer.length > MAX_BYTES) return { ...empty, warnings: ["Document exceeds the 14 MB visual OCR limit; split it into smaller files."] };
  const models = [...new Set([clean(process.env.CABG_OCR_GEMINI_MODEL || process.env.PGX_OCR_GEMINI_MODEL || "gemini-3.6-flash", 50), "gemini-2.5-flash"])];
  let lastError = "";
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(API_BASE + "/v1beta/models/" + model + ":generateContent", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt() }, { inlineData: { mimeType, data: file.buffer.toString("base64") } }] }],
          generationConfig: { temperature: 0.02, maxOutputTokens: 8000, responseMimeType: "application/json", responseSchema },
        }),
      });
      const payload = await response.json().catch(() => ({})) as GeminiResponse;
      if (!response.ok) { lastError = clean(payload.error?.message || "HTTP " + response.status); continue; }
      const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
      if (!raw) { lastError = "empty model response"; continue; }
      return { used: true, ...normalizeCabgVisionResult(JSON.parse(raw)) };
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? "request timed out" : clean(error instanceof Error ? error.message : error);
    } finally { clearTimeout(timeout); }
  }
  return { ...empty, warnings: ["Advanced visual OCR was unavailable (" + (lastError || "unknown error") + "); verify the source manually."] };
}
