import type { ClaimStatusInquiryInput, NormalizedClaimStatusResponse } from "@shared/revenue-cycle";
import { createAvailityDemoAdapterFromEnvironment } from "./availity-demo-adapter";

type AvailityClaimStatusResult = Awaited<ReturnType<ReturnType<typeof createAvailityDemoAdapterFromEnvironment>["runClaimStatusScenario"]>>;

function amount(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyStatus(result: AvailityClaimStatusResult): NormalizedClaimStatusResponse["status"] {
  const detailText = result.statusDetails.map((detail) => `${detail.category || ""} ${detail.status || ""}`).join(" ").toLowerCase();
  const paid = result.statusDetails.some((detail) => (amount(detail.paymentAmount) || 0) > 0);
  if (paid || /paid|payment issued|finalized/.test(detailText)) return "paid";
  if (/denied|rejected|not payable/.test(detailText)) return "denied";
  if (/pending|processing|in process/.test(detailText)) return "processing";
  if (!result.claimCount) return "not_found";
  return "received";
}

export async function runAvailityClaimStatusInquiry(
  input: ClaimStatusInquiryInput,
  runScenario = () => createAvailityDemoAdapterFromEnvironment().runClaimStatusScenario(),
): Promise<NormalizedClaimStatusResponse> {
  if (input.dataClassification !== "synthetic" || input.scenario !== "standard_complete") {
    throw new Error("Only the fixed synthetic Availity 276/277 scenario is allowed.");
  }
  const result = await runScenario();
  const status = classifyStatus(result);
  const paymentAmount = result.statusDetails.reduce<number | null>((total, detail) => {
    const value = amount(detail.paymentAmount);
    return value === null ? total : (total || 0) + value;
  }, null);
  const nextAction = status === "paid"
    ? "Reconcile the payment to the remittance record."
    : status === "denied"
      ? "Route the claim to denial review with the returned status codes."
      : status === "processing"
        ? "Monitor the payer response and repeat the inquiry after the payer processing window."
        : status === "not_found"
          ? "Verify the payer, service dates, and submitted claim identifiers."
          : "Confirm the claim is present in the payer system and continue status monitoring.";

  return {
    status,
    provider: "availity",
    environment: "demo",
    mockVerified: true,
    inquiryType: "standard_276_277",
    responseId: result.responseId,
    payer: { id: result.payerId || "BCBSF", name: result.payerId === "BCBSF" || !result.payerId ? "Florida Blue (demo)" : result.payerId },
    claim: {
      claimNumberMasked: "CL4IM••••NUM8ER",
      patientAccountMasked: "PAT••••••••NUMB3R",
      claimAmount: amount(result.claimAmount),
      paymentAmount,
      responseStatus: result.status || "Complete",
      responseStatusCode: result.statusCode,
      serviceLineCount: result.serviceLineCount,
    },
    statusDetails: result.statusDetails.map((detail) => ({
      category: detail.category || "Status information",
      categoryCode: detail.categoryCode || "—",
      status: detail.status || "No description returned",
      statusCode: detail.statusCode || "—",
      entity: detail.entity,
      entityCode: detail.entityCode,
      paymentAmount: amount(detail.paymentAmount),
    })),
    nextAction,
    checkedAt: new Date().toISOString(),
  };
}
