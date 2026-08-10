import assert from "node:assert/strict";
import test from "node:test";
import { evaluateNicuCase, nicuAgeOnDate, type NicuCaseInput, type NicuDailyInput } from "../shared/nicu-coding";

const day = (id: string, serviceDate: string, overrides: Partial<NicuDailyInput> = {}): NicuDailyInput => ({
  id, serviceDate, presentWeightGrams: 1400, careLevel: "critical", criticalStatusDocumented: true,
  intensiveServicesDocumented: false, recoveringLowBirthWeightInfant: false, directingProviderId: "NPI-100",
  directingProviderRole: "physician", providerDirectedCare: true, bedsideExamDocumented: true,
  planOfCareDirected: true, anotherProviderReportedPerDiem: false, sameDayIntensiveToCriticalTransfer: false,
  differentGroupAtCriticalTransfer: false, procedures: [], ...overrides,
});

const input = (days: NicuDailyInput[], overrides: Partial<NicuCaseInput> = {}): NicuCaseInput => ({
  patientName: "Baby Test", dateOfBirth: "2026-01-01", admissionDate: "2026-01-01", admissionOrigin: "birth-hospital",
  birthWeightGrams: 1200, claimScope: "practitioner", payerType: "medicaid", payerName: "State Medicaid",
  payerJurisdiction: "MD", payerPolicyVerified: true, payerPolicyCurrent: true,
  diagnoses: [{ id: "default-diagnosis", code: "P07.15", providerDocumented: true, clinicallySignificant: true, presentOnAdmission: "yes" }],
  days, ...overrides,
});

test("calendar age uses DOB and includes day 28 in neonatal band", () => {
  assert.deepEqual(nicuAgeOnDate("2026-01-01", "2026-01-29"), { ageDays: 28, ageBand: "neonate-0-28d" });
  assert.deepEqual(nicuAgeOnDate("2026-01-01", "2026-01-30"), { ageDays: 29, ageBand: "infant-29d-<2y" });
});

test("first and subsequent neonatal critical days sequence correctly", () => {
  const result = evaluateNicuCase(input([day("d1", "2026-01-01"), day("d2", "2026-01-02")]));
  assert.deepEqual(result.days.map((item) => item.code), ["99468", "99469"]);
  assert.equal(result.status, "ready");
});

test("age-band transition creates the age-appropriate initial critical service", () => {
  const result = evaluateNicuCase(input([day("d28", "2026-01-29"), day("d29", "2026-01-30")]));
  assert.deepEqual(result.days.map((item) => item.code), ["99468", "99471"]);
  assert.equal(result.days[1].codeRole, "initial");
});

test("critical care through the fifth year uses its own initial and subsequent pair", () => {
  const result = evaluateNicuCase(input([day("one", "2028-01-01"), day("two", "2028-01-02")], { admissionDate: "2028-01-01" }));
  assert.deepEqual(result.days.map((item) => item.code), ["99475", "99476"]);
});

test("older-than-five path is held for time-based general critical care", () => {
  const result = evaluateNicuCase(input([day("older", "2032-01-02")], { admissionDate: "2032-01-02" }));
  assert.equal(result.days[0].code, null);
  assert.match(result.days[0].blockers.join(" "), /outside.*age range/i);
});

test("critical status cannot be inferred from a selected care level", () => {
  const result = evaluateNicuCase(input([day("unverified", "2026-01-01", { criticalStatusDocumented: null })]));
  assert.equal(result.status, "hold");
  assert.match(result.blockers.join(" "), /explicitly documented/i);
});

test("initial neonatal intensive day is distinct from continuing weight tiers", () => {
  const result = evaluateNicuCase(input([
    day("initial", "2026-01-01", { careLevel: "intensive", criticalStatusDocumented: false, intensiveServicesDocumented: true, recoveringLowBirthWeightInfant: false }),
    day("continuing", "2026-01-02", { careLevel: "intensive", criticalStatusDocumented: false, intensiveServicesDocumented: true, recoveringLowBirthWeightInfant: true, presentWeightGrams: 1499 }),
  ]));
  assert.deepEqual(result.days.map((item) => item.code), ["99477", "99478"]);
});

test("continuing intensive tiers use exact present-weight boundaries", () => {
  const result = evaluateNicuCase(input([
    day("critical", "2026-01-01"),
    day("w1499", "2026-01-02", { careLevel: "intensive", intensiveServicesDocumented: true, recoveringLowBirthWeightInfant: true, presentWeightGrams: 1499 }),
    day("w1500", "2026-01-03", { careLevel: "intensive", intensiveServicesDocumented: true, recoveringLowBirthWeightInfant: true, presentWeightGrams: 1500 }),
    day("w2501", "2026-01-04", { careLevel: "intensive", intensiveServicesDocumented: true, recoveringLowBirthWeightInfant: true, presentWeightGrams: 2501 }),
  ]));
  assert.deepEqual(result.days.slice(1).map((item) => item.code), ["99478", "99479", "99480"]);
});

test("birth weight never substitutes for missing present weight", () => {
  const result = evaluateNicuCase(input([
    day("critical", "2026-01-01"),
    day("missing", "2026-01-02", { careLevel: "intensive", intensiveServicesDocumented: true, recoveringLowBirthWeightInfant: true, presentWeightGrams: undefined }),
  ], { birthWeightGrams: 900 }));
  assert.equal(result.days[1].code, null);
  assert.match(result.days[1].blockers.join(" "), /present body weight/i);
});

test("continuing intensive code requires prior per-diem history", () => {
  const result = evaluateNicuCase(input([day("late", "2026-02-01", { careLevel: "intensive", intensiveServicesDocumented: true, recoveringLowBirthWeightInfant: true })], { admissionDate: "2026-02-01" }));
  assert.match(result.days[0].blockers.join(" "), /earlier critical or intensive/i);
});

test("weight above 5000 grams leaves the continuing NICU tier", () => {
  const result = evaluateNicuCase(input([
    day("critical", "2026-01-01"),
    day("large", "2026-01-02", { careLevel: "intensive", intensiveServicesDocumented: true, recoveringLowBirthWeightInfant: true, presentWeightGrams: 5001 }),
  ]));
  assert.equal(result.days[1].code, null);
  assert.match(result.days[1].blockers.join(" "), /exceeds 5000/i);
});

test("one directing provider per diem conflict holds the day", () => {
  const result = evaluateNicuCase(input([day("conflict", "2026-01-01", { anotherProviderReportedPerDiem: true })]));
  assert.match(result.days[0].blockers.join(" "), /another provider/i);
});

test("provider bedside and plan direction are separate evidence gates", () => {
  const result = evaluateNicuCase(input([day("provider", "2026-01-01", { bedsideExamDocumented: false, planOfCareDirected: null })]));
  assert.match(result.days[0].blockers.join(" "), /bedside examination/i);
  assert.match(result.days[0].blockers.join(" "), /plan of care/i);
});

test("unknown NPP reporting eligibility is held", () => {
  const result = evaluateNicuCase(input([day("npp", "2026-01-01", { directingProviderRole: "unknown" })]));
  assert.match(result.days[0].blockers.join(" "), /eligible physician or independently reporting NPP/i);
});

test("duplicate service dates cannot create duplicate per-diem records", () => {
  const result = evaluateNicuCase(input([day("one", "2026-01-01"), day("two", "2026-01-01")]));
  assert.ok(result.days.every((item) => item.status === "hold"));
  assert.match(result.blockers.join(" "), /only one.*per-diem/i);
});

test("facility scope never releases professional per-diem CPT", () => {
  const result = evaluateNicuCase(input([day("facility", "2026-01-01")], { claimScope: "facility" }));
  assert.equal(result.days[0].code, null);
  assert.equal(result.days[0].codeRole, "facility-pathway");
  assert.equal(result.status, "hold");
  assert.match(result.blockers.join(" "), /facility NICU billing/i);
});

test("discharge management selection requires documented minutes", () => {
  const held = evaluateNicuCase(input([day("discharge", "2026-01-01", { careLevel: "discharge", dischargeManagementMinutes: undefined })]));
  assert.equal(held.days[0].status, "hold");
  const complete = evaluateNicuCase(input([day("discharge", "2026-01-01", { careLevel: "discharge", dischargeManagementMinutes: 31 })]));
  assert.equal(complete.days[0].code, "99239");
});

test("routine and comfort care do not masquerade as critical care", () => {
  const result = evaluateNicuCase(input([day("routine", "2026-01-01", { careLevel: "routine" })]));
  assert.equal(result.days[0].code, null);
  assert.match(result.days[0].blockers.join(" "), /licensed CPT rules adapter/i);
});

test("Z38 is held outside the birth hospital", () => {
  const result = evaluateNicuCase(input([day("day", "2026-01-01")], { admissionOrigin: "transfer-in", diagnoses: [{ id: "z38", code: "Z38.00", providerDocumented: true, clinicallySignificant: true, presentOnAdmission: "yes" }] }));
  assert.equal(result.diagnoses[0].status, "held");
  assert.match(result.diagnoses[0].rationale, /birth record/i);
});

test("diagnoses are retained only when documented and clinically significant", () => {
  const result = evaluateNicuCase(input([day("day", "2026-01-01")], { diagnoses: [
    { id: "accepted", code: "P07.15", providerDocumented: true, clinicallySignificant: true },
    { id: "held", code: "P28.0", providerDocumented: null, clinicallySignificant: true },
  ] }));
  assert.deepEqual(result.diagnoses.map((item) => item.status), ["accepted", "held"]);
});

test("a claim-ready worksheet requires an accepted diagnosis", () => {
  const result = evaluateNicuCase(input([day("day", "2026-01-01")], { diagnoses: [] }));
  assert.equal(result.status, "hold");
  assert.match(result.blockers.join(" "), /at least one provider-documented/i);
});

test("CMS-listed practitioner services are included while other procedures require NCCI", () => {
  const result = evaluateNicuCase(input([day("procedures", "2026-01-01", { procedures: [
    { id: "line", code: "36410", performed: true, separatelyIdentifiable: true },
    { id: "chest", code: "32551", performed: true, separatelyIdentifiable: true },
  ] })]));
  assert.deepEqual(result.days[0].procedureReviews.map((item) => item.status), ["included", "ncci-review"]);
  assert.ok(result.ncciCodes.includes("32551"));
});

test("same-day transition exception remains a manual payer review", () => {
  const result = evaluateNicuCase(input([day("transition", "2026-01-01", { sameDayIntensiveToCriticalTransfer: true, differentGroupAtCriticalTransfer: true })]));
  assert.match(result.days[0].warnings.join(" "), /narrow.*different-physician/i);
});

test("payer policy and jurisdiction are release gates", () => {
  const result = evaluateNicuCase(input([day("day", "2026-01-01")], { payerJurisdiction: "", payerPolicyCurrent: null }));
  assert.match(result.blockers.join(" "), /jurisdiction/i);
  assert.match(result.blockers.join(" "), /currency/i);
});

test("engine always requires licensed verification and human approval", () => {
  const result = evaluateNicuCase(input([day("day", "2026-01-01")]));
  assert.equal(result.licensedCptVerificationRequired, true);
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.autonomousClaimSubmissionAllowed, false);
});
