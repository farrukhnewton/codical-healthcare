export const AMBULANCE_ENGINE_VERSION = "2026.08.04.1";
export const AMBULANCE_POLICY_VERSION = "CMS-AFS-2026-Q3";

export type AmbulancePayerMode = "medicare-fs" | "medicare-advantage" | "medicaid" | "commercial" | "self-pay";
export type AmbulanceEntityType = "independent-supplier" | "institutional-provider";
export type AmbulanceClaimFormat = "837P" | "837I";
export type AmbulanceTransportMode = "ground" | "fixed-wing" | "rotary-wing";
export type AmbulanceResponseType = "emergency" | "non-emergency";
export type AmbulanceTransportOutcome = "transported" | "pronounced-before-dispatch" | "pronounced-after-dispatch-before-load" | "pronounced-after-load";
export type AmbulanceRurality = "urban" | "rural" | "super-rural" | "unknown";
export type AmbulanceOriginDestination = "D" | "E" | "G" | "H" | "I" | "J" | "N" | "P" | "R" | "S" | "X";
export type AmbulanceProvision = "direct" | "under-arrangement";
export type AmbulanceStatus = "pass" | "review" | "hold" | "not-applicable";

export type Als2Procedure =
  | "manual-defibrillation-cardioversion"
  | "endotracheal-intubation"
  | "central-venous-line"
  | "cardiac-pacing"
  | "chest-decompression"
  | "surgical-airway"
  | "intraosseous-line"
  | "prehospital-blood-transfusion";

export type MedicationAdministration = {
  medication: string;
  route: "iv-push" | "iv-bolus" | "continuous-infusion" | "intramuscular" | "subcutaneous" | "oral" | "sublingual" | "nebulized" | "other";
  isCrystalloid?: boolean;
  standardProtocolDose?: boolean;
  splitDose?: boolean;
  documented?: boolean;
  time?: string;
};

export type AmbulanceCaseInput = {
  serviceDate: string;
  payerMode: AmbulancePayerMode;
  entityType: AmbulanceEntityType;
  provision: AmbulanceProvision;
  transportMode: AmbulanceTransportMode;
  responseType: AmbulanceResponseType;
  outcome: AmbulanceTransportOutcome;
  origin: AmbulanceOriginDestination;
  destination: AmbulanceOriginDestination;
  pointOfPickupZip: string;
  rurality: AmbulanceRurality;
  loadedMiles: number | string;
  patientCount: number;
  medicalNecessity: boolean | null;
  destinationAppropriate: boolean | null;
  nearestAppropriateFacility: boolean | null;
  diagnosisCodes?: string[];
  symptoms?: string[];
  transportReason?: string;
  contraindicationToOtherTransport?: string;
  alsAssessment?: boolean;
  alsIntervention?: boolean;
  medications?: MedicationAdministration[];
  als2Procedures?: Als2Procedure[];
  sct?: {
    interfacility: boolean;
    criticallyIllOrInjured: boolean;
    ongoingCareRequired: boolean;
    beyondStateParamedicScope: boolean | null;
    specialtyProfessional?: string;
  };
  paramedicIntercept?: {
    requested: boolean;
    rural: boolean;
    contractedVolunteerService: boolean;
    volunteerBlsOnly: boolean;
    volunteerProhibitedFromBilling: boolean;
    interceptSupplierMeetsAlsRequirements: boolean;
  };
  rsnat?: {
    repetitive: boolean;
    scheduled: boolean;
    physicianCertificationStatement: boolean;
    priorAuthorizationStatus?: "approved" | "pending" | "not-required" | "unknown";
  };
  air?: {
    groundTransportInappropriate: boolean | null;
    rapidTransportRequired: boolean | null;
    distanceOrObstacleDocumented: boolean | null;
  };
  signatureStatus?: "complete" | "representative" | "crew-attestation" | "missing";
  abnStatus?: "not-required" | "signed" | "missing" | "unknown";
};

export type AmbulanceClaimLine = {
  hcpcs: string;
  category: "base" | "mileage";
  units: number;
  modifiers: string[];
  description: string;
  evidence: string[];
  warnings: string[];
};

export type AmbulanceDomainResult = {
  status: AmbulanceStatus;
  title: string;
  summary: string;
  evidence: string[];
  missing: string[];
};

export type AmbulanceEvaluation = {
  engineVersion: string;
  policyVersion: string;
  claimFormat: AmbulanceClaimFormat;
  placeOfService: "41" | "42";
  originDestinationModifier: string | null;
  providerModifier: "QM" | "QN" | null;
  levelOfService: AmbulanceDomainResult & { hcpcs: string | null };
  medicalNecessity: AmbulanceDomainResult;
  coverage: AmbulanceDomainResult;
  payment: AmbulanceDomainResult;
  claimReadiness: AmbulanceDomainResult;
  lines: AmbulanceClaimLine[];
  diagnosisCodes: string[];
  queries: string[];
  warnings: string[];
  sourceLineage: Array<{ id: string; title: string; effectiveOn: string }>;
  requiresCoderApproval: true;
};

export type AmbulanceRateInput = {
  sourceVersion: string;
  effectiveFrom: string;
  effectiveTo?: string;
  importedAt: string;
  baseRate: number;
  mileageRate: number;
  ruralMiles1To17Rate?: number;
  includesTemporaryAddOns: boolean;
};

export type AmbulancePaymentEstimate = {
  status: "estimated" | "unavailable";
  sourceVersion: string | null;
  baseAmount: number | null;
  mileageAmount: number | null;
  reductionAmount: number | null;
  estimatedAllowed: number | null;
  calculation: string[];
  warning: string;
};

export const AMBULANCE_HCPCS = {
  A0425: "Ground mileage, per statute mile",
  A0426: "ALS1, non-emergency",
  A0427: "ALS1, emergency",
  A0428: "BLS, non-emergency",
  A0429: "BLS, emergency",
  A0430: "Fixed-wing air base service",
  A0431: "Rotary-wing air base service",
  A0432: "Paramedic intercept",
  A0433: "ALS2",
  A0434: "Specialty care transport",
  A0435: "Fixed-wing air mileage",
  A0436: "Rotary-wing air mileage",
} as const;

export const ORIGIN_DESTINATION_LABELS: Record<AmbulanceOriginDestination, string> = {
  D: "Diagnostic or therapeutic site other than P or H",
  E: "Residential, domiciliary, custodial facility",
  G: "Hospital-based dialysis facility",
  H: "Hospital",
  I: "Site of transfer between modes of ambulance transport",
  J: "Freestanding dialysis facility",
  N: "Skilled nursing facility",
  P: "Physician office",
  R: "Residence",
  S: "Scene of accident or acute event",
  X: "Intermediate stop at physician office on way to hospital",
};

export const ALS2_PROCEDURE_LABELS: Record<Als2Procedure, string> = {
  "manual-defibrillation-cardioversion": "Manual defibrillation/cardioversion",
  "endotracheal-intubation": "Endotracheal intubation",
  "central-venous-line": "Central venous line",
  "cardiac-pacing": "Cardiac pacing",
  "chest-decompression": "Chest decompression",
  "surgical-airway": "Surgical airway",
  "intraosseous-line": "Intraosseous line",
  "prehospital-blood-transfusion": "Prehospital blood transfusion",
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function decimalCeil(value: number | string, places: number) {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  const factor = 10 ** places;
  return Math.ceil((parsed - Number.EPSILON) * factor) / factor;
}

/** CMS-1500/837P and 837I mileage reporting: upward to a tenth through 99.9, then upward to a whole mile. */
export function roundAmbulanceMileage(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed < 100 ? decimalCeil(parsed, 1) : decimalCeil(parsed, 0);
}

export function buildAmbulanceModifier(origin: AmbulanceOriginDestination, destination: AmbulanceOriginDestination) {
  if (origin === "X") return null;
  return `${origin}${destination}`;
}

export function evaluateAls2(input: Pick<AmbulanceCaseInput, "medications" | "als2Procedures">) {
  const qualifyingAdministrations = (input.medications ?? []).filter((administration) =>
    administration.documented !== false
    && ["iv-push", "iv-bolus", "continuous-infusion"].includes(administration.route)
    && !administration.isCrystalloid
    && administration.standardProtocolDose !== false
    && !administration.splitDose,
  );
  const procedures = Array.from(new Set(input.als2Procedures ?? []));
  return {
    qualifies: qualifyingAdministrations.length >= 3 || procedures.length > 0,
    medicationCount: qualifyingAdministrations.length,
    procedures,
    excludedMedicationCount: (input.medications ?? []).length - qualifyingAdministrations.length,
  };
}

export function detectRsnat(input: Pick<AmbulanceCaseInput, "responseType" | "rsnat">) {
  return input.responseType === "non-emergency" && Boolean(input.rsnat?.repetitive && input.rsnat.scheduled);
}

function domain(status: AmbulanceStatus, title: string, summary: string, evidence: string[] = [], missing: string[] = []): AmbulanceDomainResult {
  return { status, title, summary, evidence, missing };
}

function normalizedDiagnoses(codes: string[] = []) {
  return Array.from(new Set(codes.map((code) => code.trim().toUpperCase()).filter((code) => /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code))));
}

function selectGroundLevel(input: AmbulanceCaseInput) {
  const sct = input.sct;
  if (sct?.interfacility && sct.criticallyIllOrInjured && sct.ongoingCareRequired && sct.beyondStateParamedicScope === true) {
    return { hcpcs: "A0434", label: AMBULANCE_HCPCS.A0434, evidence: ["Ground interfacility transport", "Critically ill/injured", "Ongoing specialty care beyond state paramedic scope"] };
  }

  const intercept = input.paramedicIntercept;
  if (intercept?.requested && intercept.rural && intercept.contractedVolunteerService && intercept.volunteerBlsOnly && intercept.volunteerProhibitedFromBilling && intercept.interceptSupplierMeetsAlsRequirements) {
    return { hcpcs: "A0432", label: AMBULANCE_HCPCS.A0432, evidence: ["All rural paramedic-intercept conditions documented"] };
  }

  const als2 = evaluateAls2(input);
  if (als2.qualifies) {
    const medicationEvidence = als2.medicationCount >= 3 ? `${als2.medicationCount} qualifying IV administrations` : "";
    const procedureEvidence = als2.procedures.map((item) => ALS2_PROCEDURE_LABELS[item]);
    return { hcpcs: "A0433", label: AMBULANCE_HCPCS.A0433, evidence: [medicationEvidence, ...procedureEvidence].filter(Boolean) };
  }

  if (input.alsAssessment || input.alsIntervention) {
    return input.responseType === "emergency"
      ? { hcpcs: "A0427", label: AMBULANCE_HCPCS.A0427, evidence: [input.alsIntervention ? "Medically necessary ALS intervention documented" : "Appropriately dispatched emergency ALS assessment documented"] }
      : { hcpcs: "A0426", label: AMBULANCE_HCPCS.A0426, evidence: ["Medically necessary ALS intervention documented"] };
  }

  return input.responseType === "emergency"
    ? { hcpcs: "A0429", label: AMBULANCE_HCPCS.A0429, evidence: ["BLS-level emergency response"] }
    : { hcpcs: "A0428", label: AMBULANCE_HCPCS.A0428, evidence: ["BLS-level non-emergency transport"] };
}

export function evaluateAmbulanceCase(input: AmbulanceCaseInput): AmbulanceEvaluation {
  const warnings: string[] = [];
  const queries: string[] = [];
  const diagnoses = normalizedDiagnoses(input.diagnosisCodes);
  const mileage = roundAmbulanceMileage(input.loadedMiles);
  const odModifier = buildAmbulanceModifier(input.origin, input.destination);
  const providerModifier = input.entityType === "institutional-provider" ? (input.provision === "direct" ? "QN" : "QM") : null;
  const claimFormat: AmbulanceClaimFormat = input.entityType === "institutional-provider" ? "837I" : "837P";
  const placeOfService = input.transportMode === "ground" ? "41" : "42";

  if (!odModifier) queries.push("Origin code X is invalid. X may be used only as a destination character.");
  if (!/^\d{5}$/.test(input.pointOfPickupZip)) queries.push("Enter the 5-digit point-of-pickup ZIP used for locality and rurality.");
  if (input.rurality === "unknown") queries.push("Resolve the point-of-pickup ZIP against the effective CMS ZIP designation file.");
  if (input.patientCount < 1 || input.patientCount > 4) queries.push("Confirm the number of patients transported in the vehicle.");
  if (!diagnoses.length) queries.push("Add only diagnoses or symptoms supported by the patient care report; the engine will not invent a diagnosis.");
  if (input.medicalNecessity == null) queries.push("Confirm why transport by another means was contraindicated.");
  if (input.destinationAppropriate == null || input.nearestAppropriateFacility == null) queries.push("Confirm the destination was covered and the nearest appropriate facility for the required care.");
  if (detectRsnat(input) && !input.rsnat?.physicianCertificationStatement) queries.push("RSNAT is identified; verify the physician certification statement and applicable prior authorization requirements.");
  if (input.sct?.interfacility && input.sct.beyondStateParamedicScope == null) queries.push("Compare the documented specialty care with the effective state paramedic scope before considering SCT.");

  let selected: { hcpcs: string | null; label: string; evidence: string[] };
  if (input.outcome === "pronounced-before-dispatch") {
    selected = { hcpcs: null, label: "No covered ambulance transport", evidence: ["Death pronounced before dispatch"] };
  } else if (input.outcome === "pronounced-after-dispatch-before-load") {
    selected = { hcpcs: "A0428", label: "BLS base rate only with QL", evidence: ["Death pronounced after dispatch and before loading"] };
  } else if (input.transportMode === "fixed-wing") {
    selected = { hcpcs: "A0430", label: AMBULANCE_HCPCS.A0430, evidence: ["Fixed-wing transport documented"] };
  } else if (input.transportMode === "rotary-wing") {
    selected = { hcpcs: "A0431", label: AMBULANCE_HCPCS.A0431, evidence: ["Rotary-wing transport documented"] };
  } else {
    selected = selectGroundLevel(input);
  }

  if (input.transportMode !== "ground") {
    const air = input.air;
    if (air?.groundTransportInappropriate !== true || air?.rapidTransportRequired !== true || air?.distanceOrObstacleDocumented !== true) {
      queries.push("Air transport needs evidence that ground transport was inappropriate and rapid transport/distance/obstacle requirements were met.");
    }
  }

  const levelStatus: AmbulanceStatus = selected.hcpcs && odModifier ? "pass" : selected.hcpcs ? "review" : input.outcome === "pronounced-before-dispatch" ? "not-applicable" : "hold";
  const levelOfService = { ...domain(levelStatus, "Level of service", selected.label, selected.evidence, levelStatus === "hold" ? ["A supported billable level"] : []), hcpcs: selected.hcpcs };

  const necessityStatus: AmbulanceStatus = input.medicalNecessity === true && Boolean(input.contraindicationToOtherTransport?.trim()) ? "pass" : input.medicalNecessity === false ? "hold" : "review";
  const medicalNecessity = domain(
    necessityStatus,
    "Medical necessity",
    necessityStatus === "pass" ? "Ambulance necessity and contraindication to other transport are documented." : input.medicalNecessity === false ? "The reviewed evidence does not support ambulance medical necessity." : "Medical necessity needs explicit clinical support.",
    [input.contraindicationToOtherTransport ?? ""].filter(Boolean),
    necessityStatus === "pass" ? [] : ["Patient condition and why another transport method was contraindicated"],
  );

  const coveragePass = input.destinationAppropriate === true && input.nearestAppropriateFacility === true && necessityStatus === "pass";
  const coverage = domain(
    coveragePass ? "pass" : input.destinationAppropriate === false || input.nearestAppropriateFacility === false || necessityStatus === "hold" ? "hold" : "review",
    "Coverage",
    coveragePass ? "Core Medicare destination and necessity gates are supported." : "Coverage remains separate from the selected HCPCS and requires review.",
    [ORIGIN_DESTINATION_LABELS[input.origin], ORIGIN_DESTINATION_LABELS[input.destination]],
    coveragePass ? [] : ["Covered destination, nearest appropriate facility, and medical necessity"],
  );

  const paymentReady = input.payerMode === "medicare-fs" && input.rurality !== "unknown" && /^\d{5}$/.test(input.pointOfPickupZip);
  const payment = domain(
    paymentReady ? "review" : "hold",
    "Payment estimate",
    paymentReady ? "A versioned CMS locality/rate record is still required before an estimate can be calculated." : "Payment cannot be estimated until payer mode, pickup ZIP, rurality, and an effective imported rate are available.",
    paymentReady ? [`Pickup ZIP ${input.pointOfPickupZip}`, input.rurality] : [],
    ["Effective CMS AFS locality/rate version"],
  );

  const lineModifiers = [odModifier, providerModifier, input.patientCount > 1 ? "GM" : null, input.outcome === "pronounced-after-dispatch-before-load" ? "QL" : null].filter((value): value is string => Boolean(value));
  const lines: AmbulanceClaimLine[] = [];
  if (selected.hcpcs) {
    lines.push({ hcpcs: selected.hcpcs, category: "base", units: 1, modifiers: lineModifiers, description: selected.label, evidence: selected.evidence, warnings: [] });
    const transported = input.outcome === "transported" || input.outcome === "pronounced-after-load";
    if (transported && mileage > 0 && selected.hcpcs !== "A0432") {
      const mileageHcpcs = input.transportMode === "fixed-wing" ? "A0435" : input.transportMode === "rotary-wing" ? "A0436" : "A0425";
      lines.push({ hcpcs: mileageHcpcs, category: "mileage", units: mileage, modifiers: lineModifiers.filter((modifier) => modifier !== "QL"), description: AMBULANCE_HCPCS[mileageHcpcs], evidence: [`${mileage} loaded mile${mileage === 1 ? "" : "s"} after CMS upward rounding`], warnings: [] });
    }
  }

  const readinessMissing = [...queries];
  if (input.signatureStatus === "missing" || !input.signatureStatus) readinessMissing.push("Resolve the beneficiary/representative/crew signature path.");
  if (input.abnStatus === "missing") readinessMissing.push("Resolve the required ABN before billing the beneficiary.");
  const claimReadiness = domain(
    !readinessMissing.length && coverage.status === "pass" && lines.length > 0 ? "pass" : lines.length ? "review" : "hold",
    "Claim readiness",
    !readinessMissing.length && coverage.status === "pass" ? "Claim lines are ready for human coding approval, not autonomous submission." : "The draft is intentionally held for coder review and unresolved evidence.",
    lines.map((line) => `${line.hcpcs} ${line.modifiers.join(" ")}`.trim()),
    readinessMissing,
  );

  if (input.responseType === "emergency") warnings.push("Emergency response does not independently establish medical necessity.");
  if (input.patientCount > 1) warnings.push("GM identifies multiple patients; apply the current multi-patient payment policy only through an effective versioned adjustment record.");
  if (selected.hcpcs === "A0434") warnings.push("SCT depends on the state scope of practice effective on the service date.");
  if (input.payerMode !== "medicare-fs") warnings.push("Medicare logic is shown as a coding reference; payer-specific coverage and payment rules may differ.");

  return {
    engineVersion: AMBULANCE_ENGINE_VERSION,
    policyVersion: AMBULANCE_POLICY_VERSION,
    claimFormat,
    placeOfService,
    originDestinationModifier: odModifier,
    providerModifier,
    levelOfService,
    medicalNecessity,
    coverage,
    payment,
    claimReadiness,
    lines,
    diagnosisCodes: diagnoses,
    queries: Array.from(new Set(queries)),
    warnings: Array.from(new Set(warnings)),
    sourceLineage: [
      { id: "cms-bp-100-02-ch10", title: "Medicare Benefit Policy Manual, Chapter 10", effectiveOn: input.serviceDate },
      { id: "cms-cp-100-04-ch15", title: "Medicare Claims Processing Manual, Chapter 15", effectiveOn: input.serviceDate },
      { id: "cms-afs-puf-2026", title: "CY 2026 Ambulance Fee Schedule PUF", effectiveOn: input.serviceDate },
    ],
    requiresCoderApproval: true,
  };
}

export function estimateAmbulancePayment(input: AmbulanceCaseInput, evaluation: AmbulanceEvaluation, rate?: AmbulanceRateInput): AmbulancePaymentEstimate {
  const unavailable = (warning: string): AmbulancePaymentEstimate => ({ status: "unavailable", sourceVersion: rate?.sourceVersion ?? null, baseAmount: null, mileageAmount: null, reductionAmount: null, estimatedAllowed: null, calculation: [], warning });
  if (input.payerMode !== "medicare-fs") return unavailable("A Medicare fee-schedule estimate is not applicable to the selected payer mode.");
  if (!rate) return unavailable("No versioned CMS rate record was supplied. The engine never fabricates a payment amount.");
  if (!evaluation.lines.length || !evaluation.levelOfService.hcpcs) return unavailable("No payable service line is available.");
  if (input.rurality === "unknown") return unavailable("Pickup ZIP rurality is unresolved.");
  if (input.serviceDate < rate.effectiveFrom || (rate.effectiveTo && input.serviceDate > rate.effectiveTo)) return unavailable("The supplied rate version is not effective on the date of service.");

  let baseAmount = rate.baseRate;
  let regularMileageRate = rate.mileageRate;
  const calculation: string[] = [`Base from imported ${rate.sourceVersion}: $${rate.baseRate.toFixed(2)}`];
  if (!rate.includesTemporaryAddOns && input.transportMode === "ground") {
    const geographicFactor = input.rurality === "urban" ? 1.02 : 1.03;
    baseAmount *= geographicFactor;
    regularMileageRate *= geographicFactor;
    calculation.push(`${input.rurality === "urban" ? "2% urban" : "3% rural"} temporary add-on applied through 2027-12-31`);
    if (input.rurality === "super-rural") {
      baseAmount *= 1.226;
      calculation.push("22.6% super-rural base add-on applied");
    }
  }

  const miles = roundAmbulanceMileage(input.loadedMiles);
  let mileageAmount = 0;
  if (miles > 0 && evaluation.lines.some((line) => line.category === "mileage")) {
    if (input.transportMode === "ground" && (input.rurality === "rural" || input.rurality === "super-rural")) {
      const firstMiles = Math.min(17, miles);
      const remainingMiles = Math.max(0, miles - firstMiles);
      const firstRate = rate.ruralMiles1To17Rate ?? regularMileageRate * 1.5;
      mileageAmount = firstMiles * firstRate + remainingMiles * regularMileageRate;
      calculation.push(`${firstMiles} rural loaded miles at first-17 rate; ${remainingMiles} at regular rural rate`);
    } else {
      mileageAmount = miles * regularMileageRate;
      calculation.push(`${miles} loaded miles at imported mileage rate`);
    }
  }

  let subtotal = baseAmount + mileageAmount;
  let reductionAmount = 0;
  const dialysis = evaluation.levelOfService.hcpcs === "A0428" && [input.origin, input.destination].some((value) => value === "G" || value === "J");
  if (dialysis) {
    reductionAmount = subtotal * 0.23;
    subtotal -= reductionAmount;
    calculation.push("23% ESRD non-emergency BLS dialysis reduction applied after normal AFS/add-on calculation");
  }

  return {
    status: "estimated",
    sourceVersion: rate.sourceVersion,
    baseAmount: roundCurrency(baseAmount),
    mileageAmount: roundCurrency(mileageAmount),
    reductionAmount: roundCurrency(reductionAmount),
    estimatedAllowed: roundCurrency(subtotal),
    calculation,
    warning: "Informational estimate only. The MAC's effective claim-processing file controls payment; coder approval is required.",
  };
}
