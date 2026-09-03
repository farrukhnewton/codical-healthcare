export type ClaimMdMessage = {
  id: string | null;
  status: string;
  message: string;
  fields: string[];
};

export type ClaimMdClaimResponse = {
  responseId: string | null;
  claimMdId: string | null;
  remoteClaimId: string | null;
  patientControlNumber: string | null;
  payerId: string | null;
  status: string;
  accepted: boolean;
  totalCharge: number;
  messages: ClaimMdMessage[];
};

export type ClaimMdRemittance = {
  eraId: string | null;
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
    adjustments: Array<{ group: string; code: string; amount: number }>;
  }>;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function nullable(value: unknown) {
  const output = text(value);
  return output || null;
}

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resultCollection(payload: unknown, singularKey: string, pluralKey: string) {
  const outer = record(payload);
  const rawResult = outer.result ?? outer;
  if (Array.isArray(rawResult)) {
    const first = record(rawResult[0]);
    if (singularKey in first || pluralKey in first) {
      return { outer, result: first, items: array(first[singularKey] ?? first[pluralKey]) };
    }
    return { outer, result: outer, items: rawResult };
  }
  const result = record(rawResult);
  return { outer, result, items: array(result[singularKey] ?? result[pluralKey]) };
}

function greatestNumericText(values: Array<string | null | undefined>, fallback = "0") {
  let greatest = fallback;
  for (const candidate of values) {
    if (!candidate || !/^\d+$/.test(candidate)) continue;
    try {
      if (BigInt(candidate) > BigInt(greatest)) greatest = candidate;
    } catch {
      // Ignore malformed or out-of-range vendor cursor values.
    }
  }
  return greatest;
}

export function normalizeClaimMdResponses(payload: unknown): { lastResponseId: string; claims: ClaimMdClaimResponse[] } {
  const collection = resultCollection(payload, "claim", "claims");
  const claims = collection.items.map((entry) => {
    const claim = record(entry);
    const messages = array(claim.messages ?? claim.message).map((messageEntry) => {
      const message = record(messageEntry);
      return {
        id: nullable(message.responseid ?? message.mesgid),
        status: text(message.status),
        message: text(message.message),
        fields: text(message.fields).split(",").map((field) => field.trim()).filter(Boolean),
      };
    });
    const status = text(claim.status).toUpperCase();
    return {
      responseId: nullable(messages.at(-1)?.id),
      claimMdId: nullable(claim.claimmd_id ?? claim.claimmdId),
      remoteClaimId: nullable(claim.remote_claimid ?? claim.remoteClaimId),
      patientControlNumber: nullable(claim.pcn ?? claim.patientControlNumber),
      payerId: nullable(claim.payerid ?? claim.payerId),
      status,
      accepted: status === "A" && !messages.some((message) => message.status.toUpperCase() === "R"),
      totalCharge: amount(claim.total_charge ?? claim.totalCharge),
      messages,
    } satisfies ClaimMdClaimResponse;
  });
  const declaredCursor = text(
    collection.result.last_responseid ?? collection.result.lastResponseId
      ?? collection.outer.last_responseid ?? collection.outer.lastResponseId,
  );
  return {
    lastResponseId: greatestNumericText(
      [declaredCursor, ...claims.flatMap((claim) => [claim.responseId, ...claim.messages.map((message) => message.id)])],
    ),
    claims,
  };
}

export function normalizeClaimMdEraList(payload: unknown) {
  const collection = resultCollection(payload, "era", "eras");
  const eras = collection.items.map((entry) => {
    const era = record(entry);
    return {
      eraId: text(era.eraid ?? era.eraId),
      payerId: nullable(era.payerid ?? era.payerId),
      payerName: nullable(era.payer_name ?? era.payerName),
      checkNumber: nullable(era.check_number ?? era.checkNumber),
      paidAmount: amount(era.paid_amount ?? era.paidAmount),
      paidDate: nullable(era.paid_date ?? era.paidDate),
    };
  });
  const declaredCursor = text(
    collection.result.last_eraid ?? collection.result.lastEraId
      ?? collection.outer.last_eraid ?? collection.outer.lastEraId,
  );
  return {
    lastEraId: greatestNumericText([declaredCursor, ...eras.map((era) => era.eraId)]),
    eras,
  };
}

export function normalizeClaimMdRemittances(payload: unknown): ClaimMdRemittance[] {
  const collection = resultCollection(payload, "claim", "claims");
  return collection.items.map((entry) => {
    const claim = record(entry);
    const lines = array(claim.charge ?? claim.charges).map((lineEntry) => {
      const line = record(lineEntry);
      const adjustments = array(line.adjustment ?? line.adjustments).map((adjustmentEntry) => {
        const adjustment = record(adjustmentEntry);
        return { group: text(adjustment.group), code: text(adjustment.code), amount: amount(adjustment.amount) };
      });
      return {
        lineItemControlNumber: nullable(line.remote_chgid ?? line.remoteChgid ?? line.chgid),
        procedureCode: nullable(line.proc_code ?? line.procedureCode),
        chargeAmount: amount(line.charge),
        paidAmount: amount(line.paid),
        allowedAmount: nullable(line.allowed) == null ? null : amount(line.allowed),
        adjustments,
      };
    });
    const patientResponsibilityAmount = lines.flatMap((line) => line.adjustments)
      .filter((adjustment) => adjustment.group.toUpperCase() === "PR")
      .reduce((sum, adjustment) => sum + adjustment.amount, 0);
    return {
      eraId: nullable(claim.eraid ?? claim.eraId ?? collection.result.eraid ?? collection.result.eraId),
      patientControlNumber: text(claim.pcn ?? claim.patientControlNumber),
      payerClaimControlNumber: nullable(claim.payer_icn ?? claim.payerClaimControlNumber),
      claimStatusCode: nullable(claim.status_code ?? claim.statusCode),
      totalCharge: amount(claim.total_charge ?? claim.totalCharge),
      paidAmount: amount(claim.total_paid ?? claim.totalPaid),
      patientResponsibilityAmount,
      lines,
    };
  });
}
