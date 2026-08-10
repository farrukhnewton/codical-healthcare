import assert from "node:assert/strict";
import test from "node:test";
import { normalizeNicuVisionResult } from "../server/services/nicu-document-understanding";

test("NICU visual normalization preserves daily provenance without verifying clinical gates", () => {
  const result = normalizeNicuVisionResult({
    patientName: "Baby Rivera DOB 2026-01-01",
    dateOfBirth: "2026-01-01",
    admissionDate: "2026-01-01",
    birthWeightGrams: 980,
    days: [{
      serviceDate: "2026-01-02", presentWeightGrams: 1010, careLevel: "critical",
      criticalStatusText: "continues critically ill", directingProvider: "Dr Rivera", providerRole: "physician",
      bedsideExamText: "seen and examined", planDirectionText: "plan reviewed with team",
      procedureCodes: ["36410", "bad"], page: 4, confidence: .92, evidence: "Daily progress note",
    }],
    diagnoses: [{ code: "P07.15", description: "Extremely low birth weight", page: 2, confidence: .93, evidence: "Assessment" }],
  });
  assert.equal(result.patientName, "Baby Rivera");
  assert.equal(result.days[0].page, 4);
  assert.equal(result.days[0].presentWeightGrams, 1010);
  assert.deepEqual(result.days[0].procedureCodes, ["36410"]);
  assert.equal(result.diagnoses[0].code, "P07.15");
});

test("ambiguous OCR values are omitted and flagged for verification", () => {
  const result = normalizeNicuVisionResult({
    patientName: "DOB",
    dateOfBirth: "01/01/26",
    admissionDate: "not a date",
    days: [{ serviceDate: "", presentWeightGrams: -1, careLevel: "maybe", directingProvider: "", procedureCodes: [], page: 7, confidence: .4, evidence: "handwritten fragment" }],
    diagnoses: [{ code: "DOB", page: 7, confidence: .2, evidence: "demographic label" }],
  });
  assert.equal(result.patientName, undefined);
  assert.equal(result.dateOfBirth, undefined);
  assert.equal(result.days[0].presentWeightGrams, undefined);
  assert.equal(result.days[0].careLevel, undefined);
  assert.equal(result.diagnoses.length, 0);
  assert.match(result.warnings.join(" "), /source verification/i);
});
