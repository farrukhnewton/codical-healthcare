import assert from "node:assert/strict";
import test from "node:test";
import { analyzeBurnCase, extentCode, type BurnCaseInput } from "../shared/burn-coding";

function caseInput(overrides: Partial<BurnCaseInput> = {}): BurnCaseInput {
  return {
    patientAge: 40,
    serviceDate: "2026-08-03",
    injuryType: "burn",
    encounter: "initial",
    regions: [],
    service: { type: "assessment_only", performed: false },
    ...overrides,
  };
}

test("superficial burns are tracked but excluded from counted TBSA", () => {
  const result = analyzeBurnCase(caseInput({ regions: [{ regionId: "head", burnDepth: 1, percentBurned: 100 }] }));
  assert.equal(result.superficialTbsa, 7);
  assert.equal(result.totalTbsa, 0);
  assert.equal(result.extentCode, null);
});

test("extent codes do not create invalid T31.00 and switch to T32 for corrosion", () => {
  assert.equal(extentCode(8, 0, "burn"), "T31.0");
  assert.equal(extentCode(28, 14, "burn"), "T31.21");
  assert.equal(extentCode(16, 0, "corrosion"), "T32.10");
});

test("Lund-Browder calculation uses the pediatric age band", () => {
  const result = analyzeBurnCase(caseInput({ patientAge: 3, regions: [{ regionId: "head", burnDepth: 2, percentBurned: 50 }] }));
  assert.equal(result.totalTbsa, 8.5);
  assert.equal(result.extentCode, "T31.0");
});

test("anterior and posterior limb surfaces calculate independently", () => {
  const anterior = analyzeBurnCase(caseInput({ regions: [{ regionId: "right_upper_arm", surface: "anterior", burnDepth: 2, percentBurned: 100 }] }));
  const both = analyzeBurnCase(caseInput({ regions: [
    { regionId: "right_upper_arm", surface: "anterior", burnDepth: 2, percentBurned: 100 },
    { regionId: "right_upper_arm", surface: "posterior", burnDepth: 2, percentBurned: 100 },
  ] }));
  assert.equal(anterior.totalTbsa, 2);
  assert.equal(both.totalTbsa, 4);
});

for (const [area, expected] of [
  [12, [["15271", 1]]],
  [40, [["15271", 1], ["15272", 1]]],
  [100, [["15273", 1]]],
  [250, [["15273", 1], ["15274", 2]]],
] as const) {
  test(`sheet skin substitute application calculates ${area} cm² units`, () => {
    const result = analyzeBurnCase(caseInput({
      regions: [{ regionId: "anterior_trunk", burnDepth: 2, percentBurned: 25 }],
      service: { type: "skin_substitute_sheet", performed: true, siteGroup: "trunk_limbs", areaCm2: area, productForm: "sheet" },
    }));
    assert.deepEqual(result.serviceLines.map(({ code, units }) => [code, units]), expected);
  });
}

test("burned surfaces suppress general wound debridement families", () => {
  const result = analyzeBurnCase(caseInput({
    regions: [{ regionId: "right_leg", burnDepth: 2, percentBurned: 50 }],
    service: { type: "non_burn_debridement", performed: true, areaCm2: 30 },
  }));
  assert.equal(result.serviceLines.length, 0);
  assert.match(result.warnings.join(" "), /withheld/i);
});

test("sequela encounters do not receive T31 or T32 extent codes", () => {
  const result = analyzeBurnCase(caseInput({ encounter: "sequela", regions: [{ regionId: "anterior_trunk", burnDepth: 3, percentBurned: 100 }] }));
  assert.equal(result.extentCode, null);
  assert.match(result.warnings.join(" "), /sequela/i);
});
