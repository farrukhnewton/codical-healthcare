import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("PGx workspace retains workflow landmarks, labels, and live errors", () => {
  const ui = fs.readFileSync("client/src/pages/PgxWorkspace.tsx", "utf8");
  assert.match(ui, /<nav[^>]+aria-label="PGx workflow progress"/);
  assert.match(ui, /role="alert"/);
  assert.match(ui, /<label/);
  assert.match(ui, /type="file"/);
  assert.match(ui, /type="button"/);
});

test("Specialty routes are registered", () => {
  const app = fs.readFileSync("client/src/components/layout/AuthenticatedApp.tsx", "utf8");
  assert.match(app, /path="\/specialty"/);
  assert.match(app, /path="\/specialty\/pgx"/);
});
