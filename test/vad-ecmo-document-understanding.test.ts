import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVadEcmoVisionResult } from "../server/services/vad-ecmo-document-understanding";

test("VAD/ECMO OCR normalization preserves provenance without verifying billing facts", () => {
  const result = normalizeVadEcmoVisionResult({
    patientName: "DOE, JANE DOB 1980-01-01", dateOfBirth: "1980-01-01",
    services: [{ serviceDate: "2026-08-10", supportKind: "ecmo", phase: "initiation", ecmoMode: "va", approach: "peripheral-percutaneous", configuration: "unknown", reportingClinician: "Dr A", managementText: "Initiated VA support", procedureCodes: ["33947", "bad"], page: 4, confidence: 0.88, evidence: "Operative record" }],
    diagnoses: [{ code: "R57.0", description: "Cardiogenic shock", page: 2, confidence: 0.91, evidence: "Assessment" }],
    coverageFacts: ["LVEF 20%", "NYHA IV"],
  });
  assert.equal(result.patientName, "DOE, JANE");
  assert.equal(result.services[0].ecmoMode, "va");
  assert.deepEqual(result.services[0].procedureCodes, ["33947"]);
  assert.equal(result.diagnoses[0].code, "R57.0");
  assert.deepEqual(result.coverageFacts, ["LVEF 20%", "NYHA IV"]);
  assert.ok(result.warnings.length > 0);
});

test("OCR normalization rejects invented or malformed code values", () => {
  const result = normalizeVadEcmoVisionResult({ patientName: "", dateOfBirth: "not-date", services: [], diagnoses: [{ code: "DOB", page: 1, confidence: 1, evidence: "" }], coverageFacts: [] });
  assert.equal(result.dateOfBirth, undefined);
  assert.equal(result.diagnoses.length, 0);
});
