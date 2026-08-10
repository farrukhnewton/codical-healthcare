import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCabgVisionResult } from "../server/services/cabg-document-understanding";

test("CABG OCR normalization preserves target provenance without verifying billing facts", () => {
  const result = normalizeCabgVisionResult({
    patientName: "DOE, JANE DOB 1960-01-01", dateOfBirth: "1960-01-01", serviceDate: "2026-08-10", primarySurgeon: "Dr A",
    signedReportText: "Electronically signed", targets: [{ targetVessel: "LAD", conduitKind: "arterial", conduitSource: "left-internal-mammary", inflowSource: "left-internal-mammary", approach: "open", completedText: "LIMA to LAD completed", page: 4, confidence: .88, evidence: "Distal anastomosis" }],
    harvests: [{ source: "left-saphenous", method: "endoscopic", performedText: "harvested", page: 2, confidence: .94, evidence: "EVH" }],
    diagnoses: [{ code: "I25.10", description: "CAD", page: 1, confidence: .95, evidence: "Pre-op diagnosis" }],
    redoFacts: [], endarterectomyVessels: [], sameDayProcedureCodes: ["33533", "bad"],
  });
  assert.equal(result.patientName, "DOE, JANE");
  assert.equal(result.targets[0].targetVessel, "LAD");
  assert.equal(result.targets[0].conduitSource, "left-internal-mammary");
  assert.equal(result.harvests[0].method, "endoscopic");
  assert.deepEqual(result.sameDayProcedureCodes, ["33533"]);
  assert.ok(result.warnings.length > 0);
});

test("CABG OCR normalization rejects malformed dates diagnoses and procedures", () => {
  const result = normalizeCabgVisionResult({ patientName: "", dateOfBirth: "bad", serviceDate: "bad", targets: [], harvests: [], diagnoses: [{ code: "DOB", page: 1, confidence: 1, evidence: "" }], redoFacts: [], endarterectomyVessels: [], sameDayProcedureCodes: ["no"] });
  assert.equal(result.dateOfBirth, undefined);
  assert.equal(result.serviceDate, undefined);
  assert.equal(result.diagnoses.length, 0);
  assert.equal(result.sameDayProcedureCodes.length, 0);
});
