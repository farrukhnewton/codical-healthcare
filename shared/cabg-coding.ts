export const CABG_ENGINE_VERSION = "2026.08.10.1";
export const CABG_POLICY_VERSION = "CMS-PFS-NCCI-MUE-AOC-PCS-2026Q3";

export type CabgReviewState = true | false | null;
export type CabgClaimScope = "professional" | "inpatient-facility";
export type CabgPayerType = "medicare" | "medicaid" | "commercial" | "other";
export type CabgConduitKind = "arterial" | "venous" | "synthetic" | "nonautologous" | "zooplastic";
export type CabgConduitSource =
  | "left-internal-mammary"
  | "right-internal-mammary"
  | "left-radial"
  | "right-radial"
  | "left-saphenous"
  | "right-saphenous"
  | "other-artery"
  | "other-vein"
  | "synthetic"
  | "nonautologous"
  | "zooplastic";
export type CabgInflowSource =
  | "aorta"
  | "left-internal-mammary"
  | "right-internal-mammary"
  | "coronary-artery"
  | "thoracic-artery"
  | "abdominal-artery"
  | "unknown";
export type CabgApproach = "open" | "percutaneous-endoscopic" | "unknown";
export type CabgHarvestMethod = "none" | "open" | "endoscopic" | "percutaneous";
export type CabgHarvestSource =
  | "left-saphenous"
  | "right-saphenous"
  | "left-radial"
  | "right-radial"
  | "upper-extremity-vein"
  | "femoropopliteal-vein"
  | "internal-mammary"
  | "other";

export type CabgDiagnosisEvidence = {
  id: string;
  code: string;
  description?: string;
  providerDocumented: CabgReviewState;
  clinicallySupported: CabgReviewState;
  sourceDocumentId?: string;
};

/** One row represents one completed distal coronary target/anastomosis. */
export type CabgTargetInput = {
  id: string;
  targetVessel: string;
  conduitKind: CabgConduitKind;
  conduitSource: CabgConduitSource;
  inflowSource: CabgInflowSource;
  approach: CabgApproach;
  completed: CabgReviewState;
  sourceVerified: CabgReviewState;
  sourceDocumentId?: string;
};

export type CabgHarvestInput = {
  id: string;
  source: CabgHarvestSource;
  method: CabgHarvestMethod;
  performed: CabgReviewState;
  sourceVerified: CabgReviewState;
  sourceDocumentId?: string;
};

export type CabgCaseInput = {
  patientName: string;
  dateOfBirth: string;
  serviceDate: string;
  claimScope: CabgClaimScope;
  payerType: CabgPayerType;
  payerName: string;
  payerJurisdiction: string;
  payerPolicyVerified: CabgReviewState;
  payerPolicyCurrent: CabgReviewState;
  operativeReportSigned: CabgReviewState;
  surgeryCompleted: CabgReviewState;
  primarySurgeon: string;
  surgeonEligible: CabgReviewState;
  diagnoses: CabgDiagnosisEvidence[];
  targets: CabgTargetInput[];
  harvests: CabgHarvestInput[];
  redo: {
    isReoperation: CabgReviewState;
    previousCabgOrValve: CabgReviewState;
    priorOperationDate: string;
    explicitlyDocumented: CabgReviewState;
  };
  coronaryEndarterectomyVessels: number;
  coronaryEndarterectomyDocumented: CabgReviewState;
  sameDayProcedureCodes: string[];
  combinedProceduresSourceVerified: CabgReviewState;
};

export type CabgCodeCandidate = {
  code: string | null;
  system: "CPT" | "ICD-10-PCS";
  role: "primary" | "add-on" | "harvest" | "concomitant" | "facility-bypass" | "facility-harvest";
  status: "candidate" | "review" | "held";
  rationale: string;
  blockers: string[];
  warnings: string[];
  units: number;
};

export type CabgEvaluation = {
  engineVersion: string;
  policyVersion: string;
  status: "ready" | "review" | "hold";
  arterialTargets: number;
  venousTargets: number;
  totalTargets: number;
  candidates: CabgCodeCandidate[];
  diagnoses: Array<{ id: string; code: string; status: "accepted" | "held"; rationale: string }>;
  claimCodes: string[];
  ncciCodes: string[];
  blockers: string[];
  warnings: string[];
  coverage: { status: "review" | "verified"; findings: string[] };
  currentNcciRequired: true;
  currentMueRequired: true;
  currentAocRequired: true;
  licensedCptVerificationRequired: true;
  currentPcsTableVerificationRequired: true;
  modifiersNeverAutomatic: true;
  msDrgNotDetermined: true;
  humanApprovalRequired: true;
  autonomousClaimSubmissionAllowed: false;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DX_PATTERN = /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/;
const PROCEDURE_PATTERN = /^[A-Z0-9]{5,7}$/;

function parseDate(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  const parts = value.split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2] ? date : null;
}

function normalizeDiagnosis(value: string) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9.]/g, "");
  return compact.includes(".") || compact.length <= 3 ? compact : compact.slice(0, 3) + "." + compact.slice(3);
}

function normalizeProcedure(value: string) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function codeCandidate(
  code: string | null,
  system: CabgCodeCandidate["system"],
  role: CabgCodeCandidate["role"],
  rationale: string,
  blockers: string[] = [],
  warnings: string[] = [],
  units = 1,
): CabgCodeCandidate {
  return { code, system, role, rationale, blockers, warnings, units, status: blockers.length ? "held" : warnings.length ? "review" : "candidate" };
}

export function professionalCabgCodes(arterialTargets: number, venousTargets: number) {
  const codes: string[] = [];
  if (arterialTargets > 0) {
    codes.push(arterialTargets === 1 ? "33533" : arterialTargets === 2 ? "33534" : arterialTargets === 3 ? "33535" : "33536");
    if (venousTargets > 0) {
      codes.push(venousTargets === 1 ? "33517" : venousTargets === 2 ? "33518" : venousTargets === 3 ? "33519" : venousTargets === 4 ? "33521" : venousTargets === 5 ? "33522" : "33523");
    }
  } else if (venousTargets > 0) {
    codes.push(venousTargets === 1 ? "33510" : venousTargets === 2 ? "33511" : venousTargets === 3 ? "33512" : venousTargets === 4 ? "33513" : venousTargets === 5 ? "33514" : "33516");
  }
  return codes;
}

function conduitDevice(source: CabgConduitSource, inflow: CabgInflowSource) {
  if (source === "left-saphenous" || source === "right-saphenous" || source === "other-vein") return "9";
  if (source === "left-internal-mammary") return inflow === "left-internal-mammary" ? "Z" : "A";
  if (source === "right-internal-mammary") return inflow === "right-internal-mammary" ? "Z" : "A";
  if (source === "left-radial" || source === "right-radial" || source === "other-artery") return "A";
  if (source === "synthetic") return "J";
  if (source === "nonautologous") return "K";
  if (source === "zooplastic") return "8";
  return null;
}

function inflowQualifier(source: CabgInflowSource) {
  return source === "coronary-artery" ? "3"
    : source === "right-internal-mammary" ? "8"
      : source === "left-internal-mammary" ? "9"
        : source === "thoracic-artery" ? "C"
          : source === "abdominal-artery" ? "F"
            : source === "aorta" ? "W"
              : null;
}

function approachCharacter(approach: CabgApproach) {
  return approach === "open" ? "0" : approach === "percutaneous-endoscopic" ? "4" : null;
}

function bodyPartCharacter(count: number) {
  return count === 1 ? "0" : count === 2 ? "1" : count === 3 ? "2" : "3";
}

function pcsBypassCandidates(targets: CabgTargetInput[]) {
  const groups = new Map<string, CabgTargetInput[]>();
  const held: CabgCodeCandidate[] = [];
  for (const target of targets) {
    const blockers: string[] = [];
    const device = conduitDevice(target.conduitSource, target.inflowSource);
    const qualifier = inflowQualifier(target.inflowSource);
    const approach = approachCharacter(target.approach);
    if (!target.targetVessel.trim()) blockers.push("Document the distal coronary target.");
    if (target.completed !== true) blockers.push("Confirm that this distal bypass was completed.");
    if (target.sourceVerified !== true) blockers.push("Verify conduit, inflow source, approach, and distal target against the signed operative report.");
    if (!device || !qualifier || !approach) blockers.push("Complete the PCS device, inflow qualifier, and approach facts.");
    if (blockers.length) {
      held.push(codeCandidate(null, "ICD-10-PCS", "facility-bypass", "Incomplete coronary bypass PCS construction.", blockers));
      continue;
    }
    const key = approach + "|" + device + "|" + qualifier;
    groups.set(key, [...(groups.get(key) || []), target]);
  }
  const candidates = [...groups.entries()].map(([key, rows]) => {
    const chars = key.split("|");
    const code = "021" + bodyPartCharacter(rows.length) + chars[0] + chars[1] + chars[2];
    return codeCandidate(code, "ICD-10-PCS", "facility-bypass", rows.length + " documented coronary target(s) grouped by the same approach, conduit device, and inflow source.");
  });
  return [...candidates, ...held];
}

function pcsHarvestCode(harvest: CabgHarvestInput) {
  if (harvest.source === "right-saphenous") return harvest.method === "open" ? "06BP0ZZ" : harvest.method === "percutaneous" ? "06BP3ZZ" : harvest.method === "endoscopic" ? "06BP4ZZ" : null;
  if (harvest.source === "left-saphenous") return harvest.method === "open" ? "06BQ0ZZ" : harvest.method === "percutaneous" ? "06BQ3ZZ" : harvest.method === "endoscopic" ? "06BQ4ZZ" : null;
  if (harvest.source === "right-radial") return harvest.method === "open" ? "03BB0ZZ" : harvest.method === "percutaneous" ? "03BB3ZZ" : harvest.method === "endoscopic" ? "03BB4ZZ" : null;
  if (harvest.source === "left-radial") return harvest.method === "open" ? "03BC0ZZ" : harvest.method === "percutaneous" ? "03BC3ZZ" : harvest.method === "endoscopic" ? "03BC4ZZ" : null;
  return null;
}

function professionalHarvestCode(harvest: CabgHarvestInput) {
  if ((harvest.source === "left-saphenous" || harvest.source === "right-saphenous") && harvest.method === "endoscopic") return "33508";
  if ((harvest.source === "left-radial" || harvest.source === "right-radial") && harvest.method === "endoscopic") return "33509";
  if ((harvest.source === "left-radial" || harvest.source === "right-radial") && harvest.method === "open") return "35600";
  if (harvest.source === "upper-extremity-vein" && harvest.method === "open") return "35500";
  if (harvest.source === "femoropopliteal-vein" && harvest.method === "open") return "35572";
  return null;
}

function moreThanOneCalendarMonth(priorValue: string, serviceValue: string) {
  const prior = parseDate(priorValue);
  const service = parseDate(serviceValue);
  if (!prior || !service) return false;
  const threshold = new Date(prior.getTime());
  threshold.setUTCMonth(threshold.getUTCMonth() + 1);
  return service > threshold;
}

export function evaluateCabgCase(input: CabgCaseInput): CabgEvaluation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const eligibleTargets = input.targets.filter((target) => target.completed === true);
  const arterialTargets = eligibleTargets.filter((target) => target.conduitKind === "arterial").length;
  const venousTargets = eligibleTargets.filter((target) => target.conduitKind === "venous").length;

  if (!input.patientName.trim()) blockers.push("Patient name is required for source-document matching.");
  if (!parseDate(input.dateOfBirth)) blockers.push("A valid patient date of birth is required.");
  if (!parseDate(input.serviceDate)) blockers.push("A valid operative service date is required.");
  if (input.operativeReportSigned !== true) blockers.push("A signed operative report is required.");
  if (input.surgeryCompleted !== true) blockers.push("Confirm that the CABG procedure was completed.");
  if (!input.primarySurgeon.trim() || input.surgeonEligible !== true) blockers.push("Verify the reporting surgeon and billing eligibility.");
  if (!input.targets.length || !eligibleTargets.length) blockers.push("Add at least one completed distal coronary target.");
  if (input.targets.some((target) => target.completed !== true || target.sourceVerified !== true)) blockers.push("Every reported target must be completed and source verified.");
  if (input.targets.some((target) => !target.targetVessel.trim())) blockers.push("Every target row needs a documented distal coronary vessel.");
  if (input.payerPolicyVerified !== true || input.payerPolicyCurrent !== true) warnings.push("Date-effective payer coverage and authorization rules remain unverified.");
  if (new Set(eligibleTargets.map((target) => target.targetVessel.trim().toUpperCase())).size < eligibleTargets.length) warnings.push("Repeated target labels detected; verify sequential distal anastomoses and do not count conduit segments alone.");

  const diagnoses = input.diagnoses.map((diagnosis) => {
    const code = normalizeDiagnosis(diagnosis.code);
    const accepted = DX_PATTERN.test(code) && diagnosis.providerDocumented === true && diagnosis.clinicallySupported === true;
    return { id: diagnosis.id, code, status: accepted ? "accepted" as const : "held" as const, rationale: accepted ? "Provider-documented and clinically supported." : "Hold until code format, provider documentation, and clinical support are verified." };
  });
  if (!diagnoses.some((diagnosis) => diagnosis.status === "accepted")) blockers.push("At least one supported provider-documented ICD-10-CM diagnosis is required.");

  const candidates: CabgCodeCandidate[] = [];
  if (input.claimScope === "professional") {
    const graftCodes = professionalCabgCodes(arterialTargets, venousTargets);
    if (graftCodes.length) {
      candidates.push(codeCandidate(graftCodes[0], "CPT", "primary", arterialTargets > 0 ? "Arterial CABG family selected from documented distal arterial targets." : "Venous-only CABG family selected from documented distal venous targets.", blockers.filter((item) => /target|operative|completed|surgeon/i.test(item))));
      if (graftCodes[1]) candidates.push(codeCandidate(graftCodes[1], "CPT", "add-on", "Combined arterial-venous add-on family selected from documented distal venous targets."));
    } else {
      candidates.push(codeCandidate(null, "CPT", "primary", "CABG family cannot be selected without completed distal targets.", ["No completed arterial or venous targets were available."]));
    }

    for (const harvest of input.harvests) {
      if (harvest.performed !== true) continue;
      const code = professionalHarvestCode(harvest);
      const harvestBlockers: string[] = [];
      if (harvest.sourceVerified !== true) harvestBlockers.push("Verify the harvest source and technique.");
      if (!code && harvest.method !== "none") {
        warnings.push("A harvest is documented but no separately reportable professional harvest candidate was established; review integral-service and licensed CPT rules.");
        continue;
      }
      if (code === "33508" && venousTargets < 1) harvestBlockers.push("Endoscopic vein harvest requires a documented venous bypass target.");
      if ((code === "33509" || code === "35600") && arterialTargets < 1) harvestBlockers.push("Upper-extremity artery harvest requires a documented arterial bypass target.");
      if (code) candidates.push(codeCandidate(code, "CPT", "harvest", "Technique-specific conduit harvest candidate; validate its current add-on primary-code relationship.", harvestBlockers));
    }

    if (input.redo.isReoperation === true) {
      const redoBlockers: string[] = [];
      if (input.redo.previousCabgOrValve !== true || input.redo.explicitlyDocumented !== true) redoBlockers.push("Confirm a documented prior CABG or valve operation and that this is a reoperation.");
      if (!moreThanOneCalendarMonth(input.redo.priorOperationDate, input.serviceDate)) redoBlockers.push("The prior operation must be documented as more than one calendar month before this service.");
      candidates.push(codeCandidate("33530", "CPT", "add-on", "Reoperation add-on candidate.", redoBlockers));
    }

    if (input.coronaryEndarterectomyVessels > 0) {
      const endarterectomyBlockers: string[] = [];
      if (input.coronaryEndarterectomyDocumented !== true) endarterectomyBlockers.push("Verify coronary endarterectomy in the signed operative report.");
      if (input.coronaryEndarterectomyVessels > 3) endarterectomyBlockers.push("The July 2026 practitioner MUE is 3 units; review every vessel and line.");
      candidates.push(codeCandidate("33572", "CPT", "add-on", "Coronary endarterectomy candidate by documented distinct vessel.", endarterectomyBlockers, [], Math.max(1, input.coronaryEndarterectomyVessels)));
    }

    const sameDay = [...new Set(input.sameDayProcedureCodes.map(normalizeProcedure).filter((code) => PROCEDURE_PATTERN.test(code)))];
    if (sameDay.length && input.combinedProceduresSourceVerified !== true) blockers.push("Verify every same-day valve or other procedure against the signed source before NCCI review.");
    if (input.combinedProceduresSourceVerified === true) {
      for (const code of sameDay) candidates.push(codeCandidate(code, "CPT", "concomitant", "Source-verified same-day procedure retained for licensed code and current NCCI review.", [], ["No valve code or modifier was inferred by the engine."]));
    }
  } else {
    candidates.push(...pcsBypassCandidates(input.targets));
    for (const harvest of input.harvests) {
      if (harvest.performed !== true) continue;
      const code = pcsHarvestCode(harvest);
      const harvestBlockers: string[] = [];
      if (harvest.sourceVerified !== true) harvestBlockers.push("Verify harvest body part and approach.");
      if (!code) harvestBlockers.push("The documented harvest source/method is not specific enough for PCS construction.");
      candidates.push(codeCandidate(code, "ICD-10-PCS", "facility-harvest", "Separate inpatient facility conduit-harvest objective.", harvestBlockers));
    }
    if (input.sameDayProcedureCodes.length) warnings.push("Facility valve and other procedures require independent current PCS construction; CPT codes are not crosswalked into PCS.");
  }

  for (const candidate of candidates) {
    blockers.push(...candidate.blockers);
    warnings.push(...candidate.warnings);
  }
  const uniqueBlockers = [...new Set(blockers)];
  const uniqueWarnings = [...new Set(warnings)];
  const claimCodes = [...new Set(candidates.filter((candidate) => candidate.code && candidate.status !== "held").map((candidate) => candidate.code as string))];
  const ncciCodes = input.claimScope === "professional" ? claimCodes.filter((code) => /^\d{5}$/.test(code)) : [];
  const coverageVerified = input.payerPolicyVerified === true && input.payerPolicyCurrent === true;
  const status = uniqueBlockers.length || candidates.some((candidate) => candidate.status === "held") ? "hold" : uniqueWarnings.length || candidates.some((candidate) => candidate.status === "review") ? "review" : "ready";

  return {
    engineVersion: CABG_ENGINE_VERSION,
    policyVersion: CABG_POLICY_VERSION,
    status,
    arterialTargets,
    venousTargets,
    totalTargets: eligibleTargets.length,
    candidates,
    diagnoses,
    claimCodes,
    ncciCodes,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    coverage: {
      status: coverageVerified ? "verified" : "review",
      findings: coverageVerified
        ? ["Date-effective payer policy was marked verified; retain source evidence and authorization status."]
        : ["CABG coverage is not inferred from code selection. Verify the applicable MAC, Medicaid, or plan policy and authorization for the service date."],
    },
    currentNcciRequired: true,
    currentMueRequired: true,
    currentAocRequired: true,
    licensedCptVerificationRequired: true,
    currentPcsTableVerificationRequired: true,
    modifiersNeverAutomatic: true,
    msDrgNotDetermined: true,
    humanApprovalRequired: true,
    autonomousClaimSubmissionAllowed: false,
  };
}
