import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateWorkPriority,
  canTransitionClaim,
  evaluateClaimIntegrity,
  isValidNpi,
  revenueClaimCorrectionSchema,
  revenueClaimCreateSchema,
  revenueTransmissionSchema,
  revenueWorkItemActionSchema,
} from "../shared/revenue-integrity";
import { canCorrectRevenueClaim, summarizeClaimChanges } from "../server/services/revenue-integrity/claim-correction";
import { ClearinghouseConfigurationError } from "../server/services/revenue-integrity/clearinghouse";
import { OptumSandboxAdapter } from "../server/services/revenue-integrity/optum-sandbox-adapter";
import { createOptumCertificationFixture } from "../server/services/revenue-integrity/optum-certification-fixtures";
import { mapProfessionalClaimToOptum } from "../server/services/revenue-integrity/optum-professional-claim";
import { StediClearinghouseAdapter } from "../server/services/revenue-integrity/stedi-adapter";
import { mapProfessionalClaimToStedi } from "../server/services/revenue-integrity/stedi-professional-claim";
import { normalize277ClaimAcknowledgments, normalize835Remittances, parseStediWebhookEvent } from "../server/services/revenue-integrity/stedi-responses";
import {
  REVENUE_SESSION_COOKIE,
  cookieValue,
  createRevenueSession,
  serializeRevenueSessionCookie,
  verifyRevenueSession,
} from "../server/services/revenue-integrity/revenue-session";

const validClaim = revenueClaimCreateSchema.parse({
  patientControlNumber: "PCN-10001",
  payerId: "STEDITEST",
  payerName: "Stedi Test Payer",
  serviceFrom: "2026-08-21",
  billingProviderNpi: "1234567893",
  diagnosisCodes: ["I10"],
  totalCharge: 150,
  lines: [{
    lineNumber: 1,
    procedureCode: "99213",
    diagnosisPointers: [1],
    units: 1,
    chargeAmount: 150,
    placeOfService: "11",
  }],
});

function loadFixture(name: string) {
  return JSON.parse(readFileSync(new URL(`./fixtures/revenue-integrity/${name}`, import.meta.url), "utf8")) as {
    claim: unknown;
    expected: { ready: boolean; integrityScore?: number; issueCodes: string[] };
  };
}

test("round-trips a Revenue Integrity session only for the bearer token that created it", () => {
  const now = Date.UTC(2026, 7, 28, 12, 0, 0);
  const sessionToken = createRevenueSession({
    identity: { id: "user-123", email: "coder@example.com", user_metadata: { full_name: "Test Coder" } },
    bearerToken: "supabase-access-token",
    secret: "test-session-secret",
    now,
  });

  assert.deepEqual(verifyRevenueSession({
    sessionToken,
    bearerToken: "supabase-access-token",
    secret: "test-session-secret",
    now: now + 60_000,
  }), {
    id: "user-123",
    email: "coder@example.com",
    user_metadata: { full_name: "Test Coder" },
  });
  assert.equal(verifyRevenueSession({
    sessionToken,
    bearerToken: "a-different-access-token",
    secret: "test-session-secret",
    now: now + 60_000,
  }), null);
});

test("rejects tampered and expired Revenue Integrity sessions", () => {
  const now = Date.UTC(2026, 7, 28, 12, 0, 0);
  const sessionToken = createRevenueSession({
    identity: { id: "user-123" },
    bearerToken: "supabase-access-token",
    secret: "test-session-secret",
    now,
  });
  const tampered = `${sessionToken.slice(0, -1)}${sessionToken.endsWith("a") ? "b" : "a"}`;

  assert.equal(verifyRevenueSession({
    sessionToken: tampered,
    bearerToken: "supabase-access-token",
    secret: "test-session-secret",
    now: now + 60_000,
  }), null);
  assert.equal(verifyRevenueSession({
    sessionToken,
    bearerToken: "supabase-access-token",
    secret: "test-session-secret",
    now: now + 11 * 60_000,
  }), null);
});

test("serializes a scoped secure HTTP-only Revenue Integrity cookie", () => {
  const serialized = serializeRevenueSessionCookie("signed.session", true);
  assert.match(serialized, new RegExp(`^${REVENUE_SESSION_COOKIE}=`));
  assert.match(serialized, /Path=\/api\/revenue-integrity/);
  assert.match(serialized, /HttpOnly/);
  assert.match(serialized, /SameSite=Strict/);
  assert.match(serialized, /Secure/);
  assert.equal(cookieValue(`unrelated=1; ${REVENUE_SESSION_COOKIE}=signed.session; another=2`, REVENUE_SESSION_COOKIE), "signed.session");
});

test("validates an NPI using the CMS check-digit convention", () => {
  assert.equal(isValidNpi("1234567893"), true);
  assert.equal(isValidNpi("1234567890"), false);
});

test("marks a structurally complete professional claim ready", () => {
  const result = evaluateClaimIntegrity(validClaim);
  assert.equal(result.ready, true);
  assert.equal(result.score, 100);
  assert.deepEqual(result.issues, []);
});

test("holds claims with invalid diagnosis pointers and unreconciled charges", () => {
  const result = evaluateClaimIntegrity({
    ...validClaim,
    totalCharge: 200,
    lines: [{ ...validClaim.lines[0], diagnosisPointers: [2] }],
  });
  assert.equal(result.ready, false);
  assert.ok(result.issues.some((issue) => issue.code === "INVALID_DIAGNOSIS_POINTER"));
  assert.ok(result.issues.some((issue) => issue.code === "CHARGE_TOTAL_MISMATCH"));
});

test("keeps the synthetic certification fixtures aligned with the validator", () => {
  for (const fixtureName of ["professional-claim-ready.json", "professional-claim-hold.json"]) {
    const fixture = loadFixture(fixtureName);
    const claim = revenueClaimCreateSchema.parse(fixture.claim);
    const result = evaluateClaimIntegrity(claim);
    assert.equal(result.ready, fixture.expected.ready);
    if (fixture.expected.integrityScore !== undefined) {
      assert.equal(result.score, fixture.expected.integrityScore);
    }
    for (const issueCode of fixture.expected.issueCodes) {
      assert.ok(result.issues.some((issue) => issue.code === issueCode), `${fixtureName} must include ${issueCode}`);
    }
  }
});

test("enforces the claim lifecycle transition guard", () => {
  assert.equal(canTransitionClaim("ready", "submitted"), true);
  assert.equal(canTransitionClaim("draft", "paid"), false);
  assert.equal(canTransitionClaim("denied", "appealed"), true);
});

test("prioritizes critical, high-value, near-deadline work", () => {
  const urgent = calculateWorkPriority({ severity: "critical", recoverableAmount: 25_000, deadlineHours: 12, confidence: 0.95 });
  const routine = calculateWorkPriority({ severity: "low", recoverableAmount: 50, deadlineHours: 720, confidence: 0.5 });
  assert.ok(urgent > routine);
  assert.ok(urgent >= 90);
});

test("blocks production submission unless the server-side live switch is enabled", async () => {
  const adapter = new StediClearinghouseAdapter({ apiKey: "test-key", mode: "production", liveSubmissionEnabled: false });
  await assert.rejects(
    () => adapter.submitProfessionalClaim({ payload: {}, idempotencyKey: "claim-1" }),
    ClearinghouseConfigurationError,
  );
});

test("forces the test usage indicator for certification submissions", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  let capturedIdempotency = "";
  const adapter = new StediClearinghouseAdapter({
    apiKey: "test-key",
    mode: "test",
    testSubmissionEnabled: true,
    fetchImpl: async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body || "{}"));
      capturedIdempotency = new Headers(init?.headers).get("Idempotency-Key") || "";
      return new Response(JSON.stringify({ transactionId: "tx-test-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await adapter.submitProfessionalClaim({
    payload: { usageIndicator: "P", claimInformation: { patientControlNumber: "PCN-10001" } },
    idempotencyKey: "claim-1",
  });
  assert.equal(capturedBody?.usageIndicator, "T");
  assert.equal(capturedIdempotency, "claim-1");
  assert.equal(result.transactionId, "tx-test-1");
});

test("keeps certification submission disabled until the server test switch is enabled", async () => {
  const adapter = new StediClearinghouseAdapter({ apiKey: "test-key", mode: "test", testSubmissionEnabled: false });
  await assert.rejects(
    () => adapter.submitProfessionalClaim({ payload: {}, idempotencyKey: "claim-disabled" }),
    ClearinghouseConfigurationError,
  );
});

test("keeps Optum sandbox validation locked when submission is enabled", () => {
  const adapter = new OptumSandboxAdapter({
    clientId: "sandbox-client",
    clientSecret: "sandbox-secret",
    validationEnabled: true,
    submissionEnabled: true,
  });
  const readiness = adapter.readiness();
  assert.equal(readiness.validationEnabled, false);
  assert.equal(readiness.submissionEnabled, false);
  assert.ok(readiness.blockers.some((blocker) => blocker.includes("must remain false")));
});

test("validates a synthetic 837P through Optum sandbox and forces test usage", async () => {
  const requested: Array<{ url: string; body: Record<string, unknown> }> = [];
  const adapter = new OptumSandboxAdapter({
    clientId: "sandbox-client",
    clientSecret: "sandbox-secret",
    validationEnabled: true,
    submissionEnabled: false,
    fetchImpl: async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      requested.push({ url, body });
      if (url.endsWith("/apip/auth/v2/token")) {
        return new Response(JSON.stringify({ access_token: "sandbox-token", token_type: "Bearer", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        status: "SUCCESS",
        editStatus: "SUCCESS",
        controlNumber: "000000001",
        claimReference: { correlationId: "optum-correlation-1" },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const result = await adapter.validateProfessionalClaim({
    payload: { usageIndicator: "P", claimInformation: { patientControlNumber: "test00001" } },
    idempotencyKey: "optum-validation-1",
    dataClassification: "synthetic",
  });
  assert.equal(requested.length, 2);
  assert.ok(requested[1].url.endsWith("/professionalclaims/v3/validation"));
  assert.equal(requested[1].body.usageIndicator, "T");
  assert.equal(result.valid, true);
  assert.equal(result.correlationId, "optum-correlation-1");
});

test("builds Optum certification claims with the required control number and synthetic-only marker", () => {
  for (const scenario of ["success", "edits"] as const) {
    const fixture = createOptumCertificationFixture(scenario);
    const integrity = evaluateClaimIntegrity(fixture.claim);
    const mapping = mapProfessionalClaimToOptum(fixture.claim, fixture.transmission, fixture.controlNumber);
    assert.equal(integrity.ready, true);
    assert.deepEqual(mapping.issues, []);
    assert.ok(mapping.payload);
    assert.match(String(mapping.payload?.controlNumber), /^\d{9}$/);
    assert.equal(mapping.payload?.usageIndicator, "T");
    const billing = mapping.payload?.billing as Record<string, unknown>;
    const rendering = mapping.payload?.rendering as Record<string, unknown>;
    const subscriber = mapping.payload?.subscriber as Record<string, unknown>;
    const dependent = mapping.payload?.dependent as Record<string, unknown>;
    assert.equal(billing.npi, fixture.claim.billingProviderNpi);
    assert.equal(billing.providerType, "BillingProvider");
    assert.equal(rendering.providerType, "RenderingProvider");
    assert.match(String(subscriber.gender), /^(M|F|U)$/);
    assert.match(String(dependent.gender), /^(M|F|U)$/);
    assert.equal(fixture.claim.metadata.dataClassification, "synthetic");
  }
  assert.equal(createOptumCertificationFixture("edits").claim.patientControlNumber, "test00005");
});

test("normalizes Optum validation edits for the Revenue Integrity work queue", async () => {
  const adapter = new OptumSandboxAdapter({
    clientId: "sandbox-client",
    clientSecret: "sandbox-secret",
    validationEnabled: true,
    fetchImpl: async (input) => {
      if (String(input).endsWith("/apip/auth/v2/token")) {
        return new Response(JSON.stringify({ access_token: "sandbox-token", expires_in: 3600 }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        status: "EDITS",
        editStatus: "EDITS",
        errors: [{ field: "claimInformation.patientControlNumber", value: "test00005", description: "Synthetic canned edit", location: "2300 CLM01" }],
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    },
  });
  const result = await adapter.validateProfessionalClaim({ payload: {}, idempotencyKey: "edit-case", dataClassification: "synthetic" });
  assert.equal(result.valid, false);
  assert.equal(result.status, "EDITS");
  assert.equal(result.editStatus, "EDITS");
  assert.deepEqual(result.edits, [{
    field: "claimInformation.patientControlNumber",
    value: "test00005",
    description: "Synthetic canned edit",
    location: "2300 CLM01",
  }]);
});

test("keeps unstructured Optum HTTP errors in the transport failure path", async () => {
  const adapter = new OptumSandboxAdapter({
    clientId: "sandbox-client",
    clientSecret: "sandbox-secret",
    validationEnabled: true,
    fetchImpl: async (input) => {
      if (String(input).endsWith("/apip/auth/v2/token")) {
        return new Response(JSON.stringify({ access_token: "sandbox-token", expires_in: 3600 }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ message: "Temporary upstream failure" }), { status: 503, headers: { "Content-Type": "application/json" } });
    },
  });
  await assert.rejects(
    () => adapter.validateProfessionalClaim({ payload: {}, idempotencyKey: "transport-error", dataClassification: "synthetic" }),
    /Temporary upstream failure/,
  );
});

test("reuses an unexpired Optum OAuth token across validations", async () => {
  let tokenCalls = 0;
  const adapter = new OptumSandboxAdapter({
    clientId: "sandbox-client",
    clientSecret: "sandbox-secret",
    validationEnabled: true,
    fetchImpl: async (input) => {
      if (String(input).endsWith("/apip/auth/v2/token")) {
        tokenCalls += 1;
        return new Response(JSON.stringify({ access_token: "cached-token", expires_in: 3600 }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ status: "SUCCESS", editStatus: "SUCCESS" }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  await adapter.validateProfessionalClaim({ payload: {}, idempotencyKey: "first", dataClassification: "synthetic" });
  await adapter.validateProfessionalClaim({ payload: {}, idempotencyKey: "second", dataClassification: "synthetic" });
  assert.equal(tokenCalls, 1);
});

test("rejects real or unclassified data before Optum sandbox authentication", async () => {
  let fetchCalls = 0;
  const adapter = new OptumSandboxAdapter({
    clientId: "sandbox-client",
    clientSecret: "sandbox-secret",
    validationEnabled: true,
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("{}", { status: 200 });
    },
  });
  await assert.rejects(
    () => adapter.validateProfessionalClaim({ payload: {}, idempotencyKey: "unsafe" }),
    /synthetic data only/,
  );
  assert.equal(fetchCalls, 0);
});

test("retrieves 277CA and 835 reports through their versioned endpoints", async () => {
  const requested: string[] = [];
  const adapter = new StediClearinghouseAdapter({
    apiKey: "test-key",
    mode: "test",
    testSubmissionEnabled: true,
    fetchImpl: async (input) => {
      requested.push(String(input));
      return new Response(JSON.stringify({ transactions: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  await adapter.retrieveClaimAcknowledgment("tx-277-test-001");
  await adapter.retrieveRemittance("tx-835-test-001");
  assert.ok(requested[0].endsWith("/reports/v2/tx-277-test-001/277"));
  assert.ok(requested[1].endsWith("/reports/v2/tx-835-test-001/835"));
});

const validTransmission = revenueTransmissionSchema.parse({
  tradingPartnerServiceId: "STEDI",
  tradingPartnerName: "Stedi Test Payer",
  submitter: {
    organizationName: "Codical Test Submitter",
    submitterIdentification: "SUBMITTER01",
    contactInformation: { name: "Test Operations", phoneNumber: "5552223333" },
  },
  receiver: { organizationName: "Stedi Test Payer" },
  subscriber: {
    memberId: "MEMBER0001",
    firstName: "Synthetic",
    lastName: "Patient",
    dateOfBirth: "1990-01-01",
    gender: "U",
    address: { address1: "1 Test Avenue", city: "Test City", state: "NY", postalCode: "100010001" },
  },
  billing: {
    organizationName: "Codical Test Clinic",
    npi: "1234567893",
    employerId: "123456789",
    taxonomyCode: "2084P0800X",
    address: { address1: "2 Test Avenue", city: "Test City", state: "NY", postalCode: "100010001" },
    contactInformation: { name: "Billing Office", phoneNumber: "5553334444" },
  },
});

test("maps a verified canonical claim to the current Stedi 837P JSON contract", () => {
  const mapping = mapProfessionalClaimToStedi({ ...validClaim, patientControlNumber: "RI837P000000001" }, validTransmission);
  assert.deepEqual(mapping.issues, []);
  assert.ok(mapping.payload);
  const claimInformation = mapping.payload?.claimInformation as Record<string, unknown>;
  const serviceLines = claimInformation.serviceLines as Array<Record<string, unknown>>;
  assert.equal(mapping.payload?.tradingPartnerServiceId, "STEDI");
  assert.equal(claimInformation.patientControlNumber, "RI837P000000001");
  assert.equal(serviceLines[0].providerControlNumber, "RI837P000000001-1");
  assert.equal((serviceLines[0].professionalService as Record<string, unknown>).procedureCode, "99213");
});

test("holds an 837P mapping when the PCN cannot be reliably correlated", () => {
  const mapping = mapProfessionalClaimToStedi({ ...validClaim, patientControlNumber: "THIS-PCN-IS-FAR-TOO-LONG" }, validTransmission);
  assert.equal(mapping.payload, null);
  assert.ok(mapping.issues.some((issue) => issue.code === "PCN_TOO_LONG"));
  assert.ok(mapping.issues.some((issue) => issue.code === "PCN_NOT_X12_SAFE"));
});

test("parses and validates the Stedi webhook envelope", () => {
  const event = parseStediWebhookEvent({
    version: "0",
    id: "event-001",
    "detail-type": "transaction.processed.v2",
    source: "stedi.core",
    time: "2026-08-22T00:00:00Z",
    detail: { transactionId: "tx-277-001", x12: { transactionSetIdentifier: "277" } },
  });
  assert.equal(event.transactionId, "tx-277-001");
  assert.equal(event.transactionSetIdentifier, "277");
  assert.throws(() => parseStediWebhookEvent({ id: "bad" }));
});

test("normalizes a rejected 277CA with claim and service-line correlation", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/revenue-integrity/stedi-277ca-rejected.json", import.meta.url), "utf8"));
  const acknowledgments = normalize277ClaimAcknowledgments(fixture);
  assert.equal(acknowledgments.length, 1);
  assert.equal(acknowledgments[0].patientControlNumber, "RI837P000000001");
  assert.equal(acknowledgments[0].accepted, false);
  assert.equal(acknowledgments[0].categoryCode, "A3");
  assert.equal(acknowledgments[0].lineItemControlNumber, "RI837P000000001-1");
});

test("normalizes an 835 into claim and line payment facts", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/revenue-integrity/stedi-835-partial.json", import.meta.url), "utf8"));
  const remittances = normalize835Remittances(fixture);
  assert.equal(remittances.length, 1);
  assert.equal(remittances[0].paidAmount, 100);
  assert.equal(remittances[0].patientResponsibilityAmount, 20);
  assert.equal(remittances[0].lines[0].allowedAmount, 120);
  assert.equal(remittances[0].lines[0].lineItemControlNumber, "RI837P000000001-1");
});

test("accepts a controlled claim correction with an optimistic version and audit reason", () => {
  const correction = revenueClaimCorrectionSchema.parse({
    expectedVersion: 3,
    reason: "Correct the payer edit before revalidation.",
    claim: { ...validClaim, patientControlNumber: "PCN-10002" },
    transmission: validTransmission,
  });
  assert.equal(correction.expectedVersion, 3);
  assert.equal(correction.claim.patientControlNumber, "PCN-10002");
  assert.throws(() => revenueClaimCorrectionSchema.parse({
    expectedVersion: 0,
    reason: "bad",
    claim: validClaim,
  }));
});

test("requires a disposition note when a work item is closed or reopened", () => {
  assert.deepEqual(revenueWorkItemActionSchema.parse({ action: "start" }), { action: "start" });
  assert.throws(() => revenueWorkItemActionSchema.parse({ action: "resolve" }));
  assert.equal(revenueWorkItemActionSchema.parse({ action: "resolve", note: "Corrected and independently verified." }).action, "resolve");
});

test("limits in-place corrections to pre-submission claim states", () => {
  assert.equal(canCorrectRevenueClaim("needs_review"), true);
  assert.equal(canCorrectRevenueClaim("ready"), true);
  assert.equal(canCorrectRevenueClaim("submitted"), false);
  assert.equal(canCorrectRevenueClaim("paid"), false);
});

test("records exact claim and 837P profile fields changed by a correction", () => {
  const changed = summarizeClaimChanges({
    before: validClaim,
    after: {
      ...validClaim,
      patientControlNumber: "PCN-10002",
      lines: [{ ...validClaim.lines[0], chargeAmount: 175 }],
    },
    beforeTransmission: validTransmission,
    afterTransmission: {
      ...validTransmission,
      subscriber: { ...validTransmission.subscriber, memberId: "MEMBER0002" },
    },
  });
  assert.deepEqual(changed, ["patientControlNumber", "lines", "837pProfile"]);
});
