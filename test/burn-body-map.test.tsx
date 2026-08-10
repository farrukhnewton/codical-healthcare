import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BurnBodyMap, burnModelFillTop, burnModelKindForAge, isClinicalGarmentPoint, pediatricModelBlend, resolveBurnModelPoint } from "../client/src/components/burn/BurnBodyMap";
import { ageBandIndex } from "../shared/burn-coding";

const noop = () => undefined;

test("adult and pediatric 3D Lund-Browder maps expose distinct age modes", () => {
  const adult = renderToStaticMarkup(<BurnBodyMap age={36} regions={[]} onSelect={noop} />);
  const pediatric = renderToStaticMarkup(<BurnBodyMap age={7} regions={[]} onSelect={noop} />);
  assert.match(adult, /Adult 3D Lund–Browder/);
  assert.match(pediatric, /Pediatric 3D Lund–Browder/);
  assert.notEqual(adult, pediatric);
  assert.match(adult, /Adult \(18\+ years\)/);
  assert.match(pediatric, /5–9 years/);
});

test("pediatric model and Lund-Browder weights switch to the locked adult model at 18", () => {
  assert.equal(burnModelKindForAge(0), "pediatric");
  assert.equal(burnModelKindForAge(17.99), "pediatric");
  assert.equal(burnModelKindForAge(18), "adult");
  assert.equal(ageBandIndex(17), 4);
  assert.equal(ageBandIndex(18), 5);
  assert.deepEqual(pediatricModelBlend(0), { infant: 1, child: 0, adult: 0 });
  assert.deepEqual(pediatricModelBlend(5), { infant: 0, child: 1, adult: 0 });
  assert.deepEqual(pediatricModelBlend(13), { infant: 0, child: 1, adult: 0 });
  assert.deepEqual(pediatricModelBlend(18), { infant: 0, child: 0, adult: 1 });
});

test("percentage fill threshold stays proportional and clamps invalid input", () => {
  assert.equal(burnModelFillTop(0), -1);
  assert.equal(burnModelFillTop(50), 0);
  assert.equal(burnModelFillTop(100), 1);
  assert.equal(burnModelFillTop(-20), -1);
  assert.equal(burnModelFillTop(140), 1);
});

test("clicked mesh points resolve to Lund-Browder regions and independent surfaces", () => {
  assert.deepEqual(resolveBurnModelPoint([-2.4, 4.8, 1.0]), { regionId: "right_upper_arm", surface: "anterior" });
  assert.deepEqual(resolveBurnModelPoint([-2.4, 4.8, -0.5]), { regionId: "right_upper_arm", surface: "posterior" });
  assert.deepEqual(resolveBurnModelPoint([4.1, 2.8, 0.9]), { regionId: "left_lower_arm", surface: "anterior" });
  assert.deepEqual(resolveBurnModelPoint([-5.2, 1.5, -0.2]), { regionId: "right_hand", surface: "posterior" });
  assert.deepEqual(resolveBurnModelPoint([4.8, 2.15, 2.6]), { regionId: "left_hand", surface: "anterior" });
  assert.deepEqual(resolveBurnModelPoint([0.4, 4.2, 1.1]), { regionId: "anterior_trunk", surface: "anterior" });
  assert.deepEqual(resolveBurnModelPoint([0.4, 4.2, -0.6]), { regionId: "posterior_trunk", surface: "posterior" });
  assert.deepEqual(resolveBurnModelPoint([-0.75, 1.55, -0.4]), { regionId: "right_buttock", surface: "posterior" });
  assert.deepEqual(resolveBurnModelPoint([0.1, 1.5, 0.9]), { regionId: "perineum", surface: "anterior" });
  assert.deepEqual(resolveBurnModelPoint([-1.0, -1.2, 0.8]), { regionId: "right_thigh", surface: "anterior" });
  assert.deepEqual(resolveBurnModelPoint([1.0, -4.5, -0.3]), { regionId: "left_leg", surface: "posterior" });
  assert.deepEqual(resolveBurnModelPoint([-2.0, -7.2, 0.65]), { regionId: "right_leg", surface: "anterior" });
  assert.deepEqual(resolveBurnModelPoint([-2.0, -7.8, 1.5]), { regionId: "right_foot", surface: "anterior" });
  assert.deepEqual(resolveBurnModelPoint([0, 8.1, -0.2]), { regionId: "head", surface: "posterior" });
});

test("clinical garment covers the complete perineum and upper thighs without becoming a skirt", () => {
  assert.equal(isClinicalGarmentPoint([0, 0.2, 1]), true);
  assert.equal(isClinicalGarmentPoint([1.35, 0, 0.8]), true);
  assert.equal(isClinicalGarmentPoint([0.82, 0, 0.9]), false);
  assert.equal(isClinicalGarmentPoint([1.05, 0, 0.9]), true);
  assert.equal(isClinicalGarmentPoint([0, 2.2, 0.5]), false);
  assert.equal(isClinicalGarmentPoint([1.4, -0.3, 0.4]), false);
});
