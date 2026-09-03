import { revenueClaimCreateSchema, revenueTransmissionSchema } from "@shared/revenue-integrity";

export type ClaimMdCertificationScenario = "accepted" | "rejected" | "denied";

export function createClaimMdCertificationFixture(scenario: ClaimMdCertificationScenario) {
  const trigger = scenario === "rejected" ? "REJECT" : scenario === "denied" ? "DENY" : "TESTMEMBER01";
  const claim = revenueClaimCreateSchema.parse({
    patientControlNumber: `CMD${scenario.toUpperCase()}01`,
    payerId: "22099",
    payerName: "NJ BCBS (Claim.MD test)",
    serviceFrom: "2026-08-31",
    billingProviderNpi: "1111111112",
    renderingProviderNpi: "1111111112",
    diagnosisCodes: ["I10"],
    totalCharge: 100,
    expectedAmount: 80,
    lines: [{ lineNumber: 1, procedureCode: "99214", diagnosisPointers: [1], units: 1, chargeAmount: 100, expectedAmount: 80, placeOfService: "11" }],
    metadata: {
      dataClassification: "synthetic",
      certificationKey: `claimmd-837p-${scenario}-v1`,
      certificationScenario: scenario,
      source: "claimmd-test-account-trigger",
    },
  });
  const transmission = revenueTransmissionSchema.parse({
    tradingPartnerServiceId: "22099",
    tradingPartnerName: "NJ BCBS",
    submitter: {
      organizationName: "CODICAL SYNTHETIC TEST",
      submitterIdentification: "CODICALTEST",
      contactInformation: { name: "TEST OPERATIONS", phoneNumber: "5552223333" },
    },
    receiver: { organizationName: "CLAIM MD TEST" },
    subscriber: {
      memberId: trigger,
      policyNumber: trigger,
      firstName: "SYNTHETIC",
      lastName: "PATIENT",
      dateOfBirth: "1990-01-01",
      gender: "F",
      address: { address1: "1 TEST AVENUE", city: "TEST CITY", state: "NJ", postalCode: "070010001" },
    },
    billing: {
      organizationName: "CODICAL TEST CLINIC",
      npi: "1111111112",
      employerId: "741111111",
      taxonomyCode: "208D00000X",
      address: { address1: "2 TEST AVENUE", city: "TEST CITY", state: "NJ", postalCode: "070010001" },
      contactInformation: { name: "TEST BILLING", phoneNumber: "5553334444" },
    },
    rendering: { firstName: "TEST", lastName: "PROVIDER", npi: "1111111112", taxonomyCode: "208D00000X" },
  });
  return { scenario, certificationKey: String(claim.metadata.certificationKey), claim, transmission };
}
