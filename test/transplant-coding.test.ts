import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateAcquisition,
  evaluateDonor,
  evaluateDrugBenefit,
  evaluateTransplantCase,
  evaluateTransplantCoverage,
  validateTransplantProgram,
  type TransplantCaseInput,
} from "../shared/transplant-coding";

const base: TransplantCaseInput = {
  serviceDate: "2026-08-10",
  organ: "kidney",
  ageCategory: "adult",
  payerMode: "medicare-ffs",
  purpose: "transplant",
  facilityCcn: "123456",
  diagnosisCodes: ["N18.6"],
  programApprovals: [{ organ: "kidney", ageCategory: "adult", effectiveFrom: "2026-01-01", status: "approved", source: "pecos", ccn: "123456" }],
  clinical: { endStageOrganFailure: true, transplantIndicationDocumented: true },
  operative: { finalOperativeReport: true, organImplanted: true, licensedProfessionalCode: "LICENSED-ADAPTER-CODE", icd10PcsCode: "0TY00Z0", icd10PcsVersion: "FY2026", dischargeDate: "2026-08-20", msDrgGrouperVersion: "FY2026-v43" },
  acquisition: { costItems: [{ id: "1", description: "Donor evaluation", amountCents: 10000, category: "direct-organ", organ: "kidney" }], sacReconciled: true },
};

test("exact effective PECOS organ approval passes", () => {
  assert.equal(validateTransplantProgram(base).status, "pass");
});

test("parent or unrelated program never substitutes for exact organ", () => {
  const result = validateTransplantProgram({ ...base, organ: "heart", programApprovals: base.programApprovals });
  assert.equal(result.status, "hold");
  assert.match(result.blockers.join(" "), /No effective adult heart/i);
});

test("post-April 2026 legacy-only approval is held for PECOS verification", () => {
  const input = { ...base, programApprovals: [{ ...base.programApprovals![0], source: "legacy-cms" as const }] };
  assert.match(validateTransplantProgram(input).blockers.join(" "), /PECOS/i);
});

test("historical date cannot use a future program record", () => {
  const input = { ...base, serviceDate: "2026-05-01", programApprovals: [{ ...base.programApprovals![0], effectiveFrom: "2026-06-01" }] };
  assert.equal(validateTransplantProgram(input).status, "hold");
});

test("pediatric program does not satisfy adult program approval", () => {
  const input = { ...base, programApprovals: [{ ...base.programApprovals![0], ageCategory: "pediatric" as const }] };
  assert.equal(validateTransplantProgram(input).status, "hold");
});

test("pancreas program also requires kidney prerequisite", () => {
  const pancreas = { ...base, organ: "pancreas" as const, programApprovals: [{ ...base.programApprovals![0], organ: "pancreas" as const }] };
  assert.match(validateTransplantProgram(pancreas).blockers.join(" "), /kidney prerequisite/i);
});

test("intestine program requires liver prerequisite", () => {
  const intestine = { ...base, organ: "intestine" as const, programApprovals: [{ ...base.programApprovals![0], organ: "intestine" as const }] };
  assert.match(validateTransplantProgram(intestine).blockers.join(" "), /liver prerequisite/i);
});

test("heart-lung program requires both heart and lung programs", () => {
  const input = { ...base, organ: "heart-lung" as const, programApprovals: [{ ...base.programApprovals![0], organ: "heart-lung" as const }] };
  const blockers = validateTransplantProgram(input).blockers.join(" ");
  assert.match(blockers, /heart prerequisite/i);
  assert.match(blockers, /lung prerequisite/i);
});

test("pancreas islet pathway is not treated as whole-organ coverage", () => {
  const input: TransplantCaseInput = { ...base, organ: "pancreas", clinical: { pancreasPath: "islet", wholeOrganTransplant: false, insulinDependentDiabetes: true, betaCellFailureDocumented: true } };
  assert.match(evaluateTransplantCoverage(input).blockers.join(" "), /Islet-cell/i);
});

test("intestine coverage requires PN failure or life-threatening complication", () => {
  const input: TransplantCaseInput = { ...base, organ: "intestine", clinical: { irreversibleIntestinalFailure: true, failedParenteralNutrition: false, lifeThreateningParenteralNutritionComplication: false } };
  assert.match(evaluateTransplantCoverage(input).blockers.join(" "), /parenteral nutrition/i);
});

test("liver follow-up can be independently evaluated after noncovered transplant", () => {
  const input: TransplantCaseInput = { ...base, organ: "liver", purpose: "follow-up", clinical: { originalTransplantCovered: false, followUpIndependentlyReasonableNecessary: true } };
  assert.equal(evaluateTransplantCoverage(input).status, "pass");
});

test("lung path does not fabricate a dedicated NCD", () => {
  const input: TransplantCaseInput = { ...base, organ: "lung", clinical: { endStageOrganFailure: true, transplantIndicationDocumented: true } };
  assert.match(evaluateTransplantCoverage(input).blockers.join(" "), /No dedicated national lung/i);
});

test("shared acquisition allocation must total 100 percent", () => {
  const input: TransplantCaseInput = { ...base, purpose: "organ-acquisition", acquisition: { sacReconciled: true, costItems: [{ id: "shared", description: "Shared coordinator", amountCents: 25000, category: "shared", allocations: [{ organ: "kidney", percent: 60 }] }] } };
  assert.match(evaluateAcquisition(input).blockers.join(" "), /100%/);
});

test("acquisition ledger rejects negative and unresolved costs", () => {
  const input: TransplantCaseInput = { ...base, acquisition: { sacReconciled: false, costItems: [{ id: "bad", description: "Unknown invoice", amountCents: -1, category: "unresolved" }] } };
  const blockers = evaluateAcquisition(input).blockers.join(" ");
  assert.match(blockers, /negative/i);
  assert.match(blockers, /unresolved/i);
  assert.match(blockers, /standard acquisition charge/i);
});

test("Q3 kidney donor complication requires occurrence and relationship fields", () => {
  const input: TransplantCaseInput = { ...base, purpose: "donor", donor: { donorType: "living", organ: "kidney", recipientAccountLinked: true, kidneyComplication: true, occurrenceCode36: false, patientRelationship39: false } };
  assert.equal(evaluateDonor(input).status, "hold");
});

test("Q3 handling cannot be used for a liver donor complication", () => {
  const input: TransplantCaseInput = { ...base, organ: "liver", purpose: "donor", donor: { donorType: "living", organ: "liver", recipientAccountLinked: true, kidneyComplication: true, occurrenceCode36: true, patientRelationship39: true } };
  assert.match(evaluateDonor(input).blockers.join(" "), /restricted to kidney/i);
});

test("paired exchange requires account reconciliation", () => {
  const input: TransplantCaseInput = { ...base, purpose: "donor", donor: { donorType: "paired-exchange", organ: "kidney", recipientAccountLinked: true, pairedExchangeReconciled: false } };
  assert.match(evaluateDonor(input).blockers.join(" "), /Paired-exchange/i);
});

test("Part B-ID is rejected for non-kidney transplant", () => {
  const input: TransplantCaseInput = { ...base, organ: "liver", purpose: "immunosuppressive-drug", drug: { pathway: "part-b-id", kidneyTransplant: false, medicareEntitlementEndedAfter36Months: true, noDisqualifyingCoverage: true, partBidEnrolled: true, medicationDocumentedAsImmunosuppressive: true, daysSupply: 30, refillSequence: "initial" } };
  assert.match(evaluateDrugBenefit(input).blockers.join(" "), /kidney-transplant/i);
});

test("qualifying kidney Part B-ID pathway passes", () => {
  const input: TransplantCaseInput = { ...base, purpose: "immunosuppressive-drug", drug: { pathway: "part-b-id", kidneyTransplant: true, medicareEntitlementEndedAfter36Months: true, noDisqualifyingCoverage: true, partBidEnrolled: true, medicationDocumentedAsImmunosuppressive: true, daysSupply: 30, refillSequence: "initial" } };
  assert.equal(evaluateDrugBenefit(input).status, "pass");
});

test("engine never infers or repairs diagnosis codes", () => {
  const result = evaluateTransplantCase({ ...base, diagnosisCodes: ["N18.6", "kidney failure", "T86.12"] });
  assert.deepEqual(result.diagnosisCodes, ["N18.6", "T86.12"]);
  assert.match(result.queries.join(" "), /no diagnosis was inferred/i);
});

test("professional code is blocked without licensed adapter", () => {
  const result = evaluateTransplantCase({ ...base, operative: { ...base.operative, licensedProfessionalCode: undefined } });
  assert.match(result.professional.blockers.join(" "), /Licensed CPT mapping/i);
  assert.equal(result.claimLanes.find((lane) => lane.lane === "professional")?.lines.length, 0);
});

test("facility coding requires PCS and discharge-effective grouper, not CPT", () => {
  const result = evaluateTransplantCase({ ...base, operative: { finalOperativeReport: true, organImplanted: true, licensedProfessionalCode: "X" } });
  assert.match(result.facility.blockers.join(" "), /ICD-10-PCS/i);
  assert.match(result.facility.blockers.join(" "), /MS-DRG/i);
});

test("complete deterministic case is ready only for human approval", () => {
  const result = evaluateTransplantCase(base);
  assert.equal(result.claimReadiness.status, "pass");
  assert.equal(result.requiresHumanApproval, true);
  assert.equal(result.autonomousClaimSubmission, false);
});
