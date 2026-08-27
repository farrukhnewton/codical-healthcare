import type { Pool, PoolClient } from "pg";
import { calculateWorkPriority } from "@shared/revenue-integrity";
import { createStediAdapterFromEnvironment } from "./stedi-adapter";
import { normalize277ClaimAcknowledgments, normalize835Remittances } from "./stedi-responses";

type QueuedWebhook = {
  id: number;
  organizationId: string;
  eventId: string;
  eventType: string;
  transactionType: string | null;
  transactionId: string | null;
  attempts: number;
};

async function findClaim(client: PoolClient, organizationId: string, patientControlNumber: string) {
  const result = await client.query<{ id: string; totalCharge: string; expectedAmount: string | null }>(`
    select id, total_charge as "totalCharge", expected_amount as "expectedAmount"
    from revenue_claims
    where organization_id = $1
      and (
        lower(patient_control_number) = lower($2)
        or lower(left(patient_control_number, 30)) = lower(left($2, 30))
      )
    order by case when lower(patient_control_number) = lower($2) then 0 else 1 end
    limit 1
  `, [organizationId, patientControlNumber]);
  return result.rows[0] || null;
}

async function apply277(pool: Pool, event: QueuedWebhook, report: Record<string, unknown>) {
  const acknowledgments = normalize277ClaimAcknowledgments(report);
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const acknowledgment of acknowledgments) {
      const claim = await findClaim(client, event.organizationId, acknowledgment.patientControlNumber);
      if (!claim) continue;
      const status = acknowledgment.accepted ? "accepted" : "rejected";
      await client.query(`
        update revenue_claims
        set status = $3, last_transaction_at = now(), updated_at = now()
        where id = $1 and organization_id = $2
      `, [claim.id, event.organizationId, status]);
      await client.query(`
        update revenue_claim_submissions
        set status = 'acknowledged', updated_at = now()
        where claim_id = $1 and organization_id = $2 and status = 'submitted'
      `, [claim.id, event.organizationId]);
      await client.query(`
        insert into revenue_claim_events
          (organization_id, claim_id, event_type, source, external_event_id, summary, occurred_at)
        values ($1, $2, '277ca_acknowledgment', 'stedi', $3, $4::jsonb, now())
        on conflict (organization_id, source, external_event_id) where external_event_id is not null do nothing
      `, [event.organizationId, claim.id, `${event.eventId}:${acknowledgment.patientControlNumber}`, JSON.stringify(acknowledgment)]);

      if (!acknowledgment.accepted) {
        const priority = calculateWorkPriority({ severity: "critical", recoverableAmount: Number(claim.totalCharge), confidence: 1 });
        await client.query(`
          insert into revenue_work_items
            (organization_id, claim_id, category, issue_code, title, description, recommended_action, severity, priority_score, recoverable_amount)
          values ($1, $2, 'clearinghouse_rejection', $3, 'Claim rejected before adjudication', $4, $5, 'critical', $6, $7)
        `, [
          event.organizationId,
          claim.id,
          `277CA_${acknowledgment.categoryCode || "UNKNOWN"}_${acknowledgment.statusCode || "UNKNOWN"}`,
          acknowledgment.message,
          "Correct the acknowledged claim error, revalidate the evidence, and create a new idempotent submission.",
          priority,
          Number(claim.totalCharge),
        ]);
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function apply835(pool: Pool, event: QueuedWebhook, report: Record<string, unknown>) {
  const remittances = normalize835Remittances(report);
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const remittance of remittances) {
      const claim = await findClaim(client, event.organizationId, remittance.patientControlNumber);
      const remittanceResult = await client.query<{ id: number }>(`
        insert into revenue_remittances
          (organization_id, claim_id, provider, transaction_id, patient_control_number, payer_claim_control_number,
           claim_status_code, total_charge, paid_amount, patient_responsibility_amount, summary)
        values ($1, $2, 'stedi', $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        on conflict (organization_id, provider, transaction_id, patient_control_number)
        do update set
          claim_id = excluded.claim_id,
          payer_claim_control_number = excluded.payer_claim_control_number,
          claim_status_code = excluded.claim_status_code,
          total_charge = excluded.total_charge,
          paid_amount = excluded.paid_amount,
          patient_responsibility_amount = excluded.patient_responsibility_amount,
          summary = excluded.summary
        returning id
      `, [
        event.organizationId,
        claim?.id || null,
        event.transactionId,
        remittance.patientControlNumber,
        remittance.payerClaimControlNumber,
        remittance.claimStatusCode,
        remittance.totalCharge,
        remittance.paidAmount,
        remittance.patientResponsibilityAmount,
        JSON.stringify({ lineCount: remittance.lines.length }),
      ]);
      const remittanceId = remittanceResult.rows[0].id;
      await client.query("delete from revenue_line_remittances where remittance_id = $1", [remittanceId]);

      const claimLines = claim
        ? await client.query<{ id: number; lineNumber: number }>(
            `select id, line_number as "lineNumber" from revenue_claim_lines where claim_id = $1`,
            [claim.id],
          )
        : { rows: [] };
      for (const line of remittance.lines) {
        const suffix = line.lineItemControlNumber?.match(/-(\d+)$/)?.[1];
        const matchedLine = suffix ? claimLines.rows.find((candidate) => candidate.lineNumber === Number(suffix)) : null;
        await client.query(`
          insert into revenue_line_remittances
            (remittance_id, claim_line_id, line_item_control_number, procedure_code, charge_amount, paid_amount, allowed_amount, adjustments)
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        `, [remittanceId, matchedLine?.id || null, line.lineItemControlNumber, line.procedureCode, line.chargeAmount, line.paidAmount, line.allowedAmount, JSON.stringify(line.adjustments)]);
        if (matchedLine) {
          await client.query(`update revenue_claim_lines set paid_amount = $2, status = 'adjudicated', updated_at = now() where id = $1`, [matchedLine.id, line.paidAmount]);
        }
      }

      if (claim) {
        const expectedAmount = claim.expectedAmount == null ? null : Number(claim.expectedAmount);
        const status = remittance.claimStatusCode === "4"
          ? "denied"
          : remittance.paidAmount > 0 && remittance.paidAmount >= remittance.totalCharge
            ? "paid"
            : remittance.paidAmount > 0
              ? "partially_paid"
              : "adjudicating";
        await client.query(`
          update revenue_claims
          set status = $3, paid_amount = $4, payer_claim_control_number = coalesce($5, payer_claim_control_number),
              last_transaction_at = now(), updated_at = now()
          where id = $1 and organization_id = $2
        `, [claim.id, event.organizationId, status, remittance.paidAmount, remittance.payerClaimControlNumber]);
        await client.query(`
          insert into revenue_claim_events
            (organization_id, claim_id, event_type, source, external_event_id, summary, occurred_at)
          values ($1, $2, '835_remittance', 'stedi', $3, $4::jsonb, now())
          on conflict (organization_id, source, external_event_id) where external_event_id is not null do nothing
        `, [event.organizationId, claim.id, `${event.eventId}:${remittance.patientControlNumber}`, JSON.stringify({ status, paidAmount: remittance.paidAmount, patientResponsibilityAmount: remittance.patientResponsibilityAmount })]);

        if (expectedAmount != null && remittance.paidAmount + 0.01 < expectedAmount && status !== "denied") {
          const opportunity = expectedAmount - remittance.paidAmount;
          await client.query(`
            insert into revenue_work_items
              (organization_id, claim_id, category, issue_code, title, description, recommended_action, severity, priority_score, recoverable_amount)
            values ($1, $2, 'underpayment', 'PAID_BELOW_EXPECTED', 'Payment is below the expected amount', $3, $4, 'high', $5, $6)
          `, [
            event.organizationId,
            claim.id,
            `Expected ${expectedAmount.toFixed(2)} but the 835 reports ${remittance.paidAmount.toFixed(2)} paid.`,
            "Review contract terms, CARC/RARC adjustments, patient responsibility, and appeal or reconsideration requirements.",
            calculateWorkPriority({ severity: "high", recoverableAmount: opportunity, confidence: 0.9 }),
            opportunity,
          ]);
        }
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function leaseNextWebhook(pool: Pool): Promise<QueuedWebhook | null> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<QueuedWebhook>(`
      with candidate as (
        select id
        from revenue_webhook_events
        where (
          (status in ('queued', 'failed') and next_attempt_at <= now())
          or (status = 'processing' and lease_expires_at <= now())
        ) and attempts < 8
        order by received_at
        for update skip locked
        limit 1
      )
      update revenue_webhook_events e
      set status = 'processing', attempts = attempts + 1, last_error = null, lease_expires_at = now() + interval '5 minutes'
      from candidate
      where e.id = candidate.id
      returning e.id, e.organization_id as "organizationId", e.event_id as "eventId", e.event_type as "eventType",
        e.transaction_type as "transactionType", e.transaction_id as "transactionId", e.attempts
    `);
    await client.query("commit");
    return result.rows[0] || null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function processNextStediWebhook(pool: Pool) {
  const event = await leaseNextWebhook(pool);
  if (!event) return { processed: false as const };
  try {
    if (!event.transactionId || !event.transactionType) {
      await pool.query(`update revenue_webhook_events set status = 'ignored', processed_at = now(), lease_expires_at = null where id = $1`, [event.id]);
      return { processed: true as const, eventId: event.eventId, outcome: "ignored" as const };
    }
    const adapter = createStediAdapterFromEnvironment();
    if (event.transactionType === "277") {
      await apply277(pool, event, await adapter.retrieveClaimAcknowledgment(event.transactionId));
    } else if (event.transactionType === "835") {
      await apply835(pool, event, await adapter.retrieveRemittance(event.transactionId));
    } else {
      await pool.query(`update revenue_webhook_events set status = 'ignored', processed_at = now(), lease_expires_at = null where id = $1`, [event.id]);
      return { processed: true as const, eventId: event.eventId, outcome: "ignored" as const };
    }
    await pool.query(`update revenue_webhook_events set status = 'processed', processed_at = now(), lease_expires_at = null where id = $1`, [event.id]);
    return { processed: true as const, eventId: event.eventId, outcome: "processed" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Webhook processing failed.";
    const delayMinutes = Math.min(60, 2 ** Math.min(event.attempts, 6));
    await pool.query(`
      update revenue_webhook_events
      set status = 'failed', last_error = $2, next_attempt_at = now() + ($3::text || ' minutes')::interval, lease_expires_at = null
      where id = $1
    `, [event.id, message, delayMinutes]);
    throw error;
  }
}
