import type { RevenueClaimCreateInput, RevenueTransmissionInput } from "@shared/revenue-integrity";

const EDITABLE_CLAIM_STATUSES = new Set(["draft", "needs_review", "ready", "rejected"]);

export function canCorrectRevenueClaim(status: string) {
  return EDITABLE_CLAIM_STATUSES.has(status);
}

function normalized(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function summarizeClaimChanges(input: {
  before: RevenueClaimCreateInput;
  after: RevenueClaimCreateInput;
  beforeTransmission?: RevenueTransmissionInput | null;
  afterTransmission?: RevenueTransmissionInput | null;
}) {
  const fields: Array<keyof RevenueClaimCreateInput> = [
    "patientControlNumber",
    "payerId",
    "payerName",
    "serviceFrom",
    "serviceTo",
    "billingProviderNpi",
    "renderingProviderNpi",
    "diagnosisCodes",
    "totalCharge",
    "expectedAmount",
    "lines",
  ];
  const changedFields = fields.filter((field) => normalized(input.before[field]) !== normalized(input.after[field]));
  if (normalized(input.beforeTransmission) !== normalized(input.afterTransmission)) changedFields.push("metadata");
  return changedFields.map((field) => field === "metadata" ? "837pProfile" : field);
}
