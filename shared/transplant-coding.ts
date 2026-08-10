export const TRANSPLANT_ENGINE_VERSION = "2026.08.10.1";
export const TRANSPLANT_POLICY_VERSION = "CMS-TRANSPLANT-2026-Q3";
export const PECOS_TRANSPLANT_RECORD_EFFECTIVE_DATE = "2026-04-06";

export type TransplantOrgan = "kidney" | "liver" | "heart" | "lung" | "heart-lung" | "pancreas" | "intestine" | "multivisceral" | "combined";
export type TransplantAgeCategory = "adult" | "pediatric";
export type TransplantPayerMode = "medicare-ffs" | "medicare-advantage" | "medicaid" | "commercial" | "self-pay";
export type TransplantEpisodePurpose = "transplant" | "follow-up" | "donor" | "organ-acquisition" | "immunosuppressive-drug";
export type TransplantStatus = "pass" | "review" | "hold" | "not-applicable";
export type ProgramRecordSource = "pecos" | "legacy-cms" | "payer";

export type ProgramApprovalRecord = {
  organ: TransplantOrgan;
  ageCategory: TransplantAgeCategory | "all";
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: "approved" | "terminated" | "suspended";
  source: ProgramRecordSource;
  ccn?: string;
  sourceRecordId?: string;
};

export type TransplantCaseInput = {
  serviceDate: string;
  organ: TransplantOrgan;
  ageCategory: TransplantAgeCategory;
  payerMode: TransplantPayerMode;
  purpose: TransplantEpisodePurpose;
  facilityCcn?: string;
  diagnosisCodes?: string[];
  programApprovals?: ProgramApprovalRecord[];
  clinical?: {
    endStageOrganFailure?: boolean | null;
    transplantIndicationDocumented?: boolean | null;
    wholeOrganTransplant?: boolean | null;
    pancreasPath?: "spk" | "pak" | "pta" | "islet" | "unknown";
    insulinDependentDiabetes?: boolean | null;
    betaCellFailureDocumented?: boolean | null;
    medicallyUncontrollableHyperglycemia?: boolean | null;
    secondaryComplications?: boolean | null;
    irreversibleIntestinalFailure?: boolean | null;
    failedParenteralNutrition?: boolean | null;
    lifeThreateningParenteralNutritionComplication?: boolean | null;
    originalTransplantCovered?: boolean | null;
    followUpIndependentlyReasonableNecessary?: boolean | null;
  };
  operative?: {
    finalOperativeReport?: boolean;
    organImplanted?: boolean;
    backbenchDocumented?: boolean;
    reconstructionDocumented?: boolean;
    licensedProfessionalCode?: string;
    icd10PcsCode?: string;
    icd10PcsVersion?: string;
    dischargeDate?: string;
    msDrgGrouperVersion?: string;
  };
  acquisition?: {
    costItems?: AcquisitionCostItem[];
    sacReconciled?: boolean | null;
  };
  donor?: {
    donorType?: "living" | "deceased" | "paired-exchange";
    organ?: TransplantOrgan;
    recipientAccountLinked?: boolean | null;
    kidneyComplication?: boolean;
    occurrenceCode36?: boolean;
    patientRelationship39?: boolean;
    pairedExchangeReconciled?: boolean | null;
  };
  drug?: {
    pathway?: "ordinary-part-b" | "part-b-id" | "part-d" | "other";
    kidneyTransplant?: boolean | null;
    medicareEntitlementEndedAfter36Months?: boolean | null;
    noDisqualifyingCoverage?: boolean | null;
    partBidEnrolled?: boolean | null;
    medicationDocumentedAsImmunosuppressive?: boolean | null;
    daysSupply?: number | null;
    refillSequence?: "initial" | "subsequent" | "replacement" | null;
  };
};

export type AcquisitionCostItem = {
  id: string;
  description: string;
  amountCents: number;
  category: "direct-organ" | "shared" | "non-acquisition" | "unresolved";
  organ?: TransplantOrgan;
  allocations?: Array<{ organ: TransplantOrgan; percent: number }>;
  sourcePointer?: string;
};

export type TransplantDomainResult = {
  domain: string;
  status: TransplantStatus;
  title: string;
  reasons: string[];
  blockers: string[];
  sourceIds: string[];
};

export type TransplantClaimLane = {
  lane: "professional" | "institutional" | "dme" | "pharmacy";
  status: TransplantStatus;
  lines: Array<{ codeSystem: string; code?: string; description: string; source: string }>;
  blockers: string[];
};

export type TransplantEvaluation = {
  engineVersion: string;
  policyVersion: string;
  program: TransplantDomainResult;
  coverage: TransplantDomainResult;
  professional: TransplantDomainResult;
  facility: TransplantDomainResult;
  acquisition: TransplantDomainResult;
  donor: TransplantDomainResult;
  drug: TransplantDomainResult;
  claimReadiness: TransplantDomainResult;
  claimLanes: TransplantClaimLane[];
  queries: string[];
  diagnosisCodes: string[];
  requiresHumanApproval: true;
  autonomousClaimSubmission: false;
};

const PREREQUISITES: Partial<Record<TransplantOrgan, TransplantOrgan[]>> = {
  pancreas: ["kidney"],
  intestine: ["liver"],
  multivisceral: ["liver"],
  "heart-lung": ["heart", "lung"],
};

const ORGAN_SOURCES: Record<TransplantOrgan, string[]> = {
  kidney: ["CMS-BP-CH11", "CMS-PECOS-CR14262"],
  liver: ["NCD-260.1", "CMS-PECOS-CR14262"],
  heart: ["NCD-260.9", "CMS-PECOS-CR14262"],
  lung: ["CMS-BP-CH11", "CMS-PECOS-CR14262"],
  "heart-lung": ["CMS-BP-CH11", "CMS-PECOS-CR14262"],
  pancreas: ["NCD-260.3", "CMS-PECOS-CR14262"],
  intestine: ["NCD-260.5", "CMS-PECOS-CR14262"],
  multivisceral: ["NCD-260.5", "CMS-PECOS-CR14262"],
  combined: ["CMS-BP-CH11", "CMS-PECOS-CR14262"],
};

function activeOn(record: ProgramApprovalRecord, date: string) {
  return record.status === "approved" && record.effectiveFrom <= date && (!record.effectiveTo || record.effectiveTo >= date);
}

function matchingProgram(input: TransplantCaseInput, organ: TransplantOrgan) {
  return (input.programApprovals || []).find((record) =>
    record.organ === organ && activeOn(record, input.serviceDate) && (record.ageCategory === "all" || record.ageCategory === input.ageCategory));
}

function validIcd10Codes(codes: string[] | undefined) {
  return Array.from(new Set((codes || []).map((code) => code.trim().toUpperCase()).filter((code) => /^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code))));
}

export function validateTransplantProgram(input: TransplantCaseInput): TransplantDomainResult {
  if (input.purpose !== "transplant") return {
    domain: "program", status: "not-applicable", title: "Transplant program approval", reasons: ["This episode is not the transplant procedure."], blockers: [], sourceIds: ORGAN_SOURCES[input.organ],
  };
  if (!input.serviceDate) return {
    domain: "program", status: "hold", title: "Transplant program approval", reasons: [], blockers: ["Date of service is required for historical program validation."], sourceIds: ORGAN_SOURCES[input.organ],
  };

  const reasons: string[] = [];
  const blockers: string[] = [];
  const exact = matchingProgram(input, input.organ);
  if (!exact) blockers.push(`No effective ${input.ageCategory} ${input.organ} program approval was supplied for the service date.`);
  else {
    reasons.push(`Exact ${input.organ} program approval is effective on ${input.serviceDate}.`);
    if (input.serviceDate >= PECOS_TRANSPLANT_RECORD_EFFECTIVE_DATE && exact.source !== "pecos") {
      blockers.push("For dates on or after April 6, 2026, verify the exact organ type in PECOS before release.");
    }
    if (input.facilityCcn && exact.ccn && input.facilityCcn !== exact.ccn) blockers.push("Program approval CCN does not match the billing facility CCN.");
  }

  for (const prerequisite of PREREQUISITES[input.organ] || []) {
    if (matchingProgram(input, prerequisite)) reasons.push(`${prerequisite} prerequisite program approval is effective.`);
    else blockers.push(`${input.organ} requires an effective ${prerequisite} prerequisite program approval.`);
  }
  if (input.organ === "combined") blockers.push("Combined-organ cases require organ-by-organ program validation; a generic combined record is insufficient.");
  return { domain: "program", status: blockers.length ? "hold" : "pass", title: "Transplant program approval", reasons, blockers, sourceIds: ORGAN_SOURCES[input.organ] };
}

export function evaluateTransplantCoverage(input: TransplantCaseInput, program = validateTransplantProgram(input)): TransplantDomainResult {
  const c = input.clinical || {};
  const reasons: string[] = [];
  const blockers: string[] = [];
  const unknown = (label: string, value: boolean | null | undefined) => {
    if (value === true) reasons.push(label);
    else blockers.push(value === false ? `${label} is not supported.` : `Confirm: ${label.toLowerCase()}.`);
  };

  if (input.purpose === "follow-up") {
    if (c.originalTransplantCovered === true) reasons.push("Original transplant coverage is documented.");
    else if (input.organ === "liver" && c.followUpIndependentlyReasonableNecessary === true) reasons.push("Follow-up is independently reasonable and necessary; NCD 260.1 allows separate evaluation even when the original transplant was noncovered.");
    else blockers.push("Establish coverage of the original transplant or an independently covered follow-up pathway.");
  } else if (input.purpose !== "transplant") {
    return { domain: "coverage", status: "not-applicable", title: "Medicare transplant coverage", reasons: ["Coverage criteria are evaluated in the episode-specific donor, acquisition, or drug domain."], blockers: [], sourceIds: ORGAN_SOURCES[input.organ] };
  } else {
    if (program.status === "hold") blockers.push("Program approval is unresolved.");
    switch (input.organ) {
      case "kidney":
        unknown("End-stage organ failure is documented", c.endStageOrganFailure);
        unknown("Transplant indication is documented", c.transplantIndicationDocumented);
        break;
      case "liver":
      case "heart":
        unknown("End-stage organ failure is documented", c.endStageOrganFailure);
        unknown("Transplant indication is documented", c.transplantIndicationDocumented);
        break;
      case "pancreas":
        if (c.pancreasPath === "islet") blockers.push("Islet-cell transplantation is not treated as whole-organ pancreas coverage; route to the applicable trial/policy review.");
        if (!c.pancreasPath || c.pancreasPath === "unknown") blockers.push("Select SPK, PAK, PTA, or islet pathway.");
        unknown("Whole-organ pancreas transplant is documented", c.wholeOrganTransplant);
        unknown("Insulin-dependent diabetes is documented", c.insulinDependentDiabetes);
        unknown("Beta-cell failure is documented", c.betaCellFailureDocumented);
        if (c.pancreasPath === "pta") {
          unknown("Medically uncontrollable hyperglycemia is documented", c.medicallyUncontrollableHyperglycemia);
          unknown("Secondary complications are documented", c.secondaryComplications);
        }
        break;
      case "intestine":
      case "multivisceral":
        unknown("Irreversible intestinal failure is documented", c.irreversibleIntestinalFailure);
        if (c.failedParenteralNutrition === true || c.lifeThreateningParenteralNutritionComplication === true) reasons.push("Failure of parenteral nutrition or a life-threatening complication is documented.");
        else blockers.push("Document failed parenteral nutrition or a qualifying life-threatening complication.");
        break;
      case "lung":
      case "heart-lung":
        unknown("End-stage organ failure is documented", c.endStageOrganFailure);
        unknown("Transplant indication is documented", c.transplantIndicationDocumented);
        blockers.push("No dedicated national lung-transplant NCD was represented; verify current reasonable-and-necessary and payer criteria.");
        break;
      case "combined":
        blockers.push("Combined-organ coverage requires organ-specific criteria and cannot be released from a generic pathway.");
        break;
    }
  }
  return { domain: "coverage", status: blockers.length ? "review" : "pass", title: "Coverage criteria", reasons, blockers, sourceIds: ORGAN_SOURCES[input.organ] };
}

export function evaluateAcquisition(input: TransplantCaseInput): TransplantDomainResult {
  if (input.purpose !== "transplant" && input.purpose !== "organ-acquisition") return { domain: "acquisition", status: "not-applicable", title: "Organ acquisition and SAC", reasons: [], blockers: [], sourceIds: ["CMS-CP-CH3", "CMS-2552-10-D4"] };
  const items = input.acquisition?.costItems || [];
  const blockers: string[] = [];
  const reasons: string[] = [];
  if (!items.length) blockers.push("No organ-acquisition cost ledger was supplied.");
  for (const item of items) {
    if (item.amountCents < 0) blockers.push(`${item.description}: amount cannot be negative.`);
    if (item.category === "unresolved") blockers.push(`${item.description}: cost classification is unresolved.`);
    if (item.category === "shared") {
      const total = (item.allocations || []).reduce((sum, allocation) => sum + allocation.percent, 0);
      if (Math.abs(total - 100) > 0.01) blockers.push(`${item.description}: shared-cost allocations must total 100%.`);
    }
  }
  if (items.length) reasons.push(`${items.length} acquisition-ledger item(s) retained separately from the transplant claim.`);
  if (input.acquisition?.sacReconciled === true) reasons.push("Standard acquisition charge reconciliation is documented.");
  else blockers.push("Reconcile the organ-specific standard acquisition charge; do not collapse acquisition cost into one invoice line.");
  return { domain: "acquisition", status: blockers.length ? "review" : "pass", title: "Organ acquisition and SAC", reasons, blockers, sourceIds: ["CMS-CP-CH3", "CMS-2552-10-D4"] };
}

export function evaluateDonor(input: TransplantCaseInput): TransplantDomainResult {
  if (input.purpose !== "donor" && !input.donor) return { domain: "donor", status: "not-applicable", title: "Donor billing", reasons: [], blockers: [], sourceIds: ["CMS-CP-CH3"] };
  const donor = input.donor || {};
  const blockers: string[] = [];
  const reasons: string[] = [];
  if (donor.recipientAccountLinked === true) reasons.push("Donor services are linked to the recipient acquisition account.");
  else blockers.push("Link donor services to the recipient acquisition account before release.");
  if (donor.kidneyComplication) {
    if (donor.organ !== "kidney") blockers.push("Q3 donor-complication handling is restricted to kidney donor complications.");
    if (donor.occurrenceCode36 && donor.patientRelationship39) reasons.push("Kidney donor complication fields 36 and relationship 39 are documented.");
    else blockers.push("Kidney donor complication billing requires occurrence code 36 and patient relationship code 39.");
  }
  if (donor.donorType === "paired-exchange" && donor.pairedExchangeReconciled !== true) blockers.push("Paired-exchange donor and recipient acquisition accounts require reconciliation.");
  return { domain: "donor", status: blockers.length ? "hold" : "pass", title: "Donor billing", reasons, blockers, sourceIds: ["CMS-CP-CH3"] };
}

export function evaluateDrugBenefit(input: TransplantCaseInput): TransplantDomainResult {
  if (input.purpose !== "immunosuppressive-drug" && !input.drug) return { domain: "drug", status: "not-applicable", title: "Immunosuppressive drug benefit", reasons: [], blockers: [], sourceIds: ["CMS-CP-CH17", "CMS-PART-B-ID"] };
  const d = input.drug || {};
  const blockers: string[] = [];
  const reasons: string[] = [];
  if (d.medicationDocumentedAsImmunosuppressive === true) reasons.push("Medication is documented as continuous immunosuppressive therapy.");
  else blockers.push("Confirm that the medication is a covered transplant immunosuppressive drug.");
  if (d.pathway === "part-b-id") {
    if (input.organ !== "kidney" || d.kidneyTransplant !== true) blockers.push("Part B-ID is limited to qualifying kidney-transplant recipients.");
    if (d.medicareEntitlementEndedAfter36Months !== true) blockers.push("Confirm Medicare entitlement ended 36 months after the kidney transplant.");
    if (d.noDisqualifyingCoverage !== true) blockers.push("Confirm absence of other disqualifying health coverage.");
    if (d.partBidEnrolled !== true) blockers.push("Confirm active Part B-ID enrollment.");
  } else if (!d.pathway || d.pathway === "other") blockers.push("Select and verify the drug-benefit pathway.");
  if (!d.daysSupply || d.daysSupply < 1) blockers.push("Days supply is required.");
  if (!d.refillSequence) blockers.push("Initial, subsequent, or replacement supply sequence is required for supply-fee review.");
  return { domain: "drug", status: blockers.length ? "hold" : "pass", title: "Immunosuppressive drug benefit", reasons, blockers, sourceIds: ["CMS-CP-CH17", "CMS-PART-B-ID"] };
}

function professionalDomain(input: TransplantCaseInput): TransplantDomainResult {
  if (input.purpose !== "transplant") return { domain: "professional", status: "not-applicable", title: "Professional coding", reasons: [], blockers: [], sourceIds: ["LICENSED-CPT-ADAPTER", "CMS-MPFS", "CMS-NCCI"] };
  const reasons: string[] = [];
  const blockers: string[] = [];
  if (!input.operative?.finalOperativeReport) blockers.push("Final signed operative report is required.");
  if (!input.operative?.organImplanted) blockers.push("The operative evidence must confirm the organ was implanted.");
  if (input.operative?.licensedProfessionalCode) reasons.push("A licensed CPT adapter supplied a professional code candidate.");
  else blockers.push("Licensed CPT mapping is unavailable; the engine will not invent or reproduce licensed code content.");
  if (input.operative?.reconstructionDocumented) reasons.push("Reconstruction is explicitly documented for separate licensed-adapter review.");
  return { domain: "professional", status: blockers.length ? "review" : "pass", title: "Professional coding", reasons, blockers, sourceIds: ["LICENSED-CPT-ADAPTER", "CMS-MPFS", "CMS-NCCI"] };
}

function facilityDomain(input: TransplantCaseInput): TransplantDomainResult {
  if (input.purpose !== "transplant") return { domain: "facility", status: "not-applicable", title: "Facility inpatient coding", reasons: [], blockers: [], sourceIds: ["CMS-ICD10-PCS", "CMS-MS-DRG-MCE"] };
  const reasons: string[] = [];
  const blockers: string[] = [];
  if (input.operative?.icd10PcsCode && input.operative?.icd10PcsVersion) reasons.push("Versioned ICD-10-PCS candidate supplied from operative evidence.");
  else blockers.push("A versioned ICD-10-PCS mapping is required; CPT is not used as the inpatient facility procedure code.");
  if (input.operative?.dischargeDate && input.operative?.msDrgGrouperVersion) reasons.push("Discharge-date MS-DRG/MCE grouper version supplied.");
  else blockers.push("Discharge date and effective MS-DRG/MCE grouper version are required.");
  return { domain: "facility", status: blockers.length ? "review" : "pass", title: "Facility inpatient coding", reasons, blockers, sourceIds: ["CMS-ICD10-PCS", "CMS-MS-DRG-MCE"] };
}

function buildClaimLanes(input: TransplantCaseInput, professional: TransplantDomainResult, facility: TransplantDomainResult, drug: TransplantDomainResult): TransplantClaimLane[] {
  const professionalLines = input.operative?.licensedProfessionalCode ? [{ codeSystem: "CPT", code: input.operative.licensedProfessionalCode, description: "Licensed-adapter professional procedure candidate", source: "licensed-cpt-adapter" }] : [];
  const facilityLines = input.operative?.icd10PcsCode ? [{ codeSystem: "ICD-10-PCS", code: input.operative.icd10PcsCode, description: "Inpatient facility procedure candidate", source: input.operative.icd10PcsVersion || "version-missing" }] : [];
  const dmeLines = input.drug?.pathway && input.drug.refillSequence ? [{ codeSystem: "HCPCS", description: `${input.drug.refillSequence} immunosuppressive supply-fee candidate; code resolved from effective CMS adapter`, source: "CMS-CP-CH17" }] : [];
  return [
    { lane: "professional", status: professional.status, lines: professionalLines, blockers: professional.blockers },
    { lane: "institutional", status: facility.status, lines: facilityLines, blockers: facility.blockers },
    { lane: "dme", status: drug.status, lines: dmeLines, blockers: drug.blockers },
    { lane: "pharmacy", status: input.drug?.pathway === "part-d" ? drug.status : "not-applicable", lines: [], blockers: input.drug?.pathway === "part-d" ? drug.blockers : [] },
  ];
}

export function evaluateTransplantCase(input: TransplantCaseInput): TransplantEvaluation {
  const program = validateTransplantProgram(input);
  const coverage = evaluateTransplantCoverage(input, program);
  const professional = professionalDomain(input);
  const facility = facilityDomain(input);
  const acquisition = evaluateAcquisition(input);
  const donor = evaluateDonor(input);
  const drug = evaluateDrugBenefit(input);
  const diagnosisCodes = validIcd10Codes(input.diagnosisCodes);
  const queries = Array.from(new Set([program, coverage, professional, facility, acquisition, donor, drug].flatMap((domain) => domain.blockers)));
  if ((input.diagnosisCodes || []).length !== diagnosisCodes.length) queries.push("Review invalid or unsupported diagnosis-code entries; no diagnosis was inferred or repaired.");
  if (!diagnosisCodes.length && ["transplant", "follow-up"].includes(input.purpose)) queries.push("Add source-supported ICD-10-CM diagnoses before claim release.");
  const releaseDomains = [program, coverage, professional, facility, acquisition].filter((domain) => domain.status !== "not-applicable");
  const blockers = [...queries];
  const claimReadiness: TransplantDomainResult = {
    domain: "claim-readiness",
    status: blockers.length || releaseDomains.some((domain) => domain.status !== "pass") ? "hold" : "pass",
    title: "Claim readiness",
    reasons: blockers.length ? [] : ["All applicable deterministic gates passed; human approval is still required."],
    blockers,
    sourceIds: Array.from(new Set(releaseDomains.flatMap((domain) => domain.sourceIds))),
  };
  return {
    engineVersion: TRANSPLANT_ENGINE_VERSION,
    policyVersion: TRANSPLANT_POLICY_VERSION,
    program, coverage, professional, facility, acquisition, donor, drug, claimReadiness,
    claimLanes: buildClaimLanes(input, professional, facility, drug),
    queries, diagnosisCodes, requiresHumanApproval: true, autonomousClaimSubmission: false,
  };
}
