import { getMcdBatchPairEvidence } from "./mcd-service";
import { checkNcciBatchEdits, type NcciCheckType } from "./ncci-service";

function normalizeCodeList(values: unknown, max = 8) {
  const input = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(/[\s,;]+/)
      : [];
  const seen = new Set<string>();
  const codes: string[] = [];

  for (const value of input) {
    const code = String(value || "").trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    if (codes.length >= max) break;
  }

  return codes;
}

function normalizeNcciType(value: unknown): NcciCheckType {
  return value === "outpatient" ? "outpatient" : "practitioner";
}

export async function validateClaimCodeSet(input: {
  diagnosisCodes?: unknown;
  procedureCodes?: unknown;
  ncciType?: unknown;
  coverageLimit?: unknown;
}) {
  const diagnosisCodes = normalizeCodeList(input.diagnosisCodes);
  const procedureCodes = normalizeCodeList(input.procedureCodes);
  const ncciType = normalizeNcciType(input.ncciType);
  const warnings: string[] = [];
  let coverageValidation = null;
  let ncciValidation = null;

  if (diagnosisCodes.length === 0 && procedureCodes.length === 0) {
    const error = new Error("At least one diagnosis or procedure code is required");
    (error as any).statusCode = 400;
    throw error;
  }

  if (diagnosisCodes.length > 0 && procedureCodes.length > 0) {
    try {
      coverageValidation = await getMcdBatchPairEvidence({
        diagnosisCodes,
        procedureCodes,
        limit: input.coverageLimit || 8,
      });
      if (!coverageValidation) warnings.push("Cloudflare MCD coverage intelligence is not configured");
    } catch (error: any) {
      warnings.push(`Coverage validation failed: ${error?.message || error}`);
    }
  } else {
    warnings.push("Coverage validation requires at least one diagnosis code and one procedure code");
  }

  if (procedureCodes.length > 1) {
    try {
      ncciValidation = await checkNcciBatchEdits(procedureCodes, ncciType);
    } catch (error: any) {
      warnings.push(`NCCI validation failed: ${error?.message || error}`);
    }
  } else {
    warnings.push("NCCI validation requires at least two procedure codes");
  }

  return {
    source: "codical-claim-validation",
    diagnosisCodes,
    procedureCodes,
    ncciType,
    coverageValidation,
    ncciValidation,
    warnings,
    summary: {
      diagnosisCodeCount: diagnosisCodes.length,
      procedureCodeCount: procedureCodes.length,
      coveragePairCount: coverageValidation?.pairCount || 0,
      coverageEvidenceCount: coverageValidation?.counts?.evidence || 0,
      noncoveredPairCount: coverageValidation?.counts?.noncovered || 0,
      ncciPairCount: ncciValidation?.pairCount || 0,
      ncciEditCount: ncciValidation?.counts?.edits || 0,
      ncciModifierNotAllowedCount: ncciValidation?.counts?.modifierNotAllowed || 0,
    },
  };
}
