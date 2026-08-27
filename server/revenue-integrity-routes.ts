import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { Express, Request } from "express";
import { eq, or } from "drizzle-orm";
import { users } from "@shared/schema";
import {
  calculateWorkPriority,
  evaluateClaimIntegrity,
  revenueClaimCorrectionSchema,
  revenueClaimCreateSchema,
  revenueTransmissionSchema,
  revenueWorkItemActionSchema,
  type ClaimIntegrityIssue,
  type RevenueClaimCreateInput,
} from "@shared/revenue-integrity";
import { db, pool } from "./db";
import { supabaseAdmin } from "./supabase-admin";
import { createOptumSandboxAdapterFromEnvironment } from "./services/revenue-integrity/optum-sandbox-adapter";
import { createOptumCertificationFixture, type OptumCertificationScenario } from "./services/revenue-integrity/optum-certification-fixtures";
import { mapProfessionalClaimToOptum } from "./services/revenue-integrity/optum-professional-claim";
import { createStediAdapterFromEnvironment } from "./services/revenue-integrity/stedi-adapter";
import { mapProfessionalClaimToStedi } from "./services/revenue-integrity/stedi-professional-claim";
import { parseStediWebhookEvent } from "./services/revenue-integrity/stedi-responses";
import { processNextStediWebhook } from "./services/revenue-integrity/stedi-webhook-processor";
import { canCorrectRevenueClaim, summarizeClaimChanges } from "./services/revenue-integrity/claim-correction";

type RevenueRequestContext = {
  user: typeof users.$inferSelect;
  organization: { id: string; name: string; slug: string };
  role: string;
};

const REVENUE_WRITE_ROLES = new Set(["owner", "admin", "integrity_manager", "coder", "biller"]);

function bearerToken(req: Request) {
  const authorization = String(req.headers.authorization || "");
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
}

function secretsMatch(expected: string | undefined, received: string) {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function webhookCredential(req: Request) {
  const header = String(req.headers["x-codical-webhook-key"] || "").trim();
  return header || bearerToken(req);
}

async function ensureRevenueUser(supabaseUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const email = String(supabaseUser.email || "").trim().toLowerCase();
  const [existing] = await db.select().from(users).where(
    email
      ? or(eq(users.supabaseId, supabaseUser.id), eq(users.email, email))
      : eq(users.supabaseId, supabaseUser.id),
  ).limit(1);

  if (existing) {
    if (!existing.supabaseId) {
      const [updated] = await db.update(users)
        .set({ supabaseId: supabaseUser.id, email: existing.email || email || null })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  const fullName = String(supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || "").trim();
  const username = `auth_${supabaseUser.id.replace(/[^a-z0-9]/gi, "").slice(0, 36)}`;
  try {
    const [created] = await db.insert(users).values({
      supabaseId: supabaseUser.id,
      username,
      email: email || null,
      fullName: fullName || email.split("@")[0] || "Codical user",
      role: "coder",
      isOnline: true,
      lastSeen: new Date(),
    }).returning();
    return created;
  } catch (error) {
    const candidate = error as { code?: string; cause?: { code?: string } };
    if (candidate.code !== "23505" && candidate.cause?.code !== "23505") throw error;

    const [concurrentlyCreated] = await db.select().from(users).where(
      email
        ? or(eq(users.supabaseId, supabaseUser.id), eq(users.email, email))
        : eq(users.supabaseId, supabaseUser.id),
    ).limit(1);
    if (!concurrentlyCreated) throw error;
    return concurrentlyCreated;
  }
}

async function ensureRevenueContext(req: Request): Promise<RevenueRequestContext> {
  const token = bearerToken(req);
  if (!token) {
    const error = new Error("A signed-in Supabase session is required.") as Error & { status?: number };
    error.status = 401;
    throw error;
  }

  const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !data.user) {
    const error = new Error("The session is invalid or expired.") as Error & { status?: number };
    error.status = 401;
    throw error;
  }

  const user = await ensureRevenueUser(data.user);
  const requestedOrganizationId = String(req.headers["x-codical-organization-id"] || "").trim();
  const membershipResult = await pool.query<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: string;
  }>(`
    select
      o.id as "organizationId",
      o.name as "organizationName",
      o.slug as "organizationSlug",
      m.role
    from revenue_organization_members m
    join revenue_organizations o on o.id = m.organization_id
    where m.user_id = $1
      and m.status = 'active'
      and ($2::text = '' or o.id = $2)
    order by case when m.role = 'owner' then 0 else 1 end, m.created_at
    limit 1
  `, [user.id, requestedOrganizationId]);

  let membership = membershipResult.rows[0];
  if (!membership && requestedOrganizationId) {
    const error = new Error("You do not have access to the requested organization.") as Error & { status?: number };
    error.status = 403;
    throw error;
  }

  if (!membership) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock($1)", [user.id]);

      const lockedMembershipResult = await client.query<{
        organizationId: string;
        organizationName: string;
        organizationSlug: string;
        role: string;
      }>(`
        select
          o.id as "organizationId",
          o.name as "organizationName",
          o.slug as "organizationSlug",
          m.role
        from revenue_organization_members m
        join revenue_organizations o on o.id = m.organization_id
        where m.user_id = $1 and m.status = 'active'
        order by case when m.role = 'owner' then 0 else 1 end, m.created_at
        limit 1
      `, [user.id]);

      membership = lockedMembershipResult.rows[0];
      if (!membership) {
        const organizationId = `org_${randomUUID()}`;
        const organizationSlug = `workspace-${user.id}-${randomUUID().slice(0, 8)}`;
        const organizationName = `${user.fullName || "Codical"} Revenue Workspace`;
        await client.query(
          `insert into revenue_organizations (id, slug, name, status, clearinghouse_provider, created_by)
           values ($1, $2, $3, 'onboarding', 'stedi', $4)`,
          [organizationId, organizationSlug, organizationName, user.id],
        );
        await client.query(
          `insert into revenue_organization_members (organization_id, user_id, role, status)
           values ($1, $2, 'owner', 'active')`,
          [organizationId, user.id],
        );
        await client.query(
          `insert into revenue_clearinghouse_connections
           (organization_id, provider, mode, status, capabilities, live_submission_enabled)
           values ($1, 'stedi', 'test', 'not_configured', $2::jsonb, false)`,
          [organizationId, JSON.stringify(["837P", "277CA", "835", "276/277", "275", "enrollments"])],
        );
        membership = {
          organizationId,
          organizationName,
          organizationSlug,
          role: "owner",
        };
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    user,
    organization: {
      id: membership.organizationId,
      name: membership.organizationName,
      slug: membership.organizationSlug,
    },
    role: membership.role,
  };
}

function requireRevenueWriteAccess(context: RevenueRequestContext) {
  if (REVENUE_WRITE_ROLES.has(context.role)) return;
  const error = new Error("Your Revenue Integrity role is read-only.") as Error & { status?: number };
  error.status = 403;
  throw error;
}

async function loadClaimForTransmission(claimId: string, organizationId: string) {
  const claimResult = await pool.query<{
    patientId: number | null;
    encounterId: number | null;
    patientControlNumber: string;
    payerId: string;
    payerName: string;
    serviceFrom: string;
    serviceTo: string | null;
    billingProviderNpi: string;
    renderingProviderNpi: string | null;
    diagnosisCodes: string[];
    totalCharge: string;
    expectedAmount: string | null;
    metadata: Record<string, unknown>;
    status: string;
    version: number;
  }>(`
    select
      patient_id as "patientId", encounter_id as "encounterId", patient_control_number as "patientControlNumber",
      payer_id as "payerId", payer_name as "payerName", service_from as "serviceFrom", service_to as "serviceTo",
      billing_provider_npi as "billingProviderNpi", rendering_provider_npi as "renderingProviderNpi",
      diagnosis_codes as "diagnosisCodes", total_charge as "totalCharge", expected_amount as "expectedAmount",
      metadata, status, version
    from revenue_claims
    where id = $1 and organization_id = $2
    limit 1
  `, [claimId, organizationId]);
  const claim = claimResult.rows[0];
  if (!claim) return null;
  const lineResult = await pool.query<{
    lineNumber: number;
    procedureCode: string;
    description: string | null;
    modifiers: string[];
    diagnosisPointers: number[];
    placeOfService: string | null;
    units: string;
    chargeAmount: string;
    expectedAmount: string | null;
  }>(`
    select line_number as "lineNumber", procedure_code as "procedureCode", description, modifiers,
      diagnosis_pointers as "diagnosisPointers", place_of_service as "placeOfService", units,
      charge_amount as "chargeAmount", expected_amount as "expectedAmount"
    from revenue_claim_lines
    where claim_id = $1
    order by line_number
  `, [claimId]);
  const input = revenueClaimCreateSchema.parse({
    ...claim,
    patientId: claim.patientId || undefined,
    encounterId: claim.encounterId || undefined,
    serviceTo: claim.serviceTo || undefined,
    renderingProviderNpi: claim.renderingProviderNpi || undefined,
    totalCharge: Number(claim.totalCharge),
    expectedAmount: claim.expectedAmount == null ? undefined : Number(claim.expectedAmount),
    lines: lineResult.rows.map((line) => ({
      ...line,
      description: line.description || undefined,
      placeOfService: line.placeOfService || undefined,
      units: Number(line.units),
      chargeAmount: Number(line.chargeAmount),
      expectedAmount: line.expectedAmount == null ? undefined : Number(line.expectedAmount),
    })),
  });
  return { input, status: claim.status, version: claim.version };
}

function submissionHash(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function processWebhookBatch(limit: number) {
  const results: Array<{ processed: boolean; eventId?: string; outcome?: string }> = [];
  for (let index = 0; index < limit; index += 1) {
    const result = await processNextStediWebhook(pool);
    results.push(result);
    if (!result.processed) break;
  }
  return results;
}

function integrationSnapshot(connection?: {
  provider: string;
  mode: string;
  status: string;
  liveSubmissionEnabled: boolean;
} | null) {
  const adapter = createStediAdapterFromEnvironment();
  const readiness = adapter.readiness();
  const configuredMode = connection?.mode === "production" ? "production" : connection ? "test" : "not_configured";
  return {
    provider: connection?.provider || adapter.provider,
    mode: configuredMode,
    status: connection?.status || "not_configured",
    liveSubmissionEnabled: Boolean(connection?.liveSubmissionEnabled && readiness.liveSubmissionEnabled),
    testSubmissionEnabled: readiness.testSubmissionEnabled,
    credentialsConfigured: readiness.configured,
    blockers: readiness.blockers,
    capabilities: adapter.capabilities,
  };
}

function optumValidationSnapshot() {
  const adapter = createOptumSandboxAdapterFromEnvironment();
  const readiness = adapter.readiness();
  return {
    provider: adapter.provider,
    environment: adapter.environment,
    credentialsConfigured: readiness.configured,
    validationEnabled: readiness.validationEnabled,
    submissionEnabled: readiness.submissionEnabled,
    blockers: readiness.blockers,
    capabilities: adapter.capabilities,
  };
}

function riskLevelForIssues(issues: ClaimIntegrityIssue[]) {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.some((issue) => issue.severity === "high")) return "high";
  if (issues.some((issue) => issue.severity === "medium")) return "medium";
  if (issues.length) return "low";
  return "low";
}

function optumControlNumber(claimId: string, version: number) {
  const digest = createHash("sha256").update(`${claimId}:v${version}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000_000).padStart(9, "0");
}

async function validateClaimWithOptum(input: { organizationId: string; claimId: string }) {
  const claim = await loadClaimForTransmission(input.claimId, input.organizationId);
  if (!claim) {
    const error = new Error("Claim not found.") as Error & { status?: number };
    error.status = 404;
    throw error;
  }
  if (claim.input.metadata.dataClassification !== "synthetic") {
    const error = new Error("Optum sandbox validation accepts claims explicitly classified as synthetic only.") as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  const transmissionResult = await pool.query<{ transmissionData: unknown; verifiedAt: Date | null }>(`
    select transmission_data as "transmissionData", verified_at as "verifiedAt"
    from revenue_claim_transmissions
    where claim_id = $1 and organization_id = $2
    limit 1
  `, [input.claimId, input.organizationId]);
  const transmission = transmissionResult.rows[0];
  if (!transmission?.verifiedAt) {
    const error = new Error("Verified transmission data is required before Optum sandbox validation.") as Error & { status?: number };
    error.status = 409;
    throw error;
  }
  const parsed = revenueTransmissionSchema.safeParse(transmission.transmissionData);
  if (!parsed.success) {
    const error = new Error("Stored transmission data no longer passes the active schema.") as Error & { status?: number; issues?: unknown };
    error.status = 409;
    error.issues = parsed.error.flatten();
    throw error;
  }

  const storedControlNumber = String(claim.input.metadata.optumControlNumber || "").trim();
  const controlNumber = /^\d{9}$/.test(storedControlNumber)
    ? storedControlNumber
    : optumControlNumber(input.claimId, claim.version);
  const mapping = mapProfessionalClaimToOptum(claim.input, parsed.data, controlNumber);
  if (!mapping.payload) {
    const error = new Error("The claim is not ready for Optum Professional Claims v3 validation.") as Error & { status?: number; issues?: unknown };
    error.status = 422;
    error.issues = mapping.issues;
    throw error;
  }

  const adapter = createOptumSandboxAdapterFromEnvironment();
  const idempotencyKey = `optum-validation:${input.claimId}:v${claim.version}`;
  const result = await adapter.validateProfessionalClaim({
    payload: mapping.payload,
    idempotencyKey,
    dataClassification: "synthetic",
  });
  const normalizedStatus = result.valid ? "ready" : "needs_review";
  const integrityScore = result.valid ? 100 : Math.max(0, 100 - Math.max(1, result.edits.length) * 15);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`
      update revenue_claims
      set status = $3, integrity_score = $4, risk_level = $5, last_transaction_at = now(), updated_at = now()
      where id = $1 and organization_id = $2
    `, [input.claimId, input.organizationId, normalizedStatus, integrityScore, result.valid ? "low" : "high"]);
    await client.query(`
      update revenue_work_items
      set status = 'resolved', resolved_at = now(),
        resolution_note = case
          when $3 then 'Resolved automatically by a passing Optum revalidation.'
          else 'Superseded by a newer Optum validation response.'
        end,
        updated_at = now()
      where organization_id = $1 and claim_id = $2 and issue_code like 'OPTUM_VALIDATION_%'
        and status in ('open', 'in_progress', 'blocked')
    `, [input.organizationId, input.claimId, result.valid]);
    for (const [index, edit] of result.edits.entries()) {
      await client.query(`
        insert into revenue_work_items
          (organization_id, claim_id, category, issue_code, title, description, recommended_action,
           severity, priority_score, recoverable_amount)
        values ($1, $2, 'claim_format', $3, $4, $5, $6, 'high', $7, $8)
      `, [
        input.organizationId,
        input.claimId,
        `OPTUM_VALIDATION_${String(index + 1).padStart(2, "0")}`,
        `Optum 837P edit: ${edit.field}`,
        edit.description,
        `Correct ${edit.field}${edit.location ? ` at ${edit.location}` : ""}, then run Optum validation again.`,
        calculateWorkPriority({ severity: "high", recoverableAmount: claim.input.totalCharge, confidence: 1 }),
        claim.input.totalCharge,
      ]);
    }
    await client.query(`
      insert into revenue_claim_events
        (organization_id, claim_id, event_type, source, idempotency_key, payload_hash, summary, occurred_at)
      values ($1, $2, 'sandbox_validation_completed', 'optum', $3, $4, $5::jsonb, now())
    `, [
      input.organizationId,
      input.claimId,
      idempotencyKey,
      submissionHash(mapping.payload),
      JSON.stringify({
        valid: result.valid,
        status: result.status,
        editStatus: result.editStatus,
        controlNumber: result.controlNumber,
        correlationId: result.correlationId,
        edits: result.edits,
      }),
    ]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return {
    claim,
    payload: mapping.payload,
    result,
    status: normalizedStatus,
    integrityScore,
  };
}

async function ensureOptumCertificationClaim(input: {
  context: RevenueRequestContext;
  scenario: OptumCertificationScenario;
}) {
  const fixture = createOptumCertificationFixture(input.scenario);
  const existing = await pool.query<{ id: string }>(`
    select id from revenue_claims
    where organization_id = $1 and metadata->>'certificationKey' = $2
    limit 1
  `, [input.context.organization.id, fixture.certificationKey]);
  if (existing.rows[0]) {
    const existingClaimId = existing.rows[0].id;
    await pool.query(`
      update revenue_claims
      set patient_control_number = $3, payer_id = $4, payer_name = $5, service_from = $6, service_to = $6,
          billing_provider_npi = $7, rendering_provider_npi = $8, diagnosis_codes = $9::jsonb,
          total_charge = $10, expected_amount = $11, metadata = $12::jsonb, updated_at = now()
      where id = $1 and organization_id = $2
    `, [
      existingClaimId,
      input.context.organization.id,
      fixture.claim.patientControlNumber,
      fixture.claim.payerId,
      fixture.claim.payerName,
      fixture.claim.serviceFrom,
      fixture.claim.billingProviderNpi,
      fixture.claim.renderingProviderNpi || null,
      JSON.stringify(fixture.claim.diagnosisCodes),
      fixture.claim.totalCharge,
      fixture.claim.expectedAmount ?? null,
      JSON.stringify({ ...fixture.claim.metadata, optumControlNumber: fixture.controlNumber }),
    ]);
    await pool.query(`
      update revenue_claim_transmissions
      set schema_version = 'optum-professional-claims-v3', transmission_data = $3::jsonb,
          source = 'synthetic_certification', verified_by = $4, verified_at = now(), updated_at = now()
      where claim_id = $1 and organization_id = $2
    `, [existingClaimId, input.context.organization.id, JSON.stringify(fixture.transmission), input.context.user.id]);
    return { claimId: existingClaimId, fixture, reused: true };
  }

  const integrity = evaluateClaimIntegrity(fixture.claim);
  const claimId = `clm_${randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`
      insert into revenue_claims
        (id, organization_id, patient_control_number, claim_type, status, payer_id, payer_name,
         service_from, service_to, billing_provider_npi, rendering_provider_npi, diagnosis_codes,
         total_charge, expected_amount, integrity_score, risk_level, clearinghouse_provider, created_by, metadata)
      values ($1, $2, $3, 'professional', $4, $5, $6, $7, $7, $8, $9, $10::jsonb,
        $11, $12, $13, $14, 'optum', $15, $16::jsonb)
    `, [
      claimId,
      input.context.organization.id,
      fixture.claim.patientControlNumber,
      integrity.ready ? "ready" : "needs_review",
      fixture.claim.payerId,
      fixture.claim.payerName,
      fixture.claim.serviceFrom,
      fixture.claim.billingProviderNpi,
      fixture.claim.renderingProviderNpi || null,
      JSON.stringify(fixture.claim.diagnosisCodes),
      fixture.claim.totalCharge,
      fixture.claim.expectedAmount ?? null,
      integrity.score,
      riskLevelForIssues(integrity.issues),
      input.context.user.id,
      JSON.stringify({ ...fixture.claim.metadata, optumControlNumber: fixture.controlNumber }),
    ]);
    for (const line of fixture.claim.lines) {
      await client.query(`
        insert into revenue_claim_lines
          (claim_id, line_number, procedure_code, description, modifiers, diagnosis_pointers,
           place_of_service, units, charge_amount, expected_amount, status)
        values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)
      `, [
        claimId,
        line.lineNumber,
        line.procedureCode.toUpperCase(),
        line.description || null,
        JSON.stringify(line.modifiers),
        JSON.stringify(line.diagnosisPointers),
        line.placeOfService || null,
        line.units,
        line.chargeAmount,
        line.expectedAmount ?? null,
        integrity.ready ? "ready" : "needs_review",
      ]);
    }
    await writeIntegrityWorkItems({
      organizationId: input.context.organization.id,
      claimId,
      issues: integrity.issues,
      totalCharge: fixture.claim.totalCharge,
      client,
    });
    await client.query(`
      insert into revenue_claim_transmissions
        (organization_id, claim_id, schema_version, transmission_data, source, verified_by, verified_at)
      values ($1, $2, 'optum-professional-claims-v3', $3::jsonb, 'synthetic_certification', $4, now())
    `, [input.context.organization.id, claimId, JSON.stringify(fixture.transmission), input.context.user.id]);
    await client.query(`
      insert into revenue_claim_events (organization_id, claim_id, event_type, source, summary, occurred_at)
      values ($1, $2, 'synthetic_certification_created', 'codical', $3::jsonb, now())
    `, [input.context.organization.id, claimId, JSON.stringify({ scenario: input.scenario, dataClassification: "synthetic" })]);
    await client.query(`
      insert into audit_logs (user_id, action, entity_type, entity_id, details)
      values ($1, 'optum_synthetic_certification_created', 'revenue_claim', $2, $3::jsonb)
    `, [input.context.user.id, claimId, JSON.stringify({ organizationId: input.context.organization.id, scenario: input.scenario })]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return { claimId, fixture, reused: false };
}

async function writeIntegrityWorkItems(input: {
  organizationId: string;
  claimId: string;
  issues: ClaimIntegrityIssue[];
  totalCharge: number;
  client: { query: (text: string, values?: unknown[]) => Promise<unknown> };
}) {
  for (const issue of input.issues) {
    const priority = calculateWorkPriority({
      severity: issue.severity,
      recoverableAmount: input.totalCharge,
      confidence: 1,
    });
    await input.client.query(
      `insert into revenue_work_items
       (organization_id, claim_id, category, issue_code, title, description, recommended_action, severity, priority_score, recoverable_amount)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        input.organizationId,
        input.claimId,
        issue.category,
        issue.code,
        issue.message,
        issue.message,
        issue.recommendedAction,
        issue.severity,
        priority,
        input.totalCharge,
      ],
    );
  }
}

function requestError(res: { status: (status: number) => { json: (body: unknown) => unknown } }, error: unknown) {
  const candidate = error as { status?: number; message?: string; publicMessage?: string; issues?: unknown };
  const status = candidate.status || 500;
  console.error("[revenue-integrity]", { status, message: candidate.message, issues: candidate.issues });
  return res.status(status).json({
    message: status >= 500 ? candidate.publicMessage || "Revenue Integrity request failed." : candidate.message,
    issues: candidate.issues,
    detail: process.env.NODE_ENV === "development" ? candidate.message : undefined,
  });
}

export function registerRevenueIntegrityRoutes(app: Express) {
  app.get("/api/revenue-integrity/overview", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      const [metricsResult, statusResult, connectionResult, operationsResult] = await Promise.all([
        pool.query<{
          openClaims: string;
          readyToSubmit: string;
          rejectedClaims: string;
          deniedClaims: string;
          openWorkItems: string;
          revenueAtRisk: string;
          underpaymentOpportunity: string;
        }>(`
          select
            count(*) filter (where c.status not in ('paid', 'closed'))::text as "openClaims",
            count(*) filter (where c.status = 'ready')::text as "readyToSubmit",
            count(*) filter (where c.status = 'rejected')::text as "rejectedClaims",
            count(*) filter (where c.status = 'denied')::text as "deniedClaims",
            (select count(*)::text from revenue_work_items w where w.organization_id = $1 and w.status in ('open', 'in_progress', 'blocked')) as "openWorkItems",
            coalesce(sum(greatest(c.total_charge - c.paid_amount, 0)) filter (where c.status in ('rejected', 'denied', 'partially_paid')), 0)::text as "revenueAtRisk",
            coalesce(sum(greatest(coalesce(c.expected_amount, 0) - c.paid_amount, 0)) filter (where c.status in ('paid', 'partially_paid')), 0)::text as "underpaymentOpportunity"
          from revenue_claims c
          where c.organization_id = $1
        `, [context.organization.id]),
        pool.query<{ status: string; count: string }>(`
          select status, count(*)::text as count
          from revenue_claims
          where organization_id = $1
          group by status
          order by status
        `, [context.organization.id]),
        pool.query<{
          provider: string;
          mode: string;
          status: string;
          liveSubmissionEnabled: boolean;
        }>(`
          select provider, mode, status, live_submission_enabled as "liveSubmissionEnabled"
          from revenue_clearinghouse_connections
          where organization_id = $1
          order by created_at
          limit 1
        `, [context.organization.id]),
        pool.query<{ queuedWebhooks: string; failedWebhooks: string; testSubmissions: string; productionSubmissions: string }>(`
          select
            (select count(*)::text from revenue_webhook_events where organization_id = $1 and status in ('queued', 'processing')) as "queuedWebhooks",
            (select count(*)::text from revenue_webhook_events where organization_id = $1 and status = 'failed') as "failedWebhooks",
            (select count(*)::text from revenue_claim_submissions where organization_id = $1 and mode = 'test' and status in ('submitted', 'acknowledged')) as "testSubmissions",
            (select count(*)::text from revenue_claim_submissions where organization_id = $1 and mode = 'production' and status in ('submitted', 'acknowledged')) as "productionSubmissions"
        `, [context.organization.id]),
      ]);

      const metrics = metricsResult.rows[0];
      res.json({
        generatedAt: new Date().toISOString(),
        organization: context.organization,
        metrics: {
          openClaims: Number(metrics.openClaims || 0),
          readyToSubmit: Number(metrics.readyToSubmit || 0),
          rejectedClaims: Number(metrics.rejectedClaims || 0),
          deniedClaims: Number(metrics.deniedClaims || 0),
          openWorkItems: Number(metrics.openWorkItems || 0),
          revenueAtRisk: Number(metrics.revenueAtRisk || 0),
          underpaymentOpportunity: Number(metrics.underpaymentOpportunity || 0),
        },
        statusCounts: statusResult.rows.map((row) => ({ status: row.status, count: Number(row.count) })),
        integration: {
          ...integrationSnapshot(connectionResult.rows[0]),
          operations: {
            queuedWebhooks: Number(operationsResult.rows[0]?.queuedWebhooks || 0),
            failedWebhooks: Number(operationsResult.rows[0]?.failedWebhooks || 0),
            testSubmissions: Number(operationsResult.rows[0]?.testSubmissions || 0),
            productionSubmissions: Number(operationsResult.rows[0]?.productionSubmissions || 0),
          },
        },
        validationPartners: [optumValidationSnapshot()],
      });
    } catch (error) {
      requestError(res, error);
    }
  });

  app.get("/api/revenue-integrity/claims", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      const requestedLimit = Number(req.query.limit || 50);
      const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 50;
      const status = String(req.query.status || "").trim();
      const result = await pool.query(`
        select
          c.id,
          c.patient_control_number as "patientControlNumber",
          c.status,
          c.payer_id as "payerId",
          c.payer_name as "payerName",
          c.service_from as "serviceFrom",
          c.total_charge as "totalCharge",
          c.expected_amount as "expectedAmount",
          c.paid_amount as "paidAmount",
          c.integrity_score as "integrityScore",
          c.risk_level as "riskLevel",
          c.updated_at as "updatedAt",
          coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), c.metadata->>'syntheticPatientName') as "patientName",
          count(w.id) filter (where w.status in ('open', 'in_progress', 'blocked'))::int as "openWorkItems"
        from revenue_claims c
        left join patients p on p.id = c.patient_id
        left join revenue_work_items w on w.claim_id = c.id
        where c.organization_id = $1
          and ($2::text = '' or c.status = $2)
        group by c.id, p.first_name, p.last_name
        order by
          case c.risk_level when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end,
          c.updated_at desc
        limit $3
      `, [context.organization.id, status, limit]);
      res.json({ claims: result.rows });
    } catch (error) {
      requestError(res, error);
    }
  });

  app.get("/api/revenue-integrity/work-items", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      const result = await pool.query(`
        select
          w.id,
          w.claim_id as "claimId",
          c.patient_control_number as "patientControlNumber",
          c.payer_name as "payerName",
          w.category,
          w.issue_code as "issueCode",
          w.title,
          w.description,
          w.recommended_action as "recommendedAction",
          w.status,
          w.severity,
          w.priority_score as "priorityScore",
          w.recoverable_amount as "recoverableAmount",
          w.due_at as "dueAt",
          w.created_at as "createdAt"
        from revenue_work_items w
        join revenue_claims c on c.id = w.claim_id
        where w.organization_id = $1
          and w.status in ('open', 'in_progress', 'blocked')
        order by w.priority_score desc, w.created_at
        limit 200
      `, [context.organization.id]);
      res.json({ workItems: result.rows });
    } catch (error) {
      requestError(res, error);
    }
  });

  app.get("/api/revenue-integrity/claims/:claimId", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      const claimResult = await pool.query(`
        select c.id, c.patient_control_number as "patientControlNumber", c.status, c.payer_id as "payerId",
          c.payer_name as "payerName", c.payer_claim_control_number as "payerClaimControlNumber",
          c.service_from as "serviceFrom", c.service_to as "serviceTo", c.billing_provider_npi as "billingProviderNpi",
          c.rendering_provider_npi as "renderingProviderNpi", c.diagnosis_codes as "diagnosisCodes",
          c.total_charge as "totalCharge", c.expected_amount as "expectedAmount", c.paid_amount as "paidAmount",
          c.integrity_score as "integrityScore", c.risk_level as "riskLevel", c.version,
          c.clearinghouse_provider as "clearinghouseProvider", c.metadata->>'dataClassification' as "dataClassification",
          c.created_at as "createdAt", c.updated_at as "updatedAt",
          coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), c.metadata->>'syntheticPatientName') as "patientName"
        from revenue_claims c
        left join patients p on p.id = c.patient_id
        where c.id = $1 and c.organization_id = $2
        limit 1
      `, [req.params.claimId, context.organization.id]);
      if (!claimResult.rows[0]) return res.status(404).json({ message: "Claim not found." });

      const [lines, events, workItems, evidence, submissions, remittances, transmission] = await Promise.all([
        pool.query(`select id, line_number as "lineNumber", procedure_code as "procedureCode", description, modifiers,
          diagnosis_pointers as "diagnosisPointers", place_of_service as "placeOfService", units,
          charge_amount as "chargeAmount", expected_amount as "expectedAmount", paid_amount as "paidAmount", status
          from revenue_claim_lines where claim_id = $1 order by line_number`, [req.params.claimId]),
        pool.query(`select id, event_type as "eventType", source, summary, occurred_at as "occurredAt"
          from revenue_claim_events where claim_id = $1 order by occurred_at desc`, [req.params.claimId]),
        pool.query(`select id, category, issue_code as "issueCode", title, description,
          recommended_action as "recommendedAction", status, severity, priority_score as "priorityScore",
          resolution_note as "resolutionNote", started_at as "startedAt", resolved_at as "resolvedAt"
          from revenue_work_items where claim_id = $1 order by priority_score desc, created_at`, [req.params.claimId]),
        pool.query(`select id, evidence_type as "evidenceType", source_label as "sourceLabel", rule_ref as "ruleRef", confidence
          from revenue_evidence_links where claim_id = $1 order by created_at`, [req.params.claimId]),
        pool.query(`select id, provider, mode, status, external_transaction_id as "externalTransactionId", correlation_id as "correlationId",
          last_error as "lastError", submitted_at as "submittedAt", created_at as "createdAt"
          from revenue_claim_submissions where claim_id = $1 order by created_at desc`, [req.params.claimId]),
        pool.query(`select id, provider, transaction_id as "transactionId", patient_control_number as "patientControlNumber",
          payer_claim_control_number as "payerClaimControlNumber", claim_status_code as "claimStatusCode",
          total_charge as "totalCharge", paid_amount as "paidAmount", patient_responsibility_amount as "patientResponsibilityAmount",
          received_at as "receivedAt" from revenue_remittances where claim_id = $1 order by received_at desc`, [req.params.claimId]),
        pool.query(`select schema_version as "schemaVersion", transmission_data as "transmissionData", source,
          verified_at as "verifiedAt", created_at as "createdAt", updated_at as "updatedAt"
          from revenue_claim_transmissions where claim_id = $1 limit 1`, [req.params.claimId]),
      ]);
      return res.json({
        claim: claimResult.rows[0],
        lines: lines.rows,
        events: events.rows,
        workItems: workItems.rows,
        evidence: evidence.rows,
        submissions: submissions.rows,
        remittances: remittances.rows,
        transmission: transmission.rows[0] || null,
      });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.put("/api/revenue-integrity/claims/:claimId/correction", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      requireRevenueWriteAccess(context);
      const parsed = revenueClaimCorrectionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "The claim correction is invalid.", issues: parsed.error.flatten() });
      }

      const current = await loadClaimForTransmission(req.params.claimId, context.organization.id);
      if (!current) return res.status(404).json({ message: "Claim not found." });
      if (current.version !== parsed.data.expectedVersion) {
        return res.status(409).json({
          message: "This claim changed after you opened it. Refresh the claim before saving your correction.",
          currentVersion: current.version,
        });
      }
      if (!canCorrectRevenueClaim(current.status)) {
        return res.status(409).json({ message: `Claims in ${current.status} status cannot be edited in place. Create a corrected-claim version instead.` });
      }

      const correctedClaim = revenueClaimCreateSchema.parse({
        ...parsed.data.claim,
        patientId: current.input.patientId,
        encounterId: current.input.encounterId,
        metadata: current.input.metadata,
      });
      const integrity = evaluateClaimIntegrity(correctedClaim);
      const transmissionResult = await pool.query<{
        schemaVersion: string;
        transmissionData: unknown;
      }>(`
        select schema_version as "schemaVersion", transmission_data as "transmissionData"
        from revenue_claim_transmissions
        where claim_id = $1 and organization_id = $2
        limit 1
      `, [req.params.claimId, context.organization.id]);
      const storedTransmission = transmissionResult.rows[0];
      const currentTransmission = storedTransmission
        ? revenueTransmissionSchema.safeParse(storedTransmission.transmissionData)
        : null;
      if (currentTransmission && !currentTransmission.success) {
        return res.status(409).json({ message: "The stored 837P profile must be repaired before this claim can be corrected.", issues: currentTransmission.error.flatten() });
      }
      const correctedTransmission = parsed.data.transmission || (currentTransmission?.success ? currentTransmission.data : undefined);
      const changedFields = summarizeClaimChanges({
        before: current.input,
        after: correctedClaim,
        beforeTransmission: currentTransmission?.success ? currentTransmission.data : null,
        afterTransmission: correctedTransmission || null,
      });
      if (!changedFields.length) return res.status(400).json({ message: "No claim or 837P profile changes were detected." });

      if (correctedTransmission) {
        const isOptumProfile = storedTransmission?.schemaVersion.startsWith("optum-") || current.input.metadata.dataClassification === "synthetic";
        const mapping = isOptumProfile
          ? mapProfessionalClaimToOptum(
              correctedClaim,
              correctedTransmission,
              String(current.input.metadata.optumControlNumber || "000000001"),
            )
          : mapProfessionalClaimToStedi(correctedClaim, correctedTransmission);
        if (!mapping.payload) {
          return res.status(422).json({ message: "The corrected claim does not map to a valid 837P profile.", issues: mapping.issues });
        }
      }

      const client = await pool.connect();
      try {
        await client.query("begin");
        const locked = await client.query<{ version: number; status: string }>(`
          select version, status from revenue_claims
          where id = $1 and organization_id = $2
          for update
        `, [req.params.claimId, context.organization.id]);
        if (!locked.rows[0] || locked.rows[0].version !== parsed.data.expectedVersion) {
          const error = new Error("This claim changed while the correction was being saved. Refresh and try again.") as Error & { status?: number };
          error.status = 409;
          throw error;
        }
        if (!canCorrectRevenueClaim(locked.rows[0].status)) {
          const error = new Error(`Claims in ${locked.rows[0].status} status cannot be edited in place.`) as Error & { status?: number };
          error.status = 409;
          throw error;
        }
        const duplicate = await client.query(`
          select 1 from revenue_claims
          where organization_id = $1 and patient_control_number = $2 and id <> $3
          limit 1
        `, [context.organization.id, correctedClaim.patientControlNumber, req.params.claimId]);
        if (duplicate.rows[0]) {
          const error = new Error("Another claim already uses this patient control number.") as Error & { status?: number };
          error.status = 409;
          throw error;
        }
        const productionSubmission = await client.query(`
          select 1 from revenue_claim_submissions
          where organization_id = $1 and claim_id = $2 and mode = 'production'
            and status in ('submitting', 'submitted', 'acknowledged')
          limit 1
        `, [context.organization.id, req.params.claimId]);
        if (productionSubmission.rows[0]) {
          const error = new Error("A production-submitted claim cannot be edited in place. Create a corrected claim instead.") as Error & { status?: number };
          error.status = 409;
          throw error;
        }

        const externalTasks = await client.query<{ count: string }>(`
          select count(*)::text as count from revenue_work_items
          where claim_id = $1 and status in ('open', 'in_progress', 'blocked')
            and issue_code like 'OPTUM_VALIDATION_%'
        `, [req.params.claimId]);
        const hasExternalTasks = Number(externalTasks.rows[0]?.count || 0) > 0;
        const nextStatus = integrity.ready && !hasExternalTasks ? "ready" : "needs_review";
        const nextRisk = hasExternalTasks ? "high" : riskLevelForIssues(integrity.issues);

        await client.query(`
          update revenue_claims set
            patient_control_number = $3, payer_id = $4, payer_name = $5,
            service_from = $6, service_to = $7, billing_provider_npi = $8,
            rendering_provider_npi = $9, diagnosis_codes = $10::jsonb,
            total_charge = $11, expected_amount = $12, status = $13,
            integrity_score = $14, risk_level = $15, version = version + 1, updated_at = now()
          where id = $1 and organization_id = $2
        `, [
          req.params.claimId,
          context.organization.id,
          correctedClaim.patientControlNumber,
          correctedClaim.payerId,
          correctedClaim.payerName,
          correctedClaim.serviceFrom,
          correctedClaim.serviceTo || correctedClaim.serviceFrom,
          correctedClaim.billingProviderNpi,
          correctedClaim.renderingProviderNpi || null,
          JSON.stringify(correctedClaim.diagnosisCodes.map((code) => code.toUpperCase())),
          correctedClaim.totalCharge,
          correctedClaim.expectedAmount ?? null,
          nextStatus,
          integrity.score,
          nextRisk,
        ]);

        const lineNumbers = correctedClaim.lines.map((line) => line.lineNumber);
        await client.query(`delete from revenue_claim_lines where claim_id = $1 and not (line_number = any($2::int[]))`, [req.params.claimId, lineNumbers]);
        for (const line of correctedClaim.lines) {
          await client.query(`
            insert into revenue_claim_lines
              (claim_id, line_number, procedure_code, description, modifiers, diagnosis_pointers,
               place_of_service, units, charge_amount, expected_amount, status)
            values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)
            on conflict (claim_id, line_number) do update set
              procedure_code = excluded.procedure_code, description = excluded.description,
              modifiers = excluded.modifiers, diagnosis_pointers = excluded.diagnosis_pointers,
              place_of_service = excluded.place_of_service, units = excluded.units,
              charge_amount = excluded.charge_amount, expected_amount = excluded.expected_amount,
              status = excluded.status, updated_at = now()
          `, [
            req.params.claimId,
            line.lineNumber,
            line.procedureCode.toUpperCase(),
            line.description || null,
            JSON.stringify(line.modifiers.map((modifier) => modifier.toUpperCase())),
            JSON.stringify(line.diagnosisPointers),
            line.placeOfService || null,
            line.units,
            line.chargeAmount,
            line.expectedAmount ?? null,
            nextStatus,
          ]);
        }

        await client.query(`
          update revenue_work_items
          set status = 'resolved', resolved_at = now(), resolved_by = $2,
              resolution_note = 'Superseded by validated claim correction.', updated_at = now()
          where claim_id = $1 and status in ('open', 'in_progress', 'blocked')
            and issue_code not like 'OPTUM_VALIDATION_%'
        `, [req.params.claimId, context.user.id]);
        await writeIntegrityWorkItems({
          organizationId: context.organization.id,
          claimId: req.params.claimId,
          issues: integrity.issues,
          totalCharge: correctedClaim.totalCharge,
          client,
        });

        if (correctedTransmission) {
          await client.query(`
            insert into revenue_claim_transmissions
              (organization_id, claim_id, schema_version, transmission_data, source, verified_by, verified_at)
            values ($1, $2, $3, $4::jsonb, 'manual_correction', $5, now())
            on conflict (claim_id) do update set
              transmission_data = excluded.transmission_data, source = excluded.source,
              verified_by = excluded.verified_by, verified_at = excluded.verified_at, updated_at = now()
          `, [
            context.organization.id,
            req.params.claimId,
            storedTransmission?.schemaVersion || "stedi-837p-v3",
            JSON.stringify(correctedTransmission),
            context.user.id,
          ]);
        }

        await client.query(`
          insert into revenue_claim_events
            (organization_id, claim_id, event_type, source, summary, occurred_at)
          values ($1, $2, 'claim_corrected', 'codical', $3::jsonb, now())
        `, [context.organization.id, req.params.claimId, JSON.stringify({
          reason: parsed.data.reason,
          changedFields,
          previousVersion: parsed.data.expectedVersion,
          version: parsed.data.expectedVersion + 1,
          status: nextStatus,
          integrityScore: integrity.score,
        })]);
        await client.query(`
          insert into audit_logs (user_id, action, entity_type, entity_id, details)
          values ($1, 'revenue_claim_corrected', 'revenue_claim', $2, $3::jsonb)
        `, [context.user.id, req.params.claimId, JSON.stringify({
          organizationId: context.organization.id,
          reason: parsed.data.reason,
          changedFields,
          previousVersion: parsed.data.expectedVersion,
          version: parsed.data.expectedVersion + 1,
        })]);
        await client.query("commit");
        return res.json({
          claimId: req.params.claimId,
          version: parsed.data.expectedVersion + 1,
          status: nextStatus,
          integrity,
          changedFields,
          requiresRevalidation: hasExternalTasks,
        });
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.patch("/api/revenue-integrity/work-items/:workItemId", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      requireRevenueWriteAccess(context);
      const parsed = revenueWorkItemActionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "The work-item action is invalid.", issues: parsed.error.flatten() });
      const workItemId = Number(req.params.workItemId);
      if (!Number.isInteger(workItemId) || workItemId <= 0) return res.status(400).json({ message: "The work-item identifier is invalid." });

      const itemResult = await pool.query<{
        id: number;
        claimId: string;
        issueCode: string;
        status: string;
      }>(`
        select id, claim_id as "claimId", issue_code as "issueCode", status
        from revenue_work_items where id = $1 and organization_id = $2 limit 1
      `, [workItemId, context.organization.id]);
      const item = itemResult.rows[0];
      if (!item) return res.status(404).json({ message: "Work item not found." });
      if (parsed.data.action === "resolve" && item.issueCode.startsWith("OPTUM_VALIDATION_")) {
        return res.status(409).json({ message: "Optum validation edits can only be resolved by a passing claim revalidation." });
      }
      if (parsed.data.action === "dismiss" && !["owner", "admin", "integrity_manager"].includes(context.role)) {
        return res.status(403).json({ message: "Only an integrity manager can dismiss a work item." });
      }

      const transitions: Record<string, { from: string[]; to: string }> = {
        start: { from: ["open", "blocked"], to: "in_progress" },
        resolve: { from: ["open", "in_progress", "blocked"], to: "resolved" },
        dismiss: { from: ["open", "in_progress", "blocked"], to: "dismissed" },
        reopen: { from: ["resolved", "dismissed"], to: "open" },
      };
      const transition = transitions[parsed.data.action];
      if (!transition.from.includes(item.status)) {
        return res.status(409).json({ message: `A ${item.status} work item cannot be moved to ${transition.to}.` });
      }
      const isClosed = transition.to === "resolved" || transition.to === "dismissed";
      await pool.query(`
        update revenue_work_items set status = $3,
          started_at = case when $3 = 'in_progress' then coalesce(started_at, now()) else started_at end,
          resolved_at = case when $4 then now() else null end,
          resolved_by = case when $4 then $5 else null end,
          resolution_note = $6, updated_at = now()
        where id = $1 and organization_id = $2
      `, [workItemId, context.organization.id, transition.to, isClosed, context.user.id, parsed.data.note || null]);
      await pool.query(`
        insert into revenue_claim_events
          (organization_id, claim_id, event_type, source, summary, occurred_at)
        values ($1, $2, 'work_item_status_changed', 'codical', $3::jsonb, now())
      `, [context.organization.id, item.claimId, JSON.stringify({
        workItemId,
        issueCode: item.issueCode,
        from: item.status,
        to: transition.to,
        note: parsed.data.note || null,
      })]);
      await pool.query(`
        insert into audit_logs (user_id, action, entity_type, entity_id, details)
        values ($1, 'revenue_work_item_status_changed', 'revenue_work_item', $2, $3::jsonb)
      `, [context.user.id, String(workItemId), JSON.stringify({
        organizationId: context.organization.id,
        claimId: item.claimId,
        from: item.status,
        to: transition.to,
        note: parsed.data.note || null,
      })]);
      return res.json({ workItemId, claimId: item.claimId, status: transition.to });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.post("/api/revenue-integrity/claims", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      requireRevenueWriteAccess(context);
      const parsed = revenueClaimCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "The claim payload is invalid.", issues: parsed.error.flatten() });
      }

      const input = parsed.data;
      const integrity = evaluateClaimIntegrity(input);
      const claimId = `clm_${randomUUID()}`;
      const status = integrity.ready ? "ready" : "needs_review";
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          `insert into revenue_claims
           (id, organization_id, patient_id, encounter_id, patient_control_number, claim_type, status, payer_id, payer_name,
            service_from, service_to, billing_provider_npi, rendering_provider_npi, diagnosis_codes, total_charge,
            expected_amount, integrity_score, risk_level, clearinghouse_provider, created_by, metadata)
           values ($1, $2, $3, $4, $5, 'professional', $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, $17, 'stedi', $18, $19::jsonb)`,
          [
            claimId,
            context.organization.id,
            input.patientId || null,
            input.encounterId || null,
            input.patientControlNumber,
            status,
            input.payerId,
            input.payerName,
            input.serviceFrom,
            input.serviceTo || input.serviceFrom,
            input.billingProviderNpi,
            input.renderingProviderNpi || null,
            JSON.stringify(input.diagnosisCodes),
            input.totalCharge,
            input.expectedAmount ?? null,
            integrity.score,
            riskLevelForIssues(integrity.issues),
            context.user.id,
            JSON.stringify(input.metadata),
          ],
        );

        for (const line of input.lines) {
          await client.query(
            `insert into revenue_claim_lines
             (claim_id, line_number, procedure_code, description, modifiers, diagnosis_pointers, place_of_service, units, charge_amount, expected_amount, status)
             values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)`,
            [
              claimId,
              line.lineNumber,
              line.procedureCode.toUpperCase(),
              line.description || null,
              JSON.stringify(line.modifiers.map((modifier) => modifier.toUpperCase())),
              JSON.stringify(line.diagnosisPointers),
              line.placeOfService || null,
              line.units,
              line.chargeAmount,
              line.expectedAmount ?? null,
              status,
            ],
          );
        }

        await writeIntegrityWorkItems({
          organizationId: context.organization.id,
          claimId,
          issues: integrity.issues,
          totalCharge: input.totalCharge,
          client,
        });
        await client.query(
          `insert into revenue_claim_events
           (organization_id, claim_id, event_type, source, summary, occurred_at)
           values ($1, $2, 'claim_created', 'codical', $3::jsonb, now())`,
          [context.organization.id, claimId, JSON.stringify({ status, integrityScore: integrity.score, issueCount: integrity.issues.length })],
        );
        await client.query(
          `insert into audit_logs (user_id, action, entity_type, entity_id, details)
           values ($1, 'revenue_claim_created', 'revenue_claim', $2, $3::jsonb)`,
          [context.user.id, claimId, JSON.stringify({ organizationId: context.organization.id, status, integrityScore: integrity.score })],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }

      return res.status(201).json({ claimId, status, integrity });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.put("/api/revenue-integrity/claims/:claimId/transmission", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      requireRevenueWriteAccess(context);
      const parsed = revenueTransmissionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "The professional-claim transmission data is invalid.", issues: parsed.error.flatten() });
      }
      const claim = await loadClaimForTransmission(req.params.claimId, context.organization.id);
      if (!claim) return res.status(404).json({ message: "Claim not found." });
      const mapping = mapProfessionalClaimToStedi(claim.input, parsed.data);
      if (!mapping.payload) {
        return res.status(422).json({ message: "The claim is not ready for 837P mapping.", issues: mapping.issues });
      }
      await pool.query(`
        insert into revenue_claim_transmissions
          (organization_id, claim_id, transmission_data, source, verified_by, verified_at)
        values ($1, $2, $3::jsonb, 'manual_verified', $4, now())
        on conflict (claim_id) do update set
          transmission_data = excluded.transmission_data,
          source = excluded.source,
          verified_by = excluded.verified_by,
          verified_at = excluded.verified_at,
          updated_at = now()
      `, [context.organization.id, req.params.claimId, JSON.stringify(parsed.data), context.user.id]);
      await pool.query(`
        insert into revenue_claim_events (organization_id, claim_id, event_type, source, summary, occurred_at)
        values ($1, $2, 'transmission_verified', 'codical', $3::jsonb, now())
      `, [context.organization.id, req.params.claimId, JSON.stringify({ schemaVersion: "stedi-837p-v3", mappedServiceLines: claim.input.lines.length })]);
      return res.json({ ready: true, schemaVersion: "stedi-837p-v3", mappedServiceLines: claim.input.lines.length });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.get("/api/revenue-integrity/claims/:claimId/transmission-readiness", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      const claim = await loadClaimForTransmission(req.params.claimId, context.organization.id);
      if (!claim) return res.status(404).json({ message: "Claim not found." });
      const transmissionResult = await pool.query<{ transmissionData: unknown; verifiedAt: Date | null }>(`
        select transmission_data as "transmissionData", verified_at as "verifiedAt"
        from revenue_claim_transmissions
        where claim_id = $1 and organization_id = $2
        limit 1
      `, [req.params.claimId, context.organization.id]);
      const transmission = transmissionResult.rows[0];
      if (!transmission) return res.json({ ready: false, verified: false, issues: [{ code: "TRANSMISSION_DATA_REQUIRED", message: "Subscriber, submitter, billing, receiver, and address information has not been verified." }] });
      const parsed = revenueTransmissionSchema.safeParse(transmission.transmissionData);
      if (!parsed.success) return res.json({ ready: false, verified: false, issues: parsed.error.issues });
      const mapping = mapProfessionalClaimToStedi(claim.input, parsed.data);
      return res.json({ ready: Boolean(mapping.payload), verified: Boolean(transmission.verifiedAt), issues: mapping.issues, mode: createStediAdapterFromEnvironment().mode });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.post("/api/revenue-integrity/integrations/optum/health", async (req, res) => {
    try {
      await ensureRevenueContext(req);
      const adapter = createOptumSandboxAdapterFromEnvironment();
      const result = await adapter.healthCheck();
      return res.json({
        ok: true,
        provider: adapter.provider,
        environment: adapter.environment,
        status: typeof result.status === "string" ? result.status : "OK",
      });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.post("/api/revenue-integrity/certification/optum", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      requireRevenueWriteAccess(context);
      const scenario = String(req.body?.scenario || "success") as OptumCertificationScenario;
      if (scenario !== "success" && scenario !== "edits") {
        return res.status(400).json({ message: "The Optum certification scenario must be success or edits." });
      }
      const certification = await ensureOptumCertificationClaim({ context, scenario });
      const validation = await validateClaimWithOptum({
        organizationId: context.organization.id,
        claimId: certification.claimId,
      });
      return res.json({
        claimId: certification.claimId,
        patientControlNumber: certification.fixture.claim.patientControlNumber,
        scenario,
        reused: certification.reused,
        provider: validation.result.provider,
        environment: validation.result.environment,
        valid: validation.result.valid,
        claimStatus: validation.status,
        integrityScore: validation.integrityScore,
        status: validation.result.status,
        editStatus: validation.result.editStatus,
        controlNumber: validation.result.controlNumber,
        correlationId: validation.result.correlationId,
        edits: validation.result.edits,
      });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.post("/api/revenue-integrity/claims/:claimId/validate-optum", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      requireRevenueWriteAccess(context);
      const validation = await validateClaimWithOptum({ organizationId: context.organization.id, claimId: req.params.claimId });
      const result = validation.result;
      return res.json({
        provider: result.provider,
        environment: result.environment,
        valid: result.valid,
        claimStatus: validation.status,
        integrityScore: validation.integrityScore,
        status: result.status,
        editStatus: result.editStatus,
        controlNumber: result.controlNumber,
        correlationId: result.correlationId,
        edits: result.edits,
      });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.post("/api/revenue-integrity/claims/:claimId/submit", async (req, res) => {
    let submissionId: number | null = null;
    try {
      const context = await ensureRevenueContext(req);
      requireRevenueWriteAccess(context);
      const claim = await loadClaimForTransmission(req.params.claimId, context.organization.id);
      if (!claim) return res.status(404).json({ message: "Claim not found." });
      if (claim.status !== "ready") return res.status(409).json({ message: "Only a validated claim in Ready status can be submitted." });

      const transmissionResult = await pool.query<{ transmissionData: unknown; verifiedAt: Date | null }>(`
        select transmission_data as "transmissionData", verified_at as "verifiedAt"
        from revenue_claim_transmissions
        where claim_id = $1 and organization_id = $2
        limit 1
      `, [req.params.claimId, context.organization.id]);
      const transmission = transmissionResult.rows[0];
      if (!transmission?.verifiedAt) return res.status(409).json({ message: "Verified transmission data is required before submission." });
      const parsed = revenueTransmissionSchema.safeParse(transmission.transmissionData);
      if (!parsed.success) return res.status(409).json({ message: "Stored transmission data no longer passes the active schema.", issues: parsed.error.flatten() });
      const mapping = mapProfessionalClaimToStedi(claim.input, parsed.data);
      if (!mapping.payload) return res.status(422).json({ message: "The claim is not ready for 837P mapping.", issues: mapping.issues });

      const adapter = createStediAdapterFromEnvironment();
      const connectionResult = await pool.query<{ mode: string; status: string; liveSubmissionEnabled: boolean }>(`
        select mode, status, live_submission_enabled as "liveSubmissionEnabled"
        from revenue_clearinghouse_connections
        where organization_id = $1 and provider = 'stedi'
        limit 1
      `, [context.organization.id]);
      const connection = connectionResult.rows[0];
      if (adapter.mode === "production" && (!connection || connection.mode !== "production" || connection.status !== "active" || !connection.liveSubmissionEnabled)) {
        return res.status(409).json({ message: "The organization has not passed the production clearinghouse activation gates." });
      }

      const idempotencyKey = `${req.params.claimId}:v${claim.version}:${adapter.mode}`;
      const payloadHash = submissionHash(mapping.payload);
      const submissionResult = await pool.query<{ id: number; status: string; externalTransactionId: string | null; correlationId: string | null }>(`
        insert into revenue_claim_submissions
          (organization_id, claim_id, provider, mode, status, idempotency_key, payload_hash, submitted_by)
        values ($1, $2, 'stedi', $3, 'submitting', $4, $5, $6)
        on conflict (organization_id, provider, idempotency_key) do update set
          status = case when revenue_claim_submissions.status in ('submitted', 'acknowledged') then revenue_claim_submissions.status else 'submitting' end,
          payload_hash = excluded.payload_hash,
          submitted_by = excluded.submitted_by,
          updated_at = now()
        returning id, status, external_transaction_id as "externalTransactionId", correlation_id as "correlationId"
      `, [context.organization.id, req.params.claimId, adapter.mode, idempotencyKey, payloadHash, context.user.id]);
      const submission = submissionResult.rows[0];
      submissionId = submission.id;
      if (submission.status === "submitted" || submission.status === "acknowledged") {
        return res.json({ submissionId: submission.id, status: submission.status, transactionId: submission.externalTransactionId, correlationId: submission.correlationId, duplicatePrevented: true });
      }

      const result = await adapter.submitProfessionalClaim({ payload: mapping.payload, idempotencyKey });
      await pool.query(`
        update revenue_claim_submissions
        set status = 'submitted', external_transaction_id = $2, correlation_id = $3,
          response_summary = $4::jsonb, submitted_at = now(), updated_at = now(), last_error = null
        where id = $1
      `, [submission.id, result.transactionId, result.correlationId, JSON.stringify({ provider: result.provider, status: result.status })]);
      if (adapter.mode === "production") {
        await pool.query(`update revenue_claims set status = 'submitted', submitted_at = now(), last_transaction_at = now(), updated_at = now() where id = $1`, [req.params.claimId]);
      }
      await pool.query(`
        insert into revenue_claim_events
          (organization_id, claim_id, event_type, source, idempotency_key, payload_hash, summary, occurred_at)
        values ($1, $2, $3, 'stedi', $4, $5, $6::jsonb, now())
      `, [context.organization.id, req.params.claimId, adapter.mode === "production" ? "claim_submitted" : "test_claim_submitted", idempotencyKey, payloadHash, JSON.stringify({ transactionId: result.transactionId, correlationId: result.correlationId })]);
      return res.status(202).json({ submissionId: submission.id, mode: adapter.mode, status: "submitted", transactionId: result.transactionId, correlationId: result.correlationId });
    } catch (error) {
      if (submissionId) {
        const message = error instanceof Error ? error.message.slice(0, 1000) : "Submission failed.";
        await pool.query(`update revenue_claim_submissions set status = 'failed', last_error = $2, updated_at = now() where id = $1`, [submissionId, message]).catch(() => undefined);
      }
      return requestError(res, error);
    }
  });

  app.post("/api/revenue-integrity/webhooks/stedi/:organizationId", async (req, res) => {
    try {
      if (!secretsMatch(process.env.STEDI_WEBHOOK_SECRET, webhookCredential(req))) {
        return res.status(401).json({ message: "Webhook authentication failed." });
      }
      const event = parseStediWebhookEvent(req.body);
      const occurredAt = new Date(event.time);
      if (Number.isNaN(occurredAt.getTime())) return res.status(400).json({ message: "Webhook event time is invalid." });
      const connection = await pool.query(`
        select 1 from revenue_clearinghouse_connections
        where organization_id = $1 and provider = 'stedi'
        limit 1
      `, [req.params.organizationId]);
      if (!connection.rows[0]) return res.status(404).json({ message: "Webhook destination is not configured." });
      const inserted = await pool.query(`
        insert into revenue_webhook_events
          (organization_id, provider, event_id, event_type, transaction_type, transaction_id, status, payload, occurred_at)
        values ($1, 'stedi', $2, $3, $4, $5, 'queued', $6::jsonb, $7)
        on conflict (organization_id, provider, event_id) do nothing
        returning id
      `, [req.params.organizationId, event.id, event.detailType, event.transactionSetIdentifier, event.transactionId, JSON.stringify(event.raw), occurredAt]);
      return res.status(202).json({ accepted: true, duplicate: inserted.rowCount === 0 });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.post("/api/revenue-integrity/process-webhooks", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      if (!["owner", "admin", "integrity_manager"].includes(context.role)) return res.status(403).json({ message: "An integrity-manager role is required." });
      return res.json({ results: await processWebhookBatch(10) });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.post("/api/internal/revenue-integrity/process-stedi-webhooks", async (req, res) => {
    try {
      const credential = String(req.headers["x-codical-cron-secret"] || "").trim() || bearerToken(req);
      if (!secretsMatch(process.env.REVENUE_INTEGRITY_CRON_SECRET, credential)) return res.status(401).json({ message: "Worker authentication failed." });
      return res.json({ results: await processWebhookBatch(25) });
    } catch (error) {
      return requestError(res, error);
    }
  });

  app.get("/api/revenue-integrity/integration-readiness", async (req, res) => {
    try {
      const context = await ensureRevenueContext(req);
      const result = await pool.query<{
        provider: string;
        mode: string;
        status: string;
        liveSubmissionEnabled: boolean;
      }>(`
        select provider, mode, status, live_submission_enabled as "liveSubmissionEnabled"
        from revenue_clearinghouse_connections
        where organization_id = $1
        order by created_at
        limit 1
      `, [context.organization.id]);
      return res.json({
        organization: context.organization,
        integration: integrationSnapshot(result.rows[0]),
        validationPartners: [optumValidationSnapshot()],
        requiredProductionSteps: [
          "Execute a clearinghouse agreement and BAA.",
          "Create the production account and restricted API credential.",
          "Enroll each billing provider for 837P and 835 transactions where required.",
          "Configure an authenticated, idempotent webhook destination and durable processor.",
          "Complete test-payer 277CA and 835 certification cases.",
          "Approve a controlled live-submit policy for the organization.",
        ],
      });
    } catch (error) {
      return requestError(res, error);
    }
  });
}
