import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCabgCase, professionalCabgCodes, type CabgCaseInput, type CabgHarvestInput, type CabgTargetInput } from "../shared/cabg-coding";

const target = (overrides: Partial<CabgTargetInput> = {}): CabgTargetInput => ({
  id: "target-" + Math.random(), targetVessel: "LAD", conduitKind: "arterial", conduitSource: "left-internal-mammary",
  inflowSource: "left-internal-mammary", approach: "open", completed: true, sourceVerified: true, ...overrides,
});
const harvest = (overrides: Partial<CabgHarvestInput> = {}): CabgHarvestInput => ({
  id: "harvest-" + Math.random(), source: "left-saphenous", method: "endoscopic", performed: true, sourceVerified: true, ...overrides,
});
const baseCase = (overrides: Partial<CabgCaseInput> = {}): CabgCaseInput => ({
  patientName: "Example Patient", dateOfBirth: "1960-01-01", serviceDate: "2026-08-10", claimScope: "professional",
  payerType: "medicare", payerName: "Medicare", payerJurisdiction: "J-L", payerPolicyVerified: true, payerPolicyCurrent: true,
  operativeReportSigned: true, surgeryCompleted: true, primarySurgeon: "Dr Example", surgeonEligible: true,
  diagnoses: [{ id: "dx-1", code: "I25.10", description: "CAD", providerDocumented: true, clinicallySupported: true }],
  targets: [target()], harvests: [], redo: { isReoperation: false, previousCabgOrValve: false, priorOperationDate: "", explicitlyDocumented: false },
  coronaryEndarterectomyVessels: 0, coronaryEndarterectomyDocumented: false, sameDayProcedureCodes: [], combinedProceduresSourceVerified: false,
  ...overrides,
});

test("arterial CABG families count completed distal targets", () => {
  assert.deepEqual(professionalCabgCodes(1, 0), ["33533"]);
  assert.deepEqual(professionalCabgCodes(2, 0), ["33534"]);
  assert.deepEqual(professionalCabgCodes(3, 0), ["33535"]);
  assert.deepEqual(professionalCabgCodes(6, 0), ["33536"]);
});

test("venous-only mapping skips inactive 33515", () => {
  assert.deepEqual(professionalCabgCodes(1, 5), ["33533", "33522"]);
  assert.deepEqual(professionalCabgCodes(0, 5), ["33514"]);
  assert.deepEqual(professionalCabgCodes(0, 6), ["33516"]);
  assert.ok(!professionalCabgCodes(0, 6).includes("33515"));
});

test("combined arterial and venous mapping skips inactive 33520", () => {
  assert.deepEqual(professionalCabgCodes(1, 3), ["33533", "33519"]);
  assert.deepEqual(professionalCabgCodes(1, 4), ["33533", "33521"]);
  assert.ok(!professionalCabgCodes(1, 4).includes("33520"));
});

test("planned or unverified distal rows do not become releasable grafts", () => {
  const result = evaluateCabgCase(baseCase({ targets: [target({ completed: null }), target({ targetVessel: "OM1", sourceVerified: null })] }));
  assert.equal(result.totalTargets, 1);
  assert.equal(result.status, "hold");
  assert.match(result.blockers.join(" "), /completed and source verified/i);
});

test("endoscopic saphenous and radial harvests use distinct candidates", () => {
  const result = evaluateCabgCase(baseCase({ targets: [target(), target({ targetVessel: "PDA", conduitKind: "venous", conduitSource: "left-saphenous", inflowSource: "aorta" })], harvests: [harvest(), harvest({ source: "right-radial" })] }));
  assert.ok(result.claimCodes.includes("33508"));
  assert.ok(result.claimCodes.includes("33509"));
});

test("open radial harvest does not map to endoscopic radial harvest", () => {
  const result = evaluateCabgCase(baseCase({ harvests: [harvest({ source: "left-radial", method: "open" })] }));
  assert.ok(result.claimCodes.includes("35600"));
  assert.ok(!result.claimCodes.includes("33509"));
});

test("redo add-on requires explicit prior CABG or valve surgery more than one calendar month earlier", () => {
  const held = evaluateCabgCase(baseCase({ redo: { isReoperation: true, previousCabgOrValve: true, explicitlyDocumented: true, priorOperationDate: "2026-07-10" } }));
  assert.equal(held.candidates.find((row) => row.code === "33530")?.status, "held");
  const ready = evaluateCabgCase(baseCase({ redo: { isReoperation: true, previousCabgOrValve: true, explicitlyDocumented: true, priorOperationDate: "2026-07-09" } }));
  assert.equal(ready.candidates.find((row) => row.code === "33530")?.status, "candidate");
});

test("coronary endarterectomy applies the current three-unit MUE hold", () => {
  const result = evaluateCabgCase(baseCase({ coronaryEndarterectomyVessels: 4, coronaryEndarterectomyDocumented: true }));
  const candidate = result.candidates.find((row) => row.code === "33572");
  assert.equal(candidate?.units, 4);
  assert.equal(candidate?.status, "held");
  assert.match(candidate?.blockers.join(" ") || "", /MUE is 3/i);
});

test("inpatient PCS groups targets only when approach device and inflow match", () => {
  const result = evaluateCabgCase(baseCase({ claimScope: "inpatient-facility", targets: [target(), target({ targetVessel: "OM1" })] }));
  assert.ok(result.claimCodes.includes("02110Z9"));
  assert.equal(result.candidates.filter((row) => row.role === "facility-bypass").length, 1);
});

test("inpatient PCS splits LIMA and saphenous-aortic bypasses", () => {
  const result = evaluateCabgCase(baseCase({ claimScope: "inpatient-facility", targets: [target(), target({ targetVessel: "PDA", conduitKind: "venous", conduitSource: "left-saphenous", inflowSource: "aorta" })] }));
  assert.ok(result.claimCodes.includes("02100Z9"));
  assert.ok(result.claimCodes.includes("021009W"));
});

test("facility harvest is a separate PCS objective", () => {
  const result = evaluateCabgCase(baseCase({ claimScope: "inpatient-facility", harvests: [harvest()] }));
  assert.ok(result.claimCodes.includes("06BQ4ZZ"));
});

test("a code family never creates a diagnosis or coverage finding", () => {
  const result = evaluateCabgCase(baseCase({ diagnoses: [], payerPolicyVerified: null, payerPolicyCurrent: null }));
  assert.equal(result.diagnoses.length, 0);
  assert.equal(result.coverage.status, "review");
  assert.match(result.blockers.join(" "), /diagnosis/i);
});

test("same-day codes remain held until explicitly source verified", () => {
  const result = evaluateCabgCase(baseCase({ sameDayProcedureCodes: ["33430"], combinedProceduresSourceVerified: null }));
  assert.ok(!result.claimCodes.includes("33430"));
  assert.match(result.blockers.join(" "), /same-day/i);
});

test("human release and current code edit gates always remain", () => {
  const result = evaluateCabgCase(baseCase());
  assert.equal(result.currentNcciRequired, true);
  assert.equal(result.currentMueRequired, true);
  assert.equal(result.currentAocRequired, true);
  assert.equal(result.modifiersNeverAutomatic, true);
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.autonomousClaimSubmissionAllowed, false);
});
