import { createHash } from "node:crypto";

export const PGX_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const PGX_MAX_PDF_PAGES = 250;

export const US_SERVICE_AREA_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY", "AS", "GU", "MP", "PR", "VI",
] as const;

const US_SERVICE_AREA_SET = new Set<string>(US_SERVICE_AREA_CODES);
const SUPPORTED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "txt"]);
const MIME_BY_EXTENSION: Record<string, Set<string>> = {
  pdf: new Set(["application/pdf"]),
  png: new Set(["image/png"]),
  jpg: new Set(["image/jpeg"]),
  jpeg: new Set(["image/jpeg"]),
  txt: new Set(["text/plain"]),
};

export type PgxIntakeKind = "pdf" | "png" | "jpeg" | "txt";
export type PgxExtractionMethod = "native_pdf_text" | "manual_entry" | "approved_external_ocr";

export type PgxIntakeValidation = {
  kind: PgxIntakeKind;
  canonicalMimeType: string;
  sha256: string;
  byteSize: number;
  pageCount: number | null;
  extractionMethod: PgxExtractionMethod;
  requiresManualReview: boolean;
  warnings: string[];
};

export class PgxIntakeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PgxIntakeError";
  }
}

function fileExtension(name: string) {
  const match = name.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function beginsWith(buffer: Buffer, signature: number[]) {
  return signature.every((value, index) => buffer[index] === value);
}

function validatePdf(buffer: Buffer) {
  if (!beginsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new PgxIntakeError("signature_mismatch", "The PDF signature does not match its declared file type.");
  }
  const ascii = buffer.toString("latin1");
  if (!ascii.slice(-8192).includes("%%EOF")) {
    throw new PgxIntakeError("malformed_pdf", "The PDF is incomplete or malformed.");
  }
  if (/\/Encrypt\b/.test(ascii)) {
    throw new PgxIntakeError("password_protected_pdf", "Password-protected PDFs require a separately approved workflow.");
  }
  const pageCount = Math.max(1, (ascii.match(/\/Type\s*\/Page\b/g) || []).length);
  if (pageCount > PGX_MAX_PDF_PAGES) {
    throw new PgxIntakeError("page_limit", `PDFs may contain at most ${PGX_MAX_PDF_PAGES} pages.`);
  }
  return pageCount;
}

function validateText(buffer: Buffer) {
  if (buffer.includes(0)) throw new PgxIntakeError("binary_text", "TXT uploads cannot contain binary NUL bytes.");
  const text = buffer.toString("utf8");
  if (text.includes("\uFFFD")) throw new PgxIntakeError("invalid_utf8", "TXT uploads must be valid UTF-8 text.");
  const sample = text.slice(0, 8192);
  const controlCount = Array.from(sample).filter((char) => {
    const code = char.charCodeAt(0);
    return code < 32 && ![9, 10, 13].includes(code);
  }).length;
  if (sample.length > 0 && controlCount / sample.length > 0.01) {
    throw new PgxIntakeError("binary_text", "TXT upload contains an unsafe amount of control data.");
  }
}

export function validatePgxIntakeFile(input: {
  name: string;
  mimeType: string;
  buffer: Buffer;
}): PgxIntakeValidation {
  const { buffer } = input;
  if (!buffer.length) throw new PgxIntakeError("empty_file", "Empty PGx files are not accepted.");
  if (buffer.length > PGX_MAX_FILE_BYTES) {
    throw new PgxIntakeError("size_limit", `PGx files must be ${PGX_MAX_FILE_BYTES / 1024 / 1024} MB or smaller.`);
  }

  const extension = fileExtension(input.name);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new PgxIntakeError("unsupported_extension", "Supported PGx file extensions are PDF, PNG, JPG/JPEG, and TXT.");
  }
  const normalizedMime = input.mimeType.toLowerCase().split(";")[0].trim();
  if (!MIME_BY_EXTENSION[extension]?.has(normalizedMime)) {
    throw new PgxIntakeError("mime_mismatch", "The file extension and MIME type do not match.");
  }
  if (beginsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) || beginsWith(buffer, [0x4d, 0x5a])) {
    throw new PgxIntakeError("executable_or_archive", "Archives and executable files are not accepted.");
  }

  let kind: PgxIntakeKind;
  let canonicalMimeType: string;
  let pageCount: number | null = null;
  let extractionMethod: PgxExtractionMethod;
  let requiresManualReview = false;
  const warnings: string[] = [];

  if (extension === "pdf") {
    kind = "pdf";
    canonicalMimeType = "application/pdf";
    pageCount = validatePdf(buffer);
    extractionMethod = "native_pdf_text";
  } else if (extension === "png") {
    if (!beginsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
      throw new PgxIntakeError("signature_mismatch", "The PNG signature does not match its declared file type.");
    }
    kind = "png";
    canonicalMimeType = "image/png";
    extractionMethod = "manual_entry";
    requiresManualReview = true;
    warnings.push("Image OCR is not active; image content cannot populate claim-bound fields until manually reviewed.");
  } else if (extension === "jpg" || extension === "jpeg") {
    if (!beginsWith(buffer, [0xff, 0xd8, 0xff]) || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) {
      throw new PgxIntakeError("signature_mismatch", "The JPEG signature does not match its declared file type.");
    }
    kind = "jpeg";
    canonicalMimeType = "image/jpeg";
    extractionMethod = "manual_entry";
    requiresManualReview = true;
    warnings.push("Image OCR is not active; image content cannot populate claim-bound fields until manually reviewed.");
  } else {
    validateText(buffer);
    kind = "txt";
    canonicalMimeType = "text/plain";
    extractionMethod = "manual_entry";
  }

  return {
    kind,
    canonicalMimeType,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    byteSize: buffer.length,
    pageCount,
    extractionMethod,
    requiresManualReview,
    warnings,
  };
}

export type PgxCoverageDecisionState =
  | "supported"
  | "not_supported"
  | "insufficient_evidence"
  | "jurisdiction_not_configured"
  | "source_outdated"
  | "manual_review";

export type PgxCoverageEvidence = {
  sourceVersionId: string;
  stateCode: string;
  macId: string;
  codeSystem: "CPT" | "HCPCS" | "ICD10CM";
  code: string;
  relationshipStatus: "supported" | "not_supported" | "listed" | "manual_review";
  effectiveDate: string | null;
  endDate: string | null;
  reviewStatus: "verified" | "pending" | "quarantined" | "rejected";
};

function validIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function evaluatePgxCoverage(input: {
  stateCode?: string;
  macId?: string;
  serviceDate?: string;
  sourceStatus: "current" | "outdated" | "missing";
  evidence: PgxCoverageEvidence[];
}): { state: PgxCoverageDecisionState; sourceVersionIds: string[]; rationale: string } {
  const stateCode = String(input.stateCode || "").trim().toUpperCase();
  const macId = String(input.macId || "").trim();
  const serviceDate = String(input.serviceDate || "").trim();
  if (!US_SERVICE_AREA_SET.has(stateCode) || !macId || !validIsoDate(serviceDate)) {
    return {
      state: "jurisdiction_not_configured",
      sourceVersionIds: [],
      rationale: "Select a valid service state/territory, applicable MAC, and date of service before coverage review.",
    };
  }
  if (input.sourceStatus === "outdated") {
    return { state: "source_outdated", sourceVersionIds: [], rationale: "The configured CMS source release is outside its freshness window." };
  }
  if (input.sourceStatus === "missing") {
    return { state: "insufficient_evidence", sourceVersionIds: [], rationale: "No verified CMS source release is available for this review." };
  }

  const applicable = input.evidence.filter((row) =>
    row.stateCode === stateCode
    && row.macId === macId
    && (!row.effectiveDate || row.effectiveDate <= serviceDate)
    && (!row.endDate || row.endDate >= serviceDate),
  );
  const sourceVersionIds = Array.from(new Set(applicable.map((row) => row.sourceVersionId)));
  if (!applicable.length) {
    return { state: "insufficient_evidence", sourceVersionIds, rationale: "No date-effective source relationship matches the selected jurisdiction and MAC." };
  }
  if (applicable.some((row) => row.reviewStatus !== "verified" || row.relationshipStatus === "manual_review" || row.relationshipStatus === "listed")) {
    return { state: "manual_review", sourceVersionIds, rationale: "A matching source row exists but has not passed authoritative relationship review." };
  }
  if (applicable.some((row) => row.relationshipStatus === "not_supported")) {
    return { state: "not_supported", sourceVersionIds, rationale: "A verified, date-effective source relationship marks the candidate as not supported for this context." };
  }
  if (applicable.some((row) => row.relationshipStatus === "supported")) {
    return { state: "supported", sourceVersionIds, rationale: "A verified, date-effective source relationship supports the candidate for the selected jurisdiction and MAC." };
  }
  return { state: "manual_review", sourceVersionIds, rationale: "The evidence set requires manual coding review." };
}

export function neutralizeCsvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function buildPgxAuditHash(input: {
  tenantId: string;
  userId: string | number;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  previousEventHash?: string | null;
  timestamp: string;
}) {
  return createHash("sha256").update(JSON.stringify({
    tenantId: input.tenantId,
    userId: String(input.userId),
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId || null,
    previousEventHash: input.previousEventHash || null,
    timestamp: input.timestamp,
  })).digest("hex");
}
