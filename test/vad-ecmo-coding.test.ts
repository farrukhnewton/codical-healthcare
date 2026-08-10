import assert from "node:assert/strict";
import test from "node:test";
import { ageOnServiceDate, evaluateVadEcmoCase, type VadEcmoCaseInput, type VadEcmoServiceInput } from "../shared/vad-ecmo-coding";

const service = (overrides: Partial<VadEcmoServiceInput> = {}): VadEcmoServiceInput => ({
  id: `service-${Math.random()}`, serviceDate: "2026-08-10", supportKind: "ecmo", phase: "initiation", ecmoMode: "vv",
  approach: "peripheral-percutaneous", configuration: "unknown", intraoperative: false, cardiopulmonaryBypassUsed: null,
  servicePerformed: true, sourceVerified: true, reportingClinician: "Dr Example", clinicianEligible: true,
  managementDocumented: true, interrogationInPerson: null, interrogationAnalysisReport: null, sameDayProcedureCodes: [], ...overrides,
});

const baseCase = (overrides: Partial<VadEcmoCaseInput> = {}): VadEcmoCaseInput => ({
  patientName: "Example Patient", dateOfBirth: "1980-01-01", claimScope: "professional", payerType: "commercial",
  payerName: "Example Plan", payerJurisdiction: "PA", payerPolicyVerified: true, payerPolicyCurrent: true,
  coverage: {
    indication: "unknown", fdaApprovedAndOnLabel: null, nyhaClassIV: null, lvefPercent: undefined,
    inotropeDependent: null, cardiacIndex: undefined, optimalMedicalManagementDaysOfLast60: undefined,
    failingOptimalMedicalManagement: null, advancedHeartFailureDays: undefined, temporaryMechanicalSupportDays: undefined,
    multidisciplinaryTeamConfirmed: null, credentialedFacilityConfirmed: null, informedDecisionSupportConfirmed: null,
  },
  diagnoses: [{ id: "dx-1", code: "R57.0", description: "Source diagnosis", providerDocumented: true, clinicallySupported: true }],
  services: [service()], ...overrides,
});

const code = (input: VadEcmoCaseInput) => evaluateVadEcmoCase(input).services[0].candidates[0];

test("calendar age drives the ECMO age family", () => {
  assert.equal(ageOnServiceDate("2020-08-11", "2026-08-10"), 5);
  assert.equal(ageOnServiceDate("2020-08-10", "2026-08-10"), 6);
  assert.equal(ageOnServiceDate("bad", "2026-08-10"), null);
});

test("VV and VA initiation use distinct current families", () => {
  assert.equal(code(baseCase()).code, "33946");
  assert.equal(code(baseCase({ services: [service({ ecmoMode: "va" })] })).code, "33947");
});

test("VV and VA daily management remain distinct and are not called weaning", () => {
  assert.equal(code(baseCase({ services: [service({ phase: "daily-management", ecmoMode: "vv" })] })).code, "33948");
  assert.equal(code(baseCase({ services: [service({ phase: "daily-management", ecmoMode: "va" })] })).code, "33949");
});

test("unknown ECMO mode holds initiation", () => {
  const result = code(baseCase({ services: [service({ ecmoMode: "unknown" })] }));
  assert.equal(result.code, null);
  assert.equal(result.status, "held");
});

test("peripheral percutaneous cannulation branches at age six", () => {
  const young = baseCase({ dateOfBirth: "2023-01-01", services: [service({ phase: "insertion", approach: "peripheral-percutaneous" })] });
  const older = baseCase({ dateOfBirth: "2020-01-01", services: [service({ phase: "insertion", approach: "peripheral-percutaneous" })] });
  assert.equal(code(young).code, "33951");
  assert.equal(code(older).code, "33952");
});

test("open and central cannulation use their own age families", () => {
  assert.equal(code(baseCase({ dateOfBirth: "2023-01-01", services: [service({ phase: "insertion", approach: "peripheral-open" })] })).code, "33953");
  assert.equal(code(baseCase({ services: [service({ phase: "insertion", approach: "central-open" })] })).code, "33956");
});

test("ECMO reposition and removal branch by access and age", () => {
  assert.equal(code(baseCase({ dateOfBirth: "2023-01-01", services: [service({ phase: "reposition", approach: "central-open" })] })).code, "33963");
  assert.equal(code(baseCase({ services: [service({ phase: "removal", approach: "peripheral-open" })] })).code, "33984");
  assert.equal(code(baseCase({ services: [service({ phase: "removal", approach: "central-open" })] })).code, "33986");
});

test("extracorporeal VAD configuration controls insertion and removal", () => {
  assert.equal(code(baseCase({ services: [service({ supportKind: "extracorporeal-vad", phase: "insertion", configuration: "single-ventricle", approach: "open" })] })).code, "33975");
  assert.equal(code(baseCase({ services: [service({ supportKind: "extracorporeal-vad", phase: "removal", configuration: "biventricular", approach: "open" })] })).code, "33978");
});

test("implantable replacement requires documented bypass use", () => {
  assert.equal(code(baseCase({ services: [service({ supportKind: "implantable-vad", phase: "replacement", cardiopulmonaryBypassUsed: false, approach: "open" })] })).code, "33982");
  assert.equal(code(baseCase({ services: [service({ supportKind: "implantable-vad", phase: "replacement", cardiopulmonaryBypassUsed: true, approach: "open" })] })).code, "33983");
  assert.equal(code(baseCase({ services: [service({ supportKind: "implantable-vad", phase: "replacement", cardiopulmonaryBypassUsed: null, approach: "open" })] })).status, "held");
});

test("percutaneous VAD insertion distinguishes the circuit", () => {
  assert.equal(code(baseCase({ services: [service({ supportKind: "percutaneous-vad", phase: "insertion", configuration: "arterial-only", approach: "percutaneous" })] })).code, "33990");
  assert.equal(code(baseCase({ services: [service({ supportKind: "percutaneous-vad", phase: "insertion", configuration: "arterial-and-venous", approach: "percutaneous" })] })).code, "33991");
});

test("VAD interrogation is not auto-daily and needs in-person analysis/report", () => {
  const held = code(baseCase({ services: [service({ supportKind: "implantable-vad", phase: "interrogation", approach: "open" })] }));
  assert.equal(held.code, "93750");
  assert.equal(held.status, "held");
  const reviewed = code(baseCase({ services: [service({ supportKind: "implantable-vad", phase: "interrogation", approach: "open", interrogationInPerson: true, interrogationAnalysisReport: true })] }));
  assert.equal(reviewed.status, "review");
  assert.match(reviewed.warnings.join(" "), /not automatically billable every day/i);
});

test("same-day VAD surgery holds interrogation pending current edits", () => {
  const result = code(baseCase({ services: [service({ supportKind: "implantable-vad", phase: "interrogation", approach: "open", interrogationInPerson: true, interrogationAnalysisReport: true, sameDayProcedureCodes: ["33979"] })] }));
  assert.equal(result.status, "held");
  assert.match(result.blockers.join(" "), /same-day VAD surgical code/i);
});

test("facility ECMO support maps central and peripheral VV/VA separately", () => {
  assert.equal(code(baseCase({ claimScope: "inpatient-facility", services: [service({ approach: "peripheral-percutaneous", ecmoMode: "va" })] })).code, "5A1522G");
  assert.equal(code(baseCase({ claimScope: "inpatient-facility", services: [service({ approach: "central-open", ecmoMode: "vv", intraoperative: true })] })).code, "5A15A2F");
});

test("facility implantable VAD insertion constructs a PCS candidate from approach", () => {
  const result = code(baseCase({ claimScope: "inpatient-facility", services: [service({ supportKind: "implantable-vad", phase: "insertion", configuration: "single-ventricle", approach: "open" })] }));
  assert.equal(result.code, "02HA0QZ");
  assert.equal(result.system, "ICD-10-PCS");
});

test("facility replacement is held for distinct PCS objectives", () => {
  const result = code(baseCase({ claimScope: "inpatient-facility", services: [service({ supportKind: "implantable-vad", phase: "replacement", approach: "open", cardiopulmonaryBypassUsed: true })] }));
  assert.equal(result.status, "held");
  assert.match(result.blockers.join(" "), /removal and insertion/i);
});

test("Medicare durable LVAD insertion applies NCD 20.9.1 gates", () => {
  const result = evaluateVadEcmoCase(baseCase({ payerType: "medicare", services: [service({ supportKind: "implantable-vad", phase: "insertion", configuration: "single-ventricle", approach: "open" })] }));
  assert.equal(result.coverage.applicable, true);
  assert.equal(result.coverage.status, "failed");
  assert.match(result.blockers.join(" "), /NCD 20\.9\.1/i);
});

test("complete Medicare heart-failure path satisfies the NCD evidence gate", () => {
  const result = evaluateVadEcmoCase(baseCase({
    payerType: "medicare",
    coverage: { indication: "heart-failure-long-term", fdaApprovedAndOnLabel: true, nyhaClassIV: true, lvefPercent: 20, inotropeDependent: true, cardiacIndex: undefined, optimalMedicalManagementDaysOfLast60: undefined, failingOptimalMedicalManagement: null, advancedHeartFailureDays: undefined, temporaryMechanicalSupportDays: undefined, multidisciplinaryTeamConfirmed: true, credentialedFacilityConfirmed: true, informedDecisionSupportConfirmed: true },
    services: [service({ supportKind: "implantable-vad", phase: "insertion", configuration: "single-ventricle", approach: "open" })],
  }));
  assert.equal(result.coverage.status, "satisfied");
});

test("device use never creates a diagnosis", () => {
  const result = evaluateVadEcmoCase(baseCase({ diagnoses: [] }));
  assert.equal(result.diagnoses.length, 0);
  assert.match(result.blockers.join(" "), /provider-documented/i);
});

test("unverified sources and payer policy prevent release", () => {
  const result = evaluateVadEcmoCase(baseCase({ payerPolicyVerified: null, services: [service({ sourceVerified: null })] }));
  assert.equal(result.status, "hold");
  assert.match(result.blockers.join(" "), /payer coverage/i);
});

test("autonomous submission is always disabled", () => {
  const result = evaluateVadEcmoCase(baseCase());
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.autonomousClaimSubmissionAllowed, false);
  assert.equal(result.payerCoverageNotInferred, true);
});
