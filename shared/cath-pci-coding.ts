export const CATH_PCI_ENGINE_VERSION = "2026.08.10.1";
export const CATH_PCI_POLICY_VERSION = "CMS-PFS-NCCI-MUE-AOC-PCS-MCD-2026Q3";

export type CathReviewState = true | false | null;
export type CathClaimScope = "professional" | "hospital-outpatient" | "inpatient-facility";
export type CathPayerType = "medicare" | "medicaid" | "commercial" | "other";
export type CoronaryVessel = "left-main" | "lad" | "lcx" | "rca" | "ramus-intermedius" | "bypass-graft";
export type CoronaryModifier = "LM" | "LD" | "LC" | "RC" | "RI" | "";
export type PciTechnique = "angioplasty" | "atherectomy" | "stent" | "atherectomy-stent" | "acute-mi" | "cto-antegrade" | "cto-antegrade-retrograde";
export type PciDevice = "drug-eluting-stent" | "intraluminal-device" | "no-device" | "unknown";
export type PciApproach = "percutaneous" | "percutaneous-endoscopic" | "unknown";
export type CathAdjunctKind = "ivus-oct" | "ffr-cfr" | "mechanical-thrombectomy" | "brachytherapy";

export type CathDiagnosisEvidence = {
  id: string;
  code: string;
  description?: string;
  providerDocumented: CathReviewState;
  clinicallySupported: CathReviewState;
};

export type PciTargetInput = {
  id: string;
  vessel: CoronaryVessel;
  arteryModifier: CoronaryModifier;
  graftLabel?: string;
  lesionsTreated: number;
  stentsPlaced: number;
  technique: PciTechnique;
  device: PciDevice;
  approach: PciApproach;
  bifurcation: CathReviewState;
  completed: CathReviewState;
  sourceVerified: CathReviewState;
};

export type CathAdjunctInput = {
  id: string;
  kind: CathAdjunctKind;
  vessel: CoronaryVessel;
  arteryModifier: CoronaryModifier;
  performed: CathReviewState;
  sourceVerified: CathReviewState;
  medicallyNecessary: CathReviewState;
};

export type DiagnosticCathFacts = {
  rightHeart: CathReviewState;
  leftHeart: CathReviewState;
  coronaryAngiography: CathReviewState;
  bypassGraftAngiography: CathReviewState;
  completeDiagnosticStudy: CathReviewState;
  diagnosticMedicalNecessity: CathReviewState;
  priorStudyAvailable: CathReviewState;
  priorStudyAdequate: CathReviewState;
  changedCondition: CathReviewState;
  inadequateVisualization: CathReviewState;
  intraprocedureClinicalChange: CathReviewState;
  interventionDecisionBasedOnStudy: CathReviewState;
};

export type CathPciCaseInput = {
  caseId?: string;
  patientName: string;
  dateOfService: string;
  claimScope: CathClaimScope;
  payerType: CathPayerType;
  payerJurisdiction: string;
  operatorName: string;
  reportSigned: CathReviewState;
  operatorEligible: CathReviewState;
  payerPolicyVerified: CathReviewState;
  payerPolicyCurrent: CathReviewState;
  diagnostic: DiagnosticCathFacts;
  interventions: PciTargetInput[];
  adjuncts: CathAdjunctInput[];
  diagnoses: CathDiagnosisEvidence[];
  sameDayProcedureCodes: string[];
};

export type CathCodeCandidate = {
  code?: string;
  modifiers: string[];
  units: number;
  system: "CPT" | "HCPCS" | "ICD-10-PCS";
  role: "diagnostic" | "intervention" | "adjunct" | "facility";
  status: "candidate" | "held" | "packaged";
  rationale: string;
  blockers: string[];
};

export type CathPciEvaluation = {
  engineVersion: string;
  policyVersion: string;
  status: "ready" | "hold";
  candidates: CathCodeCandidate[];
  claimCodes: string[];
  diagnoses: Array<CathDiagnosisEvidence & { status: "candidate" | "held" }>;
  coverage: { status: "verified" | "review"; findings: string[] };
  warnings: string[];
  hardStops: string[];
  humanApprovalRequired: true;
};

const EXPECTED_MODIFIER: Partial<Record<CoronaryVessel, CoronaryModifier>> = {
  "left-main": "LM", lad: "LD", lcx: "LC", rca: "RC", "ramus-intermedius": "RI",
};

const MUE: Record<string, number> = {
  "92920": 3, "92924": 2, "92928": 3, "92930": 1, "92933": 2, "92937": 2,
  "92941": 1, "92943": 2, "92945": 1, "92973": 2, "92974": 1, "92978": 1,
  "92979": 2, "93571": 1, "93572": 2,
  "93451": 1, "93452": 1, "93453": 1, "93454": 1, "93455": 1, "93456": 1,
  "93457": 1, "93458": 1, "93459": 1, "93460": 1, "93461": 1,
};

const RETIRED_2026 = new Set(["92921", "92925", "92929", "92934", "92938", "92944", "92975"]);

function candidate(code: string | undefined, role: CathCodeCandidate["role"], rationale: string, blockers: string[] = [], modifiers: string[] = [], system: CathCodeCandidate["system"] = "CPT", status?: CathCodeCandidate["status"]): CathCodeCandidate {
  return { code, role, rationale, blockers, modifiers, units: 1, system, status: status ?? (blockers.length ? "held" : "candidate") };
}

export function inclusiveDiagnosticCathCode(facts: DiagnosticCathFacts): string | undefined {
  const r = facts.rightHeart === true;
  const l = facts.leftHeart === true;
  const c = facts.coronaryAngiography === true;
  const g = facts.bypassGraftAngiography === true;
  if (r && l && c) return g ? "93461" : "93460";
  if (r && c) return g ? "93457" : "93456";
  if (l && c) return g ? "93459" : "93458";
  if (c) return g ? "93455" : "93454";
  if (r && l) return "93453";
  if (l) return "93452";
  if (r) return "93451";
  return undefined;
}

function pciCode(row: PciTargetInput): string {
  if (row.technique === "acute-mi") return "92941";
  if (row.technique === "cto-antegrade") return "92943";
  if (row.technique === "cto-antegrade-retrograde") return "92945";
  if (row.vessel === "bypass-graft") return "92937";
  if (row.technique === "atherectomy-stent") return "92933";
  if (row.technique === "stent") return row.lesionsTreated >= 2 ? "92930" : "92928";
  if (row.technique === "atherectomy") return "92924";
  return "92920";
}

function modifierBlockers(row: { vessel: CoronaryVessel; arteryModifier: CoronaryModifier }) {
  const expected = EXPECTED_MODIFIER[row.vessel];
  if (expected && row.arteryModifier !== expected) return [`Use the source-verified ${expected} coronary-artery modifier for this vessel.`];
  if (row.vessel === "bypass-graft" && !row.arteryModifier) return ["Identify the native coronary territory supplied by the bypass graft before assigning an artery modifier."];
  return [];
}

function pcsDeviceCharacter(device: PciDevice, stents: number) {
  if (device === "drug-eluting-stent") return stents >= 4 ? "7" : stents === 3 ? "6" : stents === 2 ? "5" : "4";
  if (device === "intraluminal-device") return stents >= 4 ? "G" : stents === 3 ? "F" : stents === 2 ? "E" : "D";
  if (device === "no-device") return "Z";
  return undefined;
}

export function inpatientPcsCandidates(rows: PciTargetInput[]): CathCodeCandidate[] {
  const eligible = rows.filter((row) => row.completed === true && row.sourceVerified === true);
  const groups = new Map<string, PciTargetInput[]>();
  const held: CathCodeCandidate[] = [];
  for (const row of eligible) {
    if (row.device === "unknown" || row.approach === "unknown" || row.vessel === "bypass-graft") {
      held.push(candidate(undefined, "facility", `ICD-10-PCS Dilation attributes remain incomplete for ${row.graftLabel || row.vessel}.`, ["Verify coronary artery count, approach, device type/device count, and bifurcation qualifier."], [], "ICD-10-PCS"));
      continue;
    }
    const key = [row.approach, row.device, row.bifurcation === true ? "6" : "Z"].join("|");
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const output = [...groups.entries()].map(([key, grouped]) => {
    const [approach, deviceType, qualifier] = key.split("|");
    const arteries = new Set(grouped.map((row) => row.vessel)).size;
    const deviceCount = grouped.reduce((sum, row) => sum + Math.max(1, row.stentsPlaced), 0);
    const device = pcsDeviceCharacter(deviceType as PciDevice, deviceCount) as string;
    const bodyPart = arteries >= 4 ? "3" : String(Math.max(1, arteries) - 1);
    const approachChar = approach === "percutaneous" ? "3" : "4";
    const code = `027${bodyPart}${approachChar}${device}${qualifier}`;
    return candidate(code, "facility", `Dilation of ${arteries >= 4 ? "four or more" : arteries} coronary ${arteries === 1 ? "artery" : "arteries"}; device, approach, and bifurcation qualifier grouped from verified intervention rows.`, [], [], "ICD-10-PCS");
  });
  return [...output, ...held];
}

export function evaluateCathPciCase(input: CathPciCaseInput): CathPciEvaluation {
  const candidates: CathCodeCandidate[] = [];
  const warnings: string[] = [];
  const hardStops: string[] = [];
  if (!input.dateOfService) hardStops.push("Date of service is required for date-effective code and payer-policy review.");
  if (input.reportSigned !== true) hardStops.push("A signed/final catheterization report is required before release.");
  if (input.operatorEligible !== true) hardStops.push("Confirm the reporting clinician or facility is eligible for this claim scope.");

  const completed = input.interventions.filter((row) => row.completed === true);
  const seen = new Map<string, CathCodeCandidate>();
  let acuteMiCount = 0;
  for (const row of completed) {
    const key = `${row.vessel}:${row.vessel === "bypass-graft" ? (row.graftLabel || "") : ""}`;
    const blockers = [...modifierBlockers(row)];
    const duplicate = seen.get(key);
    if (duplicate) {
      const duplicateBlocker = "Multiple rows use the same major coronary artery/graft. Consolidate lesions and retain only the most intensive intervention family.";
      blockers.push(duplicateBlocker);
      duplicate.blockers.push(duplicateBlocker);
      duplicate.status = "held";
    }
    if (row.sourceVerified !== true) blockers.push("Verify vessel, lesion count, technique, and device against the signed source report.");
    if (row.technique === "stent" && row.lesionsTreated < 1) blockers.push("Document the treated lesion count; 92928 and 92930 are lesion-count dependent in 2026.");
    if (row.technique === "acute-mi" && ++acuteMiCount > 1) blockers.push("92941 has a date-of-service MUE of 1; only the single emergent AMI culprit intervention may use this family.");
    const code = pciCode(row);
    const interventionCandidate = candidate(code, "intervention", `${row.technique.replaceAll("-", " ")} in ${row.graftLabel || row.vessel}; one hierarchy-selected PCI family per major artery/graft.`, blockers, row.arteryModifier ? [row.arteryModifier] : []);
    candidates.push(interventionCandidate);
    if (!duplicate) seen.set(key, interventionCandidate);
  }
  if (input.interventions.some((row) => row.completed !== true)) warnings.push("Incomplete or pending intervention rows were excluded from claim candidates.");

  const diagnosticCode = inclusiveDiagnosticCathCode(input.diagnostic);
  if (diagnosticCode) {
    const blockers: string[] = [];
    if (input.diagnostic.completeDiagnosticStudy !== true || input.diagnostic.diagnosticMedicalNecessity !== true) blockers.push("Confirm a complete, medically necessary diagnostic study.");
    if (completed.length) {
      const noAdequatePrior = input.diagnostic.priorStudyAvailable === false && input.diagnostic.interventionDecisionBasedOnStudy === true;
      const repeatJustified = input.diagnostic.changedCondition === true || input.diagnostic.inadequateVisualization === true || input.diagnostic.intraprocedureClinicalChange === true;
      if (!noAdequatePrior && !repeatJustified) blockers.push("Same-session diagnostic catheterization is integral to PCI unless CMS repeat-study criteria are documented.");
      warnings.push("No NCCI bypass modifier is auto-assigned; a coder must validate any distinct diagnostic service from the record and current edits.");
    }
    candidates.unshift(candidate(diagnosticCode, "diagnostic", "Single inclusive catheterization/angiography family selected from documented components.", blockers));
  }
  if (!completed.length && !diagnosticCode) hardStops.push("No completed intervention or diagnostic catheterization component is available for coding.");

  const adjunctGroups: Record<string, CathAdjunctInput[]> = {};
  for (const row of input.adjuncts.filter((item) => item.performed === true)) (adjunctGroups[row.kind] ||= []).push(row);
  for (const [kind, rows] of Object.entries(adjunctGroups) as Array<[CathAdjunctKind, CathAdjunctInput[]]>) {
    rows.forEach((row, index) => {
      const blockers = [...modifierBlockers(row)];
      if (row.sourceVerified !== true || row.medicallyNecessary !== true) blockers.push("Verify performance, vessel, and medical necessity from the signed report.");
      let code = "";
      if (kind === "ivus-oct") code = index ? "92979" : "92978";
      if (kind === "ffr-cfr") code = index ? "93572" : "93571";
      if (kind === "brachytherapy") code = "92974";
      if (kind === "mechanical-thrombectomy") {
        code = "92973";
        if (completed.some((item) => item.vessel === row.vessel && (item.technique === "atherectomy" || item.technique === "atherectomy-stent"))) blockers.push("Mechanical thrombectomy is bundled when reported with atherectomy in the same vessel.");
        if (completed.some((item) => item.vessel === row.vessel && item.technique === "acute-mi")) warnings.push("Confirm thrombectomy was mechanical; non-mechanical aspiration is integral to 92941.");
      }
      candidates.push(candidate(code, "adjunct", `${kind.replaceAll("-", " ")} ${index ? "additional" : "initial"} vessel candidate.`, blockers, row.arteryModifier ? [row.arteryModifier] : []));
    });
  }

  if (input.claimScope === "inpatient-facility") {
    candidates.splice(0, candidates.length, ...inpatientPcsCandidates(input.interventions));
    warnings.push("The inpatient pathway produces ICD-10-PCS procedure candidates; diagnoses, MS-DRG, POA, and payment are outside this engine and require facility review.");
  } else if (input.claimScope === "hospital-outpatient" && completed.length) {
    candidates.push(candidate("G0269", "facility", "Hospital-outpatient closure-device service shown only as a packaged/bundled control; it is not a separately payable professional service.", [], [], "HCPCS", "packaged"));
    warnings.push("Hospital-outpatient claims require current OPPS/OCE/APC validation; this engine does not estimate payment.");
  }

  for (const item of candidates) {
    if (item.code && RETIRED_2026.has(item.code)) item.blockers.push("Code retired for 2026 PCI reporting; replace using current vessel/lesion hierarchy.");
    if (item.code && MUE[item.code] && item.units > MUE[item.code]) item.blockers.push(`Units exceed the Q3 2026 practitioner MUE of ${MUE[item.code]}.`);
    if (item.blockers.length) item.status = "held";
  }

  const diagnoses = input.diagnoses.map((diagnosis) => ({ ...diagnosis, status: diagnosis.code && diagnosis.providerDocumented === true && diagnosis.clinicallySupported === true ? "candidate" as const : "held" as const }));
  if (!diagnoses.some((item) => item.status === "candidate")) hardStops.push("At least one provider-documented, clinically supported diagnosis is required; the engine never infers one from a procedure.");
  const coverageVerified = input.payerPolicyVerified === true && input.payerPolicyCurrent === true && Boolean(input.payerJurisdiction);
  const coverage = {
    status: coverageVerified ? "verified" as const : "review" as const,
    findings: coverageVerified
      ? ["Date-effective payer/MAC policy review was affirmed by the user; retain the policy source in the audit record."]
      : ["Coverage is not inferred. Verify the member, jurisdiction/MAC, payer policy, setting, diagnosis support, and effective date."],
  };
  const claimCodes = candidates.filter((item) => item.status === "candidate" && item.code).map((item) => item.code as string);
  const status = hardStops.length || candidates.some((item) => item.status === "held") ? "hold" : "ready";
  return { engineVersion: CATH_PCI_ENGINE_VERSION, policyVersion: CATH_PCI_POLICY_VERSION, status, candidates, claimCodes, diagnoses, coverage, warnings, hardStops, humanApprovalRequired: true };
}
