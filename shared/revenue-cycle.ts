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
