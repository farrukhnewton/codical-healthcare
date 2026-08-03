import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("PGx workspace exposes accessible intake and a single billing worksheet without the prototype stepper", () => {
  const ui = fs.readFileSync("client/src/pages/PgxWorkspace.tsx", "utf8");
  assert.match(ui, /role="alert"/);
  assert.match(ui, /role="status"/);
  assert.match(ui, /<label/);
  assert.match(ui, /type="file"/);
  assert.match(ui, /type="button"/);
  assert.match(ui, /Billable services and PGx evidence/);
  assert.match(ui, /not additional claim lines/i);
  assert.doesNotMatch(ui, /CMS-1500|UB-04/);
  assert.match(ui, /aria-invalid=/);
  assert.match(ui, /Marked diagnoses found/);
  assert.doesNotMatch(ui, /PGx workflow progress/);
  assert.doesNotMatch(ui, /JSON\.stringify\(claim\.claimJson/);
});

test("Specialty Coding is injected immediately after Code Search", () => {
  const sidebar = fs.readFileSync("client/src/components/layout/IconRail.tsx", "utf8");
  assert.match(sidebar, /href: "\/search"[\s\S]*href: "\/specialty"/);
  assert.doesNotMatch(sidebar, /SpecialtyNavigation|app-specialty-native-toggle/);
  assert.doesNotMatch(sidebar, /SPECIALTY_MODULES\.map/);
});

test("Specialty routes are registered", () => {
  const app = fs.readFileSync("client/src/components/layout/AuthenticatedApp.tsx", "utf8");
  assert.match(app, /path="\/specialty"/);
  assert.match(app, /path="\/specialty\/pgx"/);
  assert.match(app, /path="\/specialty\/burn"/);
});

test("Burn workspace exposes guarded coding inputs and no autonomous claim action", () => {
  const ui = fs.readFileSync("client/src/pages/BurnWorkspace.tsx", "utf8");
  assert.match(ui, /Superficial \/ 1st/);
  assert.match(ui, /Service actually performed/);
  assert.match(ui, /Candidate service lines/);
  assert.match(ui, /Documentation gates/);
  assert.doesNotMatch(ui, /Submit claim/i);
});
