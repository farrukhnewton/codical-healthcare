import assert from "node:assert/strict";
import test from "node:test";
import { buildPgxClaimPreview, extractPgxDataFromText, analyzePgxCoding } from "../server/pgx-engine";
import { buildPgxAuditHash, evaluatePgxCoverage, neutralizeCsvCell, PgxIntakeError, validatePgxIntakeFile } from "../server/pgx-phase2";
import { understandPgxRequisition } from "../server/services/pgx-document-understanding";

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
  assert.deepEqual(preview.documentedDiagnosisCodes, []);
  assert.ok(preview.serviceLines.every((line) => line.diagnosisCodes.length === 0));
  assert.ok(preview.serviceLines.every((line) => line.status === "review"));
});

test("OCR form labels and DOB artifacts are not accepted as diagnoses or provider names", () => {
  const extracted = extractPgxDataFromText([
    "Patient Name: .......... TUKEL, ERIN Account 44521",
    "DOB: 09/21/1996 Requisition ID P261570012",
    "Ordering Provider Signature: hand) ? Date: @ ~ 22.6",
    "D0B",
    "CYP2C19 *1/*2 intermediate metabolizer",
  ].join("\n"));

  assert.deepEqual(extracted.diagnosisCodes, []);
  assert.equal("dob" in extracted.patient, false);
  assert.equal(extracted.patient.name, "TUKEL, ERIN");
  assert.equal(extracted.orderingProvider?.name, undefined);

  const analysis = analyzePgxCoding({ extracted, primaryIcd10: "D0B" });
  assert.deepEqual(analysis.icd10, []);
});

test("unmarked requisition diagnosis lists are not treated as patient diagnoses", () => {
  const extracted = extractPgxDataFromText([
    "--- CODICAL REQUISITION START ---",
    "Group 4",
    "[ ] F20.0 Paranoid schizophrenia",
    "[ ] F25.1 Schizoaffective disorder, depressive type",
    "[ ] F41.1 Generalized anxiety disorder",
    "DOB: 09/21/1996",
    "--- CODICAL REQUISITION END ---",
    "CYP2C19 *1/*2 intermediate metabolizer",
  ].join("\n"));

  assert.deepEqual(extracted.diagnosisCodes, []);
});

test("vision requisition extraction normalizes handwriting and rejects DOB artifacts", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body || "{}"));
    assert.match(request.contents[0].parts[0].text, /only diagnoses and active medications visibly selected/i);
    assert.equal(request.contents[0].parts[1].inlineData.mimeType, "image/png");
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              selectedDiagnoses: [
                { code: "F251", description: "Schizoaffective disorder, depressive type", selectionType: "handwritten_circled", page: 2, confidence: 0.96, evidence: "handwritten code inside circle" },
                { code: "DOB", description: "Date of birth", selectionType: "other_mark", page: 1, confidence: 0.99, evidence: "printed label" },
              ],
            }),
          }],
        },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await understandPgxRequisition({
      buffer: Buffer.from("not-a-real-image"),
      mimetype: "image/png",
      originalname: "requisition.png",
    });
    assert.equal(result.used, true);
    assert.deepEqual(result.selections.map((selection) => selection.code), ["F25.1"]);
    assert.equal(result.selections[0].selectionType, "handwritten_circled");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("isolated diagnosis-page vision preserves the original PDF page number", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
    patientName: "", activeMedications: [], geneResults: [],
    selectedDiagnoses: [{ code: "F251", description: "Schizoaffective disorder, depressive type", selectionType: "handwritten_circled", page: 1, confidence: .97, evidence: "F25.1 handwritten inside a circle" }],
  }) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const result = await understandPgxRequisition({ buffer: Buffer.from("page-image"), mimetype: "image/jpeg" }, { sourcePage: 11 });
    assert.equal(result.selections[0].code, "F25.1");
    assert.equal(result.selections[0].page, 11);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("active medications and diagnoses prefer requisition context over lab-report mentions", () => {
  const extracted = extractPgxDataFromText([
    "--- CODICAL LAB REPORT START ---",
    "CYP2C19 guidance discusses clopidogrel, citalopram, escitalopram, and omeprazole.",
    "--- CODICAL LAB REPORT END ---",
    "--- CODICAL REQUISITION START ---",
    "Patient Name: Erin Tukel",
    "Diagnosis: F33.2",
    "Current medications: clopidogrel",
    "--- CODICAL REQUISITION END ---",
  ].join("\n"));

  assert.deepEqual(extracted.diagnosisCodes, ["F33.2"]);
  assert.deepEqual(extracted.medications.map((medication) => medication.name), ["clopidogrel"]);
});

test("claim preview separates the performed service from gene-medication evidence", () => {
  const extracted = extractPgxDataFromText("CYP2C19 *1/*2 intermediate metabolizer\nMedication: clopidogrel\nDiagnosis: F33.2");
  const analysis = analyzePgxCoding({ extracted, primaryIcd10: "F33.2", drugNames: ["clopidogrel"] });
  const worksheet = buildPgxClaimPreview(analysis);

  assert.equal(worksheet.claimType, "PGX_BILLING_WORKSHEET");
  assert.equal(worksheet.serviceLines[0].cptCode, "81225");
  assert.equal(worksheet.serviceLines[0].units, 1);
  assert.deepEqual(worksheet.serviceLines[0].medications, ["clopidogrel"]);
  assert.equal(worksheet.evidenceRows[0].gene, "CYP2C19");
  assert.equal(worksheet.serviceLines[0].status, "review");
});

test("billing rows become ready only when CPT, active medication, and CMS diagnosis group all match", () => {
  const extracted = extractPgxDataFromText("CYP2C19 *1/*2 intermediate metabolizer\nMedication: clopidogrel\nDiagnosis: F33.2");
  const analysis = analyzePgxCoding({
    extracted,
    primaryIcd10: "F33.2",
    drugNames: ["clopidogrel"],
    cmsGroups: [
      { articleId: "A59915", groupNumber: 2, groupType: "cpt", code: "81225" },
      { articleId: "A59915", groupNumber: 2, groupType: "icd10", code: "F33.2" },
    ],
  });
  assert.equal(analysis.billingWorksheet.serviceLines[0].status, "ready");
  assert.equal(analysis.billingWorksheet.serviceLines[0].cmsMatches[0].groupNumber, 2);
});

test("manual diagnosis remains documented without being copied into unsupported service or gene rows", () => {
  const extracted = extractPgxDataFromText("CYP2C19 *1/*2 intermediate metabolizer\nMedication: clopidogrel");
  const analysis = analyzePgxCoding({
    extracted,
    diagnosisCodes: ["F25.1"],
    drugNames: ["clopidogrel"],
    cmsGroups: [],
  });

  assert.deepEqual(analysis.billingWorksheet.documentedDiagnosisCodes, ["F25.1"]);
  assert.ok(analysis.billingWorksheet.serviceLines.length > 0);
  assert.ok(analysis.billingWorksheet.serviceLines.every((line) => line.diagnosisCodes.length === 0));
  assert.ok(analysis.billingWorksheet.serviceLines.every((line) => line.status === "review"));
  assert.ok(analysis.billingWorksheet.serviceLines.every((line) => line.issues.some((issue) => /F25\.1 is documented/.test(issue))));
});

test("production worksheet requires same-article CMS gene/drug/CPT evidence", () => {
  const extracted = extractPgxDataFromText("CYP2C19 *1/*2 intermediate metabolizer\nMedication: clopidogrel\nDiagnosis: F33.2");
  const cmsGroups = [
    { articleId: "A58801", groupNumber: 2, groupType: "cpt" as const, code: "81225" },
    { articleId: "A58801", groupNumber: 2, groupType: "icd10" as const, code: "F33.2" },
  ];
  const held = analyzePgxCoding({ extracted, drugNames: ["clopidogrel"], cmsGroups, cmsDrugEvidence: [] });
  assert.equal(held.billingWorksheet.serviceLines[0].status, "review");
  assert.match(held.billingWorksheet.serviceLines[0].issues.join(" "), /No actionable gene-drug pair is linked to 81225/);

  const ready = analyzePgxCoding({
    extracted,
    drugNames: ["clopidogrel"],
    cmsGroups,
    cmsDrugEvidence: [{ articleId: "A58801", gene: "CYP2C19", drug: "clopidogrel", cptCodes: ["81225"] }],
  });
  assert.equal(ready.billingWorksheet.serviceLines[0].status, "ready");
  assert.equal(ready.billingWorksheet.serviceLines[0].cmsMatches[0].articleId, "A58801");
});

test("a qualifying 81418 panel creates one service line and separate evidence rows", () => {
  const extracted = extractPgxDataFromText([
    "CYP2C19 normal metabolizer",
    "CYP2D6 normal metabolizer with copy number analysis",
    "CYP2C9 intermediate metabolizer",
    "CYP3A5 poor metabolizer",
    "SLCO1B1 decreased function",
    "VKORC1 normal sensitivity",
    "Medication: clopidogrel",
    "Diagnosis: F41.1",
  ].join("\n"));
  const analysis = analyzePgxCoding({
    extracted,
    cmsGroups: [
      { articleId: "A59915", groupNumber: 2, groupType: "cpt", code: "81418" },
      { articleId: "A59915", groupNumber: 2, groupType: "icd10", code: "F41.1" },
    ],
  });

  assert.equal(analysis.billingWorksheet.serviceLines.length, 1);
  assert.equal(analysis.billingWorksheet.serviceLines[0].cptCode, "81418");
  assert.equal(analysis.billingWorksheet.serviceLines[0].units, 1);
  assert.deepEqual(analysis.billingWorksheet.serviceLines[0].diagnosisCodes, ["F41.1"]);
  assert.equal(analysis.billingWorksheet.evidenceRows.length, 6);
  assert.ok(analysis.billingWorksheet.evidenceRows.every((row) => !("cptCode" in row)));
});

test("CSV output is formula-neutralized and audit hashes are deterministic", () => {
  assert.equal(neutralizeCsvCell("=HYPERLINK(\"https://example.test\")"), "'=HYPERLINK(\"https://example.test\")");
  assert.equal(neutralizeCsvCell("81225"), "81225");
  const event = { tenantId: "tenant", userId: 7, eventType: "export", entityType: "analysis", entityId: "a1", timestamp: "2026-07-28T00:00:00.000Z" };
  assert.equal(buildPgxAuditHash(event), buildPgxAuditHash(event));
});
