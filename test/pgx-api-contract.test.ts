import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("PGx API endpoints enforce authenticated ownership and preview-only claims", () => {
  const routes = fs.readFileSync("server/routes.ts", "utf8");
  for (const route of ["knowledge/genes", "knowledge/drugs", "knowledge/gene-drug", "knowledge/cms-groups", "extract", "analyze", "generate-claim", "analyses"]) {
    const index = routes.indexOf(`/api/pgx/${route}`);
    assert.ok(index >= 0, `missing route ${route}`);
    assert.match(routes.slice(index, index + 1600), /getAuthenticatedChatUser\(req\)/, `${route} must authenticate`);
  }
  const engine = fs.readFileSync("server/pgx-engine.ts", "utf8");
  assert.match(engine, /submissionEnabled:\s*false/);
  assert.match(engine, /charge:\s*null/);
  assert.doesNotMatch(engine, /diagnosisCodes\.push\("Z13\.79"\)/);
});

test("R2 object access is user-prefix scoped and short lived", () => {
  const r2 = fs.readFileSync("server/pgx-r2.ts", "utf8");
  assert.match(r2, /isPgxObjectKeyOwnedBy/);
  assert.match(r2, /expiresIn:\s*300/);
  assert.doesNotMatch(r2, /R2_PUBLIC_BASE_URL/);
});
