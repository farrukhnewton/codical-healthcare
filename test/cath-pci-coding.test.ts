import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCathPciCase, inclusiveDiagnosticCathCode, inpatientPcsCandidates, type CathPciCaseInput, type PciTargetInput } from "../shared/cath-pci-coding";

const target = (overrides: Partial<PciTargetInput> = {}): PciTargetInput => ({ id: `pci-${Math.random()}`, vessel: "lad", arteryModifier: "LD", lesionsTreated: 1, stentsPlaced: 1, technique: "stent", device: "drug-eluting-stent", approach: "percutaneous", bifurcation: false, completed: true, sourceVerified: true, ...overrides });
const diagnostic = (overrides: Partial<CathPciCaseInput["diagnostic"]> = {}): CathPciCaseInput["diagnostic"] => ({ rightHeart: false, leftHeart: false, coronaryAngiography: false, bypassGraftAngiography: false, completeDiagnosticStudy: false, diagnosticMedicalNecessity: false, priorStudyAvailable: false, priorStudyAdequate: false, changedCondition: false, inadequateVisualization: false, intraprocedureClinicalChange: false, interventionDecisionBasedOnStudy: false, ...overrides });
const baseCase = (overrides: Partial<CathPciCaseInput> = {}): CathPciCaseInput => ({ patientName: "Example Patient", dateOfService: "2026-08-10", claimScope: "professional", payerType: "medicare", payerJurisdiction: "JL", operatorName: "Dr Example", reportSigned: true, operatorEligible: true, payerPolicyVerified: true, payerPolicyCurrent: true, diagnostic: diagnostic(), interventions: [target()], adjuncts: [], diagnoses: [{ id: "dx-1", code: "I25.10", description: "CAD", providerDocumented: true, clinicallySupported: true }], sameDayProcedureCodes: [], ...overrides });

test("diagnostic cath components select one inclusive family", () => {
  assert.equal(inclusiveDiagnosticCathCode(diagnostic({ rightHeart: true })), "93451");
  assert.equal(inclusiveDiagnosticCathCode(diagnostic({ leftHeart: true, coronaryAngiography: true })), "93458");
  assert.equal(inclusiveDiagnosticCathCode(diagnostic({ rightHeart: true, leftHeart: true, coronaryAngiography: true, bypassGraftAngiography: true })), "93461");
});

test("single and multiple stent lesions use current 2026 families", () => {
  assert.ok(evaluateCathPciCase(baseCase()).claimCodes.includes("92928"));
  assert.ok(evaluateCathPciCase(baseCase({ interventions: [target({ lesionsTreated: 2 })] })).claimCodes.includes("92930"));
});

test("retired 2026 branch add-ons are never generated", () => {
  const result = evaluateCathPciCase(baseCase({ interventions: [target({ lesionsTreated: 4 }), target({ vessel: "lcx", arteryModifier: "LC", technique: "atherectomy-stent" })] }));
  for (const code of ["92921", "92925", "92929", "92934", "92938", "92944", "92975"]) assert.ok(!result.candidates.some((item) => item.code === code));
});

test("CTO direction distinguishes 92943 from new 92945", () => {
  assert.ok(evaluateCathPciCase(baseCase({ interventions: [target({ technique: "cto-antegrade" })] })).claimCodes.includes("92943"));
  assert.ok(evaluateCathPciCase(baseCase({ interventions: [target({ technique: "cto-antegrade-retrograde" })] })).claimCodes.includes("92945"));
});

test("bypass-graft work requires a native territory modifier", () => {
  const held = evaluateCathPciCase(baseCase({ interventions: [target({ vessel: "bypass-graft", arteryModifier: "", graftLabel: "SVG-RCA" })] }));
  assert.equal(held.candidates.find((item) => item.code === "92937")?.status, "held");
  const ready = evaluateCathPciCase(baseCase({ interventions: [target({ vessel: "bypass-graft", arteryModifier: "RC", graftLabel: "SVG-RCA" })] }));
  assert.ok(ready.claimCodes.includes("92937"));
});

test("duplicate major-artery rows are held for hierarchy consolidation", () => {
  const result = evaluateCathPciCase(baseCase({ interventions: [target(), target({ technique: "angioplasty" })] }));
  assert.ok(result.candidates.some((item) => item.blockers.some((blocker) => /Consolidate/i.test(blocker))));
  assert.equal(result.candidates.filter((item) => item.role === "intervention" && item.status === "candidate").length, 0);
});

test("same-session diagnostic study requires documented CMS exception", () => {
  const held = evaluateCathPciCase(baseCase({ diagnostic: diagnostic({ leftHeart: true, coronaryAngiography: true, completeDiagnosticStudy: true, diagnosticMedicalNecessity: true, priorStudyAvailable: true, priorStudyAdequate: true }) }));
  assert.equal(held.candidates.find((item) => item.code === "93458")?.status, "held");
  const allowed = evaluateCathPciCase(baseCase({ diagnostic: diagnostic({ leftHeart: true, coronaryAngiography: true, completeDiagnosticStudy: true, diagnosticMedicalNecessity: true, priorStudyAvailable: false, interventionDecisionBasedOnStudy: true }) }));
  assert.equal(allowed.candidates.find((item) => item.code === "93458")?.status, "candidate");
});

test("AMI culprit PCI applies only once per date", () => {
  const result = evaluateCathPciCase(baseCase({ interventions: [target({ technique: "acute-mi" }), target({ vessel: "rca", arteryModifier: "RC", technique: "acute-mi" })] }));
  assert.equal(result.candidates.filter((item) => item.code === "92941" && item.status === "candidate").length, 1);
});

test("IVUS and physiology sequence initial and additional vessels", () => {
  const result = evaluateCathPciCase(baseCase({ adjuncts: [
    { id: "a", kind: "ivus-oct", vessel: "lad", arteryModifier: "LD", performed: true, sourceVerified: true, medicallyNecessary: true },
    { id: "b", kind: "ivus-oct", vessel: "rca", arteryModifier: "RC", performed: true, sourceVerified: true, medicallyNecessary: true },
    { id: "c", kind: "ffr-cfr", vessel: "lad", arteryModifier: "LD", performed: true, sourceVerified: true, medicallyNecessary: true },
    { id: "d", kind: "ffr-cfr", vessel: "lcx", arteryModifier: "LC", performed: true, sourceVerified: true, medicallyNecessary: true },
  ] }));
  for (const code of ["92978", "92979", "93571", "93572"]) assert.ok(result.claimCodes.includes(code));
});

test("mechanical thrombectomy is held with atherectomy in the same vessel", () => {
  const result = evaluateCathPciCase(baseCase({ interventions: [target({ technique: "atherectomy" })], adjuncts: [{ id: "a", kind: "mechanical-thrombectomy", vessel: "lad", arteryModifier: "LD", performed: true, sourceVerified: true, medicallyNecessary: true }] }));
  assert.equal(result.candidates.find((item) => item.code === "92973")?.status, "held");
});

test("inpatient PCS constructs dilation from artery count approach and device", () => {
  assert.equal(inpatientPcsCandidates([target()])[0].code, "027034Z");
  const result = evaluateCathPciCase(baseCase({ claimScope: "inpatient-facility", interventions: [target(), target({ vessel: "rca", arteryModifier: "RC" })] }));
  assert.ok(result.claimCodes.includes("027135Z"));
  assert.ok(!result.claimCodes.includes("92928"));
});

test("hospital outpatient exposes closure only as packaged", () => {
  const result = evaluateCathPciCase(baseCase({ claimScope: "hospital-outpatient" }));
  assert.equal(result.candidates.find((item) => item.code === "G0269")?.status, "packaged");
  assert.ok(!result.claimCodes.includes("G0269"));
});

test("procedure selection never creates diagnosis or coverage", () => {
  const result = evaluateCathPciCase(baseCase({ diagnoses: [], payerPolicyVerified: null, payerPolicyCurrent: null, payerJurisdiction: "" }));
  assert.equal(result.diagnoses.length, 0); assert.equal(result.coverage.status, "review"); assert.match(result.hardStops.join(" "), /diagnosis/i);
});

test("human approval is always required", () => assert.equal(evaluateCathPciCase(baseCase()).humanApprovalRequired, true));
