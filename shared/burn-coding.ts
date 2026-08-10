export const BURN_ENGINE_VERSION = "2026.08";

export type BurnDepth = 1 | 2 | 3;
export type BurnSurface = "anterior" | "posterior" | "circumferential";
export type InjuryType = "burn" | "corrosion";
export type EncounterType = "initial" | "subsequent" | "sequela";
export type BurnServiceType =
  | "assessment_only"
  | "local_burn_treatment"
  | "escharotomy"
  | "surgical_preparation"
  | "split_thickness_autograft"
  | "full_thickness_autograft"
  | "skin_substitute_sheet"
  | "npwt"
  | "non_burn_debridement";

export type SiteGroup = "trunk_limbs" | "special_sites" | "scalp_arms_legs" | "nose_ears_eyelids_lips";

export type BurnRegionId =
  | "head"
  | "neck"
  | "anterior_trunk"
  | "posterior_trunk"
  | "right_buttock"
  | "left_buttock"
  | "right_upper_arm"
  | "left_upper_arm"
  | "right_lower_arm"
  | "left_lower_arm"
  | "right_hand"
  | "left_hand"
  | "right_thigh"
  | "left_thigh"
  | "right_leg"
  | "left_leg"
  | "right_foot"
  | "left_foot"
  | "perineum";

export type BurnRegionInput = {
  regionId: BurnRegionId;
  burnDepth: BurnDepth;
  percentBurned: number;
  surface?: BurnSurface;
};

export type BurnServiceInput = {
  type: BurnServiceType;
  performed: boolean;
  siteGroup?: SiteGroup;
  areaCm2?: number;
  anesthesiaUsed?: boolean;
  additionalIncisions?: number;
  productForm?: "sheet" | "non_sheet";
  productHcpcs?: string;
  productName?: string;
  packageSizeCm2?: number;
  appliedAreaCm2?: number;
  discardedAreaCm2?: number;
  state?: string;
  mac?: string;
};

export type BurnCaseInput = {
  patientAge: number;
  serviceDate: string;
  injuryType: InjuryType;
  encounter: EncounterType;
  regions: BurnRegionInput[];
  service: BurnServiceInput;
};

export type RegionCalculation = BurnRegionInput & {
  label: string;
  regionMaximum: number;
  contributedTbsa: number;
  siteFamily: string;
};

export type CandidateServiceLine = {
  code: string;
  units: number;
  role: "primary" | "add-on" | "product" | "review";
  label: string;
  rationale: string;
};

export type AuditGate = {
  id: string;
  status: "pass" | "review" | "hold";
  title: string;
  detail: string;
};

export type BurnAnalysis = {
  totalTbsa: number;
  superficialTbsa: number;
  thirdDegreeTbsa: number;
  extentCode: string | null;
  extentCodeRole: "additional" | "not-applicable";
  regionResults: RegionCalculation[];
  siteFamilies: Array<{ family: string; regions: string[]; prompt: string }>;
  serviceLines: CandidateServiceLine[];
  auditGates: AuditGate[];
  warnings: string[];
};

type RegionDefinition = {
  label: string;
  percentages: readonly [number, number, number, number, number, number];
  siteFamily: "T20" | "T21" | "T22" | "T23" | "T24" | "T25";
};

const SINGLE_SURFACE_REGIONS = new Set<BurnRegionId>([
  "anterior_trunk", "posterior_trunk", "right_buttock", "left_buttock", "perineum",
]);

export function burnRegionSurfaceFactor(regionId: BurnRegionId, surface: BurnSurface = "circumferential") {
  if (SINGLE_SURFACE_REGIONS.has(regionId) || surface === "circumferential") return 1;
  return 0.5;
}

export const BURN_REGIONS: Record<BurnRegionId, RegionDefinition> = {
  head: { label: "Head", percentages: [19, 17, 13, 11, 9, 7], siteFamily: "T20" },
  neck: { label: "Neck", percentages: [2, 2, 2, 2, 2, 2], siteFamily: "T20" },
  anterior_trunk: { label: "Anterior trunk", percentages: [13, 13, 13, 13, 13, 13], siteFamily: "T21" },
  posterior_trunk: { label: "Posterior trunk", percentages: [13, 13, 13, 13, 13, 13], siteFamily: "T21" },
  right_buttock: { label: "Right buttock", percentages: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5], siteFamily: "T21" },
  left_buttock: { label: "Left buttock", percentages: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5], siteFamily: "T21" },
  right_upper_arm: { label: "Right upper arm", percentages: [4, 4, 4, 4, 4, 4], siteFamily: "T22" },
  left_upper_arm: { label: "Left upper arm", percentages: [4, 4, 4, 4, 4, 4], siteFamily: "T22" },
  right_lower_arm: { label: "Right lower arm", percentages: [3, 3, 3, 3, 3, 3], siteFamily: "T22" },
  left_lower_arm: { label: "Left lower arm", percentages: [3, 3, 3, 3, 3, 3], siteFamily: "T22" },
  right_hand: { label: "Right hand", percentages: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5], siteFamily: "T23" },
  left_hand: { label: "Left hand", percentages: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5], siteFamily: "T23" },
  right_thigh: { label: "Right thigh", percentages: [5.5, 6.5, 8, 8.5, 9, 9.5], siteFamily: "T24" },
  left_thigh: { label: "Left thigh", percentages: [5.5, 6.5, 8, 8.5, 9, 9.5], siteFamily: "T24" },
  right_leg: { label: "Right lower leg", percentages: [5, 5, 5.5, 6, 6.5, 7], siteFamily: "T24" },
  left_leg: { label: "Left lower leg", percentages: [5, 5, 5.5, 6, 6.5, 7], siteFamily: "T24" },
  right_foot: { label: "Right foot", percentages: [3.5, 3.5, 3.5, 3.5, 3.5, 3.5], siteFamily: "T25" },
  left_foot: { label: "Left foot", percentages: [3.5, 3.5, 3.5, 3.5, 3.5, 3.5], siteFamily: "T25" },
  perineum: { label: "Perineum", percentages: [1, 1, 1, 1, 1, 1], siteFamily: "T21" },
};

export const BURN_SERVICE_LABELS: Record<BurnServiceType, string> = {
  assessment_only: "Assessment only / no procedure confirmed",
  local_burn_treatment: "Local burn treatment",
  escharotomy: "Escharotomy",
  surgical_preparation: "Surgical recipient-site preparation",
  split_thickness_autograft: "Split-thickness autograft",
  full_thickness_autograft: "Full-thickness autograft",
  skin_substitute_sheet: "Sheet-form skin substitute application",
  npwt: "Negative-pressure wound therapy",
  non_burn_debridement: "Non-burn wound debridement",
};

const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function ageBandIndex(age: number): number {
  if (age < 1) return 0;
  if (age <= 4) return 1;
  if (age <= 9) return 2;
  if (age <= 14) return 3;
  if (age <= 17) return 4;
  return 5;
}

export function extentCode(totalTbsa: number, thirdDegreeTbsa: number, injuryType: InjuryType): string | null {
  if (totalTbsa <= 0) return null;
  const prefix = injuryType === "burn" ? "T31" : "T32";
  if (totalTbsa < 10) return `${prefix}.0`;
  const totalBand = clamp(Math.floor(totalTbsa / 10), 1, 9);
  const thirdBand = clamp(Math.floor(thirdDegreeTbsa / 10), 0, 9);
  return `${prefix}.${totalBand}${thirdBand}`;
}

function areaLines(
  area: number,
  codes: { smallPrimary: string; smallAddon: string; largePrimary: string; largeAddon: string },
  label: string,
): CandidateServiceLine[] {
  if (area < 100) {
    const addOnUnits = area > 25 ? Math.ceil((area - 25) / 25) : 0;
    return [
      { code: codes.smallPrimary, units: 1, role: "primary", label, rationale: "First 25 cm² or less; one primary unit per anatomic group." },
      ...(addOnUnits ? [{ code: codes.smallAddon, units: addOnUnits, role: "add-on" as const, label: `${label} — additional area`, rationale: "Each additional 25 cm² or part thereof." }] : []),
    ];
  }
  const addOnUnits = area > 100 ? Math.ceil((area - 100) / 100) : 0;
  return [
    { code: codes.largePrimary, units: 1, role: "primary", label, rationale: "Total wound surface is 100 cm² or greater; first 100 cm²." },
    ...(addOnUnits ? [{ code: codes.largeAddon, units: addOnUnits, role: "add-on" as const, label: `${label} — additional area`, rationale: "Each additional 100 cm² or part thereof." }] : []),
  ];
}

function preparationLines(area: number, specialSite: boolean): CandidateServiceLine[] {
  const primary = specialSite ? "15004" : "15002";
  const addon = specialSite ? "15005" : "15003";
  const addOnUnits = area > 100 ? Math.ceil((area - 100) / 100) : 0;
  return [
    { code: primary, units: 1, role: "primary", label: "Surgical recipient-site preparation", rationale: "First 100 cm²; requires documented excisional preparation to viable tissue for reconstruction." },
    ...(addOnUnits ? [{ code: addon, units: addOnUnits, role: "add-on" as const, label: "Additional recipient-site preparation", rationale: "Each additional 100 cm² or part thereof." }] : []),
  ];
}

function autograftLines(area: number, type: "split" | "full", group: SiteGroup): CandidateServiceLine[] {
  if (type === "split") {
    const special = group !== "trunk_limbs";
    const primary = special ? "15120" : "15100";
    const addon = special ? "15121" : "15101";
    const addOnUnits = area > 100 ? Math.ceil((area - 100) / 100) : 0;
    return [
      { code: primary, units: 1, role: "primary", label: "Split-thickness autograft", rationale: "First 100 cm² or less for the selected anatomic group." },
      ...(addOnUnits ? [{ code: addon, units: addOnUnits, role: "add-on" as const, label: "Additional split-thickness autograft area", rationale: "Each additional 100 cm² or part thereof." }] : []),
    ];
  }

  const codePair: Record<SiteGroup, [string, string]> = {
    trunk_limbs: ["15200", "15201"],
    scalp_arms_legs: ["15220", "15221"],
    special_sites: ["15240", "15241"],
    nose_ears_eyelids_lips: ["15260", "15261"],
  };
  const [primary, addon] = codePair[group];
  const addOnUnits = area > 20 ? Math.ceil((area - 20) / 20) : 0;
  return [
    { code: primary, units: 1, role: "primary", label: "Full-thickness autograft", rationale: "First 20 cm² or less for the selected anatomic group." },
    ...(addOnUnits ? [{ code: addon, units: addOnUnits, role: "add-on" as const, label: "Additional full-thickness autograft area", rationale: "Each additional 20 cm² or part thereof." }] : []),
  ];
}

function buildServiceLines(input: BurnCaseInput, totalTbsa: number): CandidateServiceLine[] {
  const service = input.service;
  if (!service.performed || service.type === "assessment_only") return [];
  const area = Math.max(0, service.areaCm2 ?? 0);
  const group = service.siteGroup;

  if (service.type === "local_burn_treatment") {
    if (service.anesthesiaUsed) {
      return [{ code: "16010–16015", units: 1, role: "review", label: "Burn treatment under anesthesia", rationale: "Exact code depends on documented treated extent and anesthesia; verify the current licensed CPT descriptor." }];
    }
    const hasPartialOrFull = input.regions.some((region) => region.burnDepth >= 2);
    if (!hasPartialOrFull) return [{ code: "16000", units: 1, role: "primary", label: "Initial local treatment of superficial burn", rationale: "Use only when initial local treatment was actually performed." }];
    const code = totalTbsa < 5 ? "16020" : totalTbsa <= 10 ? "16025" : "16030";
    return [{ code, units: 1, role: "primary", label: "Local treatment of partial-thickness burn", rationale: `Selected from documented treated extent (${round(totalTbsa)}% TBSA); confirm the service and current CPT descriptor.` }];
  }

  if (service.type === "escharotomy") {
    const additional = Math.max(0, Math.floor(service.additionalIncisions ?? 0));
    return [
      { code: "16035", units: 1, role: "primary", label: "Initial escharotomy incision", rationale: "Requires a documented escharotomy incision, not routine debridement." },
      ...(additional ? [{ code: "16036", units: additional, role: "add-on" as const, label: "Additional escharotomy incision", rationale: "Each additional incision documented." }] : []),
    ];
  }

  if (service.type === "npwt") {
    return [{ code: "97605–97608", units: 1, role: "review", label: "Negative-pressure wound therapy", rationale: "Exact code depends on durable versus disposable equipment and total treated surface area." }];
  }

  if (service.type === "non_burn_debridement") {
    if (input.regions.length) return [];
    return [{ code: "11042–11047 / 97597–97598", units: 1, role: "review", label: "Non-burn wound debridement", rationale: "Choose only from documented deepest tissue removed and total surface area; these families are not for burned surfaces." }];
  }

  if (!group || area <= 0) return [];
  if (service.type !== "full_thickness_autograft" && group !== "trunk_limbs" && group !== "special_sites") return [];
  const special = group !== "trunk_limbs";
  if (service.type === "surgical_preparation") return preparationLines(area, special);
  if (service.type === "split_thickness_autograft") return autograftLines(area, "split", group);
  if (service.type === "full_thickness_autograft") return autograftLines(area, "full", group);
  if (service.type === "skin_substitute_sheet") {
    if (service.productForm !== "sheet") return [];
    const lines = areaLines(
      area,
      special
        ? { smallPrimary: "15275", smallAddon: "15276", largePrimary: "15277", largeAddon: "15278" }
        : { smallPrimary: "15271", smallAddon: "15272", largePrimary: "15273", largeAddon: "15274" },
      "Sheet-form skin substitute application",
    );
    if (service.productHcpcs?.trim()) {
      lines.push({ code: service.productHcpcs.trim().toUpperCase(), units: 1, role: "product", label: service.productName?.trim() || "Skin substitute product", rationale: "Units are intentionally held for package, billing-unit, and wastage verification." });
    }
    return lines;
  }
  return [];
}

export function analyzeBurnCase(input: BurnCaseInput): BurnAnalysis {
  const age = Number.isFinite(input.patientAge) ? clamp(input.patientAge, 0, 120) : 0;
  const band = ageBandIndex(age);
  const seen = new Set<string>();
  const warnings: string[] = [];
  const regionResults: RegionCalculation[] = [];

  for (const region of input.regions) {
    const surface = region.surface || "circumferential";
    const regionKey = `${region.regionId}:${surface}`;
    if (seen.has(regionKey)) {
      warnings.push(`${BURN_REGIONS[region.regionId].label} (${surface}) was entered more than once; only the first entry was used.`);
      continue;
    }
    seen.add(regionKey);
    const definition = BURN_REGIONS[region.regionId];
    const percentBurned = clamp(Number(region.percentBurned) || 0, 0, 100);
    const regionMaximum = round(definition.percentages[band] * burnRegionSurfaceFactor(region.regionId, surface));
    const contributedTbsa = round(regionMaximum * (percentBurned / 100));
    const surfaceLabel = SINGLE_SURFACE_REGIONS.has(region.regionId) || surface === "circumferential" ? "" : ` — ${surface}`;
    regionResults.push({ ...region, surface, percentBurned, label: `${definition.label}${surfaceLabel}`, regionMaximum, contributedTbsa, siteFamily: definition.siteFamily });
  }

  const superficialTbsa = round(regionResults.filter((region) => region.burnDepth === 1).reduce((sum, region) => sum + region.contributedTbsa, 0));
  const totalTbsa = round(regionResults.filter((region) => region.burnDepth >= 2).reduce((sum, region) => sum + region.contributedTbsa, 0));
  const thirdDegreeTbsa = round(regionResults.filter((region) => region.burnDepth === 3).reduce((sum, region) => sum + region.contributedTbsa, 0));
  const code = input.encounter === "sequela" ? null : extentCode(totalTbsa, thirdDegreeTbsa, input.injuryType);
  const families = new Map<string, string[]>();
  for (const region of regionResults) {
    const current = families.get(region.siteFamily) ?? [];
    current.push(region.label);
    families.set(region.siteFamily, current);
  }

  const serviceLines = buildServiceLines(input, totalTbsa);
  const service = input.service;
  const auditGates: AuditGate[] = [
    {
      id: "site-depth",
      status: regionResults.length ? "pass" : "hold",
      title: "Burn site and depth",
      detail: regionResults.length ? `${regionResults.length} unique mapped surface${regionResults.length === 1 ? "" : "s"} documented.` : "Document each affected site, surface, and burn depth before coding.",
    },
    {
      id: "extent",
      status: totalTbsa > 0 ? "pass" : superficialTbsa > 0 ? "review" : "hold",
      title: "TBSA calculation",
      detail: superficialTbsa > 0 ? `Superficial burns (${superficialTbsa}%) were tracked but excluded from TBSA.` : totalTbsa > 0 ? "Partial- and full-thickness extent calculated with the age-adjusted Lund–Browder chart." : "No partial- or full-thickness TBSA is available.",
    },
    {
      id: "performed-service",
      status: service.type === "assessment_only" ? "review" : service.performed ? "pass" : "hold",
      title: "Performed service",
      detail: service.performed ? BURN_SERVICE_LABELS[service.type] : "A CPT candidate is withheld until the performed service is confirmed.",
    },
  ];

  const requiresArea = ["surgical_preparation", "split_thickness_autograft", "full_thickness_autograft", "skin_substitute_sheet"].includes(service.type);
  if (requiresArea) {
    const siteGroupCompatible = service.type === "full_thickness_autograft"
      ? Boolean(service.siteGroup)
      : service.siteGroup === "trunk_limbs" || service.siteGroup === "special_sites";
    auditGates.push({
      id: "measurements",
      status: (service.areaCm2 ?? 0) > 0 && siteGroupCompatible ? "pass" : "hold",
      title: "Site group and measured area",
      detail: (service.areaCm2 ?? 0) > 0 && siteGroupCompatible ? `${service.areaCm2} cm² entered for the selected anatomic group.` : "Enter the treated area in cm² and select an anatomic group valid for this service family.",
    });
  }

  if (service.type === "skin_substitute_sheet") {
    const productReady = Boolean(service.productHcpcs?.trim() && service.productName?.trim());
    const jurisdictionReady = Boolean(service.state?.trim() && service.mac?.trim());
    auditGates.push(
      { id: "product", status: service.productForm === "sheet" && productReady ? "pass" : "hold", title: "Product identity and form", detail: service.productForm !== "sheet" ? "Non-sheet and injected products require a current HCPCS/application-code review." : productReady ? "Product name and HCPCS were entered; verify billing units and package traceability." : "Enter the exact product name and current HCPCS code." },
      { id: "jurisdiction", status: jurisdictionReady ? "pass" : "hold", title: "MAC coverage and effective date", detail: jurisdictionReady ? `${service.mac}, ${service.state}; verify the policy effective on ${input.serviceDate || "the date of service"}.` : "State and MAC are required because skin-substitute coverage limits are jurisdiction-specific." },
      { id: "wastage", status: "review", title: "Product units and wastage", detail: "Verify package size, applied/discarded amount, HCPCS billing unit, and current JW/JZ instructions; modifiers are not auto-applied." },
    );
  }

  if (["surgical_preparation", "split_thickness_autograft", "full_thickness_autograft", "skin_substitute_sheet"].includes(service.type)) {
    auditGates.push({ id: "ncci", status: "review", title: "NCCI bundling review", detail: "Routine debridement is included in graft/application work. Separately report recipient-site preparation only when its distinct excisional requirements are documented." });
  }

  if (service.type === "non_burn_debridement" && regionResults.length) warnings.push("General wound-debridement families were withheld because burned surfaces are documented; review the burn-treatment family instead.");
  if (input.encounter === "sequela") warnings.push("T31/T32 extent codes are not assigned for sequela encounters under the FY 2026 ICD-10-CM guidelines.");
  if (service.type === "skin_substitute_sheet" && service.productForm === "non_sheet") warnings.push("This release does not auto-code non-sheet or injected skin-substitute products because 2026 application-code treatment is product/form dependent.");

  return {
    totalTbsa,
    superficialTbsa,
    thirdDegreeTbsa,
    extentCode: code,
    extentCodeRole: code ? "additional" : "not-applicable",
    regionResults,
    siteFamilies: Array.from(families.entries()).map(([family, regions]) => ({ family, regions, prompt: "Choose the exact code only after subsite, depth, laterality, and encounter are documented." })),
    serviceLines,
    auditGates,
    warnings,
  };
}
