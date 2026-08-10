import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInfusionVisionResult } from "../server/services/infusion-document-understanding";

test("visual OCR normalization keeps evidence as review candidates", () => {
  const result = normalizeInfusionVisionResult({ patientName: "ERIN TEST", serviceDate: "2026-08-10", administrations: [{ drugName: "Keytruda", hcpcsCode: "j9271", dose: 200, doseUnit: "mg", category: "chemotherapy", method: "infusion", startTime: "09:04", stopTime: "10:06", accessSite: "right port", page: 2, confidence: 0.94, evidence: "Handwritten MAR row shows administration." }] });
  assert.equal(result.patientName, "ERIN TEST");
  assert.equal(result.administrations[0].hcpcsCode, "J9271");
  assert.equal(result.administrations[0].doseUnit, "MG");
  assert.equal(result.administrations[0].startTime, "09:04");
});

test("ambiguous OCR values are omitted and warned", () => {
  const result = normalizeInfusionVisionResult({ administrations: [{ drugName: "Ondansetron", dose: 4, method: "push", startTime: "9am", confidence: 0.5, page: 1, evidence: "unclear" }] });
  assert.equal(result.administrations[0].startTime, undefined);
  assert.ok(result.warnings.length > 0);
});
