import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHccCase, type HccCaseInput, type HccDiagnosisEvidence } from "../shared/hcc-coding";
import { CMS_HCC_V28_2026 } from "../server/hcc-cms-v28-data";

const evidence = (code: string, overrides: Partial<HccDiagnosisEvidence> = {}): HccDiagnosisEvidence => ({
  code,
  serviceDate: "2025-06-12",
  encounterId: `enc-${code}`,
  dataSource: "physician",
  documentationStatus: "confirmed",
  signatureStatus: "signed",
  acceptableProviderType: true,
  eligibleService: true,
  patientMatched: true,
  clinicallyAddressed: true,
  ...overrides,
});
const base = (diagnoses: HccDiagnosisEvidence[] = []): HccCaseInput => ({
  paymentYear: 2026,
  programType: "ma",
  enrollmentType: "continuing",
  snp: false,
  esrdStatus: "none",
  dateOfBirth: "1950-01-15",
  sex: "female",
  originalReasonForEntitlement: 0,
  medicaidStatus: "none",
  institutional: false,
  longTermInstitutionalMedicaid: false,
  diagnoses,
  priorYearDiagnoses: [],
});

test("official PY 2026 package is compiled with complete mapping provenance", () => {
  assert.equal(Object.keys(CMS_HCC_V28_2026.mappings).length, 8019);
  assert.equal(CMS_HCC_V28_2026.paymentYear, 2026);
  assert.equal(CMS_HCC_V28_2026.sourceHashes.mappings, "93307f974301b2a5d406ec6b095246e08601b54e346a4ad5fa5d82db59e1522e");
});

test("E11.42 maps to V28 HCC 37 rather than a legacy V24 category", () => {
  const result = evaluateHccCase(base([evidence("E11.42")]), CMS_HCC_V28_2026);
  assert.deepEqual(result.activeHccs.map((item) => item.hcc), [37]);
  assert.equal(result.activeHccs[0].label, "Diabetes with Chronic Complications");
});

test("hyphen and decimal formatting normalize before model mapping", () => {
  const result = evaluateHccCase(base([evidence(" e11.42 ")]), CMS_HCC_V28_2026);
  assert.equal(result.diagnoses[0].code, "E1142");
  assert.equal(result.diagnoses[0].status, "eligible");
});

test("V28 hierarchy suppresses diabetes without complications", () => {
  const result = evaluateHccCase(base([evidence("E11.42"), evidence("E11.9")]), CMS_HCC_V28_2026);
  assert.deepEqual(result.activeHccs.map((item) => item.hcc), [37]);
  assert.deepEqual(result.suppressedHccs, [{ hcc: 38, suppressedBy: 37 }]);
});

test("age edits select the correct cancer category", () => {
  const older = evaluateHccCase(base([evidence("C50.919")]), CMS_HCC_V28_2026);
  const younger = evaluateHccCase({ ...base([evidence("C50.919")]), dateOfBirth: "1986-02-02" }, CMS_HCC_V28_2026);
  assert.deepEqual(older.activeHccs.map((item) => item.hcc), [23]);
  assert.deepEqual(younger.activeHccs.map((item) => item.hcc), [22]);
});

test("unmapped hypertension remains visible without inventing an HCC", () => {
  const result = evaluateHccCase(base([evidence("I10")]), CMS_HCC_V28_2026);
  assert.equal(result.diagnoses[0].status, "unmapped");
  assert.equal(result.activeHccs.length, 0);
});

test("missing record signature holds the diagnosis out of scoring", () => {
  const result = evaluateHccCase(base([evidence("E11.42", { signatureStatus: "missing" })]), CMS_HCC_V28_2026);
  assert.equal(result.diagnoses[0].status, "held");
  assert.equal(result.activeHccs.length, 0);
});

test("unverified eligible service holds the diagnosis", () => {
  const result = evaluateHccCase(base([evidence("N18.4", { eligibleService: null })]), CMS_HCC_V28_2026);
  assert.equal(result.diagnoses[0].status, "held");
  assert.match(result.diagnoses[0].issues.join(" "), /eligible service/i);
});

test("clinical relevance review is a warning rather than an invented CMS exclusion", () => {
  const result = evaluateHccCase(base([evidence("E11.42", { clinicallyAddressed: null })]), CMS_HCC_V28_2026);
  assert.equal(result.diagnoses[0].status, "eligible");
  assert.match(result.warnings.join(" "), /affected care/i);
});

test("duplicate diagnosis evidence contributes one HCC", () => {
  const result = evaluateHccCase(base([evidence("E11.42", { encounterId: "one" }), evidence("E11.42", { encounterId: "two" })]), CMS_HCC_V28_2026);
  assert.equal(result.diagnoses.length, 1);
  assert.deepEqual(result.diagnoses[0].encounterIds.sort(), ["one", "two"]);
  assert.equal(result.activeHccs.length, 1);
});

test("deleted diagnoses never map or score", () => {
  const result = evaluateHccCase(base([evidence("E11.42", { documentationStatus: "deleted" })]), CMS_HCC_V28_2026);
  assert.equal(result.diagnoses[0].status, "deleted");
  assert.equal(result.activeHccs.length, 0);
});

test("out-of-period evidence is held for PY 2026", () => {
  const result = evaluateHccCase(base([evidence("E11.42", { serviceDate: "2026-02-10" })]), CMS_HCC_V28_2026);
  assert.equal(result.diagnoses[0].status, "held");
  assert.match(result.diagnoses[0].issues.join(" "), /2025 data-collection year/i);
});

test("diabetes and heart failure create the official disease interaction", () => {
  const result = evaluateHccCase(base([evidence("E11.42"), evidence("I50.9")]), CMS_HCC_V28_2026);
  assert.ok(result.interactions.includes("DIABETES_HF_V28"));
  assert.ok(result.contributions.some((item) => item.variable === "DIABETES_HF_V28"));
});

test("diabetes, heart failure, and CKD create two separate interactions", () => {
  const result = evaluateHccCase(base([evidence("E11.42"), evidence("I50.9"), evidence("N18.4")]), CMS_HCC_V28_2026);
  assert.ok(result.interactions.includes("DIABETES_HF_V28"));
  assert.ok(result.interactions.includes("HF_KIDNEY_V28"));
});

test("continuing enrollee receives demographic and HCC coefficients", () => {
  const result = evaluateHccCase(base([evidence("E11.42")]), CMS_HCC_V28_2026);
  assert.equal(result.segment, "COMMUNITY_NA");
  assert.ok(result.contributions.some((item) => item.kind === "demographic"));
  assert.ok(result.contributions.some((item) => item.variable === "HCC37"));
  assert.ok((result.rawRiskScore || 0) > 0);
});

test("new enrollee uses demographic-only coefficients", () => {
  const result = evaluateHccCase({ ...base([evidence("E11.42")]), enrollmentType: "new" }, CMS_HCC_V28_2026);
  assert.equal(result.segment, "NE");
  assert.ok(result.contributions.length > 0);
  assert.equal(result.contributions.some((item) => item.kind === "hcc"), false);
  assert.match(result.warnings.join(" "), /demographic/i);
});

test("SNP new enrollee selects the separate CMS coefficient column", () => {
  const result = evaluateHccCase({ ...base(), enrollmentType: "new", snp: true }, CMS_HCC_V28_2026);
  assert.equal(result.segment, "NE_SNP");
  assert.ok((result.rawRiskScore || 0) > 0);
});

test("institutional beneficiaries use the institutional coefficient segment", () => {
  const result = evaluateHccCase({ ...base([evidence("E11.42")]), institutional: true }, CMS_HCC_V28_2026);
  assert.equal(result.segment, "INSTITUTIONAL");
});

test("raw, normalized, and coding-adjusted score layers stay separate", () => {
  const result = evaluateHccCase(base([evidence("E11.42")]), CMS_HCC_V28_2026);
  assert.equal(result.normalizedRiskScore, Math.round((((result.rawRiskScore || 0) / 1.067) + Number.EPSILON) * 1000) / 1000);
  assert.notEqual(result.codingPatternAdjustedScore, result.normalizedRiskScore);
});

test("generic payment estimates are intentionally disabled", () => {
  const result = evaluateHccCase(base([evidence("E11.42")]), CMS_HCC_V28_2026);
  assert.equal(result.paymentEstimate, null);
  assert.match(result.paymentEstimateReason, /not a standalone dollar payment/i);
});

test("historical diagnoses create review cues and never enter current scoring", () => {
  const result = evaluateHccCase({ ...base(), priorYearDiagnoses: ["E11.42"] }, CMS_HCC_V28_2026);
  assert.equal(result.activeHccs.length, 0);
  assert.deepEqual(result.reviewCues[0].mappedHccs, [37]);
  assert.match(result.reviewCues[0].message, /never carry forward/i);
});

test("PACE pathway is held because PY 2026 requires a blend", () => {
  const result = evaluateHccCase({ ...base(), programType: "pace" }, CMS_HCC_V28_2026);
  assert.equal(result.status, "hold");
  assert.match(result.blockers.join(" "), /blended/i);
});

test("ESRD pathways are held for their dedicated models", () => {
  const result = evaluateHccCase({ ...base(), esrdStatus: "dialysis" }, CMS_HCC_V28_2026);
  assert.equal(result.status, "hold");
  assert.match(result.blockers.join(" "), /ESRD model/i);
});

test("invalid date of birth prevents a releasable score", () => {
  const result = evaluateHccCase({ ...base(), dateOfBirth: "" }, CMS_HCC_V28_2026);
  assert.equal(result.status, "hold");
  assert.equal(result.rawRiskScore, null);
});

test("engine requires human approval and cannot create or submit diagnoses", () => {
  const result = evaluateHccCase(base([evidence("E11.42")]), CMS_HCC_V28_2026);
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.autonomousDiagnosisSuggestion, false);
  assert.equal(result.autonomousSubmissionAllowed, false);
});
