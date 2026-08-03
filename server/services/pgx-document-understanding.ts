import { PGX_GENES, isIcd10CmCodeSyntax, type PgxDiagnosisSelection, type PgxGeneResult } from "../pgx-engine";

type ClinicalFile = { buffer: Buffer; mimetype?: string; originalname?: string; size?: number };
type DocumentKind = "lab" | "requisition";
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };

export type PgxVisionMedication = { name: string; page: number; confidence: number; evidence: string };
export type PgxDocumentUnderstandingResult = {
  used: boolean;
  patientName?: string;
  selections: PgxDiagnosisSelection[];
  medications: PgxVisionMedication[];
  genes: PgxGeneResult[];
  warnings: string[];
};

const API_BASE = "https://generativelanguage.googleapis.com";
const MAX_BYTES = 14 * 1024 * 1024;
const TIMEOUT_MS = 60_000;
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const SELECTION_TYPES = new Set(["circled_preprinted", "checked_preprinted", "handwritten_circled", "handwritten", "other_mark"]);

const responseSchema = {
  type: "object",
  properties: {
    patientName: { type: "string", description: "Patient full name only; empty when not visible." },
    selectedDiagnoses: { type: "array", items: { type: "object", properties: {
      code: { type: "string" }, description: { type: "string" }, selectionType: { type: "string", enum: Array.from(SELECTION_TYPES) },
      page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["code", "description", "selectionType", "page", "confidence", "evidence"] } },
    activeMedications: { type: "array", items: { type: "object", properties: {
      name: { type: "string" }, page: { type: "integer" }, confidence: { type: "number" }, evidence: { type: "string" },
    }, required: ["name", "page", "confidence", "evidence"] } },
    geneResults: { type: "array", items: { type: "object", properties: {
      gene: { type: "string" }, genotype: { type: "string" }, phenotype: { type: "string" }, confidence: { type: "number" },
    }, required: ["gene", "genotype", "phenotype", "confidence"] } },
  },
  required: ["patientName", "selectedDiagnoses", "activeMedications", "geneResults"],
};

function clean(value: unknown, max = 180) {
  return String(value || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function confidence(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function page(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 1;
}

function normalizeCode(value: unknown) {
  const compact = clean(value).toUpperCase().replace(/[^A-Z0-9.]/g, "");
  if (isIcd10CmCodeSyntax(compact)) return compact;
  if (/^[A-Z][0-9]{3,6}$/.test(compact)) {
    const dotted = `${compact.slice(0, 3)}.${compact.slice(3)}`;
    if (isIcd10CmCodeSyntax(dotted)) return dotted;
  }
  return null;
}

function normalizePatientName(value: unknown) {
  const name = clean(value, 80).replace(/\b(?:DOB|MRN|ACCOUNT|REQUISITION|DATE)\b.*$/i, "").trim();
  return /^[A-Za-z][A-Za-z'., -]{2,79}$/.test(name) ? name : undefined;
}

function prompt(kind: DocumentKind, sourcePage?: number) {
  const shared = `Return only visible facts, never infer them. Extract the patient's full name, but no DOB, MRN, address, member ID, phone, or other demographic. Carefully inspect every page, including low-contrast handwriting.`;
  if (kind === "lab") return `${shared}\nThis is a PGx laboratory report. Extract gene results shown for this patient. Do not treat educational drug lists as active medications. Return no diagnoses unless visibly marked as patient-specific.`;
  return `${shared}\nThis is ${sourcePage ? `page ${sourcePage} isolated at high resolution from ` : ""}a clinical requisition. Identify only diagnoses and active medications visibly selected by a physician: circles around a printed row, checks/X marks, underlines, filled boxes, or handwritten entries (including handwriting inside a circle). Use spatial alignment to connect a circle or mark to its row. Inspect handwritten characters independently and compare a handwritten code to nearby printed ICD-10-CM rows; for example, preserve the decimal in a code such as F25.1. Unmarked printed lists are choices, not patient facts. Never return DOB, Date, Group, NPI, account or requisition IDs as diagnoses. Do not infer diagnoses from medications or group headings. Lower confidence when a mark is ambiguous.`;
}

function normalizeResult(parsed: any, sourcePage?: number): Omit<PgxDocumentUnderstandingResult, "used"> {
  const warnings: string[] = [];
  const selections: PgxDiagnosisSelection[] = [];
  const seenCodes = new Set<string>();
  for (const row of Array.isArray(parsed?.selectedDiagnoses) ? parsed.selectedDiagnoses : []) {
    const code = normalizeCode(row?.code);
    if (!code || seenCodes.has(code)) continue;
    const score = confidence(row.confidence);
    const sourcePageNumber = sourcePage || page(row.page);
    selections.push({ code, description: clean(row.description) || undefined, selectionType: SELECTION_TYPES.has(String(row.selectionType)) ? row.selectionType : "other_mark", page: sourcePageNumber, confidence: score, evidence: clean(row.evidence), source: "vision" });
    if (score < .8) warnings.push(`Vision found a possible ${code} selection on page ${sourcePageNumber} at ${Math.round(score * 100)}% confidence; verify it.`);
    seenCodes.add(code);
  }

  const medications: PgxVisionMedication[] = [];
  const seenDrugs = new Set<string>();
  for (const row of Array.isArray(parsed?.activeMedications) ? parsed.activeMedications : []) {
    const name = clean(row?.name, 80).replace(/[^A-Za-z0-9'./ -]/g, "").trim();
    const key = name.toLowerCase();
    if (!name || seenDrugs.has(key)) continue;
    medications.push({ name, page: sourcePage || page(row.page), confidence: confidence(row.confidence), evidence: clean(row.evidence) });
    seenDrugs.add(key);
  }

  const genes: PgxGeneResult[] = [];
  const seenGenes = new Set<string>();
  for (const row of Array.isArray(parsed?.geneResults) ? parsed.geneResults : []) {
    const gene = clean(row?.gene, 20).toUpperCase();
    if (!PGX_GENES.includes(gene) || seenGenes.has(gene)) continue;
    genes.push({ gene, genotype: clean(row.genotype, 70) || undefined, phenotype: clean(row.phenotype, 70) || undefined, confidence: confidence(row.confidence) });
    seenGenes.add(gene);
  }

  return { patientName: normalizePatientName(parsed?.patientName), selections, medications, genes, warnings };
}

export function isPgxDocumentUnderstandingConfigured() { return Boolean(process.env.GEMINI_API_KEY); }

export async function understandPgxDocument(file: ClinicalFile, kind: DocumentKind, options: { sourcePage?: number } = {}): Promise<PgxDocumentUnderstandingResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const empty = { used: false, selections: [], medications: [], genes: [], warnings: [] } as PgxDocumentUnderstandingResult;
  if (!apiKey) return { ...empty, warnings: ["Advanced visual OCR is not configured; handwriting requires manual review."] };
  const mimeType = file.mimetype || "application/octet-stream";
  if (!ACCEPTED_MIME.has(mimeType)) return empty;
  if (file.buffer.length > MAX_BYTES) return { ...empty, warnings: ["Document exceeds the 14 MB visual OCR limit; split or compress it and verify handwriting manually."] };

  const models = Array.from(new Set([clean(process.env.PGX_OCR_GEMINI_MODEL || "gemini-3.6-flash", 50), "gemini-2.5-flash"]));
  let lastError = "";
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, signal: controller.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt(kind, options.sourcePage) }, { inlineData: { mimeType, data: file.buffer.toString("base64") } }] }], generationConfig: { temperature: .05, maxOutputTokens: 4000, responseMimeType: "application/json", responseSchema } }),
      });
      const payload = await response.json().catch(() => ({})) as GeminiResponse;
      if (!response.ok) { lastError = clean(payload.error?.message || `HTTP ${response.status}`); continue; }
      const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
      if (!raw) { lastError = "empty model response"; continue; }
      return { used: true, ...normalizeResult(JSON.parse(raw), options.sourcePage) };
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? "request timed out" : clean(error instanceof Error ? error.message : error);
    } finally { clearTimeout(timeout); }
  }
  return { ...empty, warnings: [`Advanced visual OCR was unavailable (${lastError || "unknown error"}); verify handwriting manually.`] };
}

export function understandPgxRequisition(file: ClinicalFile, options: { sourcePage?: number } = {}) { return understandPgxDocument(file, "requisition", options); }
