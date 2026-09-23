import { createHash } from "node:crypto";
import type { AuthorizationCheckInput, NormalizedAuthorizationResponse } from "@shared/revenue-cycle";

const PROFILES = {
  outpatient_imaging: {
    patient: "Morgan Lee",
    memberId: "•••• 1184",
    payerId: "UHCDEMODV1",
    payerName: "Synthetic Medical Network",
    procedureCode: "72148",
    description: "MRI lumbar spine without contrast",
    diagnosisCode: "M54.50",
    units: 1,
    documentation: ["Ordering-provider note", "Conservative-treatment history", "Relevant imaging history"],
  },
  ambulance_transport: {
    patient: "Casey Jordan",
    memberId: "•••• 4207",
    payerId: "UHCDEMODV1",
    payerName: "Synthetic Medical Network",
    procedureCode: "A0428",
    description: "BLS non-emergency transport",
    diagnosisCode: "R26.89",
    units: 1,
    documentation: ["Physician certification statement", "Medical-necessity narrative", "Origin and destination"],
  },
  specialty_medication: {
    patient: "Riley Adams",
    memberId: "•••• 9063",
    payerId: "UHCDEMODV1",
    payerName: "Synthetic Medical Network",
    procedureCode: "J1745",
    description: "Infliximab, per 10 mg",
    diagnosisCode: "K50.90",
    units: 40,
    documentation: ["Medication order", "Weight and dose calculation", "Previous therapy and response"],
  },
} as const;

function sandboxReference(input: AuthorizationCheckInput) {
  return createHash("sha256").update(`${input.sampleProfile}:${input.scenario}`).digest("hex").slice(0, 10).toUpperCase();
}

export function runSyntheticAuthorization(input: AuthorizationCheckInput, now = new Date()): NormalizedAuthorizationResponse {
  const profile = PROFILES[input.sampleProfile];
  const serviceFrom = now.toISOString().slice(0, 10);
  const serviceToDate = new Date(now);
  serviceToDate.setDate(serviceToDate.getDate() + 30);
  const required = input.scenario !== "not_required";
  const approved = input.scenario === "approved";
  const status = input.scenario;
  const summaries = {
    not_required: "The synthetic payer rule indicates that prior authorization is not required for this service.",
    approved: "The synthetic request meets the payer's authorization requirements.",
    pended: "The synthetic payer requires clinical review before making a determination.",
    denied: "The synthetic payer did not approve the requested service under the supplied evidence.",
  } as const;
  const nextActions = {
    not_required: "Save the reference and verify again if the service, date, or payer changes.",
    approved: "Attach the authorization number to the claim and monitor the approved dates and units.",
    pended: "Upload the requested clinical records and monitor the payer determination.",
    denied: "Review the denial reason, confirm medical necessity, and prepare reconsideration or appeal evidence.",
  } as const;

  return {
    status,
    provider: "codical",
    environment: "sandbox",
    mockVerified: true,
    patient: { displayName: profile.patient, memberIdMasked: profile.memberId },
    payer: { id: profile.payerId, name: profile.payerName },
    service: {
      procedureCode: profile.procedureCode,
      description: profile.description,
      diagnosisCode: profile.diagnosisCode,
      serviceFrom,
      serviceTo: serviceToDate.toISOString().slice(0, 10),
      requestedUnits: profile.units,
    },
    requirement: {
      required,
      summary: summaries[input.scenario],
      documentation: required ? [...profile.documentation] : [],
    },
    determination: {
      authorizationNumber: approved ? `SYN-${sandboxReference(input)}` : null,
      effectiveFrom: approved ? serviceFrom : null,
      effectiveTo: approved ? serviceToDate.toISOString().slice(0, 10) : null,
      reason: summaries[input.scenario],
      nextAction: nextActions[input.scenario],
    },
    checkedAt: now.toISOString(),
  };
}
