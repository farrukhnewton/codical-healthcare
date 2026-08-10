export const VAD_ECMO_ENGINE_VERSION = "2026.08.10.1";
export const VAD_ECMO_POLICY_VERSION = "CMS-NCD20.9.1-NCCI-PFS-PCS-2026Q3";

export type VadEcmoReviewState = true | false | null;
export type VadEcmoClaimScope = "professional" | "inpatient-facility";
export type VadEcmoPayerType = "medicare" | "medicaid" | "commercial" | "other";
export type SupportKind = "ecmo" | "extracorporeal-vad" | "implantable-vad" | "percutaneous-vad";
export type SupportPhase = "initiation" | "daily-management" | "insertion" | "reposition" | "removal" | "replacement" | "interrogation";
export type EcmoMode = "vv" | "va" | "unknown";
export type SupportApproach = "peripheral-percutaneous" | "peripheral-open" | "central-open" | "open" | "percutaneous" | "percutaneous-endoscopic" | "external" | "unknown";
export type SupportConfiguration = "single-ventricle" | "biventricular" | "arterial-only" | "arterial-and-venous" | "unknown";

export type VadEcmoDiagnosisEvidence = {
  id: string;
  code: string;
  description?: string;
  providerDocumented: VadEcmoReviewState;
  clinicallySupported: VadEcmoReviewState;
  sourceDocumentId?: string;
};

export type VadEcmoServiceInput = {
  id: string;
  serviceDate: string;
  supportKind: SupportKind;
  phase: SupportPhase;
  ecmoMode: EcmoMode;
  approach: SupportApproach;
  configuration: SupportConfiguration;
  intraoperative: VadEcmoReviewState;
  cardiopulmonaryBypassUsed: VadEcmoReviewState;
  servicePerformed: VadEcmoReviewState;
  sourceVerified: VadEcmoReviewState;
  reportingClinician: string;
  clinicianEligible: VadEcmoReviewState;
  managementDocumented: VadEcmoReviewState;
  interrogationInPerson: VadEcmoReviewState;
  interrogationAnalysisReport: VadEcmoReviewState;
  sameDayProcedureCodes: string[];
  sourceDocumentId?: string;
};

export type VadCoverageEvidence = {
  indication: "post-cardiotomy" | "heart-failure-short-term" | "heart-failure-long-term" | "other" | "unknown";
  fdaApprovedAndOnLabel: VadEcmoReviewState;
  nyhaClassIV: VadEcmoReviewState;
  lvefPercent?: number;
  inotropeDependent: VadEcmoReviewState;
  cardiacIndex?: number;
  optimalMedicalManagementDaysOfLast60?: number;
  failingOptimalMedicalManagement: VadEcmoReviewState;
  advancedHeartFailureDays?: number;
  temporaryMechanicalSupportDays?: number;
  multidisciplinaryTeamConfirmed: VadEcmoReviewState;
  credentialedFacilityConfirmed: VadEcmoReviewState;
  informedDecisionSupportConfirmed: VadEcmoReviewState;
};

export type VadEcmoCaseInput = {
  patientName: string;
  dateOfBirth: string;
  claimScope: VadEcmoClaimScope;
  payerType: VadEcmoPayerType;
  payerName: string;
  payerJurisdiction: string;
  payerPolicyVerified: VadEcmoReviewState;
  payerPolicyCurrent: VadEcmoReviewState;
  coverage: VadCoverageEvidence;
  diagnoses: VadEcmoDiagnosisEvidence[];
  services: VadEcmoServiceInput[];
};

export type VadEcmoCodeCandidate = {
  code: string | null;
  system: "CPT" | "ICD-10-PCS";
  role: string;
  status: "candidate" | "review" | "held";
  rationale: string;
  blockers: string[];
  warnings: string[];
};

export type VadEcmoServiceResult = {
  id: string;
  serviceDate: string;
  supportKind: SupportKind;
  phase: SupportPhase;
  ageYears: number | null;
  candidates: VadEcmoCodeCandidate[];
  ncciCodes: string[];
  status: "ready" | "review" | "hold";
};

export type VadEcmoDiagnosisResult = {
  id: string;
  code: string;
  status: "accepted" | "held";
  rationale: string;
};

export type VadEcmoEvaluation = {
  engineVersion: string;
  policyVersion: string;
  status: "ready" | "review" | "hold";
  services: VadEcmoServiceResult[];
  diagnoses: VadEcmoDiagnosisResult[];
  claimCodes: string[];
  ncciCodes: string[];
  blockers: string[];
  warnings: string[];
  coverage: { applicable: boolean; status: "not-applicable" | "satisfied" | "review" | "failed"; findings: string[] };
  licensedCptVerificationRequired: boolean;
  currentPcsTableVerificationRequired: boolean;
  payerCoverageNotInferred: true;
  humanApprovalRequired: true;
  autonomousClaimSubmissionAllowed: false;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DX_PATTERN = /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/;
const PROCEDURE_PATTERN = /^[A-Z0-9]{5,7}$/;

function parseDate(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export function ageOnServiceDate(dateOfBirth: string, serviceDate: string) {
  const birth = parseDate(dateOfBirth);
  const service = parseDate(serviceDate);
  if (!birth || !service || service < birth) return null;
  let years = service.getUTCFullYear() - birth.getUTCFullYear();
  if (service.getUTCMonth() < birth.getUTCMonth() || (service.getUTCMonth() === birth.getUTCMonth() && service.getUTCDate() < birth.getUTCDate())) years -= 1;
  return years;
}

function normalizeDiagnosis(value: string) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9.]/g, "");
  return compact.includes(".") || compact.length <= 3 ? compact : `${compact.slice(0, 3)}.${compact.slice(3)}`;
}

function normalizeProcedure(value: string) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function candidate(code: string | null, system: "CPT" | "ICD-10-PCS", role: string, rationale: string, blockers: string[] = [], warnings: string[] = []): VadEcmoCodeCandidate {
  return { code, system, role, rationale, blockers, warnings, status: blockers.length ? "held" : warnings.length ? "review" : "candidate" };
}

function ecmoCannulaCode(phase: SupportPhase, approach: SupportApproach, ageYears: number | null) {
  if (ageYears === null) return null;
  const young = ageYears <= 5;
  if (phase === "insertion") {
    if (approach === "peripheral-percutaneous") return young ? "33951" : "33952";
    if (approach === "peripheral-open") return young ? "33953" : "33954";
    if (approach === "central-open") return young ? "33955" : "33956";
  }
  if (phase === "reposition") {
    if (approach === "peripheral-percutaneous") return young ? "33957" : "33958";
    if (approach === "peripheral-open") return young ? "33959" : "33962";
    if (approach === "central-open") return young ? "33963" : "33964";
  }
  if (phase === "removal") {
    if (approach === "peripheral-percutaneous") return young ? "33965" : "33966";
    if (approach === "peripheral-open") return young ? "33969" : "33984";
    if (approach === "central-open") return young ? "33985" : "33986";
  }
  return null;
}

function professionalCode(service: VadEcmoServiceInput, ageYears: number | null) {
  if (service.supportKind === "ecmo") {
    if (service.phase === "initiation") return service.ecmoMode === "vv" ? "33946" : service.ecmoMode === "va" ? "33947" : null;
    if (service.phase === "daily-management") return service.ecmoMode === "vv" ? "33948" : service.ecmoMode === "va" ? "33949" : null;
    return ecmoCannulaCode(service.phase, service.approach, ageYears);
  }
  if (service.supportKind === "extracorporeal-vad") {
    if (service.phase === "insertion") return service.configuration === "single-ventricle" ? "33975" : service.configuration === "biventricular" ? "33976" : null;
    if (service.phase === "removal") return service.configuration === "single-ventricle" ? "33977" : service.configuration === "biventricular" ? "33978" : null;
    if (service.phase === "replacement") return "33981";
  }
  if (service.supportKind === "implantable-vad") {
    if (service.phase === "insertion") return service.configuration === "single-ventricle" ? "33979" : null;
    if (service.phase === "removal") return service.configuration === "single-ventricle" ? "33980" : null;
    if (service.phase === "replacement") return service.cardiopulmonaryBypassUsed === true ? "33983" : service.cardiopulmonaryBypassUsed === false ? "33982" : null;
    if (service.phase === "interrogation") return "93750";
  }
  if (service.supportKind === "percutaneous-vad") {
    if (service.phase === "insertion") return service.configuration === "arterial-only" ? "33990" : service.configuration === "arterial-and-venous" ? "33991" : null;
    if (service.phase === "removal") return "33992";
    if (service.phase === "reposition") return "33993";
  }
  return null;
}

function pcsApproach(approach: SupportApproach) {
  if (approach === "open" || approach === "central-open" || approach === "peripheral-open") return "0";
  if (approach === "percutaneous" || approach === "peripheral-percutaneous") return "3";
  if (approach === "percutaneous-endoscopic") return "4";
  return null;
}

function facilityCode(service: VadEcmoServiceInput) {
  if (service.supportKind === "ecmo" && ["initiation", "daily-management"].includes(service.phase)) {
    const intra = service.intraoperative === true;
    if (service.approach === "central-open") return intra ? "5A15A2F" : "5A1522F";
    if (service.approach === "peripheral-percutaneous" || service.approach === "peripheral-open") {
      if (service.ecmoMode === "va") return intra ? "5A15A2G" : "5A1522G";
      if (service.ecmoMode === "vv") return intra ? "5A15A2H" : "5A1522H";
    }
    return null;
  }
  const approach = pcsApproach(service.approach);
  if (!approach || service.supportKind === "ecmo") return null;
  const root = service.phase === "insertion" ? "H" : service.phase === "removal" ? "P" : service.phase === "reposition" ? "W" : null;
  if (!root) return null;
  const device = service.supportKind === "implantable-vad" ? "QZ" : service.configuration === "biventricular" ? "RS" : "RZ";
  return `02${root}A${approach}${device}`;
}

function evaluateDiagnoses(input: VadEcmoCaseInput) {
  return input.diagnoses.slice(0, 100).map<VadEcmoDiagnosisResult>((item) => {
    const code = normalizeDiagnosis(item.code);
    if (!DX_PATTERN.test(code)) return { id: item.id, code, status: "held", rationale: "The diagnosis does not match ICD-10-CM format." };
    if (item.providerDocumented !== true) return { id: item.id, code, status: "held", rationale: "The diagnosis is not confirmed as provider documented." };
    if (item.clinicallySupported !== true) return { id: item.id, code, status: "held", rationale: "Clinical support for this encounter is not verified." };
    return { id: item.id, code, status: "accepted", rationale: "Retained for coder sequencing review. Device use never creates a diagnosis automatically." };
  });
}

function evaluateNcdCoverage(input: VadEcmoCaseInput) {
  const applicable = input.payerType === "medicare" && input.services.some((service) => service.supportKind === "implantable-vad" && ["insertion", "replacement"].includes(service.phase));
  if (!applicable) return { applicable, status: "not-applicable" as const, findings: ["NCD 20.9.1 durable-LVAD criteria are not automatically applied to this episode; verify the actual payer and indication policy."] };
  const evidence = input.coverage;
  const findings: string[] = [];
  if (evidence.fdaApprovedAndOnLabel !== true) findings.push("FDA approval and use according to labeling are not confirmed.");
  if (evidence.multidisciplinaryTeamConfirmed !== true) findings.push("The explicitly identified multidisciplinary VAD team is not confirmed.");
  if (evidence.credentialedFacilityConfirmed !== true) findings.push("CMS-recognized facility credentialing is not confirmed.");
  if (evidence.informedDecisionSupportConfirmed !== true) findings.push("Patient/caregiver informed decision support is not confirmed.");
  if (evidence.indication === "post-cardiotomy") return { applicable, status: findings.length ? "failed" as const : "satisfied" as const, findings };
  if (!["heart-failure-short-term", "heart-failure-long-term"].includes(evidence.indication)) findings.push("A nationally covered post-cardiotomy or heart-failure LVAD indication is not confirmed.");
  if (evidence.nyhaClassIV !== true) findings.push("NYHA Class IV heart failure is not confirmed.");
  if (!Number.isFinite(evidence.lvefPercent) || Number(evidence.lvefPercent) > 25) findings.push("LVEF at or below 25% is not confirmed.");
  const hemodynamicPath = evidence.inotropeDependent === true || (Number.isFinite(evidence.cardiacIndex) && Number(evidence.cardiacIndex) < 2.2);
  if (!hemodynamicPath) findings.push("Inotrope dependence or cardiac index below 2.2 L/min/m2 is not confirmed.");
  if (evidence.inotropeDependent !== true) {
    const ommPath = Number(evidence.optimalMedicalManagementDaysOfLast60) >= 45 && evidence.failingOptimalMedicalManagement === true;
    const temporaryPath = Number(evidence.advancedHeartFailureDays) >= 14 && Number(evidence.temporaryMechanicalSupportDays) >= 7;
    if (!ommPath && !temporaryPath) findings.push("Neither the 45-of-60-day OMM failure path nor the advanced-HF/temporary-support path is confirmed.");
  }
  return { applicable, status: findings.length ? "failed" as const : "satisfied" as const, findings };
}

export function evaluateVadEcmoCase(input: VadEcmoCaseInput): VadEcmoEvaluation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const birth = parseDate(input.dateOfBirth);
  if (!input.patientName.trim()) blockers.push("Patient name is required for source matching.");
  if (!birth) blockers.push("A valid date of birth is required for age-dependent ECMO code families.");
  if (!input.payerName.trim()) blockers.push("Payer identification is required.");
  if (!input.payerJurisdiction.trim()) blockers.push("Payer jurisdiction or plan is required.");
  if (input.payerPolicyVerified !== true) blockers.push("Date-effective payer coverage and billing policy must be verified.");
  if (input.payerPolicyCurrent !== true) blockers.push("Payer policy currency must be confirmed for every service date.");
  if (!input.services.length) blockers.push("Add at least one support service record.");

  const diagnoses = evaluateDiagnoses(input);
  if (!diagnoses.some((row) => row.status === "accepted")) blockers.push("At least one provider-documented, clinically supported diagnosis is required before release.");
  if (diagnoses.some((row) => row.status === "held")) warnings.push("One or more diagnosis candidates remain held.");
  const coverage = evaluateNcdCoverage(input);
  if (coverage.status === "failed") blockers.push(...coverage.findings.map((finding) => `NCD 20.9.1: ${finding}`));

  const seen = new Set<string>();
  const duplicateKeys = new Set<string>();
  for (const service of input.services) {
    const key = `${service.serviceDate}|${service.supportKind}|${service.phase}`;
    if (seen.has(key)) duplicateKeys.add(key);
    seen.add(key);
  }

  const services = input.services.slice(0, 120).map<VadEcmoServiceResult>((service) => {
    const ageYears = ageOnServiceDate(input.dateOfBirth, service.serviceDate);
    const serviceBlockers: string[] = [];
    const serviceWarnings: string[] = [];
    if (!parseDate(service.serviceDate)) serviceBlockers.push("A valid service date is required.");
    if (ageYears === null) serviceBlockers.push("Patient age cannot be established for this service date.");
    if (duplicateKeys.has(`${service.serviceDate}|${service.supportKind}|${service.phase}`)) serviceBlockers.push("Duplicate device/phase record on the same date must be reconciled.");
    if (service.servicePerformed !== true) serviceBlockers.push("The selected service is not confirmed as performed.");
    if (service.sourceVerified !== true) serviceBlockers.push("Source documentation is not verified.");
    if (!service.reportingClinician.trim()) serviceBlockers.push("Reporting clinician identity is required.");
    if (service.clinicianEligible !== true && input.claimScope === "professional") serviceBlockers.push("Professional reporting eligibility is not confirmed under payer and scope-of-practice rules.");
    if (["initiation", "daily-management"].includes(service.phase) && service.supportKind === "ecmo" && service.ecmoMode === "unknown") serviceBlockers.push("ECMO mode must be documented as VV or VA.");
    if (["daily-management", "initiation"].includes(service.phase) && service.managementDocumented !== true) serviceBlockers.push("Initiation/daily management work is not explicitly documented.");
    if (["insertion", "reposition", "removal"].includes(service.phase) && service.approach === "unknown") serviceBlockers.push("The cannulation/device approach must be documented.");
    if (service.phase === "interrogation" && (service.interrogationInPerson !== true || service.interrogationAnalysisReport !== true)) serviceBlockers.push("In-person VAD interrogation and analysis/report documentation are both required.");
    if (service.phase === "interrogation") serviceWarnings.push("93750 is encounter-based, not automatically billable every day; verify medical necessity, frequency, current edits, and licensed CPT instructions.");

    const selected = input.claimScope === "professional" ? professionalCode(service, ageYears) : facilityCode(service);
    if (!selected) serviceBlockers.push(input.claimScope === "professional"
      ? "The documented device, phase, mode, access, age, configuration, or bypass facts do not identify a professional code family member."
      : "The documented support, approach, mode, configuration, or phase does not identify a complete inpatient PCS candidate; query the source and consult the current tables.");

    const sameDayCodes = service.sameDayProcedureCodes.map(normalizeProcedure).filter((code) => PROCEDURE_PATTERN.test(code));
    if (sameDayCodes.length) serviceWarnings.push("Same-day code combinations require current practitioner or hospital NCCI PTP, MUE, global-surgery, and payer review; no modifier is assigned automatically.");
    if (selected === "93750" && sameDayCodes.some((code) => /^339(7[5-9]|8[0-3])$/.test(code))) serviceBlockers.push("VAD interrogation is paired with a same-day VAD surgical code; release requires licensed CPT and current NCCI/global-surgery review.");
    if (input.claimScope === "inpatient-facility" && service.supportKind === "ecmo" && ["insertion", "reposition", "removal"].includes(service.phase)) serviceWarnings.push("Cannula vessel/body-part procedures require separate ICD-10-PCS table construction from the complete operative note; a CPT-to-PCS crosswalk is not used.");
    if (input.claimScope === "inpatient-facility" && service.phase === "replacement") serviceBlockers.push("Inpatient device replacement may require distinct removal and insertion PCS codes; operative objectives and approaches must be coded separately.");

    const codeCandidate = candidate(selected, input.claimScope === "professional" ? "CPT" : "ICD-10-PCS", `${service.supportKind} ${service.phase}`, selected
      ? "Candidate selected from documented device, phase, mode/access, age, configuration, and claim-scope facts. Verify the current licensed code set before release."
      : "No complete candidate selected.", serviceBlockers, serviceWarnings);
    const ncciCodes = input.claimScope === "professional" ? [selected, ...sameDayCodes].filter((code): code is string => Boolean(code)) : sameDayCodes;
    return { id: service.id, serviceDate: service.serviceDate, supportKind: service.supportKind, phase: service.phase, ageYears, candidates: [codeCandidate], ncciCodes, status: serviceBlockers.length ? "hold" : serviceWarnings.length ? "review" : "ready" };
  });

  if (services.some((row) => row.status === "hold")) blockers.push("One or more service records remain held.");
  if (services.some((row) => row.status === "review")) warnings.push("One or more service records require code-set, NCCI, or payer review.");
  const claimCodes = [...new Set(services.flatMap((row) => row.candidates.filter((item) => item.status !== "held" && item.code).map((item) => item.code as string)))];
  const ncciCodes = [...new Set(services.flatMap((row) => row.ncciCodes).filter((code) => code.length === 5))];
  const status = blockers.length ? "hold" : warnings.length ? "review" : "ready";
  return {
    engineVersion: VAD_ECMO_ENGINE_VERSION,
    policyVersion: VAD_ECMO_POLICY_VERSION,
    status,
    services,
    diagnoses,
    claimCodes,
    ncciCodes,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    coverage,
    licensedCptVerificationRequired: input.claimScope === "professional",
    currentPcsTableVerificationRequired: input.claimScope === "inpatient-facility",
    payerCoverageNotInferred: true,
    humanApprovalRequired: true,
    autonomousClaimSubmissionAllowed: false,
  };
}
