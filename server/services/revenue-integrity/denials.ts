import type { DenialDemoInput, NormalizedDenialCase } from "@shared/revenue-cycle";

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

export function buildSyntheticDenial(input: DenialDemoInput, now = new Date()): NormalizedDenialCase {
  const determinationDate = now.toISOString().slice(0, 10);
  const base = {
    provider: "codical" as const,
    environment: "sandbox" as const,
    dataClassification: "synthetic" as const,
    scenario: input.scenario,
    payer: { id: "MEDICARE-SYNTHETIC", name: "Synthetic Medicare Administrative Contractor", program: "Medicare FFS" as const },
    createdAt: now.toISOString(),
  };
  if (input.scenario === "minor_coding_error") return {
    ...base,
    claim: { patientControlNumber: "SYN-DEN-MODIFIER", payerClaimControlNumber: "MAC-MODIFIER-001", procedureCode: "99213", serviceDate: addDays(now, -30), amountAtRisk: 125 },
    denial: { groupCode: "CO", carc: "4", rarcs: ["N517"], reason: "Procedure code is inconsistent with the modifier used or a required modifier is missing.", determinationDate },
    routing: { pathway: "reopening", rationale: "CMS directs minor errors and omissions, including inaccurate coding, to the reopening process rather than a redetermination appeal.", filingDeadline: null, deadlineDays: null, requiredEvidence: ["Corrected coding detail", "Original remittance advice", "Brief explanation of the clerical correction"], nextAction: "Verify the modifier from the source record and prepare a reopening request. Do not submit a formal appeal for a minor clerical correction." },
  };
  if (input.scenario === "medical_necessity") return {
    ...base,
    claim: { patientControlNumber: "SYN-DEN-MEDNEC", payerClaimControlNumber: "MAC-MEDNEC-002", procedureCode: "70553", serviceDate: addDays(now, -45), amountAtRisk: 850 },
    denial: { groupCode: "CO", carc: "50", rarcs: ["M127"], reason: "Service was denied as not medically necessary; requested medical records were not received.", determinationDate },
    routing: { pathway: "redetermination", rationale: "The case disputes a coverage/payment determination and requires clinical evidence. A Medicare first-level redetermination is due within 120 days of receiving the initial determination.", filingDeadline: addDays(now, 125), deadlineDays: 125, requiredEvidence: ["Initial determination or remittance advice", "Signed order and clinical notes", "Medical-necessity rationale", "Applicable coverage policy evidence"], nextAction: "Assemble all supporting documentation and submit a written first-level redetermination to the MAC before the tracked deadline." },
  };
  return {
    ...base,
    claim: { patientControlNumber: "SYN-DEN-DUPLICATE", payerClaimControlNumber: "MAC-DUPLICATE-003", procedureCode: "93000", serviceDate: addDays(now, -20), amountAtRisk: 75 },
    denial: { groupCode: "CO", carc: "18", rarcs: ["N522"], reason: "Exact duplicate claim or service.", determinationDate },
    routing: { pathway: "duplicate_review", rationale: "Duplicate services generally do not carry appeal rights unless the dispute is whether the service was actually a duplicate.", filingDeadline: addDays(now, 125), deadlineDays: 125, requiredEvidence: ["Original and duplicate claim comparison", "Distinct encounter or service documentation", "Remittance advice", "Reason the service is not a duplicate"], nextAction: "Compare claim history first. Close a true duplicate; if the services are distinct, document the difference and prepare the appropriate reopening or redetermination request." },
  };
}

export function canAdvanceDenial(status: string, action: string) {
  const allowed: Record<string, string[]> = {
    evidence_needed: ["add_evidence"],
    evidence_added: ["add_evidence", "mark_ready"],
    ready: ["add_evidence", "submit"],
    submitted: ["overturn", "uphold"],
  };
  return allowed[status]?.includes(action) || false;
}
