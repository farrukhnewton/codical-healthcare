export type StediWebhookEvent = {
  id: string;
  time: string;
  source: string;
  detailType: string;
  transactionId: string | null;
  transactionSetIdentifier: string | null;
  raw: Record<string, unknown>;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function deepFindString(value: unknown, keys: Set<string>): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindString(item, keys);
      if (found) return found;
    }
    return null;
  }
  const object = record(value);
  if (!object) return null;
  for (const [key, child] of Object.entries(object)) {
    if (keys.has(key) && text(child)) return text(child);
    const found = deepFindString(child, keys);
    if (found) return found;
  }
  return null;
}

export function parseStediWebhookEvent(input: unknown): StediWebhookEvent {
  const raw = record(input);
  if (!raw) throw new Error("The Stedi webhook body must be a JSON object.");
  const id = text(raw.id);
  const time = text(raw.time);
  const source = text(raw.source);
  const detailType = text(raw["detail-type"]);
  if (!id || !time || source !== "stedi.core" || !detailType) {
    throw new Error("The Stedi webhook envelope is invalid.");
  }
  const detail = record(raw.detail) || {};
  return {
    id,
    time,
    source,
    detailType,
    transactionId: deepFindString(detail, new Set(["transactionId"])),
    transactionSetIdentifier: deepFindString(detail, new Set(["transactionSetIdentifier"])),
    raw,
  };
}

export type ClaimAcknowledgment = {
  patientControlNumber: string;
  accepted: boolean;
  categoryCode: string | null;
  statusCode: string | null;
  message: string;
  lineItemControlNumber?: string | null;
};

function collectObjects(value: unknown, output: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjects(item, output));
    return output;
  }
  const object = record(value);
  if (!object) return output;
  output.push(object);
  Object.values(object).forEach((item) => collectObjects(item, output));
  return output;
}

export function normalize277ClaimAcknowledgments(report: unknown): ClaimAcknowledgment[] {
  const acknowledgments: ClaimAcknowledgment[] = [];
  for (const object of collectObjects(report)) {
    const controlNumber = text(object.referencedTransactionTraceNumber)
      || text(record(object.claimStatus)?.patientAccountNumber);
    if (!controlNumber) continue;

    const statuses = collectObjects(object).filter((candidate) =>
      text(candidate.healthCareClaimStatusCategoryCode) || text(candidate.statusCode));
    const categoryCode = statuses.map((status) => text(status.healthCareClaimStatusCategoryCode)).find(Boolean) || null;
    const statusCode = statuses.map((status) => text(status.statusCode)).find(Boolean) || null;
    const categoryMessage = statuses.map((status) => text(status.healthCareClaimStatusCategoryCodeValue)).find(Boolean);
    const statusMessage = statuses.map((status) => text(status.statusCodeValue)).find(Boolean);
    const rejected = Boolean(categoryCode && /^(A3|A7|A8|R)/i.test(categoryCode));
    acknowledgments.push({
      patientControlNumber: controlNumber,
      accepted: !rejected,
      categoryCode,
      statusCode,
      message: [categoryMessage, statusMessage].filter(Boolean).join(" ") || (rejected ? "Claim rejected." : "Claim accepted for processing."),
      lineItemControlNumber: deepFindString(object.serviceLines, new Set(["lineItemControlNumber"])),
    });
  }

  const unique = new Map<string, ClaimAcknowledgment>();
  for (const acknowledgment of acknowledgments) {
    const key = `${acknowledgment.patientControlNumber.toLowerCase()}|${acknowledgment.lineItemControlNumber || ""}`;
    const existing = unique.get(key);
    if (!existing || (!acknowledgment.accepted && existing.accepted)) unique.set(key, acknowledgment);
  }
  const normalized = [...unique.values()];
  const claimsWithLineStatuses = new Set(
    normalized.filter((item) => item.lineItemControlNumber).map((item) => item.patientControlNumber.toLowerCase()),
  );
  return normalized.filter((item) => item.lineItemControlNumber || !claimsWithLineStatuses.has(item.patientControlNumber.toLowerCase()));
}

export type RemittanceClaim = {
  patientControlNumber: string;
  payerClaimControlNumber: string | null;
  claimStatusCode: string | null;
  totalCharge: number;
  paidAmount: number;
  patientResponsibilityAmount: number;
  lines: Array<{
    lineItemControlNumber: string | null;
    procedureCode: string | null;
    chargeAmount: number;
    paidAmount: number;
    allowedAmount: number | null;
    adjustments: unknown[];
  }>;
};

export function normalize835Remittances(report: unknown): RemittanceClaim[] {
  const remittances: RemittanceClaim[] = [];
  for (const object of collectObjects(report)) {
    const payment = record(object.claimPaymentInfo);
    if (!payment) continue;
    const patientControlNumber = text(payment.patientControlNumber);
    if (!patientControlNumber) continue;
    const serviceLines = Array.isArray(object.serviceLines) ? object.serviceLines : [];
    remittances.push({
      patientControlNumber,
      payerClaimControlNumber: text(payment.payerClaimControlNumber),
      claimStatusCode: text(payment.claimStatusCode),
      totalCharge: numberValue(payment.totalClaimChargeAmount),
      paidAmount: numberValue(payment.claimPaymentAmount),
      patientResponsibilityAmount: numberValue(payment.patientResponsibilityAmount),
      lines: serviceLines.map((lineValue) => {
        const line = record(lineValue) || {};
        const servicePayment = record(line.servicePaymentInformation) || {};
        const supplemental = record(line.serviceSupplementalAmounts) || {};
        return {
          lineItemControlNumber: text(line.lineItemControlNumber),
          procedureCode: text(servicePayment.adjudicatedProcedureCode),
          chargeAmount: numberValue(servicePayment.lineItemChargeAmount),
          paidAmount: numberValue(servicePayment.lineItemProviderPaymentAmount),
          allowedAmount: supplemental.allowedActual == null ? null : numberValue(supplemental.allowedActual),
          adjustments: Array.isArray(line.serviceAdjustments) ? line.serviceAdjustments : [],
        };
      }),
    });
  }
  return remittances;
}
