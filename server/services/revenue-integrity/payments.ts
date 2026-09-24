import type { NormalizedPaymentResponse, PaymentDemoInput } from "@shared/revenue-cycle";

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const descriptions: Record<string, string> = {
  "45": "Charge exceeds the contracted or fee-schedule amount.",
  "16": "Claim or service lacks information needed for adjudication.",
};

export function buildSyntheticPayment(input: PaymentDemoInput, now = new Date()): NormalizedPaymentResponse {
  const suffix = input.scenario === "clean_payment" ? "CLEAN" : input.scenario === "payment_variance" ? "VAR" : "DENIED";
  const isDenied = input.scenario === "denied_claim";
  const paidAmount = input.scenario === "clean_payment" ? 100 : input.scenario === "payment_variance" ? 80 : 0;
  const patientResponsibilityAmount = isDenied ? 0 : 20;
  const adjustments = isDenied
    ? [{ groupCode: "CO" as const, reasonCode: "16", amount: 150, description: descriptions["16"], remarkCodes: ["M51"] }]
    : [
        { groupCode: "CO" as const, reasonCode: "45", amount: 30, description: descriptions["45"], remarkCodes: [] },
        { groupCode: "PR" as const, reasonCode: "1", amount: 20, description: "Patient deductible amount.", remarkCodes: [] },
      ];
  const adjustmentTotal = round(adjustments.reduce((total, item) => total + item.amount, 0));
  const variance = round(150 - paidAmount - adjustmentTotal);
  const status = isDenied || Math.abs(variance) > 0.009 ? "exception" : "unreviewed";

  return {
    provider: "codical",
    environment: "sandbox",
    dataClassification: "synthetic",
    scenario: input.scenario,
    transactionId: `SYN835-${suffix}`,
    patientControlNumber: `SYN-PAY-${suffix}`,
    payerClaimControlNumber: `PAYER-${suffix}-835`,
    claimStatusCode: isDenied ? "4" : "1",
    payer: { id: "SYNTHETIC-PAYER", name: "Codical Synthetic Health Plan" },
    payment: {
      reference: `ACH-${suffix}-2026`,
      date: now.toISOString().slice(0, 10),
      method: "ACH",
      totalCharge: 150,
      allowedAmount: isDenied ? 0 : 120,
      paidAmount,
      patientResponsibilityAmount,
    },
    lines: [{
      lineItemControlNumber: `SYN-PAY-${suffix}-1`,
      procedureCode: "99213",
      chargeAmount: 150,
      allowedAmount: isDenied ? 0 : 120,
      paidAmount,
      adjustments,
    }],
    reconciliation: {
      status,
      adjustmentTotal,
      variance,
      explanation: isDenied
        ? "The 835 reports an explicit denied claim status and a CO-16 adjustment. Zero payment alone is not used to determine denial."
        : Math.abs(variance) > 0.009
          ? "Paid and adjusted amounts do not balance to the billed charge. Posting is held for review."
          : "Paid and adjusted amounts balance exactly to the billed charge.",
      nextAction: isDenied
        ? "Route the CO-16 edit to denial review and obtain the missing information before correction or appeal."
        : Math.abs(variance) > 0.009
          ? "Hold automatic posting and investigate the unexplained remittance variance."
          : "Review the ERA, then post the payer payment and patient responsibility.",
    },
    receivedAt: now.toISOString(),
  };
}
