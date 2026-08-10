import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBurnVisionResult } from "../server/services/burn-document-understanding";

test("burn visual extraction preserves documented handwriting and rejects demographic artifacts", () => {
  const result = normalizeBurnVisionResult({
    patientName: "Erin Tukel DOB 09/21/1996",
    patientAge: 29,
    diagnoses: [
      { code: "T24.231A", description: "second degree burn", page: 2, confidence: .94, evidence: "handwritten code" },
      { code: "DOB", description: "date of birth", page: 1, confidence: .99, evidence: "DOB label" },
    ],
    burnRegions: [{ region: "right lower leg", depth: 2, percentOfRegion: 40, surface: "anterior", page: 2, confidence: .91, evidence: "40% beside right calf" }],
    procedures: [{ type: "split_thickness_autograft", performed: false, page: 3, confidence: .88, evidence: "planned for tomorrow" }],
  });
  assert.equal(result.patientName, "Erin Tukel");
  assert.deepEqual(result.diagnoses.map((row) => row.code), ["T24.231A"]);
  assert.equal(result.regions[0].regionId, "right_leg");
  assert.equal(result.regions[0].percentBurned, 40);
  assert.equal(result.procedures[0].performed, false);
});

test("page-isolated burn vision retains the original source page", () => {
  const result = normalizeBurnVisionResult({ diagnoses: [{ code: "T31.10", description: "extent", page: 1, confidence: .9, evidence: "visible" }], burnRegions: [], procedures: [] }, 11);
  assert.equal(result.diagnoses[0].page, 11);
});
