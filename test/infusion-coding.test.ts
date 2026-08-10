import assert from "node:assert/strict";
import test from "node:test";
import { evaluateInfusionCase, lookupInfusionDrugs, type InfusionAdministrationInput, type InfusionCaseInput } from "../shared/infusion-coding";
import { CMS_INFUSION_ASP_2026_Q3 } from "../server/infusion-cms-asp-data";

const row = (id: string, overrides: Partial<InfusionAdministrationInput> = {}): InfusionAdministrationInput => ({
  id, drugName: `Drug ${id}`, hcpcsCode: "J9271", dose: 100, doseUnit: "MG", discardedDose: 0,
  category: "therapeutic", method: "infusion", startTime: "09:00", stopTime: "10:00", accessSite: "right peripheral IV",
  medicallyNecessary: true, carrierFluidOnly: false, providerPresentForPush: true, singleDoseContainer: true,
  jwJzPolicyApplies: true, separatelyPayableDrug: true, ...overrides,
});
const caseInput = (administrations: InfusionAdministrationInput[], overrides: Partial<InfusionCaseInput> = {}): InfusionCaseInput => ({
  serviceDate: "2026-08-10", setting: "hospital-outpatient", separateAccessSitesMedicallyNecessary: false, administrations, ...overrides,
});

test("official July 2026 CMS package is compiled with provenance", () => {
  assert.equal(Object.keys(CMS_INFUSION_ASP_2026_Q3.entries).length, 890);
  assert.equal(Object.keys(CMS_INFUSION_ASP_2026_Q3.aliases).length, 1052);
  assert.equal(CMS_INFUSION_ASP_2026_Q3.sourceHashes.paymentLimits, "c73883dbddb5e5eb8397a2e5fa008e71760e81236c9ee5b5d92f4918daeead2e");
});

test("drug lookup resolves brand name and exact HCPCS", () => {
  assert.equal(lookupInfusionDrugs("Keytruda", CMS_INFUSION_ASP_2026_Q3)[0].code, "J9271");
  assert.equal(lookupInfusionDrugs("J9312", CMS_INFUSION_ASP_2026_Q3)[0].dosageText, "10 MG");
});

test("hospital outpatient selects the highest documented facility hierarchy service", () => {
  const result = evaluateInfusionCase(caseInput([
    row("therapeutic", { startTime: "08:00", stopTime: "08:45" }),
    row("chemo", { drugName: "Keytruda", category: "chemotherapy", startTime: "09:00", stopTime: "10:00" }),
  ]), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(result.initialSelectionMode, "facility-hierarchy");
  assert.ok(result.administrationLines.some((line) => line.code === "96413" && line.role === "initial"));
  assert.ok(result.administrationLines.some((line) => line.code === "96367"));
});

test("physician office selects the chronologically first documented IV service", () => {
  const result = evaluateInfusionCase(caseInput([
    row("therapeutic", { startTime: "08:00", stopTime: "08:45" }),
    row("chemo", { category: "chemotherapy", startTime: "09:00", stopTime: "10:00" }),
  ], { setting: "physician-office" }), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(result.initialSelectionMode, "chronological");
  assert.ok(result.administrationLines.some((line) => line.code === "96365" && line.role === "initial"));
});

test("multiple access labels do not create multiple initials without necessity support", () => {
  const result = evaluateInfusionCase(caseInput([
    row("one", { accessSite: "lumen A" }), row("two", { accessSite: "lumen B", category: "chemotherapy" }),
  ]), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(result.administrationLines.filter((line) => line.role === "initial").length, 1);
  assert.match(result.warnings.join(" "), /Multiple access sites/i);
});

test("separate medically necessary vascular sites may each receive an initial service", () => {
  const result = evaluateInfusionCase(caseInput([
    row("one", { accessSite: "right peripheral IV" }), row("two", { accessSite: "left peripheral IV", category: "chemotherapy" }),
  ], { separateAccessSitesMedicallyNecessary: true }), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(result.administrationLines.filter((line) => line.role === "initial").length, 2);
});

test("carrier fluid and concurrent hydration are incidental", () => {
  const carrier = evaluateInfusionCase(caseInput([row("saline", { category: "hydration", drugName: "Normal saline", carrierFluidOnly: true, hcpcsCode: "J7030" })]), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(carrier.administrations[0].status, "incidental");
  assert.equal(carrier.administrationLines.length, 0);
  const concurrent = evaluateInfusionCase(caseInput([
    row("drug", { startTime: "09:00", stopTime: "10:00" }),
    row("hydration", { category: "hydration", drugName: "Normal saline", hcpcsCode: "J7030", startTime: "09:15", stopTime: "10:15", carrierFluidOnly: false }),
  ]), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(concurrent.administrations.find((item) => item.id === "hydration")?.status, "incidental");
});

test("short hydration and fifteen-minute infusion are held", () => {
  const hydration = evaluateInfusionCase(caseInput([row("hydration", { category: "hydration", carrierFluidOnly: false, startTime: "09:00", stopTime: "09:30" })]), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(hydration.status, "hold");
  assert.match(hydration.blockers.join(" "), /exceed 30 minutes/i);
  const short = evaluateInfusionCase(caseInput([row("short", { startTime: "09:00", stopTime: "09:15" })]), CMS_INFUSION_ASP_2026_Q3);
  assert.match(short.blockers.join(" "), /push-method review/i);
});

test("additional infusion hours are derived from verified duration", () => {
  const result = evaluateInfusionCase(caseInput([row("chemo", { category: "chemotherapy", startTime: "09:00", stopTime: "11:00" })]), CMS_INFUSION_ASP_2026_Q3);
  assert.ok(result.administrationLines.some((line) => line.code === "96413"));
  assert.equal(result.administrationLines.find((line) => line.code === "96415")?.units, 1);
});

test("different sequential chemotherapy drug receives the sequential service", () => {
  const result = evaluateInfusionCase(caseInput([
    row("one", { drugName: "Keytruda", category: "chemotherapy", startTime: "09:00", stopTime: "10:00" }),
    row("two", { drugName: "Paclitaxel", hcpcsCode: "J9267", category: "chemotherapy", startTime: "10:15", stopTime: "11:15" }),
  ]), CMS_INFUSION_ASP_2026_Q3);
  assert.ok(result.administrationLines.some((line) => line.code === "96417"));
});

test("only one concurrent therapeutic infusion unit is created", () => {
  const result = evaluateInfusionCase(caseInput([
    row("chemo", { category: "chemotherapy", startTime: "09:00", stopTime: "10:30" }),
    row("antiemetic-one", { drugName: "Ondansetron", hcpcsCode: "J2405", startTime: "09:10", stopTime: "09:40" }),
    row("antiemetic-two", { drugName: "Dexamethasone", hcpcsCode: "J1100", startTime: "09:20", stopTime: "09:50" }),
  ]), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(result.administrationLines.find((line) => line.code === "96368")?.units, 1);
  assert.ok(result.administrations.some((item) => item.status === "held"));
});

test("repeat therapeutic push requires thirty minutes", () => {
  const basePush = row("push-one", { method: "push", startTime: "09:00", stopTime: "09:05", drugName: "Ondansetron", hcpcsCode: "J2405" });
  const early = evaluateInfusionCase(caseInput([basePush, row("push-two", { method: "push", startTime: "09:20", stopTime: "09:25", drugName: "Ondansetron", hcpcsCode: "J2405" })]), CMS_INFUSION_ASP_2026_Q3);
  assert.match(early.blockers.join(" "), /less than 30 minutes/i);
  const later = evaluateInfusionCase(caseInput([basePush, row("push-three", { method: "push", startTime: "09:35", stopTime: "09:40", drugName: "Ondansetron", hcpcsCode: "J2405" })]), CMS_INFUSION_ASP_2026_Q3);
  assert.ok(later.administrationLines.some((line) => line.code === "96376"));
});

test("CMS drug dosage converts to units and retains Q3 reference context", () => {
  const result = evaluateInfusionCase(caseInput([row("keytruda", { drugName: "Keytruda", dose: 200, doseUnit: "MG", hcpcsCode: "J9271" })]), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(result.drugLines[0].units, 200);
  assert.equal(result.drugLines[0].modifier, "JZ");
  assert.equal(result.drugLines[0].paymentLimitReference, 60.645);
});

test("10 mg billing unit converts rituximab dose correctly", () => {
  const result = evaluateInfusionCase(caseInput([row("rituxan", { drugName: "Rituxan", dose: 750, hcpcsCode: "J9312" })]), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(result.drugLines[0].units, 75);
});

test("JW line uses only whole billable units not consumed by administered rounding", () => {
  const result = evaluateInfusionCase(caseInput([row("waste", { dose: 95, discardedDose: 5 })]), CMS_INFUSION_ASP_2026_Q3);
  assert.deepEqual(result.drugLines.map((line) => [line.modifier, line.units]), [[null, 95], ["JW", 5]]);
  const rounded = evaluateInfusionCase(caseInput([row("small-waste", { hcpcsCode: "J9312", dose: 7, discardedDose: 3 })]), CMS_INFUSION_ASP_2026_Q3);
  assert.deepEqual(rounded.drugLines.map((line) => [line.modifier, line.units]), [["JZ", 1]]);
});

test("compatible weight units convert before billing-unit calculation", () => {
  const result = evaluateInfusionCase(caseInput([row("converted", { dose: 0.2, doseUnit: "G" })]), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(result.drugLines[0].units, 200);
});

test("stale ASP quarter, ASC, and inpatient pathways are held", () => {
  assert.match(evaluateInfusionCase(caseInput([row("one")], { serviceDate: "2026-10-01" }), CMS_INFUSION_ASP_2026_Q3).blockers.join(" "), /matching quarter/i);
  assert.match(evaluateInfusionCase(caseInput([row("one")], { setting: "asc" }), CMS_INFUSION_ASP_2026_Q3).blockers.join(" "), /ASC payable procedure/i);
  assert.match(evaluateInfusionCase(caseInput([row("one")], { setting: "inpatient" }), CMS_INFUSION_ASP_2026_Q3).blockers.join(" "), /inpatient payment pathway/i);
});

test("engine requires human approval and cannot submit claims", () => {
  const result = evaluateInfusionCase(caseInput([row("one")]), CMS_INFUSION_ASP_2026_Q3);
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.autonomousClaimSubmissionAllowed, false);
});
