type ClaimValidatorHandoffSource = "workspace" | "transcription";
type ClaimValidatorNcciType = "practitioner" | "outpatient";

export type ClaimValidatorHandoff = {
  version: 1;
  source: ClaimValidatorHandoffSource;
  sourceLabel: string;
  createdAt: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  ncciType: ClaimValidatorNcciType;
  result?: unknown;
};

const CLAIM_VALIDATOR_HANDOFF_KEY = "codical_claim_validator_handoff_v1";

function normalizeCodes(values: unknown, max = 8) {
  const input = Array.isArray(values) ? values : [];
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

export function writeClaimValidatorHandoff(input: {
  source: ClaimValidatorHandoffSource;
  sourceLabel: string;
  diagnosisCodes: unknown[];
  procedureCodes: unknown[];
  ncciType?: ClaimValidatorNcciType;
  result?: unknown;
}) {
  if (typeof window === "undefined") return false;

  const handoff: ClaimValidatorHandoff = {
    version: 1,
    source: input.source,
    sourceLabel: input.sourceLabel,
    createdAt: new Date().toISOString(),
    diagnosisCodes: normalizeCodes(input.diagnosisCodes),
    procedureCodes: normalizeCodes(input.procedureCodes),
    ncciType: input.ncciType || "practitioner",
    result: input.result,
  };

  if (handoff.diagnosisCodes.length === 0 && handoff.procedureCodes.length === 0) {
    return false;
  }

  window.sessionStorage.setItem(CLAIM_VALIDATOR_HANDOFF_KEY, JSON.stringify(handoff));
  return true;
}

export function consumeClaimValidatorHandoff(): ClaimValidatorHandoff | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(CLAIM_VALIDATOR_HANDOFF_KEY);
  if (!raw) return null;

  window.sessionStorage.removeItem(CLAIM_VALIDATOR_HANDOFF_KEY);

  try {
    const parsed = JSON.parse(raw) as Partial<ClaimValidatorHandoff>;
    if (parsed.version !== 1) return null;

    return {
      version: 1 as const,
      source: parsed.source === "transcription" ? "transcription" : "workspace",
      sourceLabel: String(parsed.sourceLabel || "AI source"),
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      diagnosisCodes: normalizeCodes(parsed.diagnosisCodes),
      procedureCodes: normalizeCodes(parsed.procedureCodes),
      ncciType: parsed.ncciType === "outpatient" ? "outpatient" : "practitioner",
      result: parsed.result,
    };
  } catch {
    return null;
  }
}
