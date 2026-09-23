import type {
  EligibilityCheckInput,
  EligibilityBenefit,
  NormalizedEligibilityResponse,
} from "@shared/revenue-cycle";
import {
  createAvailityDemoAdapterFromEnvironment,
  type AvailityDemoAdapter,
} from "./availity-demo-adapter";

type EligibilityAdapter = {
  check(input: EligibilityCheckInput): Promise<NormalizedEligibilityResponse>;
};

const PROFILE_DETAILS = {
  commercial_individual: {
    displayName: "Avery Morgan",
    memberIdMasked: "•••• 4821",
    relationship: "Self",
    planName: "Synthetic PPO 750",
    groupNumberMasked: "SYN-••42",
    payerName: "Availity Demo Health Plan",
    coverageLevel: "individual" as const,
  },
  commercial_family: {
    displayName: "Jordan Rivera",
    memberIdMasked: "•••• 7319",
    relationship: "Dependent",
    planName: "Synthetic Family PPO",
    groupNumberMasked: "SYN-••88",
    payerName: "Availity Demo Health Plan",
    coverageLevel: "family" as const,
  },
  medicare_secondary: {
    displayName: "Taylor Brooks",
    memberIdMasked: "•••• 6504",
    relationship: "Self",
    planName: "Synthetic Medicare Supplement",
    groupNumberMasked: "SYN-••65",
    payerName: "Availity Demo Health Plan",
    coverageLevel: "individual" as const,
  },
};

function benefitFixtures(input: EligibilityCheckInput): EligibilityBenefit[] {
  const level = PROFILE_DETAILS[input.sampleProfile].coverageLevel;
  return [
    {
      id: "deductible",
      category: "Medical deductible",
      serviceType: input.serviceType,
      network: "in_network",
      coverageLevel: level,
      status: "active",
      amountType: "deductible",
      amount: level === "family" ? 1500 : 750,
      percent: null,
      remaining: level === "family" ? 920 : 310,
      period: "calendar_year",
      notes: ["Synthetic demonstration value", "Confirm accumulators on the date of service in production"],
    },
    {
      id: "copay",
      category: "Professional visit",
      serviceType: "professional",
      network: "in_network",
      coverageLevel: level,
      status: "active",
      amountType: "copay",
      amount: 35,
      percent: null,
      remaining: null,
      period: "visit",
      notes: ["Specialist office visit"],
    },
    {
      id: "coinsurance",
      category: "Hospital outpatient",
      serviceType: "hospital",
      network: "in_network",
      coverageLevel: level,
      status: "active",
      amountType: "coinsurance",
      amount: null,
      percent: 20,
      remaining: null,
      period: "service",
      notes: ["Applies after deductible"],
    },
    {
      id: "oop",
      category: "Out-of-pocket maximum",
      serviceType: input.serviceType,
      network: "in_network",
      coverageLevel: level,
      status: "active",
      amountType: "out_of_pocket",
      amount: level === "family" ? 12000 : 6000,
      percent: null,
      remaining: level === "family" ? 8460 : 3820,
      period: "calendar_year",
      notes: ["Synthetic demonstration value"],
    },
  ];
}

export class AvailityEligibilityAdapter implements EligibilityAdapter {
  constructor(private readonly availity: AvailityDemoAdapter = createAvailityDemoAdapterFromEnvironment()) {}

  async check(input: EligibilityCheckInput): Promise<NormalizedEligibilityResponse> {
    const upstream = await this.availity.runCoverageScenario(input.scenario);
    const profile = PROFILE_DETAILS[input.sampleProfile];
    const active = input.scenario === "complete";
    const pending = input.scenario === "inProgress" || input.scenario === "retrying";
    const status: NormalizedEligibilityResponse["status"] = active ? "active" : pending ? "pending" : "error";
    const scenarioMessage = active
      ? "Synthetic coverage is active for the selected service date."
      : pending
        ? "The demo payer has not completed the eligibility response."
        : "The demo payer returned an eligibility exception that requires review.";

    return {
      status,
      outcome: upstream.outcome,
      provider: "availity",
      environment: "demo",
      mockVerified: upstream.mockVerified,
      patient: {
        displayName: profile.displayName,
        memberIdMasked: profile.memberIdMasked,
        relationship: profile.relationship,
      },
      payer: {
        id: upstream.payerId || "AVAILITY-DEMO",
        name: profile.payerName,
      },
      plan: {
        name: profile.planName,
        groupNumberMasked: profile.groupNumberMasked,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
      },
      coverage: {
        serviceType: input.serviceType,
        network: "in_network",
        summary: scenarioMessage,
      },
      benefits: active ? benefitFixtures(input) : [],
      messages: [...new Set([scenarioMessage, ...upstream.messages])],
      checkedAt: new Date().toISOString(),
    };
  }
}
