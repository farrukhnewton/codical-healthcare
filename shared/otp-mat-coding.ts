export const OTP_ENGINE_VERSION = "2026.08.10.1";
export const OTP_POLICY_VERSION = "CMS-OTP-CY2026-R13572BP";

export type OtpStatus = "pass" | "review" | "hold" | "not-applicable";
export type OtpPayerMode = "medicare-ffs" | "medicare-advantage" | "medicaid" | "commercial" | "self-pay";
export type OtpClaimEntity = "professional" | "institutional";
export type OtpSiteType = "freestanding" | "provider-based" | "hospital-based" | "cah-based" | "mobile-unit";
export type OtpMedication =
  | "methadone"
  | "buprenorphine-oral"
  | "buprenorphine-injectable-monthly"
  | "buprenorphine-injectable-weekly"
  | "naltrexone"
  | "no-drug"
  | "not-otherwise-specified";
export type OtpTelecomMode = "none" | "audio-video" | "audio-only";
export type OtpNaloxoneProduct = "none" | "g2215-nasal" | "g2216-injectable" | "g1028-nasal-8mg" | "g0532-nalmefene";

export type OtpServiceRecord = {
  id: string;
  serviceDate: string;
  category: "individual-therapy" | "group-therapy" | "counseling" | "family-counseling" | "toxicology" | "care-coordination" | "peer-support" | "other";
  countedElsewhere?: boolean;
};

export type OtpCaseInput = {
  serviceDate: string;
  payerMode: OtpPayerMode;
  claimEntity: OtpClaimEntity;
  siteType: OtpSiteType;
  diagnosisCodes: string[];
  organizationNpi?: string;
  orderingNpi?: string;
  program: {
    samhsaCertified: boolean | null;
    accredited: boolean | null;
    medicareEnrolled: boolean | null;
    deaAndStateAuthorized: boolean | null;
  };
  medication: OtpMedication;
  medicationUsedMostOfWeek?: OtpMedication | null;
  medicationSwitchedDuringWeek?: boolean;
  drugComponentFurnished: boolean | null;
  nondrugComponentFurnished: boolean | null;
  newPatient?: boolean | null;
  intakePerformed?: boolean;
  periodicAssessmentPerformed?: boolean;
  additionalCounselingMinutes?: number;
  counselingBeyondBundlePlan?: boolean | null;
  coordinatedCareMinutes?: number;
  navigationMinutes?: number;
  peerRecoveryMinutes?: number;
  intensiveOutpatient?: {
    requested: boolean;
    practitionerCertified: boolean | null;
    services: OtpServiceRecord[];
  };
  takeHome?: {
    additionalDays: number;
    noOverlapWithBundleDates: boolean | null;
    practitionerAuthorized: boolean | null;
  };
  overdoseMedication?: {
    product: OtpNaloxoneProduct;
    dosageMg?: number;
    lastSupplyDate?: string | null;
    additionalSupplyNecessary?: boolean | null;
  };
  telecom?: {
    mode: OtpTelecomMode;
    service: "none" | "intake" | "periodic-assessment" | "additional-counseling";
    audioVideoUnavailable?: boolean | null;
    patientWithDeaPractitioner?: boolean | null;
    federalStateRequirementsMet?: boolean | null;
  };
  duplicateBundle?: {
    detected: boolean;
    reason: "none" | "guest-dosing" | "transfer" | "holiday-sync" | "other";
    recordsExchanged?: boolean | null;
    modifier59Supported?: boolean | null;
  };
  localityAdjustment?: number | null;
};

export type OtpDomainResult = {
  domain: "program" | "bundle" | "add-ons" | "telecom" | "claim" | "payment";
  title: string;
  status: OtpStatus;
  reasons: string[];
  blockers: string[];
  sourceIds: string[];
};

export type OtpClaimLine = {
  hcpcs: string;
  category: "primary-bundle" | "take-home" | "assessment" | "counseling" | "care-support" | "iop" | "overdose-medication";
  units: number;
  modifier?: "59" | "93" | "95";
  diagnosisPointers: string[];
  nationalAmountCents: number | null;
  estimatedAmountCents: number | null;
  description: string;
  sourceId: string;
};

export type OtpEvaluation = {
  engineVersion: string;
  policyVersion: string;
  claimFormat: "837P" | "837I";
  claimContext: {
    placeOfService?: "58";
    typeOfBill?: "087x" | "013x" | "085x";
    conditionCode?: "89";
    revenueCode?: "0900";
  };
  diagnosisCodes: string[];
  primaryCode: string | null;
  domains: OtpDomainResult[];
  lines: OtpClaimLine[];
  queries: string[];
  payment: {
    nationalTotalCents: number | null;
    estimatedTotalCents: number | null;
    localityApplied: boolean;
    contractorPricedCodes: string[];
    beneficiaryCoinsurance: "waived" | "payer-specific";
    partBDeductibleApplies: boolean | null;
  };
  requiresHumanApproval: true;
  autonomousClaimSubmission: false;
};

type Rate = { total: number | null; drug: number; nonDrug: number | null; description: string };

export const OTP_2026_NATIONAL_RATES: Readonly<Record<string, Rate>> = {
  G2067: { total: 27729, drug: 4441, nonDrug: 23288, description: "Weekly methadone treatment bundle" },
  G2068: { total: 29657, drug: 6369, nonDrug: 23288, description: "Weekly oral buprenorphine treatment bundle" },
  G2069: { total: 206377, drug: 182320, nonDrug: 24058, description: "Monthly injectable buprenorphine treatment bundle" },
  G2073: { total: 176073, drug: 152016, nonDrug: 24058, description: "Weekly naltrexone treatment bundle" },
  G2074: { total: 22034, drug: 0, nonDrug: 22034, description: "Weekly treatment bundle without a drug" },
  G2075: { total: null, drug: 0, nonDrug: null, description: "Medication treatment bundle, not otherwise specified" },
  G0533: { total: 63740, drug: 39683, nonDrug: 24058, description: "Weekly injectable buprenorphine treatment bundle" },
  G2076: { total: 23459, drug: 0, nonDrug: 23459, description: "Intake activities add-on" },
  G2077: { total: 15193, drug: 0, nonDrug: 15193, description: "Periodic assessment add-on" },
  G2078: { total: 4441, drug: 4441, nonDrug: 0, description: "Methadone take-home supply, up to 7 additional days" },
  G2079: { total: 6369, drug: 6369, nonDrug: 0, description: "Oral buprenorphine take-home supply, up to 7 additional days" },
  G2080: { total: 3697, drug: 0, nonDrug: 3697, description: "Each additional 30 minutes of counseling" },
  G2215: { total: 3374, drug: 3374, nonDrug: 0, description: "Take-home nasal naloxone" },
  G2216: { total: null, drug: 0, nonDrug: null, description: "Take-home injectable naloxone; contractor priced" },
  G1028: { total: 12798, drug: 12798, nonDrug: 0, description: "Two-pack 8 mg nasal naloxone" },
  G0137: { total: 82632, drug: 0, nonDrug: 82632, description: "Intensive outpatient services bundle" },
  G0532: { total: 9120, drug: 9120, nonDrug: 0, description: "Take-home nasal nalmefene" },
  G0534: { total: 4282, drug: 0, nonDrug: 4282, description: "Each additional 30 minutes of coordinated care" },
  G0535: { total: 4282, drug: 0, nonDrug: 4282, description: "Each additional 30 minutes of patient navigation" },
  G0536: { total: 4282, drug: 0, nonDrug: 4282, description: "Each additional 30 minutes of peer recovery support" },
};

const PRIMARY_CODE: Record<OtpMedication, string> = {
  methadone: "G2067",
  "buprenorphine-oral": "G2068",
  "buprenorphine-injectable-monthly": "G2069",
  "buprenorphine-injectable-weekly": "G0533",
  naltrexone: "G2073",
  "no-drug": "G2074",
  "not-otherwise-specified": "G2075",
};

const cleanCodes = (codes: string[]) => Array.from(new Set((codes || []).map((code) => String(code).trim().toUpperCase()).filter((code) => /^[A-Z][0-9A-Z]{2}(?:\.[0-9A-Z]{1,4})?$/.test(code))));
const status = (blockers: string[], review = false): OtpStatus => blockers.length ? "hold" : review ? "review" : "pass";
const domain = (name: OtpDomainResult["domain"], title: string, reasons: string[], blockers: string[], sourceIds: string[], review = false): OtpDomainResult => ({ domain: name, title, status: status(blockers, review), reasons, blockers, sourceIds });
const roundMoney = (value: number) => Math.round(value);

function claimContext(input: OtpCaseInput): OtpEvaluation["claimContext"] {
  if (input.claimEntity === "professional") return { placeOfService: "58" };
  if (input.siteType === "hospital-based") return { typeOfBill: "013x", revenueCode: "0900" };
  if (input.siteType === "cah-based") return { typeOfBill: "085x", revenueCode: "0900" };
  if (input.siteType === "provider-based") return { typeOfBill: "087x", conditionCode: "89", revenueCode: "0900" };
  return { typeOfBill: "087x", revenueCode: "0900" };
}

function adjustedAmount(code: string, units: number, factor: number | null | undefined) {
  const rate = OTP_2026_NATIONAL_RATES[code];
  if (!rate || rate.total == null || rate.nonDrug == null || !factor || factor <= 0) return rate?.total == null ? null : rate.total * units;
  return roundMoney((rate.drug + rate.nonDrug * factor) * units);
}

function daysBetween(a: string, b: string) {
  const one = Date.parse(a + "T00:00:00Z");
  const two = Date.parse(b + "T00:00:00Z");
  return Number.isFinite(one) && Number.isFinite(two) ? Math.floor(Math.abs(one - two) / 86400000) : Number.POSITIVE_INFINITY;
}

function addLine(lines: OtpClaimLine[], input: OtpCaseInput, code: string, category: OtpClaimLine["category"], units: number, description?: string, modifier?: OtpClaimLine["modifier"]) {
  const rate = OTP_2026_NATIONAL_RATES[code];
  lines.push({
    hcpcs: code,
    category,
    units,
    modifier,
    diagnosisPointers: cleanCodes(input.diagnosisCodes),
    nationalAmountCents: rate.total == null ? null : rate.total * units,
    estimatedAmountCents: adjustedAmount(code, units, input.localityAdjustment),
    description: description || rate.description,
    sourceId: "cms-otp-cy2026-rates",
  });
}

export function evaluateOtpCase(input: OtpCaseInput): OtpEvaluation {
  const diagnosisCodes = cleanCodes(input.diagnosisCodes);
  const lines: OtpClaimLine[] = [];
  const queries: string[] = [];
  const programBlockers: string[] = [];
  const programReasons: string[] = [];

  if (input.payerMode === "medicare-ffs") {
    if (input.program.samhsaCertified !== true) programBlockers.push("Verify current SAMHSA OTP certification.");
    if (input.program.accredited !== true) programBlockers.push("Verify accreditation by a SAMHSA-approved accrediting body.");
    if (input.program.medicareEnrolled !== true) programBlockers.push("Verify Medicare enrollment as an OTP for the service date.");
  } else programReasons.push("Non-FFS payer rules require a payer-specific benefit and authorization check.");
  if (input.program.deaAndStateAuthorized !== true) programBlockers.push("Verify DEA and service-state authorization for the medication and delivery method.");
  if (!programBlockers.length) programReasons.push("Program eligibility gates are documented for the selected payer path.");

  const bundleBlockers: string[] = [];
  const bundleReasons: string[] = [];
  let selectedMedication = input.medication;
  if (input.medicationSwitchedDuringWeek) {
    if (!input.medicationUsedMostOfWeek || input.medicationUsedMostOfWeek === "no-drug" || input.medicationUsedMostOfWeek === "not-otherwise-specified") {
      bundleBlockers.push("Select the medication furnished for most days of the 7-day episode; only one weekly primary bundle may be billed.");
    } else {
      selectedMedication = input.medicationUsedMostOfWeek;
      bundleReasons.push("One primary bundle is selected from the medication furnished for most days of the week.");
    }
  }
  const primaryCode = PRIMARY_CODE[selectedMedication] || null;
  const hasComponent = input.drugComponentFurnished === true || input.nondrugComponentFurnished === true;
  if (!hasComponent) bundleBlockers.push("Document at least one drug or non-drug component furnished during the episode.");
  if (selectedMedication === "no-drug" && input.nondrugComponentFurnished !== true) bundleBlockers.push("G2074 requires at least one documented non-drug service during the week.");
  if (selectedMedication !== "no-drug" && selectedMedication !== "not-otherwise-specified" && input.drugComponentFurnished !== true) bundleBlockers.push("The selected medication bundle requires documentation that its drug component was furnished.");
  if (selectedMedication === "not-otherwise-specified") bundleReasons.push("G2075 is contractor priced; obtain the MAC amount and validate that a specific medication bundle does not apply.");

  const duplicate = input.duplicateBundle;
  let primaryModifier: "59" | undefined;
  if (duplicate?.detected) {
    const limitedReason = ["guest-dosing", "transfer", "holiday-sync"].includes(duplicate.reason);
    if (!limitedReason || duplicate.recordsExchanged !== true || duplicate.modifier59Supported !== true) {
      bundleBlockers.push("A duplicate 7-day bundle is on record. Resolve overlap or document the limited guest-dosing, transfer, or synchronization exception before using modifier 59.");
    } else {
      primaryModifier = "59";
      bundleReasons.push("Modifier 59 is supported by the documented limited duplicate-bundle exception and record exchange.");
    }
  }
  if (!bundleBlockers.length && primaryCode) addLine(lines, input, primaryCode, "primary-bundle", 1, undefined, primaryModifier);

  const addOnBlockers: string[] = [];
  const addOnReasons: string[] = [];
  if (input.intakePerformed) {
    if (input.newPatient !== true) addOnBlockers.push("G2076 requires documented intake activities for a new patient.");
    else addLine(lines, input, "G2076", "assessment", 1);
  }
  if (input.periodicAssessmentPerformed) {
    if (input.newPatient === true) addOnBlockers.push("Use the intake pathway for a new patient; confirm whether G2077 is a later periodic assessment.");
    else addLine(lines, input, "G2077", "assessment", 1);
  }
  const counselingUnits = Math.floor(Math.max(0, Number(input.additionalCounselingMinutes || 0)) / 30);
  if (counselingUnits) {
    if (input.counselingBeyondBundlePlan !== true) addOnBlockers.push("G2080 requires medically necessary counseling beyond the counseling included in the weekly bundle.");
    else addLine(lines, input, "G2080", "counseling", counselingUnits);
  }
  const timedSupport: Array<[number, string]> = [
    [Number(input.coordinatedCareMinutes || 0), "G0534"],
    [Number(input.navigationMinutes || 0), "G0535"],
    [Number(input.peerRecoveryMinutes || 0), "G0536"],
  ];
  for (const [minutes, code] of timedSupport) {
    const units = Math.floor(Math.max(0, minutes) / 30);
    if (units) addLine(lines, input, code, "care-support", units);
  }

  const takeHome = input.takeHome;
  if (takeHome && takeHome.additionalDays > 0) {
    const matchingCode = selectedMedication === "methadone" ? "G2078" : selectedMedication === "buprenorphine-oral" ? "G2079" : null;
    const units = Math.ceil(Math.max(0, takeHome.additionalDays) / 7);
    if (!matchingCode) addOnBlockers.push("Take-home add-ons G2078/G2079 only match methadone or oral buprenorphine primary bundles.");
    if (units > 3) addOnBlockers.push("No more than three take-home add-on units may accompany the weekly base bundle for a one-month supply.");
    if (takeHome.noOverlapWithBundleDates !== true) addOnBlockers.push("Verify that take-home supply dates do not overlap dates represented by another weekly medication bundle.");
    if (takeHome.practitionerAuthorized !== true) addOnBlockers.push("A qualified practitioner must separately authorize take-home medication under current federal and state clinical rules.");
    if (matchingCode && units <= 3 && takeHome.noOverlapWithBundleDates === true && takeHome.practitionerAuthorized === true && !bundleBlockers.length) addLine(lines, input, matchingCode, "take-home", units);
    queries.push("Billing units do not determine clinical take-home eligibility; retain the practitioner’s patient-centered decision and applicable state documentation.");
  }

  const iop = input.intensiveOutpatient;
  if (iop?.requested) {
    const eligibleServices = (iop.services || []).filter((service) => !service.countedElsewhere);
    const uniqueServices = new Set(eligibleServices.map((service) => `${service.serviceDate}:${service.id}`));
    const dates = eligibleServices.map((service) => service.serviceDate).filter(Boolean).sort();
    const withinSevenDays = dates.length > 0 && daysBetween(dates[0], dates[dates.length - 1]) <= 6;
    if (iop.practitionerCertified !== true) addOnBlockers.push("G0137 requires physician or non-physician practitioner certification.");
    if (uniqueServices.size < 9 || !withinSevenDays) addOnBlockers.push("G0137 requires at least nine non-duplicated qualifying services within seven contiguous days.");
    if (eligibleServices.length !== (iop.services || []).length) addOnReasons.push("Services already supporting another OTP bundle or add-on were excluded from the IOP threshold.");
    if (iop.practitionerCertified === true && uniqueServices.size >= 9 && withinSevenDays) addLine(lines, input, "G0137", "iop", 1);
  }

  const overdose = input.overdoseMedication;
  if (overdose && overdose.product !== "none") {
    const code = overdose.product.split("-")[0].toUpperCase();
    const within30Days = overdose.lastSupplyDate ? daysBetween(input.serviceDate, overdose.lastSupplyDate) < 30 : false;
    if (within30Days && overdose.additionalSupplyNecessary !== true) addOnBlockers.push(`${code} was supplied within 30 days; document medical necessity for an additional supply.`);
    else if (code === "G2216") {
      const units = Math.max(1, Math.ceil(Number(overdose.dosageMg || 0)));
      addLine(lines, input, code, "overdose-medication", units);
      addOnReasons.push("G2216 uses whole 1 mg dosage units and remains contractor priced.");
    } else addLine(lines, input, code, "overdose-medication", 1);
  }
  if (!addOnBlockers.length) addOnReasons.push("Selected add-ons pass the documented frequency, time, and base-bundle checks represented in this worksheet.");

  const telecomBlockers: string[] = [];
  const telecomReasons: string[] = [];
  const telecom = input.telecom || { mode: "none" as const, service: "none" as const };
  let telecomModifier: "93" | "95" | undefined;
  if (telecom.mode !== "none") {
    if (!input.claimEntity || input.claimEntity !== "professional") telecomBlockers.push("This OTP telecom claim workflow is represented on the professional claim path; review institutional billing separately.");
    if (!["intake", "periodic-assessment", "additional-counseling"].includes(telecom.service)) telecomBlockers.push("Select an eligible OTP telecom service.");
    if (iop?.requested) telecomBlockers.push("G0137 intensive outpatient services are not represented as a telehealth service in the current OTP manual pathway.");
    if (telecom.federalStateRequirementsMet !== true) telecomBlockers.push("Verify all federal and state telecom requirements for the service and medication.");
    telecomModifier = telecom.mode === "audio-video" ? "95" : "93";
    if (telecom.mode === "audio-only" && telecom.service === "intake") {
      if (telecom.audioVideoUnavailable !== true) telecomBlockers.push("Audio-only intake requires documentation that audio-video is unavailable or not feasible.");
      if (selectedMedication === "methadone" && telecom.patientWithDeaPractitioner !== true) telecomBlockers.push("For methadone audio-only intake, document the patient’s physical presence with a DEA-registered practitioner who completes the visual component.");
    }
    telecomReasons.push(`Use POS 58 with modifier ${telecomModifier}; do not substitute POS 02 or 10 for Medicare OTP professional services.`);
    const targetCode = telecom.service === "intake" ? "G2076" : telecom.service === "periodic-assessment" ? "G2077" : "G2080";
    for (const line of lines) if (line.hcpcs === targetCode) line.modifier = telecomModifier;
  } else telecomReasons.push("No telecom service selected.");

  const claimBlockers: string[] = [];
  const claimReasons: string[] = [];
  if (!diagnosisCodes.length) claimBlockers.push("Enter the documented OUD diagnosis; the engine does not infer or repair diagnoses.");
  else if (!diagnosisCodes.some((code) => /^F11(?:\.|$)/.test(code))) claimBlockers.push("Verify a documented opioid-use-disorder diagnosis for the Medicare OTP claim.");
  if (!/^\d{10}$/.test(String(input.organizationNpi || ""))) claimBlockers.push("Enter the 10-digit enrolled OTP organization NPI.");
  if (!/^\d{10}$/.test(String(input.orderingNpi || ""))) claimBlockers.push("Enter the 10-digit ordering/prescribing practitioner NPI.");
  if (programBlockers.length || bundleBlockers.length || addOnBlockers.length || telecomBlockers.length) claimBlockers.push("Resolve all upstream program, bundle, add-on, and telecom holds before release.");
  if (!claimBlockers.length) claimReasons.push(`${input.claimEntity === "professional" ? "837P with POS 58" : "837I institutional"} claim context is assembled for coder review.`);

  const contractorPricedCodes = lines.filter((line) => line.nationalAmountCents == null).map((line) => line.hcpcs);
  const paymentBlockers: string[] = [];
  const paymentReasons: string[] = ["CY 2026 amounts are national CMS reference amounts; the non-drug component is geographically adjusted."];
  if (input.payerMode !== "medicare-ffs") paymentBlockers.push("Load the selected payer’s current fee schedule before presenting a payment estimate.");
  if (contractorPricedCodes.length) paymentBlockers.push(`Obtain MAC pricing for ${Array.from(new Set(contractorPricedCodes)).join(", ")}; the engine does not invent contractor-priced amounts.`);
  if (!input.localityAdjustment || input.localityAdjustment <= 0) paymentReasons.push("No locality factor was supplied, so estimated amounts remain at national values.");
  const pricedLines = lines.filter((line) => line.nationalAmountCents != null);
  const allNationalPriced = contractorPricedCodes.length === 0;
  const nationalTotal = allNationalPriced ? pricedLines.reduce((sum, line) => sum + Number(line.nationalAmountCents), 0) : null;
  const estimatedTotal = allNationalPriced ? pricedLines.reduce((sum, line) => sum + Number(line.estimatedAmountCents), 0) : null;

  const domains = [
    domain("program", "Program eligibility", programReasons, programBlockers, ["cms-otp-enrollment", "samhsa-42-cfr-part-8"]),
    domain("bundle", "Primary treatment bundle", bundleReasons, bundleBlockers, ["cms-clm-ch39", "cms-otp-cy2026-rates"]),
    domain("add-ons", "Add-ons and clinical intensity", addOnReasons, addOnBlockers, ["cms-clm-ch39", "cms-cr14347"]),
    domain("telecom", "Telecommunications", telecomReasons, telecomBlockers, ["cms-clm-ch39", "cms-cy2025-pfs-final"], telecom.mode !== "none" && !telecomBlockers.length),
    domain("claim", "Claim readiness", claimReasons, claimBlockers, ["cms-clm-ch39"]),
    domain("payment", "Payment readiness", paymentReasons, paymentBlockers, ["cms-otp-cy2026-rates"], !paymentBlockers.length && !input.localityAdjustment),
  ];

  if ((input.diagnosisCodes || []).length !== diagnosisCodes.length) queries.push("One or more diagnosis entries were excluded because they were not valid code-shaped values; no diagnosis was inferred or repaired.");
  queries.push("Confirm state law, payer edits, service-date eligibility, and source documentation before claim release.");

  return {
    engineVersion: OTP_ENGINE_VERSION,
    policyVersion: OTP_POLICY_VERSION,
    claimFormat: input.claimEntity === "professional" ? "837P" : "837I",
    claimContext: claimContext(input),
    diagnosisCodes,
    primaryCode,
    domains,
    lines,
    queries,
    payment: {
      nationalTotalCents: nationalTotal,
      estimatedTotalCents: estimatedTotal,
      localityApplied: Boolean(input.localityAdjustment && input.localityAdjustment > 0),
      contractorPricedCodes: Array.from(new Set(contractorPricedCodes)),
      beneficiaryCoinsurance: input.payerMode === "medicare-ffs" ? "waived" : "payer-specific",
      partBDeductibleApplies: input.payerMode === "medicare-ffs" ? true : null,
    },
    requiresHumanApproval: true,
    autonomousClaimSubmission: false,
  };
}
