import { z } from "zod";

export const eligibilityScenarioSchema = z.enum([
  "complete",
  "providerIneligible",
  "invalidSubscriberName",
  "inProgress",
  "retrying",
  "requestErrorOne",
  "requestErrorTwo",
]);

export const eligibilityCheckInputSchema = z.object({
  scenario: eligibilityScenarioSchema.default("complete"),
  sampleProfile: z.enum(["commercial_individual", "commercial_family", "medicare_secondary"]).default("commercial_individual"),
  serviceType: z.enum(["health_benefit_plan", "medical_care", "hospital", "professional"]).default("health_benefit_plan"),
  dataClassification: z.literal("synthetic"),
}).strict();

export type EligibilityScenario = z.infer<typeof eligibilityScenarioSchema>;
export type EligibilityCheckInput = z.infer<typeof eligibilityCheckInputSchema>;

export type EligibilityBenefit = {
  id: string;
  category: string;
  serviceType: string;
  network: "in_network" | "out_of_network" | "not_applicable";
  coverageLevel: "individual" | "family";
  status: "active" | "inactive" | "unknown";
  amountType: "deductible" | "copay" | "coinsurance" | "out_of_pocket" | "information";
  amount: number | null;
  percent: number | null;
  remaining: number | null;
  period: string | null;
  notes: string[];
};

export type NormalizedEligibilityResponse = {
  status: "active" | "inactive" | "pending" | "error";
  outcome: string;
  provider: "availity";
  environment: "demo";
  mockVerified: boolean;
  patient: { displayName: string; memberIdMasked: string; relationship: string };
  payer: { id: string; name: string };
  plan: { name: string; groupNumberMasked: string; effectiveFrom: string; effectiveTo: string | null };
  coverage: { serviceType: string; network: string; summary: string };
  benefits: EligibilityBenefit[];
  messages: string[];
  checkedAt: string;
};

export const authorizationScenarioSchema = z.enum(["not_required", "approved", "pended", "denied"]);

export const authorizationCheckInputSchema = z.object({
  scenario: authorizationScenarioSchema.default("approved"),
  sampleProfile: z.enum(["outpatient_imaging", "ambulance_transport", "specialty_medication"]).default("outpatient_imaging"),
  dataClassification: z.literal("synthetic"),
}).strict();

export type AuthorizationCheckInput = z.infer<typeof authorizationCheckInputSchema>;

export type NormalizedAuthorizationResponse = {
  status: "not_required" | "approved" | "pended" | "denied";
  provider: "codical";
  environment: "sandbox";
  mockVerified: true;
  patient: { displayName: string; memberIdMasked: string };
  payer: { id: string; name: string };
  service: { procedureCode: string; description: string; diagnosisCode: string; serviceFrom: string; serviceTo: string; requestedUnits: number };
  requirement: { required: boolean; summary: string; documentation: string[] };
  determination: { authorizationNumber: string | null; effectiveFrom: string | null; effectiveTo: string | null; reason: string; nextAction: string };
  checkedAt: string;
};

export const claimStatusInquiryInputSchema = z.object({
  scenario: z.literal("standard_complete").default("standard_complete"),
  dataClassification: z.literal("synthetic"),
}).strict();

export type ClaimStatusInquiryInput = z.infer<typeof claimStatusInquiryInputSchema>;

export type ClaimStatusDetail = {
  category: string;
  categoryCode: string;
  status: string;
  statusCode: string;
  entity: string | null;
  entityCode: string | null;
  paymentAmount: number | null;
};

export type NormalizedClaimStatusResponse = {
  status: "received" | "processing" | "paid" | "denied" | "not_found";
  provider: "availity";
  environment: "demo";
  mockVerified: true;
  inquiryType: "standard_276_277";
  responseId: string;
  payer: { id: string; name: string };
  claim: {
    claimNumberMasked: string;
    patientAccountMasked: string;
    claimAmount: number | null;
    paymentAmount: number | null;
    responseStatus: string;
    responseStatusCode: string | null;
    serviceLineCount: number;
  };
  statusDetails: ClaimStatusDetail[];
  nextAction: string;
  checkedAt: string;
};
