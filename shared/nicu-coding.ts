export const NICU_ENGINE_VERSION = "2026.08.10.1";
export const NICU_POLICY_VERSION = "CMS-NCCI-AAP-FY2026";

export type NicuReviewState = true | false | null;
export type NicuClaimScope = "practitioner" | "facility";
export type NicuCareLevel = "critical" | "intensive" | "routine" | "discharge" | "comfort-care";
export type NicuAdmissionOrigin = "birth-hospital" | "transfer-in" | "readmission";
export type NicuPayerType = "medicaid" | "chip" | "commercial" | "medicare" | "other";

export type NicuDiagnosisEvidence = {
  id: string;
  code: string;
  description?: string;
  providerDocumented: NicuReviewState;
  clinicallySignificant: NicuReviewState;
  presentOnAdmission?: "yes" | "no" | "unknown";
  sourceDocumentId?: string;
};

export type NicuProcedureEvidence = {
  id: string;
  code: string;
  description?: string;
  performed: NicuReviewState;
  separatelyIdentifiable: NicuReviewState;
  sourceDocumentId?: string;
};

export type NicuDailyInput = {
  id: string;
  serviceDate: string;
  presentWeightGrams?: number;
  careLevel: NicuCareLevel;
  criticalStatusDocumented: NicuReviewState;
  intensiveServicesDocumented: NicuReviewState;
  recoveringLowBirthWeightInfant: NicuReviewState;
  directingProviderId: string;
  directingProviderRole: "physician" | "npp" | "unknown";
  providerDirectedCare: NicuReviewState;
  bedsideExamDocumented: NicuReviewState;
  planOfCareDirected: NicuReviewState;
  anotherProviderReportedPerDiem: NicuReviewState;
  sameDayIntensiveToCriticalTransfer: NicuReviewState;
  differentGroupAtCriticalTransfer: NicuReviewState;
  dischargeManagementMinutes?: number;
  procedures: NicuProcedureEvidence[];
  sourceDocumentId?: string;
};

export type NicuCaseInput = {
  patientName: string;
  dateOfBirth: string;
  admissionDate: string;
  admissionOrigin: NicuAdmissionOrigin;
  birthWeightGrams?: number;
  claimScope: NicuClaimScope;
  payerType: NicuPayerType;
  payerName: string;
  payerJurisdiction: string;
  payerPolicyVerified: NicuReviewState;
  payerPolicyCurrent: NicuReviewState;
  diagnoses: NicuDiagnosisEvidence[];
  days: NicuDailyInput[];
};

export type NicuAgeBand = "neonate-0-28d" | "infant-29d-<2y" | "child-2-5y" | "older-than-5y" | "invalid";

export type NicuProcedureReview = {
  id: string;
  code: string;
  status: "included" | "ncci-review" | "held";
  rationale: string;
};

export type NicuDailyResult = {
  id: string;
  serviceDate: string;
  ageDays: number | null;
  ageBand: NicuAgeBand;
  presentWeightGrams: number | null;
  careLevel: NicuCareLevel;
  code: string | null;
  codeRole: "initial" | "subsequent" | "discharge" | "facility-pathway" | "general-hospital-review" | "none";
  rationale: string;
  status: "ready" | "review" | "hold";
  blockers: string[];
  warnings: string[];
  procedureReviews: NicuProcedureReview[];
};

export type NicuDiagnosisResult = {
  id: string;
  code: string;
  status: "accepted" | "held";
  rationale: string;
};

export type NicuEvaluation = {
  engineVersion: string;
  policyVersion: string;
  status: "hold" | "review" | "ready";
  days: NicuDailyResult[];
  diagnoses: NicuDiagnosisResult[];
  claimCodes: string[];
  ncciCodes: string[];
  blockers: string[];
  warnings: string[];
  payerPolicyRequired: true;
  licensedCptVerificationRequired: true;
  humanApprovalRequired: true;
  autonomousClaimSubmissionAllowed: false;
};

const INCLUDED_PRACTITIONER_SERVICES = new Set([
  "36000", "36410", "36600", "43752", "43753", "71045", "71046", "92953", "93701", "94002", "94003", "94004", "94660",
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CODE_PATTERN = /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/;
const PROCEDURE_PATTERN = /^[A-Z0-9]{5}$/;

function parseDate(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function addUtcYears(date: Date, years: number) {
  const copy = new Date(date.getTime());
  copy.setUTCFullYear(copy.getUTCFullYear() + years);
  return copy;
}

export function nicuAgeOnDate(dateOfBirth: string, serviceDate: string) {
  const birth = parseDate(dateOfBirth);
  const service = parseDate(serviceDate);
  if (!birth || !service || service < birth) return { ageDays: null, ageBand: "invalid" as NicuAgeBand };
  const ageDays = Math.floor((service.getTime() - birth.getTime()) / 86_400_000);
  const ageBand: NicuAgeBand = ageDays <= 28
    ? "neonate-0-28d"
    : service < addUtcYears(birth, 2)
      ? "infant-29d-<2y"
      : service < addUtcYears(birth, 6)
        ? "child-2-5y"
        : "older-than-5y";
  return { ageDays, ageBand };
}

function normalizeDiagnosis(value: string) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9.]/g, "");
  if (compact.includes(".")) return compact;
  return compact.length > 3 ? `${compact.slice(0, 3)}.${compact.slice(3)}` : compact;
}

function normalizeProcedure(value: string) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

function validPositive(value: unknown) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
}

function initialCriticalCode(ageBand: NicuAgeBand) {
  if (ageBand === "neonate-0-28d") return "99468";
  if (ageBand === "infant-29d-<2y") return "99471";
  if (ageBand === "child-2-5y") return "99475";
  return null;
}

function subsequentCriticalCode(ageBand: NicuAgeBand) {
  if (ageBand === "neonate-0-28d") return "99469";
  if (ageBand === "infant-29d-<2y") return "99472";
  if (ageBand === "child-2-5y") return "99476";
  return null;
}

function procedureReview(procedure: NicuProcedureEvidence, claimScope: NicuClaimScope): NicuProcedureReview {
  const code = normalizeProcedure(procedure.code);
  if (!PROCEDURE_PATTERN.test(code) || procedure.performed !== true) {
    return { id: procedure.id, code, status: "held", rationale: procedure.performed === false ? "The procedure is marked not performed." : "A valid, performed procedure requires source verification." };
  }
  if (claimScope === "practitioner" && INCLUDED_PRACTITIONER_SERVICES.has(code)) {
    return { id: procedure.id, code, status: "included", rationale: "CMS NCCI identifies this service as included in practitioner neonatal/pediatric critical or intensive per-diem care; do not separately report it on this worksheet." };
  }
  return {
    id: procedure.id,
    code,
    status: "ncci-review",
    rationale: procedure.separatelyIdentifiable === true
      ? "Documented as separately identifiable, but current payer NCCI/PTP, MUE, global-period, and licensed CPT review are still required. No modifier is assigned automatically."
      : "Separate reporting is not established. Verify the source, licensed CPT guidance, current NCCI edits, and payer policy before release.",
  };
}

function evaluateDiagnoses(input: NicuCaseInput) {
  return input.diagnoses.slice(0, 100).map<NicuDiagnosisResult>((item) => {
    const code = normalizeDiagnosis(item.code);
    if (!CODE_PATTERN.test(code)) return { id: item.id, code, status: "held", rationale: "The diagnosis is not a valid ICD-10-CM code format." };
    if (item.providerDocumented !== true) return { id: item.id, code, status: "held", rationale: "The diagnosis is not confirmed as provider documented." };
    if (item.clinicallySignificant !== true) return { id: item.id, code, status: "held", rationale: "Clinical significance is not confirmed under the FY 2026 perinatal reporting guideline." };
    if (code.startsWith("Z38") && input.admissionOrigin !== "birth-hospital") return { id: item.id, code, status: "held", rationale: "Z38 is limited to the birth record and is not reported by a receiving or readmission hospital." };
    return { id: item.id, code, status: "accepted", rationale: "Provider-documented, clinically significant diagnosis retained for coder sequencing review; the engine does not infer diagnoses from age, weight, monitoring, or treatment." };
  });
}

export function evaluateNicuCase(input: NicuCaseInput): NicuEvaluation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const birth = parseDate(input.dateOfBirth);
  const admission = parseDate(input.admissionDate);
  if (!input.patientName.trim()) blockers.push("Patient name is required for source matching.");
  if (!birth) blockers.push("A valid date of birth is required.");
  if (!admission) blockers.push("A valid admission date is required.");
  if (birth && admission && admission < birth) blockers.push("Admission date cannot precede date of birth.");
  if (!input.days.length) blockers.push("Add at least one daily service record.");
  if (!input.payerName.trim()) blockers.push("Payer identification is required.");
  if ((input.payerType === "medicaid" || input.payerType === "chip") && !input.payerJurisdiction.trim()) blockers.push("State or payer jurisdiction is required for Medicaid/CHIP review.");
  if (input.payerPolicyVerified !== true) blockers.push("Date-effective payer coverage and billing policy must be verified.");
  if (input.payerPolicyCurrent !== true) blockers.push("Payer policy currency must be confirmed for the service dates.");
  if (input.claimScope === "facility") blockers.push("Facility NICU billing requires the hospital inpatient grouper, revenue-center, accommodation-day, POA, and payer contract pathway; professional per-diem CPT selection is not released by this engine.");
  if (input.payerType === "medicare") warnings.push("Medicare NCCI is used as a coding-control reference, but neonatal coverage and payment must be confirmed with the actual payer; Medicare eligibility is not inferred.");
  if (validPositive(input.birthWeightGrams) && !input.days.some((day) => validPositive(day.presentWeightGrams))) warnings.push("Birth weight is retained as clinical evidence but never substitutes for present body weight when selecting continuing intensive-care tiers.");

  const diagnoses = evaluateDiagnoses(input);
  if (diagnoses.some((item) => item.status === "held")) warnings.push("One or more diagnoses are held from the worksheet pending documentation or sequencing review.");
  if (!diagnoses.some((item) => item.status === "accepted")) blockers.push("At least one provider-documented, clinically significant diagnosis is required before claim release.");

  const sorted = input.days.slice(0, 120).sort((left, right) => left.serviceDate.localeCompare(right.serviceDate));
  const duplicates = new Set<string>();
  const seenDates = new Set<string>();
  for (const day of sorted) { if (seenDates.has(day.serviceDate)) duplicates.add(day.serviceDate); seenDates.add(day.serviceDate); }
  const criticalBandsReported = new Set<NicuAgeBand>();
  let anyCriticalOrIntensiveReported = false;

  const days = sorted.map<NicuDailyResult>((day) => {
    const dayBlockers: string[] = [];
    const dayWarnings: string[] = [];
    const { ageDays, ageBand } = nicuAgeOnDate(input.dateOfBirth, day.serviceDate);
    const presentWeight = validPositive(day.presentWeightGrams);
    const procedures = day.procedures.slice(0, 40).map((item) => procedureReview(item, input.claimScope));
    let code: string | null = null;
    let codeRole: NicuDailyResult["codeRole"] = "none";
    let rationale = "No professional daily code selected.";

    if (!parseDate(day.serviceDate)) dayBlockers.push("A valid service date is required.");
    if (duplicates.has(day.serviceDate)) dayBlockers.push("Only one directing-provider per-diem record is allowed for the same date in this case ledger.");
    if (admission && parseDate(day.serviceDate) && parseDate(day.serviceDate)! < admission) dayBlockers.push("Service date precedes the admission date.");
    if (ageBand === "invalid") dayBlockers.push("Service date and date of birth do not produce a valid patient age.");
    if (!day.directingProviderId.trim()) dayBlockers.push("The directing provider identity is required.");
    if (day.directingProviderRole === "unknown") dayBlockers.push("Confirm whether the directing provider is an eligible physician or independently reporting NPP under state and payer rules.");
    if (day.providerDirectedCare !== true) dayBlockers.push("The reporting provider's direction of inpatient care is not confirmed.");
    if (day.bedsideExamDocumented !== true) dayBlockers.push("A medically appropriate bedside examination by the reporting provider is not confirmed.");
    if (day.planOfCareDirected !== true) dayBlockers.push("The reporting provider's direction of the plan of care is not confirmed.");
    if (day.anotherProviderReportedPerDiem === true) dayBlockers.push("Another provider is documented as reporting a global per-diem service for this date; resolve the directing-provider conflict.");
    if (day.anotherProviderReportedPerDiem === null) dayBlockers.push("Confirm that no other provider reported a global per-diem critical or intensive service for this date.");
    const providerDayVerified = Boolean(
      day.directingProviderId.trim()
      && day.directingProviderRole !== "unknown"
      && day.providerDirectedCare === true
      && day.bedsideExamDocumented === true
      && day.planOfCareDirected === true
      && day.anotherProviderReportedPerDiem === false,
    );

    if (input.claimScope === "facility") {
      codeRole = "facility-pathway";
      rationale = "Professional per-diem CPT selection is withheld for a facility claim; use the date-effective inpatient facility grouper and payer accommodation/revenue rules.";
      dayBlockers.push("Professional daily CPT is not released on the facility pathway.");
    } else if (day.careLevel === "critical") {
      if (day.criticalStatusDocumented !== true) dayBlockers.push("Critical status must be explicitly documented and cannot be inferred from location, diagnosis, ventilation, or procedures.");
      const initial = initialCriticalCode(ageBand);
      const subsequent = subsequentCriticalCode(ageBand);
      if (!initial || !subsequent) {
        dayBlockers.push("The patient is outside the neonatal/pediatric per-diem critical-care age range; use the time-based general critical-care pathway when supported.");
      } else {
        const isInitialForAgeBand = !criticalBandsReported.has(ageBand);
        code = isInitialForAgeBand ? initial : subsequent;
        codeRole = isInitialForAgeBand ? "initial" : "subsequent";
        rationale = isInitialForAgeBand
          ? `First documented directing-provider critical-care day in the ${ageBand} age category during this stay.`
          : `Subsequent documented directing-provider critical-care day in the ${ageBand} age category.`;
        if (day.criticalStatusDocumented === true && providerDayVerified) {
          criticalBandsReported.add(ageBand);
          anyCriticalOrIntensiveReported = true;
        }
      }
      if (day.sameDayIntensiveToCriticalTransfer === true && day.differentGroupAtCriticalTransfer !== true) dayWarnings.push("Same-day intensive-to-critical transition is present, but the CMS different-physician/different-group exception is not confirmed; do not release two per-diem services.");
      if (day.sameDayIntensiveToCriticalTransfer === true && day.differentGroupAtCriticalTransfer === true) dayWarnings.push("CMS allows a narrow different-physician/different-group transition scenario; retain both source records for manual NCCI and payer review.");
    } else if (day.careLevel === "intensive") {
      if (day.intensiveServicesDocumented !== true) dayBlockers.push("Intensive observation, frequent interventions, and other intensive services must be explicitly documented.");
      if (!anyCriticalOrIntensiveReported && ageBand === "neonate-0-28d") {
        code = "99477";
        codeRole = "initial";
        rationale = "Initial hospital intensive-care day for a neonate with documented intensive services and no earlier critical/intensive per-diem service in this ledger.";
        if (day.intensiveServicesDocumented === true && providerDayVerified) anyCriticalOrIntensiveReported = true;
      } else {
        if (!anyCriticalOrIntensiveReported) dayBlockers.push("A continuing intensive-care code requires an earlier critical or intensive per-diem service in the same admission.");
        if (day.recoveringLowBirthWeightInfant !== true) dayBlockers.push("Continuing intensive care requires confirmation that the patient is a recovering low-birth-weight infant.");
        if (presentWeight === null) dayBlockers.push("Present body weight in grams is required; birth weight cannot select the daily tier.");
        else if (presentWeight < 1500) code = "99478";
        else if (presentWeight <= 2500) code = "99479";
        else if (presentWeight <= 5000) code = "99480";
        else dayBlockers.push("Present weight exceeds 5000 g; continuing NICU intensive-care weight-tier codes are not selected.");
        if (code) {
          codeRole = "subsequent";
          rationale = `Continuing intensive-care tier selected from the documented present body weight of ${presentWeight} g, not birth weight.`;
          if (day.intensiveServicesDocumented === true && day.recoveringLowBirthWeightInfant === true && providerDayVerified) anyCriticalOrIntensiveReported = true;
        }
      }
    } else if (day.careLevel === "discharge") {
      const minutes = validPositive(day.dischargeManagementMinutes);
      if (minutes === null) dayBlockers.push("Document total discharge-management time to distinguish the discharge service.");
      else {
        code = minutes <= 30 ? "99238" : "99239";
        codeRole = "discharge";
        rationale = `Hospital discharge-management selection based on ${minutes} documented minutes; do not also report another E/M service by the same provider on this date.`;
      }
    } else {
      codeRole = "general-hospital-review";
      rationale = day.careLevel === "comfort-care"
        ? "Comfort care does not by itself satisfy critical or intensive per-diem criteria; review the documented hospital E/M service under licensed guidance."
        : "The patient is documented below critical/intensive level; select the supported hospital E/M service from MDM or time under licensed guidance.";
      dayBlockers.push("Exact general inpatient E/M selection requires documented MDM/time and a licensed CPT rules adapter.");
    }

    if (procedures.some((item) => item.status === "ncci-review")) dayWarnings.push("One or more procedures require current NCCI/PTP, MUE, global-period, licensed CPT, and payer review; modifier 25 is never automatic.");
    if (procedures.some((item) => item.status === "included")) dayWarnings.push("Practitioner services identified as included are shown for audit but suppressed from separate reporting.");
    if (day.sourceDocumentId) dayWarnings.push("OCR-derived daily facts remain candidates until verified against the source document.");
    if (dayBlockers.length && code) dayWarnings.push(`Candidate ${code} is held and must not be released until every daily gate is resolved.`);

    return {
      id: day.id,
      serviceDate: day.serviceDate,
      ageDays,
      ageBand,
      presentWeightGrams: presentWeight,
      careLevel: day.careLevel,
      code,
      codeRole,
      rationale,
      status: dayBlockers.length ? "hold" : procedures.some((item) => item.status === "ncci-review") ? "review" : "ready",
      blockers: dayBlockers,
      warnings: dayWarnings,
      procedureReviews: procedures,
    };
  });

  blockers.push(...days.flatMap((day) => day.blockers.map((message) => `${day.serviceDate}: ${message}`)));
  warnings.push(...days.flatMap((day) => day.warnings.map((message) => `${day.serviceDate}: ${message}`)));
  const claimCodes = [...new Set(days.filter((day) => day.code && !day.blockers.length).map((day) => day.code as string))];
  const procedureCodes = days.flatMap((day) => day.procedureReviews.filter((item) => item.status === "ncci-review").map((item) => item.code));
  const ncciCodes = [...new Set([...days.map((day) => day.code).filter((code): code is string => Boolean(code)), ...procedureCodes])];
  const status: NicuEvaluation["status"] = blockers.length ? "hold" : days.some((day) => day.status === "review") ? "review" : "ready";
  return {
    engineVersion: NICU_ENGINE_VERSION,
    policyVersion: NICU_POLICY_VERSION,
    status,
    days,
    diagnoses,
    claimCodes,
    ncciCodes,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    payerPolicyRequired: true,
    licensedCptVerificationRequired: true,
    humanApprovalRequired: true,
    autonomousClaimSubmissionAllowed: false,
  };
}
