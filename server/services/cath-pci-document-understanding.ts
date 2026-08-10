import type { CoronaryModifier, CoronaryVessel, PciApproach, PciDevice, PciTechnique, CathAdjunctKind } from "../../shared/cath-pci-coding";

type ClinicalFile = { buffer: Buffer; mimetype?: string; originalname?: string; size?: number };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
export type CathVisionEvidence = { page: number; confidence: number; evidence: string };
export type CathVisionIntervention = CathVisionEvidence & { vessel?: CoronaryVessel; arteryModifier?: CoronaryModifier; graftLabel?: string; lesionsTreated?: number; stentsPlaced?: number; technique?: PciTechnique; device?: PciDevice; approach?: PciApproach; bifurcationText?: string; completedText?: string };
export type CathVisionAdjunct = CathVisionEvidence & { kind?: CathAdjunctKind; vessel?: CoronaryVessel; arteryModifier?: CoronaryModifier; performedText?: string };
export type CathVisionDiagnosis = CathVisionEvidence & { code: string; description?: string };
export type CathPciDocumentUnderstandingResult = {
  used: boolean; patientName?: string; dateOfBirth?: string; serviceDate?: string; operatorName?: string; signedReportText?: string;
  diagnostic: Record<string, string>; interventions: CathVisionIntervention[]; adjuncts: CathVisionAdjunct[]; diagnoses: CathVisionDiagnosis[]; warnings: string[];
};

const API_BASE = "https://generativelanguage.googleapis.com";
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const VESSELS = new Set<CoronaryVessel>(["left-main", "lad", "lcx", "rca", "ramus-intermedius", "bypass-graft"]);
const MODIFIERS = new Set<CoronaryModifier>(["LM", "LD", "LC", "RC", "RI", ""]);
const TECHNIQUES = new Set<PciTechnique>(["angioplasty", "atherectomy", "stent", "atherectomy-stent", "acute-mi", "cto-antegrade", "cto-antegrade-retrograde"]);
const DEVICES = new Set<PciDevice>(["drug-eluting-stent", "intraluminal-device", "no-device", "unknown"]);
const APPROACHES = new Set<PciApproach>(["percutaneous", "percutaneous-endoscopic", "unknown"]);
const ADJUNCTS = new Set<CathAdjunctKind>(["ivus-oct", "ffr-cfr", "mechanical-thrombectomy", "brachytherapy"]);
const clean = (value: unknown, max = 360) => String(value || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const score = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;
const page = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 1;
const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10)) ? clean(value, 10) : undefined;
const dx = (value: unknown) => /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(clean(value, 8).toUpperCase()) ? clean(value, 8).toUpperCase() : undefined;
const count = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 20 ? Number(value) : undefined;

const evidenceProperties = { page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" } };
const responseSchema = {
  type: "object", properties: {
    patientName: { type: "string" }, dateOfBirth: { type: "string" }, serviceDate: { type: "string" }, operatorName: { type: "string" }, signedReportText: { type: "string" },
    diagnostic: { type: "object", properties: { rightHeart: { type: "string" }, leftHeart: { type: "string" }, coronaryAngiography: { type: "string" }, bypassGraftAngiography: { type: "string" }, completeDiagnosticStudy: { type: "string" }, diagnosticMedicalNecessity: { type: "string" }, priorStudyAvailable: { type: "string" }, priorStudyAdequate: { type: "string" }, changedCondition: { type: "string" }, inadequateVisualization: { type: "string" }, intraprocedureClinicalChange: { type: "string" }, interventionDecisionBasedOnStudy: { type: "string" } } },
    interventions: { type: "array", items: { type: "object", properties: { ...evidenceProperties, vessel: { type: "string", enum: [...VESSELS] }, arteryModifier: { type: "string", enum: [...MODIFIERS] }, graftLabel: { type: "string" }, lesionsTreated: { type: "integer" }, stentsPlaced: { type: "integer" }, technique: { type: "string", enum: [...TECHNIQUES] }, device: { type: "string", enum: [...DEVICES] }, approach: { type: "string", enum: [...APPROACHES] }, bifurcationText: { type: "string" }, completedText: { type: "string" } }, required: ["page", "confidence", "evidence"] } },
    adjuncts: { type: "array", items: { type: "object", properties: { ...evidenceProperties, kind: { type: "string", enum: [...ADJUNCTS] }, vessel: { type: "string", enum: [...VESSELS] }, arteryModifier: { type: "string", enum: [...MODIFIERS] }, performedText: { type: "string" } }, required: ["page", "confidence", "evidence"] } },
    diagnoses: { type: "array", items: { type: "object", properties: { ...evidenceProperties, code: { type: "string" }, description: { type: "string" } }, required: ["code", "page", "confidence", "evidence"] } },
  }, required: ["patientName", "dateOfBirth", "serviceDate", "operatorName", "signedReportText", "diagnostic", "interventions", "adjuncts", "diagnoses"],
};

function prompt() {
  return [
    "Perform high-precision visual understanding of every page of this cardiac catheterization/PCI record, including handwriting, diagrams, device logs, hemodynamics, and final report.",
    "Return only explicitly visible facts. Never infer a vessel, treated lesion, completed intervention, device, AMI culprit, CTO direction, diagnostic indication, medical necessity, diagnosis, modifier, coverage, or code.",
    "Extract patient identity, dates, operator, exact signature/finalization wording, and exact diagnostic components: right heart, left heart, native coronary angiography, bypass-graft angiography, complete-study wording, indication, prior study availability/adequacy, changed condition, inadequate prior visualization, intraprocedure clinical change, and whether the PCI decision was based on this diagnostic study.",
    "Create one intervention row for each explicitly completed major native coronary artery or named bypass graft. Normalize LM to left-main, LAD to lad, LCX to lcx, RCA to rca, ramus to ramus-intermedius. Capture lesion count, stent count, angioplasty/atherectomy/stent/combined/emergent AMI/CTO antegrade/CTO antegrade-plus-retrograde technique, device type, approach, bifurcation wording, page, confidence, and short quoted evidence.",
    "Capture each IVUS/OCT, FFR/CFR, mechanical thrombectomy, and brachytherapy vessel separately. Capture only printed or handwritten ICD-10-CM diagnoses actually present.",
    "Use low confidence for ambiguous handwriting, unlabeled diagrams, copied-forward text, or conflicting records. Do not select CPT/HCPCS/PCS codes or create a claim.",
  ].join(" ");
}

export function normalizeCathPciVisionResult(parsed: any): Omit<CathPciDocumentUnderstandingResult, "used"> {
  const warnings: string[] = [];
  const interventions: CathVisionIntervention[] = [];
  for (const row of Array.isArray(parsed?.interventions) ? parsed.interventions : []) {
    const item: CathVisionIntervention = { page: page(row?.page), confidence: score(row?.confidence), evidence: clean(row?.evidence), vessel: VESSELS.has(row?.vessel) ? row.vessel : undefined, arteryModifier: MODIFIERS.has(row?.arteryModifier) ? row.arteryModifier : undefined, graftLabel: clean(row?.graftLabel, 100) || undefined, lesionsTreated: count(row?.lesionsTreated), stentsPlaced: count(row?.stentsPlaced), technique: TECHNIQUES.has(row?.technique) ? row.technique : undefined, device: DEVICES.has(row?.device) ? row.device : undefined, approach: APPROACHES.has(row?.approach) ? row.approach : undefined, bifurcationText: clean(row?.bifurcationText) || undefined, completedText: clean(row?.completedText) || undefined };
    if (!item.vessel && !item.evidence) continue;
    interventions.push(item);
    if (item.confidence < .9 || !item.vessel || !item.technique || !item.completedText) warnings.push(`Page ${item.page}: intervention facts require source verification.`);
  }
  const adjuncts: CathVisionAdjunct[] = [];
  for (const row of Array.isArray(parsed?.adjuncts) ? parsed.adjuncts : []) {
    const item: CathVisionAdjunct = { page: page(row?.page), confidence: score(row?.confidence), evidence: clean(row?.evidence), kind: ADJUNCTS.has(row?.kind) ? row.kind : undefined, vessel: VESSELS.has(row?.vessel) ? row.vessel : undefined, arteryModifier: MODIFIERS.has(row?.arteryModifier) ? row.arteryModifier : undefined, performedText: clean(row?.performedText) || undefined };
    if (item.kind || item.evidence) adjuncts.push(item);
    if (item.confidence < .9 || !item.kind || !item.vessel) warnings.push(`Page ${item.page}: adjunct facts require source verification.`);
  }
  const diagnoses: CathVisionDiagnosis[] = [];
  for (const row of Array.isArray(parsed?.diagnoses) ? parsed.diagnoses : []) {
    const code = dx(row?.code); if (!code) continue;
    const item = { code, description: clean(row?.description, 180) || undefined, page: page(row?.page), confidence: score(row?.confidence), evidence: clean(row?.evidence) };
    diagnoses.push(item); if (item.confidence < .9) warnings.push(`${code}: diagnosis requires source verification.`);
  }
  const diagnostic: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed?.diagnostic || {})) { const normalized = clean(value); if (normalized) diagnostic[key] = normalized; }
  return { patientName: clean(parsed?.patientName, 90).replace(/\b(?:DOB|MRN|ACCOUNT|DATE)\b.*$/i, "").trim() || undefined, dateOfBirth: date(parsed?.dateOfBirth), serviceDate: date(parsed?.serviceDate), operatorName: clean(parsed?.operatorName, 120) || undefined, signedReportText: clean(parsed?.signedReportText) || undefined, diagnostic, interventions, adjuncts, diagnoses, warnings: [...new Set(warnings)] };
}

export async function understandCathPciDocument(file: ClinicalFile): Promise<CathPciDocumentUnderstandingResult> {
  const empty: CathPciDocumentUnderstandingResult = { used: false, diagnostic: {}, interventions: [], adjuncts: [], diagnoses: [], warnings: [] };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ...empty, warnings: ["Advanced visual OCR is not configured; verify handwritten cath-lab records manually."] };
  const mimeType = file.mimetype || "application/octet-stream";
  if (!ACCEPTED_MIME.has(mimeType)) return empty;
  if (file.buffer.length > 14 * 1024 * 1024) return { ...empty, warnings: ["Document exceeds the 14 MB visual OCR limit; split it into smaller files."] };
  const models = [...new Set([clean(process.env.CATH_PCI_OCR_GEMINI_MODEL || process.env.PGX_OCR_GEMINI_MODEL || "gemini-3.6-flash", 50), "gemini-2.5-flash"])];
  let lastError = "";
  for (const model of models) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(`${API_BASE}/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, signal: controller.signal, body: JSON.stringify({ contents: [{ parts: [{ text: prompt() }, { inlineData: { mimeType, data: file.buffer.toString("base64") } }] }], generationConfig: { temperature: .02, maxOutputTokens: 8000, responseMimeType: "application/json", responseSchema } }) });
      const payload = await response.json().catch(() => ({})) as GeminiResponse;
      if (!response.ok) { lastError = clean(payload.error?.message || `HTTP ${response.status}`); continue; }
      const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
      if (!raw) { lastError = "empty model response"; continue; }
      return { used: true, ...normalizeCathPciVisionResult(JSON.parse(raw)) };
    } catch (error) { lastError = error instanceof Error && error.name === "AbortError" ? "request timed out" : clean(error instanceof Error ? error.message : error); }
    finally { clearTimeout(timeout); }
  }
  return { ...empty, warnings: [`Advanced visual OCR was unavailable (${lastError || "unknown error"}); verify the source manually.`] };
}
