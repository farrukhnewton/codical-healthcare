export const HCC_ENGINE_VERSION = "2026.08.10.1";
export const HCC_POLICY_VERSION = "CMS-HCC-V28-PY2026-FINAL";
export const HCC_PAYMENT_YEAR = 2026;
export const HCC_DATA_COLLECTION_YEAR = 2025;
export const HCC_NORMALIZATION_FACTOR = 1.067;
export const HCC_MA_CODING_PATTERN_ADJUSTMENT = 0.059;

export type HccSex = "female" | "male";
export type HccMedicaidStatus = "none" | "partial" | "full";
export type HccEnrollmentType = "continuing" | "new";
export type HccProgramType = "ma" | "pace";
export type HccEsrdStatus = "none" | "dialysis" | "transplant" | "functioning-graft";
export type HccEvidenceStatus = "confirmed" | "review" | "unsubstantiated" | "deleted";
export type HccSignatureStatus = "signed" | "attested" | "missing";
export type HccDataSource = "physician" | "hospital-outpatient" | "hospital-inpatient" | "other";
export type HccResultStatus = "ready-for-human-review" | "hold";

export interface HccMappingRule {
  cc: number;
  mceAgeCondition?: string;
  ageEditCondition?: string;
  sexEditCondition?: 1 | 2;
}

export interface HccInteractionRule {
  name: string;
  variable1: string;
  variable2: string;
}

export interface HccModelData {
  paymentYear: number;
  modelVersion: string;
  mappings: Record<string, HccMappingRule[]>;
  hierarchies: Record<string, number[]>;
  diagnosisCategories: Record<string, number[]>;
  interactions: HccInteractionRule[];
  continuedCoefficients: Record<string, Record<string, number>>;
  newEnrolleeCoefficients: Record<string, Record<string, number>>;
  labels: Record<string, string>;
  sourceHashes: Record<string, string>;
}

export interface HccDiagnosisEvidence {
  code: string;
  serviceDate: string;
  encounterId: string;
  sourceDocumentId?: string;
  dataSource: HccDataSource;
  documentationStatus: HccEvidenceStatus;
  signatureStatus: HccSignatureStatus;
  acceptableProviderType: boolean | null;
  eligibleService: boolean | null;
  patientMatched: boolean | null;
  clinicallyAddressed: boolean | null;
  note?: string;
}

export interface HccCaseInput {
  paymentYear: 2026;
  programType: HccProgramType;
  enrollmentType: HccEnrollmentType;
  snp: boolean;
  esrdStatus: HccEsrdStatus;
  dateOfBirth: string;
  sex: HccSex;
  originalReasonForEntitlement: 0 | 1 | 2 | 3;
  medicaidStatus: HccMedicaidStatus;
  institutional: boolean;
  longTermInstitutionalMedicaid: boolean;
  diagnoses: HccDiagnosisEvidence[];
  priorYearDiagnoses: string[];
  reviewerName?: string;
}

export interface HccMappedDiagnosis {
  code: string;
  encounterIds: string[];
  status: "eligible" | "held" | "unmapped" | "deleted";
  mappedCcs: number[];
  paymentHccs: number[];
  issues: string[];
}

export interface HccContribution {
  variable: string;
  label: string;
  coefficient: number;
  kind: "demographic" | "hcc" | "interaction" | "condition-count";
}

export interface HccReviewCue {
  code: string;
  mappedHccs: number[];
  message: string;
}

export interface HccEvaluation {
  engineVersion: string;
  policyVersion: string;
  modelVersion: string;
  paymentYear: number;
  dataCollectionYear: number;
  status: HccResultStatus;
  ageAtModelCutoff: number | null;
  segment: string | null;
  diagnoses: HccMappedDiagnosis[];
  activeHccs: Array<{ hcc: number; label: string; sourceCodes: string[] }>;
  suppressedHccs: Array<{ hcc: number; suppressedBy: number }>;
  interactions: string[];
  contributions: HccContribution[];
  rawRiskScore: number | null;
  normalizedRiskScore: number | null;
  codingPatternAdjustedScore: number | null;
  normalizationFactor: number;
  codingPatternAdjustment: number;
  blockers: string[];
  warnings: string[];
  reviewCues: HccReviewCue[];
  paymentEstimate: null;
  paymentEstimateReason: string;
  humanApprovalRequired: true;
  autonomousDiagnosisSuggestion: false;
  autonomousSubmissionAllowed: false;
}

function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateAge(dateOfBirth: string, cutoff: Date): number | null {
  const birth = parseIsoDate(dateOfBirth);
  if (!birth || birth > cutoff) return null;
  let age = cutoff.getUTCFullYear() - birth.getUTCFullYear();
  if (cutoff.getUTCMonth() < birth.getUTCMonth() || (cutoff.getUTCMonth() === birth.getUTCMonth() && cutoff.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function ageRulePasses(expression: string | undefined, age: number): boolean {
  if (!expression?.trim()) return true;
  const compact = expression.toLowerCase().replace(/\s+/g, " ").trim();
  const plus = compact.match(/^age\s*(\d+)\+$/);
  if (plus) return age >= Number(plus[1]);
  const comparison = compact.match(/^age\s*(<=|>=|=|==|<|>)\s*(\d+)$/);
  if (!comparison) return false;
  const value = Number(comparison[2]);
  switch (comparison[1]) {
    case "<": return age < value;
    case "<=": return age <= value;
    case ">": return age > value;
    case ">=": return age >= value;
    default: return age === value;
  }
}

function modelAgeSexVariable(age: number, sex: HccSex): string {
  const prefix = sex === "male" ? "M" : "F";
  const ranges: Array<[number, number | null]> = [[0, 34], [35, 44], [45, 54], [55, 59], [60, 64], [65, 69], [70, 74], [75, 79], [80, 84], [85, 89], [90, 94], [95, null]];
  const range = ranges.find(([start, end]) => age >= start && (end === null || age <= end)) || ranges[0];
  return `${prefix}${range[0]}_${range[1] === null ? "GT" : range[1]}`;
}

function newEnrolleeAgeSexVariable(age: number, sex: HccSex, orec: number): string {
  const prefix = sex === "male" ? "NEM" : "NEF";
  if (age === 64 && orec === 0) return `${prefix}65`;
  if (age >= 65 && age <= 69) return `${prefix}${age}`;
  const ranges: Array<[number, number | null]> = [[0, 34], [35, 44], [45, 54], [55, 59], [60, 64], [70, 74], [75, 79], [80, 84], [85, 89], [90, 94], [95, null]];
  const range = ranges.find(([start, end]) => age >= start && (end === null || age <= end)) || ranges[0];
  return `${prefix}${range[0]}_${range[1] === null ? "GT" : range[1]}`;
}

function continuingSegment(input: HccCaseInput, age: number): string {
  if (input.institutional) return "INSTITUTIONAL";
  const disabled = age < 65;
  if (disabled) return input.medicaidStatus === "full" ? "COMMUNITY_FBD" : input.medicaidStatus === "partial" ? "COMMUNITY_PBD" : "COMMUNITY_ND";
  return input.medicaidStatus === "full" ? "COMMUNITY_FBA" : input.medicaidStatus === "partial" ? "COMMUNITY_PBA" : "COMMUNITY_NA";
}

function classifyContribution(variable: string): HccContribution["kind"] {
  if (/^HCC\d+$/.test(variable)) return "hcc";
  if (/^D(?:[1-9]|10P)$/.test(variable)) return "condition-count";
  if (variable.includes("_V28") || variable.startsWith("DISABLED_")) return "interaction";
  return "demographic";
}

function diagnosisEvidenceIssues(item: HccDiagnosisEvidence): string[] {
  const issues: string[] = [];
  const date = parseIsoDate(item.serviceDate);
  if (!date || date.getUTCFullYear() !== HCC_DATA_COLLECTION_YEAR) issues.push(`Date of service must fall in the ${HCC_DATA_COLLECTION_YEAR} data-collection year for PY ${HCC_PAYMENT_YEAR}.`);
  if (!item.encounterId.trim()) issues.push("Encounter identity is required.");
  if (item.dataSource === "other") issues.push("The source is not physician, hospital outpatient, or hospital inpatient data.");
  if (item.documentationStatus !== "confirmed") issues.push("Diagnosis is not confirmed as supported by the current medical record.");
  if (item.signatureStatus === "missing") issues.push("The record signature or permitted attestation is missing.");
  if (item.acceptableProviderType !== true) issues.push("Acceptable provider type has not been verified.");
  if (item.eligibleService !== true) issues.push("The encounter/service has not been verified against the applicable risk-adjustment eligible service list.");
  if (item.patientMatched !== true) issues.push("Patient identity has not been matched to the source record.");
  return issues;
}

export function evaluateHccCase(input: HccCaseInput, model: HccModelData): HccEvaluation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const cutoff = new Date(Date.UTC(input.paymentYear, 1, 1));
  const age = calculateAge(input.dateOfBirth, cutoff);
  if (input.paymentYear !== model.paymentYear) blockers.push(`Loaded model is for payment year ${model.paymentYear}, not ${input.paymentYear}.`);
  if (age === null) blockers.push("A valid date of birth is required to apply CMS demographic and age-edit logic.");
  if (input.programType === "pace") blockers.push("PACE requires the PY 2026 blended 2017/2024 CMS-HCC pathway; this workspace is scoped to non-PACE MA V28.");
  if (input.esrdStatus !== "none") blockers.push("Dialysis, transplant, and functioning-graft beneficiaries require the applicable CMS ESRD model, not the Part C community model.");

  const grouped = new Map<string, HccDiagnosisEvidence[]>();
  for (const diagnosis of input.diagnoses || []) {
    const code = normalizeCode(diagnosis.code);
    if (!code) continue;
    const entries = grouped.get(code) || [];
    entries.push(diagnosis);
    grouped.set(code, entries);
  }

  const mapped: HccMappedDiagnosis[] = [];
  const eligibleCodeCcs = new Map<string, number[]>();
  for (const [code, entries] of grouped) {
    const nonDeleted = entries.filter((entry) => entry.documentationStatus !== "deleted");
    if (!nonDeleted.length) {
      mapped.push({ code, encounterIds: entries.map((entry) => entry.encounterId), status: "deleted", mappedCcs: [], paymentHccs: [], issues: ["Diagnosis is marked deleted and is excluded from scoring."] });
      continue;
    }
    const best = nonDeleted.find((entry) => diagnosisEvidenceIssues(entry).length === 0);
    const evidenceIssues = best ? [] : diagnosisEvidenceIssues(nonDeleted[0]);
    const rules = model.mappings[code] || [];
    const eligibleRules = age === null ? [] : rules.filter((rule) => ageRulePasses(rule.mceAgeCondition, age) && ageRulePasses(rule.ageEditCondition, age) && (!rule.sexEditCondition || rule.sexEditCondition === (input.sex === "male" ? 1 : 2)));
    const ccs = [...new Set(eligibleRules.map((rule) => rule.cc))].sort((a, b) => a - b);
    const status = !rules.length ? "unmapped" : evidenceIssues.length || !ccs.length ? "held" : "eligible";
    const issues = [...evidenceIssues];
    if (!rules.length) issues.push("Code does not map in the CMS PY 2026 V28 Part C mapping file.");
    else if (!ccs.length) issues.push("The CMS age/sex edit for this diagnosis was not satisfied.");
    if (status === "eligible") eligibleCodeCcs.set(code, ccs);
    mapped.push({ code, encounterIds: [...new Set(nonDeleted.map((entry) => entry.encounterId))], status, mappedCcs: ccs, paymentHccs: [], issues });
  }

  const initialHccs = new Set<number>([...eligibleCodeCcs.values()].flat());
  if (initialHccs.has(223) && ![221, 222, 224, 225, 226].some((cc) => initialHccs.has(cc))) initialHccs.delete(223);
  const activeHccs = new Set(initialHccs);
  const suppressedHccs: Array<{ hcc: number; suppressedBy: number }> = [];
  for (const [dominantKey, suppressed] of Object.entries(model.hierarchies)) {
    const dominant = Number(dominantKey.replace(/^HCC/, ""));
    if (!activeHccs.has(dominant)) continue;
    for (const lower of suppressed) {
      if (activeHccs.delete(lower)) suppressedHccs.push({ hcc: lower, suppressedBy: dominant });
    }
  }

  for (const diagnosis of mapped) {
    diagnosis.paymentHccs = diagnosis.mappedCcs.filter((cc) => activeHccs.has(cc));
  }

  const flags: Record<string, number> = {};
  const sourceCodesByHcc = new Map<number, string[]>();
  for (const [code, ccs] of eligibleCodeCcs) {
    for (const cc of ccs) {
      if (!activeHccs.has(cc)) continue;
      flags[`HCC${cc}`] = 1;
      sourceCodesByHcc.set(cc, [...(sourceCodesByHcc.get(cc) || []), code]);
    }
  }

  let segment: string | null = null;
  let coefficients: Record<string, number> | null = null;
  if (age !== null && input.enrollmentType === "continuing") {
    segment = continuingSegment(input, age);
    coefficients = model.continuedCoefficients[segment] || null;
    flags[modelAgeSexVariable(age, input.sex)] = 1;
    const disabled = age < 65 && [1, 2, 3].includes(input.originalReasonForEntitlement);
    const originallyDisabled = age >= 65 && input.originalReasonForEntitlement === 1;
    flags.DISABL = disabled ? 1 : 0;
    flags.ORIGDIS = originallyDisabled ? 1 : 0;
    flags.OriginallyDisabled_Female = originallyDisabled && input.sex === "female" ? 1 : 0;
    flags.OriginallyDisabled_Male = originallyDisabled && input.sex === "male" ? 1 : 0;
    flags.LTIMCAID = input.longTermInstitutionalMedicaid ? 1 : 0;
  } else if (age !== null) {
    segment = input.snp ? "NE_SNP" : "NE";
    coefficients = model.newEnrolleeCoefficients[segment] || null;
    const originallyDisabled = age >= 65 && input.originalReasonForEntitlement === 1;
    const medicaid = input.medicaidStatus !== "none";
    const prefix = `${medicaid ? "MCAID" : "NMCAID"}_${originallyDisabled ? "ORIGDIS" : "NORIGDIS"}`;
    flags[`${prefix}_${newEnrolleeAgeSexVariable(age, input.sex, input.originalReasonForEntitlement)}`] = 1;
  }

  for (const [category, hccs] of Object.entries(model.diagnosisCategories)) flags[category] = hccs.some((hcc) => activeHccs.has(hcc)) ? 1 : 0;
  const hccCount = activeHccs.size;
  flags[hccCount >= 10 ? "D10P" : `D${hccCount}`] = hccCount > 0 ? 1 : 0;
  const interactionNames: string[] = [];
  for (const interaction of model.interactions) {
    const value = (flags[interaction.variable1] || 0) * (flags[interaction.variable2] || 0);
    flags[interaction.name] = value;
    if (value) interactionNames.push(interaction.name);
  }

  if (!coefficients) blockers.push("The required demographic coefficient segment is unavailable.");
  const contributions: HccContribution[] = [];
  if (coefficients) {
    for (const [variable, coefficient] of Object.entries(coefficients)) {
      if (!flags[variable] || !Number.isFinite(coefficient)) continue;
      contributions.push({ variable, label: model.labels[variable] || variable, coefficient: round3(coefficient * flags[variable]), kind: classifyContribution(variable) });
    }
  }
  if (input.enrollmentType === "new" && activeHccs.size) warnings.push("CMS new-enrollee scoring is demographic; mapped diagnoses remain visible for audit but do not add HCC coefficients to the new-enrollee score.");
  if (input.diagnoses.some((item) => item.documentationStatus !== "deleted" && item.clinicallyAddressed !== true)) warnings.push("One or more conditions need review for how they affected care at the encounter. This review cue is not used as a standalone automatic coding exclusion.");
  if (mapped.some((item) => item.status === "held")) warnings.push("Held diagnoses require record or encounter eligibility review and do not contribute to the score.");
  if (mapped.some((item) => item.status === "unmapped")) warnings.push("Unmapped diagnoses may still be clinically valid but do not contribute under the loaded V28 mapping.");

  const raw = coefficients ? round3(contributions.reduce((sum, item) => sum + item.coefficient, 0)) : null;
  const normalized = raw === null ? null : round3(raw / HCC_NORMALIZATION_FACTOR);
  const adjusted = normalized === null ? null : round3(normalized * (1 - HCC_MA_CODING_PATTERN_ADJUSTMENT));
  const currentEligibleCodes = new Set([...eligibleCodeCcs.keys()]);
  const reviewCues: HccReviewCue[] = [];
  for (const value of [...new Set(input.priorYearDiagnoses.map(normalizeCode).filter(Boolean))]) {
    if (currentEligibleCodes.has(value)) continue;
    const mappedHccs = [...new Set((model.mappings[value] || []).map((rule) => rule.cc))];
    reviewCues.push({ code: value, mappedHccs, message: "Historical diagnosis only. Review the current-year record; never carry forward or code it without current supported documentation." });
  }

  return {
    engineVersion: HCC_ENGINE_VERSION,
    policyVersion: HCC_POLICY_VERSION,
    modelVersion: model.modelVersion,
    paymentYear: input.paymentYear,
    dataCollectionYear: HCC_DATA_COLLECTION_YEAR,
    status: blockers.length ? "hold" : "ready-for-human-review",
    ageAtModelCutoff: age,
    segment,
    diagnoses: mapped,
    activeHccs: [...activeHccs].sort((a, b) => a - b).map((hcc) => ({ hcc, label: model.labels[`HCC${hcc}`] || `HCC ${hcc}`, sourceCodes: [...new Set(sourceCodesByHcc.get(hcc) || [])] })),
    suppressedHccs: suppressedHccs.sort((a, b) => a.hcc - b.hcc),
    interactions: interactionNames,
    contributions,
    rawRiskScore: raw,
    normalizedRiskScore: normalized,
    codingPatternAdjustedScore: adjusted,
    normalizationFactor: HCC_NORMALIZATION_FACTOR,
    codingPatternAdjustment: HCC_MA_CODING_PATTERN_ADJUSTMENT,
    blockers,
    warnings,
    reviewCues,
    paymentEstimate: null,
    paymentEstimateReason: "A member risk score is not a standalone dollar payment. CMS payment also depends on plan bids, benchmarks, county rates, rebates, enrollment, and reconciliation context, so this engine does not multiply RAF by a generic base rate.",
    humanApprovalRequired: true,
    autonomousDiagnosisSuggestion: false,
    autonomousSubmissionAllowed: false,
  };
}
