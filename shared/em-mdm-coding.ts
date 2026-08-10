export const EM_MDM_ENGINE_VERSION = "2026.08.10.1";
export const EM_MDM_POLICY_VERSION = "CMS-MLN006764-MAY2026";

export type EmStatus = "pass" | "review" | "hold" | "not-applicable";
export type EmLevel = "none" | "straightforward" | "low" | "moderate" | "high";
export type EmPatientType = "new" | "established" | "unknown";
export type EmSelectionBasis = "mdm" | "time" | "both";
export type EmPayerMode = "medicare-ffs" | "medicare-advantage" | "medicaid" | "commercial" | "self-pay";
export type EmSiteType = "office" | "hospital-outpatient" | "rhc" | "fqhc";

export type EmProblemProfile = {
  minorSelfLimited: number;
  stableChronic: number;
  acuteUncomplicated: number;
  stableAcute: number;
  chronicExacerbation: number;
  undiagnosedUncertainPrognosis: number;
  acuteSystemicSymptoms: number;
  acuteComplicatedInjury: number;
  chronicSevereExacerbation: number;
  threatToLifeOrBodilyFunction: number;
  clinicianCharacterizationVerified: boolean | null;
};

export type EmDataTest = {
  id: string;
  ordered?: boolean;
  resultReviewed?: boolean;
};

export type EmDataProfile = {
  externalNoteSourceIds: string[];
  tests: EmDataTest[];
  independentHistorianRequired: boolean;
  independentHistorianReasonDocumented: boolean | null;
  independentInterpretationPerformed: boolean;
  interpretationSeparatelyReported: boolean;
  externalDiscussionPerformed: boolean;
  externalDiscussionPartnerDocumented: boolean | null;
};

export type EmRiskProfile = {
  minimalManagement: boolean;
  otcMedicationManagement: boolean;
  minorProcedureWithoutRiskFactors: boolean;
  physicalOrOccupationalTherapy: boolean;
  ivFluidsWithoutAdditives: boolean;
  prescriptionDrugManagement: boolean;
  minorProcedureWithRiskFactors: boolean;
  electiveMajorSurgeryWithoutRiskFactors: boolean;
  diagnosisOrTreatmentLimitedBySdoh: boolean;
  intensiveDrugToxicityMonitoring: boolean;
  electiveMajorSurgeryWithRiskFactors: boolean;
  emergencyMajorSurgery: boolean;
  hospitalizationOrEscalation: boolean;
  deescalationBecausePoorPrognosis: boolean;
  parenteralControlledSubstance: boolean;
  managementDecisionDocumented: boolean | null;
};

export type EmTimeProfile = {
  totalQhpMinutes: number;
  separatelyReportedServiceMinutes: number;
  overlappingTeamMinutes: number;
  clinicalStaffMinutesIncluded: number;
  totalTimeDocumented: boolean | null;
  dateOfServiceOnly: boolean | null;
};

export type EmSameDayProfile = {
  serviceType: "none" | "minor-procedure" | "major-procedure" | "preventive" | "annual-wellness" | "vaccine-administration" | "other";
  procedureGlobalDays: "none" | "0" | "10" | "90" | "unknown";
  significantSeparateEmDocumented: boolean | null;
  decisionForMajorSurgeryDocumented: boolean | null;
};

export type EmG2211Profile = {
  requested: boolean;
  longitudinalRelationship: "none" | "continuing-focal-point" | "ongoing-serious-complex";
  relationshipDocumented: boolean | null;
};

export type EmMdmCaseInput = {
  serviceDate: string;
  payerMode: EmPayerMode;
  siteType: EmSiteType;
  placeOfService: "11" | "19" | "22" | "02" | "10";
  patientType: EmPatientType;
  priorProfessionalServiceWithin3Years: boolean | null;
  sameGroupAndExactSpecialty: boolean | null;
  patientStatusVerified: boolean | null;
  selectionBasis: EmSelectionBasis;
  diagnosisCodes: string[];
  billingNpi?: string;
  medicallyAppropriateHistoryExam: boolean | null;
  serviceMedicallyNecessary: boolean | null;
  currentCptEditionVerified: boolean | null;
  problems: EmProblemProfile;
  data: EmDataProfile;
  risk: EmRiskProfile;
  time: EmTimeProfile;
  sameDay: EmSameDayProfile;
  g2211: EmG2211Profile;
};

export type EmDomainResult = {
  domain: "patient-status" | "problems" | "data" | "risk" | "mdm" | "time" | "same-day" | "claim";
  title: string;
  status: EmStatus;
  level?: EmLevel;
  reasons: string[];
  blockers: string[];
  sourceIds: string[];
};

export type EmCodePath = {
  basis: "mdm" | "time";
  supported: boolean;
  code: string | null;
  level: EmLevel;
  reportableMinutes?: number;
  reasons: string[];
  blockers: string[];
};

export type EmClaimLine = {
  code: string;
  codeSystem: "CPT" | "HCPCS";
  units: number;
  modifiers: Array<"25" | "57">;
  diagnosisPointers: string[];
  description: string;
  descriptionSemantics: "original-paraphrase";
  sourceId: string;
};

export type EmMdmEvaluation = {
  engineVersion: string;
  policyVersion: string;
  patientType: EmPatientType;
  elementLevels: { problems: EmLevel; data: EmLevel; risk: EmLevel };
  overallMdmLevel: EmLevel;
  mdmPath: EmCodePath;
  timePath: EmCodePath;
  selectedPath: EmCodePath | null;
  reportableMinutes: number;
  prolonged: { code: "G2212" | null; units: number; status: EmStatus; reasons: string[]; blockers: string[] };
  sameDayModifiers: Array<"25" | "57">;
  g2211: { suggested: boolean; status: EmStatus; reasons: string[]; blockers: string[] };
  diagnosisCodes: string[];
  domains: EmDomainResult[];
  claimLines: EmClaimLine[];
  queries: string[];
  requiresHumanApproval: true;
  autonomousClaimSubmission: false;
  licensedCptDescriptorsEmbedded: false;
};

const LEVEL_RANK: Record<EmLevel, number> = { none: 0, straightforward: 1, low: 2, moderate: 3, high: 4 };
const RANK_LEVEL: EmLevel[] = ["none", "straightforward", "low", "moderate", "high"];
const CODE_BY_LEVEL: Record<"new" | "established", Record<Exclude<EmLevel, "none">, string>> = {
  new: { straightforward: "99202", low: "99203", moderate: "99204", high: "99205" },
  established: { straightforward: "99212", low: "99213", moderate: "99214", high: "99215" },
};
const TIME_THRESHOLDS: Record<"new" | "established", Array<{ minutes: number; level: Exclude<EmLevel, "none">; code: string }>> = {
  new: [
    { minutes: 15, level: "straightforward", code: "99202" },
    { minutes: 30, level: "low", code: "99203" },
    { minutes: 45, level: "moderate", code: "99204" },
    { minutes: 60, level: "high", code: "99205" },
  ],
  established: [
    { minutes: 10, level: "straightforward", code: "99212" },
    { minutes: 20, level: "low", code: "99213" },
    { minutes: 30, level: "moderate", code: "99214" },
    { minutes: 40, level: "high", code: "99215" },
  ],
};

const clampCount = (value: number) => Math.max(0, Math.floor(Number(value) || 0));
const cleanCodes = (codes: string[]) => Array.from(new Set((codes || []).map((code) => String(code).trim().toUpperCase()).filter((code) => /^[A-Z][0-9A-Z]{2}(?:\.[0-9A-Z]{1,4})?$/.test(code))));
const uniqueValues = (values: string[]) => new Set((values || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean));
const resultStatus = (blockers: string[], review = false): EmStatus => blockers.length ? "hold" : review ? "review" : "pass";
const domain = (name: EmDomainResult["domain"], title: string, reasons: string[], blockers: string[], sourceIds: string[], level?: EmLevel, review = false): EmDomainResult => ({ domain: name, title, status: resultStatus(blockers, review), level, reasons, blockers, sourceIds });

export function evaluateProblemLevel(profile: EmProblemProfile): { level: EmLevel; reasons: string[]; blockers: string[] } {
  const reasons: string[] = [];
  const blockers: string[] = [];
  let level: EmLevel = "none";
  if (clampCount(profile.threatToLifeOrBodilyFunction) || clampCount(profile.chronicSevereExacerbation)) {
    level = "high";
    reasons.push("At least one clinician-characterized problem is at the highest problem-complexity tier.");
  } else if (clampCount(profile.chronicExacerbation) || clampCount(profile.stableChronic) >= 2 || clampCount(profile.undiagnosedUncertainPrognosis) || clampCount(profile.acuteSystemicSymptoms) || clampCount(profile.acuteComplicatedInjury)) {
    level = "moderate";
    reasons.push("The documented problem mix reaches the moderate problem-complexity tier.");
  } else if (clampCount(profile.minorSelfLimited) >= 2 || clampCount(profile.stableChronic) || clampCount(profile.acuteUncomplicated) || clampCount(profile.stableAcute)) {
    level = "low";
    reasons.push("The documented problem mix reaches the low problem-complexity tier.");
  } else if (clampCount(profile.minorSelfLimited) === 1) {
    level = "straightforward";
    reasons.push("One minor or self-limited problem was documented as addressed.");
  } else blockers.push("Document at least one problem actually evaluated or treated during the encounter.");
  if (level !== "none" && profile.clinicianCharacterizationVerified !== true) blockers.push("The physician or QHP must verify whether each problem is stable, worsening, uncertain, or threatening; the coder does not determine clinical status.");
  return { level, reasons, blockers };
}

export function evaluateDataLevel(profile: EmDataProfile): { level: EmLevel; category1Elements: number; categoriesMet: string[]; reasons: string[]; blockers: string[] } {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const noteSources = uniqueValues(profile.externalNoteSourceIds).size;
  const uniqueTests = new Set((profile.tests || []).filter((test) => test.ordered || test.resultReviewed).map((test) => String(test.id).trim().toLowerCase()).filter(Boolean));
  const historian = profile.independentHistorianRequired && profile.independentHistorianReasonDocumented === true;
  if (profile.independentHistorianRequired && profile.independentHistorianReasonDocumented !== true) blockers.push("Document why an independent historian was required before counting it.");
  if (profile.independentInterpretationPerformed && profile.interpretationSeparatelyReported) blockers.push("An interpretation separately reported may not also count toward the MDM data element.");
  if (profile.externalDiscussionPerformed && profile.externalDiscussionPartnerDocumented !== true) blockers.push("Identify the external physician/QHP or appropriate source involved in the management or test discussion.");
  const category1Elements = noteSources + uniqueTests.size + (historian ? 1 : 0);
  const category1Moderate = category1Elements >= 3;
  const category2 = profile.independentInterpretationPerformed && !profile.interpretationSeparatelyReported;
  const category3 = profile.externalDiscussionPerformed && profile.externalDiscussionPartnerDocumented === true;
  const highCategories = [category1Moderate ? "category-1" : "", category2 ? "category-2" : "", category3 ? "category-3" : ""].filter(Boolean);
  let level: EmLevel = "straightforward";
  if (highCategories.length >= 2) level = "high";
  else if (highCategories.length >= 1) level = "moderate";
  else if (noteSources + uniqueTests.size >= 2 || historian) level = "low";
  reasons.push(`${noteSources} unique external note source(s), ${uniqueTests.size} unique test(s), and ${historian ? 1 : 0} supported historian element(s) were counted without order/result duplication.`);
  if (category2) reasons.push("A non-separately-reported independent interpretation supports the independent-interpretation category.");
  if (category3) reasons.push("A documented external management/test discussion supports the discussion category.");
  return { level, category1Elements, categoriesMet: highCategories, reasons, blockers };
}

export function evaluateRiskLevel(profile: EmRiskProfile): { level: EmLevel; reasons: string[]; blockers: string[] } {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const high = profile.intensiveDrugToxicityMonitoring || profile.electiveMajorSurgeryWithRiskFactors || profile.emergencyMajorSurgery || profile.hospitalizationOrEscalation || profile.deescalationBecausePoorPrognosis || profile.parenteralControlledSubstance;
  const moderate = profile.prescriptionDrugManagement || profile.minorProcedureWithRiskFactors || profile.electiveMajorSurgeryWithoutRiskFactors || profile.diagnosisOrTreatmentLimitedBySdoh;
  const low = profile.otcMedicationManagement || profile.minorProcedureWithoutRiskFactors || profile.physicalOrOccupationalTherapy || profile.ivFluidsWithoutAdditives;
  let level: EmLevel = high ? "high" : moderate ? "moderate" : low ? "low" : profile.minimalManagement ? "straightforward" : "none";
  if (level === "none") blockers.push("Document the management decision and its patient-specific risk; problem severity alone does not set the risk element.");
  else reasons.push(`The documented management decision reaches the ${level} risk tier.`);
  if (level !== "none" && profile.managementDecisionDocumented !== true) blockers.push("Verify the actual management decision and patient-specific risk in the note.");
  return { level, reasons, blockers };
}

export function calculateOverallMdm(problem: EmLevel, data: EmLevel, risk: EmLevel): EmLevel {
  const ranks = [LEVEL_RANK[problem], LEVEL_RANK[data], LEVEL_RANK[risk]].sort((a, b) => b - a);
  return RANK_LEVEL[ranks[1]] || "none";
}

export function calculateReportableTime(profile: EmTimeProfile) {
  return Math.max(0, Math.floor(Number(profile.totalQhpMinutes || 0)) - Math.max(0, Math.floor(Number(profile.separatelyReportedServiceMinutes || 0))) - Math.max(0, Math.floor(Number(profile.overlappingTeamMinutes || 0))) - Math.max(0, Math.floor(Number(profile.clinicalStaffMinutesIncluded || 0))));
}

function timeCode(patientType: "new" | "established", minutes: number) {
  let selected: { minutes: number; level: Exclude<EmLevel, "none">; code: string } | null = null;
  for (const candidate of TIME_THRESHOLDS[patientType]) if (minutes >= candidate.minutes) selected = candidate;
  return selected;
}

function codeRank(code: string | null) {
  if (!code) return 0;
  const level = Object.values(CODE_BY_LEVEL.new).indexOf(code) + 1 || Object.values(CODE_BY_LEVEL.established).indexOf(code) + 1;
  return level;
}

export function evaluateEmMdmCase(input: EmMdmCaseInput): EmMdmEvaluation {
  const queries: string[] = [];
  const diagnosisCodes = cleanCodes(input.diagnosisCodes);
  const patientBlockers: string[] = [];
  const patientReasons: string[] = [];
  let resolvedPatientType = input.patientType;
  if (input.patientStatusVerified !== true || input.patientType === "unknown") patientBlockers.push("Verify new versus established status using prior professional services, exact specialty/subspecialty, and group practice within the previous 3 years.");
  if (input.patientType === "new" && input.priorProfessionalServiceWithin3Years === true && input.sameGroupAndExactSpecialty === true) patientBlockers.push("The documented prior service in the same group and exact specialty/subspecialty conflicts with new-patient selection.");
  if (input.patientType === "established" && input.priorProfessionalServiceWithin3Years === false) patientBlockers.push("No qualifying prior professional service was documented; review whether the patient is new.");
  if (!patientBlockers.length) patientReasons.push(`${input.patientType === "new" ? "New" : "Established"} patient status is supported for the office/outpatient family.`);

  const problems = evaluateProblemLevel(input.problems);
  const data = evaluateDataLevel(input.data);
  const risk = evaluateRiskLevel(input.risk);
  const overallMdmLevel = calculateOverallMdm(problems.level, data.level, risk.level);
  const mdmBlockers = [...problems.blockers, ...data.blockers, ...risk.blockers];
  const mdmReasons = [`Two of three elements support ${overallMdmLevel} MDM: problems ${problems.level}, data ${data.level}, risk ${risk.level}.`];
  if (overallMdmLevel === "none") mdmBlockers.push("Two MDM elements do not yet support a reportable office/outpatient level.");
  const patientKnown = resolvedPatientType === "new" || resolvedPatientType === "established";
  const mdmCode = patientKnown && overallMdmLevel !== "none" ? CODE_BY_LEVEL[resolvedPatientType][overallMdmLevel] : null;
  const mdmPath: EmCodePath = { basis: "mdm", supported: Boolean(mdmCode && !mdmBlockers.length && !patientBlockers.length), code: mdmCode, level: overallMdmLevel, reasons: mdmReasons, blockers: [...patientBlockers, ...mdmBlockers] };

  const reportableMinutes = calculateReportableTime(input.time);
  const timeBlockers: string[] = [];
  const timeReasons: string[] = [];
  if (input.time.totalTimeDocumented !== true) timeBlockers.push("Document total physician/QHP time on the date of service before using time for code selection.");
  if (input.time.dateOfServiceOnly !== true) timeBlockers.push("Exclude work outside the date of service from this office/outpatient time path.");
  if (input.time.separatelyReportedServiceMinutes > 0) timeReasons.push(`${Math.floor(input.time.separatelyReportedServiceMinutes)} minute(s) tied to separately reported services were excluded.`);
  if (input.time.overlappingTeamMinutes > 0) timeReasons.push(`${Math.floor(input.time.overlappingTeamMinutes)} overlapping team minute(s) were counted once.`);
  if (input.time.clinicalStaffMinutesIncluded > 0) timeReasons.push(`${Math.floor(input.time.clinicalStaffMinutesIncluded)} clinical-staff minute(s) were excluded.`);
  const timed = patientKnown ? timeCode(resolvedPatientType, reportableMinutes) : null;
  if (!timed) timeBlockers.push("Reportable physician/QHP time does not meet the minimum threshold for a selectable office/outpatient code.");
  else timeReasons.push(`${reportableMinutes} reportable minute(s) support the ${timed.level} time pathway.`);
  const timePath: EmCodePath = { basis: "time", supported: Boolean(timed && !timeBlockers.length && !patientBlockers.length), code: timed?.code || null, level: timed?.level || "none", reportableMinutes, reasons: timeReasons, blockers: [...patientBlockers, ...timeBlockers] };

  const prolongedBlockers: string[] = [];
  const prolongedReasons: string[] = [];
  let prolongedUnits = 0;
  if ((input.selectionBasis === "time" || input.selectionBasis === "both") && timePath.supported && (timePath.code === "99205" || timePath.code === "99215")) {
    if (input.payerMode === "medicare-ffs") {
      const firstUnit = timePath.code === "99205" ? 89 : 69;
      if (reportableMinutes >= firstUnit) {
        prolongedUnits = 1 + Math.floor((reportableMinutes - firstUnit) / 15);
        prolongedReasons.push(`${prolongedUnits} complete Medicare G2212 unit(s) are supported beyond the CMS threshold.`);
      }
    } else if (reportableMinutes >= (timePath.code === "99205" ? 75 : 55)) prolongedBlockers.push("Resolve the payer's licensed prolonged-service code, threshold, and edits; Medicare G2212 logic does not apply automatically.");
  }

  const sameDayBlockers: string[] = [];
  const sameDayReasons: string[] = [];
  const modifiers: Array<"25" | "57"> = [];
  if (input.sameDay.serviceType !== "none") {
    if (input.sameDay.serviceType === "major-procedure" && input.sameDay.procedureGlobalDays === "90" && input.sameDay.decisionForMajorSurgeryDocumented === true) {
      modifiers.push("57");
      sameDayReasons.push("Modifier 57 is supported for a documented decision for major surgery in the applicable global-surgery timing window.");
    } else if (input.sameDay.significantSeparateEmDocumented === true) {
      modifiers.push("25");
      sameDayReasons.push("Modifier 25 is supported by a significant, separately identifiable same-day E/M service.");
    } else sameDayBlockers.push("A same-day service is present. Verify a significant separate E/M service or an applicable decision-for-major-surgery pathway before adding a modifier.");
  }

  const g2211Blockers: string[] = [];
  const g2211Reasons: string[] = [];
  let g2211Suggested = false;
  if (input.g2211.requested) {
    if (input.payerMode !== "medicare-ffs") g2211Blockers.push("G2211 is a Medicare HCPCS policy; verify the selected payer's treatment before adding it.");
    if (input.siteType === "rhc" || input.siteType === "fqhc") g2211Blockers.push("G2211 is bundled into RHC/FQHC encounter payment and is not separately payable in this pathway.");
    if (input.g2211.longitudinalRelationship === "none" || input.g2211.relationshipDocumented !== true) g2211Blockers.push("Document the continuing focal-point relationship or ongoing care for a serious/complex condition.");
    if (modifiers.includes("25") && !["preventive", "annual-wellness", "vaccine-administration"].includes(input.sameDay.serviceType)) g2211Blockers.push("With modifier 25, Medicare separately pays G2211 only for the allowed same-day Part B preventive, AWV, or vaccine-administration pathways represented here.");
    if (!g2211Blockers.length) {
      g2211Suggested = true;
      g2211Reasons.push("The documented longitudinal relationship supports coder review of G2211 with an eligible office/outpatient base code.");
    }
  }

  let selectedPath: EmCodePath | null = null;
  if (input.selectionBasis === "mdm") selectedPath = mdmPath.supported ? mdmPath : null;
  if (input.selectionBasis === "time") selectedPath = timePath.supported ? timePath : null;
  if (input.selectionBasis === "both") {
    const supported = [mdmPath, timePath].filter((path) => path.supported);
    selectedPath = supported.sort((a, b) => codeRank(b.code) - codeRank(a.code))[0] || null;
    if (mdmPath.supported && timePath.supported && mdmPath.code !== timePath.code) queries.push(`MDM supports ${mdmPath.code}; time supports ${timePath.code}. Verify medical necessity and select the supported basis used for reporting.`);
  }

  const claimBlockers: string[] = [];
  const claimReasons: string[] = [];
  if (!selectedPath) claimBlockers.push("The chosen selection basis does not yet support a releasable base E/M line.");
  if (!diagnosisCodes.length) claimBlockers.push("Enter the documented diagnoses addressed or otherwise relevant to the claim; the engine does not infer diagnoses.");
  if (!/^\d{10}$/.test(String(input.billingNpi || ""))) claimBlockers.push("Enter the 10-digit billing practitioner NPI.");
  if (input.medicallyAppropriateHistoryExam !== true) claimBlockers.push("Verify a medically appropriate history and/or examination when performed; these no longer determine the level.");
  if (input.serviceMedicallyNecessary !== true) claimBlockers.push("Verify that the selected service and level are medically reasonable and necessary.");
  if (input.currentCptEditionVerified !== true) claimBlockers.push("Verify the current licensed CPT edition and payer-effective code metadata before claim release.");
  if (sameDayBlockers.length || g2211Blockers.length) claimBlockers.push("Resolve the same-day service and add-on holds before claim release.");
  if (!claimBlockers.length) claimReasons.push(`${selectedPath?.code} is assembled as a coder-review candidate using the ${selectedPath?.basis.toUpperCase()} pathway.`);

  const claimLines: EmClaimLine[] = [];
  if (selectedPath && !claimBlockers.length && selectedPath.code) {
    claimLines.push({ code: selectedPath.code, codeSystem: "CPT", units: 1, modifiers, diagnosisPointers: diagnosisCodes, description: `${input.patientType === "new" ? "New" : "Established"} office/outpatient E/M candidate supported by ${selectedPath.basis.toUpperCase()}`, descriptionSemantics: "original-paraphrase", sourceId: "licensed-cpt-adapter-required" });
    if (prolongedUnits > 0) claimLines.push({ code: "G2212", codeSystem: "HCPCS", units: prolongedUnits, modifiers: [], diagnosisPointers: diagnosisCodes, description: "Medicare prolonged office/outpatient E/M time add-on", descriptionSemantics: "original-paraphrase", sourceId: "cms-clm-ch12" });
    if (g2211Suggested) claimLines.push({ code: "G2211", codeSystem: "HCPCS", units: 1, modifiers: [], diagnosisPointers: diagnosisCodes, description: "Medicare office/outpatient longitudinal visit-complexity add-on", descriptionSemantics: "original-paraphrase", sourceId: "cms-mm13473" });
  }

  if ((input.diagnosisCodes || []).length !== diagnosisCodes.length) queries.push("Invalid code-shaped diagnosis entries were excluded; no diagnosis was inferred or repaired.");
  queries.push("History and examination support clinical care but do not set the office/outpatient E/M level.");
  queries.push("Confirm payer edits, global-surgery status, code-set license, and source documentation before release.");

  const domains: EmDomainResult[] = [
    domain("patient-status", "Patient status and family", patientReasons, patientBlockers, ["cms-mln006764"]),
    domain("problems", "Problems addressed", problems.reasons, problems.blockers, ["ama-em-guidelines"], problems.level),
    domain("data", "Data reviewed and analyzed", data.reasons, data.blockers, ["ama-em-guidelines"], data.level),
    domain("risk", "Patient-management risk", risk.reasons, risk.blockers, ["ama-em-guidelines"], risk.level),
    domain("mdm", "Two-of-three MDM", mdmReasons, mdmBlockers, ["ama-em-guidelines", "cms-mln006764"], overallMdmLevel),
    domain("time", "Date-of-service time", timeReasons, timeBlockers, ["ama-em-2024-time", "cms-clm-ch12"], timePath.level),
    domain("same-day", "Same-day services and add-ons", [...sameDayReasons, ...g2211Reasons], [...sameDayBlockers, ...g2211Blockers], ["cms-mm13473", "cms-clm-ch12"], undefined, input.sameDay.serviceType !== "none" || input.g2211.requested),
    domain("claim", "Claim readiness", claimReasons, claimBlockers, ["cms-mln006764", "licensed-cpt-adapter-required"]),
  ];

  return {
    engineVersion: EM_MDM_ENGINE_VERSION,
    policyVersion: EM_MDM_POLICY_VERSION,
    patientType: resolvedPatientType,
    elementLevels: { problems: problems.level, data: data.level, risk: risk.level },
    overallMdmLevel,
    mdmPath,
    timePath,
    selectedPath,
    reportableMinutes,
    prolonged: { code: prolongedUnits ? "G2212" : null, units: prolongedUnits, status: resultStatus(prolongedBlockers, prolongedUnits === 0), reasons: prolongedReasons, blockers: prolongedBlockers },
    sameDayModifiers: modifiers,
    g2211: { suggested: g2211Suggested, status: resultStatus(g2211Blockers, input.g2211.requested && !g2211Blockers.length), reasons: g2211Reasons, blockers: g2211Blockers },
    diagnosisCodes,
    domains,
    claimLines,
    queries,
    requiresHumanApproval: true,
    autonomousClaimSubmission: false,
    licensedCptDescriptorsEmbedded: false,
  };
}
