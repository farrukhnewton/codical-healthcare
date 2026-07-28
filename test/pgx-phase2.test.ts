import assert from "node:assert/strict";
import test from "node:test";
import { buildPgxClaimPreview, extractPgxDataFromText, analyzePgxCoding } from "../server/pgx-engine";
import { buildPgxAuditHash, evaluatePgxCoverage, neutralizeCsvCell, PgxIntakeError, validatePgxIntakeFile } from "../server/pgx-phase2";

test("intake validates extension, MIME, signature and safe text", () => {
  const text = Buffer.from("CYP2C19 *1/*2 intermediate metabolizer\nMedication: clopidogrel", "utf8");
  const result = validatePgxIntakeFile({ name: "report.txt", mimeType: "text/plain", buffer: text });
  assert.equal(result.kind, "txt");
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.throws(
    () => validatePgxIntakeFile({ name: "report.pdf", mimeType: "application/pdf", buffer: text }),
    (error: unknown) => error instanceof PgxIntakeError && error.code === "signature_mismatch",
  );
  assert.throws(
    () => validatePgxIntakeFile({ name: "report.exe", mimeType: "application/octet-stream", buffer: text }),
    (error: unknown) => error instanceof PgxIntakeError && error.code === "unsupported_extension",
  );
});

test("PDF and image intake fail closed on malformed signatures", () => {
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj <</Type /Page>> endobj\n%%EOF", "latin1");
  assert.equal(validatePgxIntakeFile({ name: "report.pdf", mimeType: "application/pdf", buffer: pdf }).pageCount, 1);
  const encrypted = Buffer.from("%PDF-1.7\n/Encrypt 2 0 R\n%%EOF", "latin1");
  assert.throws(() => validatePgxIntakeFile({ name: "locked.pdf", mimeType: "application/pdf", buffer: encrypted }));
  assert.throws(() => validatePgxIntakeFile({ name: "image.png", mimeType: "image/png", buffer: Buffer.from("not png") }));
});

test("coverage decisions require jurisdiction, source freshness and verified evidence", () => {
  assert.equal(evaluatePgxCoverage({ sourceStatus: "current", evidence: [] }).state, "jurisdiction_not_configured");
  assert.equal(evaluatePgxCoverage({ stateCode: "NY", macId: "mac-1", serviceDate: "2026-07-28", sourceStatus: "outdated", evidence: [] }).state, "source_outdated");
  const evidence = [{
    sourceVersionId: "cms-v1", stateCode: "NY", macId: "mac-1", codeSystem: "CPT" as const, code: "81225",
    relationshipStatus: "supported" as const, effectiveDate: "2025-01-01", endDate: null, reviewStatus: "verified" as const,
  }];
  const result = evaluatePgxCoverage({ stateCode: "NY", macId: "mac-1", serviceDate: "2026-07-28", sourceStatus: "current", evidence });
  assert.equal(result.state, "supported");
  assert.deepEqual(result.sourceVersionIds, ["cms-v1"]);
});

test("PGx extraction does not invent diagnosis codes or charge values", () => {
  const extracted = extractPgxDataFromText("CYP2C19 *1/*2 intermediate metabolizer\nMedication: clopidogrel");
  assert.deepEqual(extracted.diagnosisCodes, []);
  const analysis = analyzePgxCoding({ extracted, drugNames: ["clopidogrel"] });
  const preview = buildPgxClaimPreview(analysis);
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.submissionEnabled, false);
  assert.equal(preview.coverageDecision, "jurisdiction_not_configured");
  assert.deepEqual(preview.diagnosisPointers, []);
  assert.ok(preview.serviceLines.every((line) => line.charge === null && line.referenceRate === null));
});

test("CSV output is formula-neutralized and audit hashes are deterministic", () => {
  assert.equal(neutralizeCsvCell("=HYPERLINK(\"https://example.test\")"), "'=HYPERLINK(\"https://example.test\")");
  assert.equal(neutralizeCsvCell("81225"), "81225");
  const event = { tenantId: "tenant", userId: 7, eventType: "export", entityType: "analysis", entityId: "a1", timestamp: "2026-07-28T00:00:00.000Z" };
  assert.equal(buildPgxAuditHash(event), buildPgxAuditHash(event));
});
