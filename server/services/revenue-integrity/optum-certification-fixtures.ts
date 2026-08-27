import {
  revenueClaimCreateSchema,
  revenueTransmissionSchema,
  type RevenueClaimCreateInput,
  type RevenueTransmissionInput,
} from "@shared/revenue-integrity";

export type OptumCertificationScenario = "success" | "edits";

export type OptumCertificationFixture = {
  scenario: OptumCertificationScenario;
  certificationKey: string;
  controlNumber: string;
  claim: RevenueClaimCreateInput;
  transmission: RevenueTransmissionInput;
};

/**
 * Synthetic values are based on Optum's published Professional Claims v3
 * sandbox examples. `test00005` is Optum's documented canned edit trigger.
 */
export function createOptumCertificationFixture(scenario: OptumCertificationScenario): OptumCertificationFixture {
  const isEditCase = scenario === "edits";
  const patientControlNumber = isEditCase ? "test00005" : "12345";
  const controlNumber = "000000001";

  const claim = revenueClaimCreateSchema.parse({
    patientControlNumber,
    payerId: "9496",
    payerName: "Extra Healthy Insurance (Optum Sandbox)",
    serviceFrom: "2005-05-14",
    billingProviderNpi: "1760854442",
    renderingProviderNpi: "1942788757",
    diagnosisCodes: ["496", "25000"],
    totalCharge: 28.75,
    expectedAmount: 28.75,
    lines: [
      { lineNumber: 1, procedureCode: "E0570", diagnosisPointers: [1, 2], units: 1, chargeAmount: 25, placeOfService: "11" },
      { lineNumber: 2, procedureCode: "A7003", diagnosisPointers: [1], units: 1, chargeAmount: 3.75, placeOfService: "11" },
    ],
    metadata: {
      dataClassification: "synthetic",
      certificationKey: `optum-837p-${scenario}-v1`,
      certificationScenario: scenario,
      syntheticPatientName: "Jane Doeone",
      source: "optum-published-sandbox-example",
    },
  });

  const transmission = revenueTransmissionSchema.parse({
    tradingPartnerServiceId: "9496",
    tradingPartnerName: "EXTRA HEALTHY INSURANCE",
    submitter: {
      organizationName: "REGIONAL PPO NETWORK",
      submitterIdentification: "009998999898",
      contactInformation: { name: "SUBMITTER CONTACT INFO", phoneNumber: "123456789" },
    },
    receiver: { organizationName: "EXTRA HEALTHY INSURANCE" },
    subscriber: {
      memberId: "0000000001",
      paymentResponsibilityLevelCode: "P",
      firstName: "johnone",
      lastName: "doeOne",
      gender: "M",
      dateOfBirth: "1980-01-02",
      policyNumber: "00001",
      address: { address1: "123 address1", city: "city1", state: "WA", postalCode: "981010000" },
    },
    dependent: {
      memberId: "0000000002",
      paymentResponsibilityLevelCode: "P",
      firstName: "janeone",
      lastName: "doeOne",
      gender: "F",
      dateOfBirth: "1980-01-02",
      relationshipToSubscriberCode: "01",
      policyNumber: "00002",
      address: { address1: "123 address1", city: "city1", state: "WA", postalCode: "981010000" },
    },
    billing: {
      organizationName: "HAPPY DOCTORS GROUPPRACTICE",
      npi: "1760854442",
      employerId: "123456789",
      taxonomyCode: "207Q00000X",
      address: { address1: "000 address1", city: "city2", state: "TN", postalCode: "372030000" },
      contactInformation: { name: "janetwo doetwo", phoneNumber: "0000000001" },
    },
    rendering: {
      firstName: "janetwo",
      lastName: "doetwo",
      npi: "1942788757",
      taxonomyCode: "207Q00000X",
    },
    serviceFacilityLocation: {
      organizationName: "HAPPY DOCTORS GROUP",
      address: { address1: "000 address1", city: "city2", state: "TN", postalCode: "372030000" },
    },
    claimFilingCode: "CI",
    claimFrequencyCode: "1",
    signatureIndicator: "Y",
    planParticipationCode: "A",
    benefitsAssignmentCertificationIndicator: "Y",
    releaseInformationCode: "Y",
  });

  return {
    scenario,
    certificationKey: String(claim.metadata.certificationKey),
    controlNumber,
    claim,
    transmission,
  };
}
