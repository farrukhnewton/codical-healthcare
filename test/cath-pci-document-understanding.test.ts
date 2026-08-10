import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCathPciVisionResult } from "../server/services/cath-pci-document-understanding";

test("cath OCR keeps source provenance and leaves facts unverified", () => {
  const result = normalizeCathPciVisionResult({ patientName: "DOE, JANE DOB 1960-01-01", dateOfBirth: "1960-01-01", serviceDate: "2026-08-10", operatorName: "Dr A", signedReportText: "Electronically signed", diagnostic: { coronaryAngiography: "Complete selective coronary angiography" }, interventions: [{ vessel: "lad", arteryModifier: "LD", lesionsTreated: 2, stentsPlaced: 1, technique: "stent", device: "drug-eluting-stent", approach: "percutaneous", completedText: "DES deployed", page: 4, confidence: .88, evidence: "LAD lesions treated" }], adjuncts: [{ kind: "ivus-oct", vessel: "lad", arteryModifier: "LD", performedText: "IVUS performed", page: 3, confidence: .96, evidence: "IVUS LAD" }], diagnoses: [{ code: "I25.10", description: "CAD", page: 1, confidence: .95, evidence: "Diagnosis" }] });
  assert.equal(result.patientName, "DOE, JANE"); assert.equal(result.interventions[0].lesionsTreated, 2); assert.equal(result.adjuncts[0].kind, "ivus-oct"); assert.equal(result.diagnoses[0].code, "I25.10"); assert.ok(result.warnings.length > 0);
});

test("cath OCR rejects DOB labels and malformed dates as diagnoses", () => {
  const result = normalizeCathPciVisionResult({ patientName: "", dateOfBirth: "bad", serviceDate: "bad", diagnostic: {}, interventions: [], adjuncts: [], diagnoses: [{ code: "DOB", page: 1, confidence: 1, evidence: "DOB" }] });
  assert.equal(result.dateOfBirth, undefined); assert.equal(result.serviceDate, undefined); assert.equal(result.diagnoses.length, 0);
});
