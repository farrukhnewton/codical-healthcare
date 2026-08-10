export const INFUSION_ENGINE_VERSION = "2026.08.10.1";
export const INFUSION_POLICY_VERSION = "CMS-NCCI-2026-Q3";

export type InfusionSetting = "physician-office" | "hospital-outpatient" | "asc" | "inpatient";
export type InfusionCategory = "chemotherapy" | "therapeutic" | "hydration";
export type InfusionMethod = "infusion" | "push" | "injection";
export type ReviewState = true | false | null;

export type InfusionAdministrationInput = {
  id: string;
  drugName: string;
  hcpcsCode?: string;
  dose?: number;
  doseUnit?: string;
  discardedDose?: number;
  category: InfusionCategory;
  method: InfusionMethod;
  startTime?: string;
  stopTime?: string;
  accessSite: string;
  medicallyNecessary: ReviewState;
  carrierFluidOnly: ReviewState;
  providerPresentForPush: ReviewState;
  singleDoseContainer: ReviewState;
  jwJzPolicyApplies: ReviewState;
  separatelyPayableDrug: ReviewState;
  sourceDocumentId?: string;
};

export type InfusionCaseInput = {
  serviceDate: string;
  setting: InfusionSetting;
  separateAccessSitesMedicallyNecessary: ReviewState;
  administrations: InfusionAdministrationInput[];
};

export type InfusionDrugCatalogEntry = {
  code: string;
  shortDescription: string;
  dosageText: string;
  paymentLimit: number | null;
  coinsurancePercentage: number | null;
  pricingNote: string;
};

export type InfusionDrugCatalog = {
  quarter: string;
  effectiveFrom: string;
  effectiveTo: string;
  releaseDate: string;
  sourceHashes: Record<string, string>;
  entries: Record<string, InfusionDrugCatalogEntry>;
  aliases: Record<string, string[]>;
};

export type InfusionCodeLine = {
  code: string;
  units: number;
  role: "initial" | "sequential" | "concurrent" | "additional-hour" | "push" | "injection";
  administrationIds: string[];
  rationale: string;
  reviewRequired: boolean;
};

export type InfusionDrugLine = {
  code: string;
  modifier: "JW" | "JZ" | null;
  units: number;
  doseRepresented: string;
  administrationId: string;
  paymentLimitReference: number | null;
  referenceAllowance: number | null;
  reviewRequired: boolean;
  issues: string[];
};

export type InfusionAdministrationResult = {
  id: string;
  drugName: string;
  category: InfusionCategory;
  method: InfusionMethod;
  durationMinutes: number | null;
  timelineRole: string;
  status: "coded" | "held" | "incidental";
  issues: string[];
};

export type InfusionEvaluation = {
  engineVersion: string;
  policyVersion: string;
  status: "hold" | "review" | "ready";
  initialSelectionMode: "chronological" | "facility-hierarchy";
  administrationLines: InfusionCodeLine[];
  drugLines: InfusionDrugLine[];
  administrations: InfusionAdministrationResult[];
  blockers: string[];
  warnings: string[];
  ncciCheckRequired: boolean;
  pricingQuarter: string;
  pricingCurrentForServiceDate: boolean;
  referenceAllowanceTotal: number | null;
  humanApprovalRequired: true;
  autonomousClaimSubmissionAllowed: false;
};

const INITIAL_CODES: Record<string, string> = {
  "chemotherapy:infusion": "96413",
  "chemotherapy:push": "96409",
  "therapeutic:infusion": "96365",
  "therapeutic:push": "96374",
  "hydration:infusion": "96360",
};
const FACILITY_RANK: Record<string, number> = {
  "chemotherapy:infusion": 1,
  "chemotherapy:push": 2,
  "therapeutic:infusion": 3,
  "therapeutic:push": 4,
  "hydration:infusion": 5,
};
const normalizeDrug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normalizeCode = (value?: string) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const roundedMoney = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

function timeMinutes(value?: string) {
  const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function durationMinutes(row: InfusionAdministrationInput) {
  if (row.method === "injection") return 0;
  const start = timeMinutes(row.startTime);
  const stop = timeMinutes(row.stopTime);
  if (start === null || stop === null || stop <= start) return null;
  return stop - start;
}

function additionalHourUnits(duration: number) {
  return duration <= 90 ? 0 : Math.floor((duration - 31) / 60);
}

function unitDefinition(value: string) {
  const match = value.toUpperCase().match(/([0-9]*\.?[0-9]+)\s*(MCG|MG|GM|G|ML|CC|IU|UNIT|UNITS|DOSE|EA)/);
  if (!match) return null;
  const unit = match[2] === "GM" ? "G" : match[2] === "CC" ? "ML" : match[2] === "UNITS" ? "UNIT" : match[2];
  return { amount: Number(match[1]), unit };
}

function convertDose(value: number, from: string, to: string) {
  const source = from.toUpperCase().replace("GM", "G").replace("UNITS", "UNIT").replace("CC", "ML");
  const target = to.toUpperCase();
  if (source === target) return value;
  const weightInMg: Record<string, number> = { MCG: 0.001, MG: 1, G: 1000 };
  if (weightInMg[source] && weightInMg[target]) return value * weightInMg[source] / weightInMg[target];
  return null;
}

function overlap(left: InfusionAdministrationInput, right: InfusionAdministrationInput) {
  const leftStart = timeMinutes(left.startTime); const leftStop = timeMinutes(left.stopTime);
  const rightStart = timeMinutes(right.startTime); const rightStop = timeMinutes(right.stopTime);
  return leftStart !== null && leftStop !== null && rightStart !== null && rightStop !== null && Math.max(leftStart, rightStart) < Math.min(leftStop, rightStop);
}

export function lookupInfusionDrugs(query: string, catalog: InfusionDrugCatalog, limit = 12) {
  const code = normalizeCode(query);
  if (catalog.entries[code]) return [catalog.entries[code]];
  const normalized = normalizeDrug(query);
  if (!normalized) return [];
  const exactCodes = catalog.aliases[normalized] || [];
  const fuzzyCodes = exactCodes.length ? [] : Object.entries(catalog.aliases)
    .filter(([alias]) => alias.includes(normalized) || normalized.includes(alias))
    .flatMap(([, codes]) => codes);
  return [...new Set([...exactCodes, ...fuzzyCodes])].map((candidate) => catalog.entries[candidate]).filter(Boolean).slice(0, limit);
}

function addCodeLine(lines: InfusionCodeLine[], line: InfusionCodeLine) {
  const existing = lines.find((item) => item.code === line.code && item.role === line.role && item.rationale === line.rationale);
  if (existing) { existing.units += line.units; existing.administrationIds.push(...line.administrationIds); existing.reviewRequired ||= line.reviewRequired; }
  else lines.push(line);
}

export function evaluateInfusionCase(input: InfusionCaseInput, catalog: InfusionDrugCatalog): InfusionEvaluation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const administrationLines: InfusionCodeLine[] = [];
  const drugLines: InfusionDrugLine[] = [];
  const results: InfusionAdministrationResult[] = [];
  const pricingCurrent = input.serviceDate >= catalog.effectiveFrom && input.serviceDate <= catalog.effectiveTo;
  const initialSelectionMode = input.setting === "hospital-outpatient" ? "facility-hierarchy" : "chronological";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.serviceDate)) blockers.push("A valid date of service is required.");
  if (!pricingCurrent) blockers.push(`The ${catalog.quarter} ASP file is not effective for this date of service; load the matching quarter before releasing drug units or prices.`);
  if (input.setting === "asc") blockers.push("Drug administration related to an ASC payable procedure is not separately reportable under this workflow.");
  if (input.setting === "inpatient") blockers.push("Inpatient drug administration requires the facility inpatient payment pathway and is outside this Part B worksheet.");
  if (!input.administrations.length) blockers.push("Add at least one documented administration.");

  const rows = input.administrations.slice(0, 100).map((row, index) => ({ ...row, id: row.id || `administration-${index + 1}` }));
  const timedCandidates = rows.filter((row) => row.method !== "injection" && INITIAL_CODES[`${row.category}:${row.method}`] && durationMinutes(row) !== null && row.medicallyNecessary === true && row.carrierFluidOnly !== true);
  const uniqueAccessSites = new Set(timedCandidates.map((row) => row.accessSite.trim().toLowerCase()).filter(Boolean));
  const allowMultipleInitials = uniqueAccessSites.size > 1 && input.separateAccessSitesMedicallyNecessary === true;
  if (uniqueAccessSites.size > 1 && input.separateAccessSitesMedicallyNecessary !== true) warnings.push("Multiple access sites are present, but separate medically necessary access has not been confirmed; only one initial service is selected.");
  const groups = allowMultipleInitials ? [...uniqueAccessSites].map((site) => timedCandidates.filter((row) => row.accessSite.trim().toLowerCase() === site)) : [timedCandidates];
  const initialIds = new Set<string>();
  for (const group of groups) {
    if (!group.length) continue;
    const chosen = [...group].sort((left, right) => {
      if (initialSelectionMode === "facility-hierarchy") {
        const rank = (FACILITY_RANK[`${left.category}:${left.method}`] || 99) - (FACILITY_RANK[`${right.category}:${right.method}`] || 99);
        if (rank) return rank;
      }
      return (timeMinutes(left.startTime) || 0) - (timeMinutes(right.startTime) || 0);
    })[0];
    initialIds.add(chosen.id);
  }

  let concurrent96368Created = false;
  const sorted = [...rows].sort((left, right) => (timeMinutes(left.startTime) ?? 10_000) - (timeMinutes(right.startTime) ?? 10_000));
  for (const row of sorted) {
    const issues: string[] = [];
    const duration = durationMinutes(row);
    let status: InfusionAdministrationResult["status"] = "coded";
    let timelineRole = row.method === "injection" ? "injection" : initialIds.has(row.id) ? "initial" : "subsequent";
    if (!row.drugName.trim()) issues.push("Drug or fluid name is required.");
    if (!row.accessSite.trim() && row.method !== "injection") issues.push("IV access site is required.");
    if (row.medicallyNecessary !== true) issues.push(row.medicallyNecessary === false ? "Administration is marked not medically necessary." : "Medical necessity requires confirmation.");
    if (row.method !== "injection" && duration === null) issues.push("Valid start and stop times are required.");
    if (row.method === "infusion" && duration !== null && duration <= 15) issues.push("A documented infusion of 15 minutes or less requires push-method review.");
    if (row.method === "infusion" && duration !== null && duration > 480) issues.push("Infusions over 8 hours require the prolonged/pump pathway.");
    if (row.method === "push" && row.providerPresentForPush !== true) issues.push("Continuous professional presence for the IV push is not confirmed.");
    if (row.carrierFluidOnly === true || (row.category === "hydration" && row.carrierFluidOnly !== false)) {
      status = row.carrierFluidOnly === true ? "incidental" : "held";
      issues.push(row.carrierFluidOnly === true ? "Carrier/patency fluid is incidental and not separately reportable." : "Hydration must be confirmed as therapeutic rather than carrier/patency fluid.");
    }
    const priorSameSite = sorted.filter((candidate) => candidate.id !== row.id && candidate.accessSite.trim().toLowerCase() === row.accessSite.trim().toLowerCase() && (timeMinutes(candidate.startTime) ?? 10_000) <= (timeMinutes(row.startTime) ?? -1));
    const concurrent = priorSameSite.some((candidate) => overlap(candidate, row));
    const sameDrugPrior = [...priorSameSite].reverse().find((candidate) => normalizeDrug(candidate.drugName) === normalizeDrug(row.drugName));
    if (row.category === "hydration" && concurrent) { status = "incidental"; issues.push("Hydration concurrent with another drug administration is not separately reportable."); }
    if (row.category === "hydration" && duration !== null && duration <= 30) { status = "held"; issues.push("Hydration must exceed 30 minutes to be separately reportable."); }
    if (issues.length && status === "coded") status = "held";

    if (status === "coded") {
      const reviewRequired = row.sourceDocumentId ? true : false;
      if (row.method === "injection") {
        addCodeLine(administrationLines, { code: row.category === "chemotherapy" ? "96401" : "96372", units: 1, role: "injection", administrationIds: [row.id], rationale: "Documented non-IV injection administration; verify route and drug complexity against licensed CPT guidance.", reviewRequired: true });
      } else if (initialIds.has(row.id)) {
        const code = INITIAL_CODES[`${row.category}:${row.method}`];
        addCodeLine(administrationLines, { code, units: 1, role: row.method === "push" ? "push" : "initial", administrationIds: [row.id], rationale: initialSelectionMode === "facility-hierarchy" ? "Selected as the facility initial service under the documented administration hierarchy." : "Selected as the chronologically first documented IV service for the physician-office encounter.", reviewRequired });
        if (row.method === "infusion" && duration !== null) {
          const units = additionalHourUnits(duration);
          if (units) addCodeLine(administrationLines, { code: row.category === "chemotherapy" ? "96415" : row.category === "therapeutic" ? "96366" : "96361", units, role: "additional-hour", administrationIds: [row.id], rationale: "Additional-hour units derived from verified infusion duration.", reviewRequired });
        }
      } else if (row.method === "push") {
        if (row.category === "chemotherapy") addCodeLine(administrationLines, { code: "96411", units: 1, role: "push", administrationIds: [row.id], rationale: "Additional documented chemotherapy-complex IV push.", reviewRequired: true });
        else if (sameDrugPrior) {
          const elapsed = (timeMinutes(row.startTime) || 0) - (timeMinutes(sameDrugPrior.startTime) || 0);
          if (elapsed >= 30) addCodeLine(administrationLines, { code: "96376", units: 1, role: "push", administrationIds: [row.id], rationale: "Repeat push of the same substance at least 30 minutes after the prior push.", reviewRequired: true });
          else { status = "held"; issues.push("Repeat push of the same substance is less than 30 minutes after the prior push."); }
        } else addCodeLine(administrationLines, { code: "96375", units: 1, role: "push", administrationIds: [row.id], rationale: "Additional sequential IV push of a new therapeutic substance.", reviewRequired: true });
      } else if (row.method === "infusion" && duration !== null) {
        if (concurrent) {
          timelineRole = "concurrent";
          if (row.category === "therapeutic" && !concurrent96368Created) {
            addCodeLine(administrationLines, { code: "96368", units: 1, role: "concurrent", administrationIds: [row.id], rationale: "One concurrent non-chemotherapy infusion is allowed per encounter; verify exact overlapping times and compatibility.", reviewRequired: true });
            concurrent96368Created = true;
          } else { status = "held"; issues.push("This concurrent administration does not create another separately reportable concurrent unit."); }
        } else if (row.category === "hydration") {
          addCodeLine(administrationLines, { code: "96361", units: Math.max(1, additionalHourUnits(duration)), role: "sequential", administrationIds: [row.id], rationale: "Medically necessary sequential hydration after a different initial service.", reviewRequired: true });
        } else if (sameDrugPrior) {
          addCodeLine(administrationLines, { code: row.category === "chemotherapy" ? "96415" : "96366", units: Math.max(1, additionalHourUnits(duration)), role: "additional-hour", administrationIds: [row.id], rationale: "Continued/sequential administration of the same documented substance; verify no interruption changes the coding interval.", reviewRequired: true });
        } else {
          addCodeLine(administrationLines, { code: row.category === "chemotherapy" ? "96417" : "96367", units: 1, role: "sequential", administrationIds: [row.id], rationale: "Sequential infusion of a new documented substance through the same access site.", reviewRequired: true });
          const units = additionalHourUnits(duration);
          if (units) addCodeLine(administrationLines, { code: row.category === "chemotherapy" ? "96415" : "96366", units, role: "additional-hour", administrationIds: [row.id], rationale: "Additional-hour units for the sequential infusion derived from verified duration.", reviewRequired: true });
        }
      }
    }

    const code = normalizeCode(row.hcpcsCode);
    if (code) {
      const catalogEntry = catalog.entries[code];
      const drugIssues: string[] = [];
      if (!catalogEntry) drugIssues.push(`HCPCS ${code} is not in the ${catalog.quarter} CMS payment-limit file.`);
      const definition = catalogEntry ? unitDefinition(catalogEntry.dosageText) : null;
      const dose = Number(row.dose);
      const convertedDose = definition && Number.isFinite(dose) && dose > 0 ? convertDose(dose, row.doseUnit || "", definition.unit) : null;
      if (!Number.isFinite(dose) || dose <= 0) drugIssues.push("Administered dose is required for drug-unit calculation.");
      else if (!definition) drugIssues.push("The HCPCS dosage descriptor is not machine-convertible; calculate units manually.");
      else if (convertedDose === null) drugIssues.push(`Dose unit ${row.doseUnit || "(missing)"} cannot be converted to ${definition.unit}.`);
      if (row.separatelyPayableDrug !== true) drugIssues.push(row.separatelyPayableDrug === false ? "Drug is marked not separately payable." : "Separate Part B payment status requires confirmation.");
      if (convertedDose !== null && definition && catalogEntry) {
        const administeredUnits = Math.ceil((convertedDose / definition.amount) - 1e-9);
        const discarded = Number(row.discardedDose || 0);
        const convertedDiscarded = discarded > 0 ? convertDose(discarded, row.doseUnit || "", definition.unit) : 0;
        let modifier: "JW" | "JZ" | null = null;
        let jwUnits = 0;
        if (row.singleDoseContainer === true && row.jwJzPolicyApplies === true) {
          if (convertedDiscarded && convertedDiscarded > 0) {
            const totalUnits = Math.ceil(((convertedDose + convertedDiscarded) / definition.amount) - 1e-9);
            jwUnits = Math.max(0, totalUnits - administeredUnits);
            if (!jwUnits) modifier = "JZ";
          } else modifier = "JZ";
        } else if (row.singleDoseContainer === null || row.jwJzPolicyApplies === null) drugIssues.push("Single-dose container and JW/JZ applicability require confirmation.");
        const paymentLimit = pricingCurrent ? catalogEntry.paymentLimit : null;
        drugLines.push({ code, modifier, units: administeredUnits, doseRepresented: `${row.dose} ${row.doseUnit || ""}`.trim(), administrationId: row.id, paymentLimitReference: paymentLimit, referenceAllowance: paymentLimit === null ? null : roundedMoney(paymentLimit * administeredUnits), reviewRequired: drugIssues.length > 0, issues: drugIssues });
        if (jwUnits) drugLines.push({ code, modifier: "JW", units: jwUnits, doseRepresented: `${row.discardedDose} ${row.doseUnit || ""} discarded`.trim(), administrationId: row.id, paymentLimitReference: paymentLimit, referenceAllowance: paymentLimit === null ? null : roundedMoney(paymentLimit * jwUnits), reviewRequired: true, issues: ["Verify single-dose packaging, actual discarded amount, and medical-record documentation."] });
      } else if (catalogEntry) drugLines.push({ code, modifier: null, units: 0, doseRepresented: "Manual unit calculation required", administrationId: row.id, paymentLimitReference: null, referenceAllowance: null, reviewRequired: true, issues: drugIssues });
      warnings.push(...drugIssues.map((issue) => `${row.drugName || code}: ${issue}`));
    } else if (row.category !== "hydration") warnings.push(`${row.drugName || row.id}: HCPCS drug code has not been selected.`);

    results.push({ id: row.id, drugName: row.drugName, category: row.category, method: row.method, durationMinutes: duration, timelineRole, status, issues });
    if (status === "held") blockers.push(...issues.map((issue) => `${row.drugName || row.id}: ${issue}`));
    else if (issues.length) warnings.push(...issues.map((issue) => `${row.drugName || row.id}: ${issue}`));
  }

  const uniqueBlockers = [...new Set(blockers)];
  const uniqueWarnings = [...new Set(warnings)];
  const allowanceValues = drugLines.map((line) => line.referenceAllowance).filter((value): value is number => value !== null);
  return {
    engineVersion: INFUSION_ENGINE_VERSION,
    policyVersion: INFUSION_POLICY_VERSION,
    status: uniqueBlockers.length ? "hold" : uniqueWarnings.length || administrationLines.some((line) => line.reviewRequired) || drugLines.some((line) => line.reviewRequired) ? "review" : "ready",
    initialSelectionMode,
    administrationLines,
    drugLines,
    administrations: results,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    ncciCheckRequired: administrationLines.length > 1,
    pricingQuarter: catalog.quarter,
    pricingCurrentForServiceDate: pricingCurrent,
    referenceAllowanceTotal: allowanceValues.length ? roundedMoney(allowanceValues.reduce((sum, value) => sum + value, 0)) : null,
    humanApprovalRequired: true,
    autonomousClaimSubmissionAllowed: false,
  };
}
