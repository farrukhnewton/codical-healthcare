import type { RevenueClaimCreateInput, RevenueTransmissionInput } from "@shared/revenue-integrity";

export type ProfessionalClaimMappingIssue = {
  code: string;
  field: string;
  message: string;
};

export type StediProfessionalClaimPayload = Record<string, unknown>;

function compactDate(value: string) {
  return value.replaceAll("-", "");
}

function money(value: number) {
  return value.toFixed(2);
}

function normalizeDiagnosis(value: string) {
  return value.toUpperCase().replaceAll(".", "");
}

function containsX12Delimiter(value: string) {
  return /[~*:^>]/.test(value);
}

export function mapProfessionalClaimToStedi(
  claim: RevenueClaimCreateInput,
  transmission: RevenueTransmissionInput,
): { payload: StediProfessionalClaimPayload | null; issues: ProfessionalClaimMappingIssue[] } {
  const issues: ProfessionalClaimMappingIssue[] = [];
  const patientControlNumber = claim.patientControlNumber.trim();

  if (patientControlNumber.length > 17) {
    issues.push({
      code: "PCN_TOO_LONG",
      field: "patientControlNumber",
      message: "The patient control number must be 17 characters or fewer for reliable 277CA and 835 correlation.",
    });
  }
  if (!/^[A-Za-z0-9]+$/.test(patientControlNumber)) {
    issues.push({
      code: "PCN_NOT_X12_SAFE",
      field: "patientControlNumber",
      message: "The patient control number must contain only letters and numbers.",
    });
  }
  if (transmission.billing.npi !== claim.billingProviderNpi) {
    issues.push({
      code: "BILLING_NPI_MISMATCH",
      field: "billing.npi",
      message: "The transmission billing NPI does not match the validated claim billing NPI.",
    });
  }
  if (claim.renderingProviderNpi && transmission.rendering?.npi !== claim.renderingProviderNpi) {
    issues.push({
      code: "RENDERING_NPI_MISMATCH",
      field: "rendering.npi",
      message: "The transmission rendering NPI does not match the validated claim rendering NPI.",
    });
  }

  const placeOfServiceCodes = new Set(claim.lines.map((line) => line.placeOfService).filter(Boolean));
  if (placeOfServiceCodes.size !== 1) {
    issues.push({
      code: "CLAIM_PLACE_OF_SERVICE_REQUIRED",
      field: "lines[].placeOfService",
      message: "A professional claim transmission requires one consistent claim-level place of service.",
    });
  }

  const textValues = [
    transmission.tradingPartnerName,
    transmission.submitter.organizationName,
    transmission.receiver.organizationName,
    transmission.subscriber.firstName,
    transmission.subscriber.lastName,
    transmission.billing.organizationName,
  ];
  if (textValues.some(containsX12Delimiter)) {
    issues.push({
      code: "X12_RESERVED_DELIMITER",
      field: "transmission",
      message: "Transmission text contains a character reserved as an X12 delimiter.",
    });
  }

  if (issues.length) return { payload: null, issues };

  const renderingProvider = transmission.rendering
    ? {
        providerType: "RenderingProvider",
        npi: transmission.rendering.npi,
        taxonomyCode: transmission.rendering.taxonomyCode.toUpperCase(),
        firstName: transmission.rendering.firstName,
        lastName: transmission.rendering.lastName,
      }
    : undefined;

  const claimInformation: Record<string, unknown> = {
    claimFilingCode: transmission.claimFilingCode,
    patientControlNumber,
    claimChargeAmount: money(claim.totalCharge),
    placeOfServiceCode: [...placeOfServiceCodes][0],
    claimFrequencyCode: transmission.claimFrequencyCode,
    signatureIndicator: transmission.signatureIndicator,
    planParticipationCode: transmission.planParticipationCode,
    benefitsAssignmentCertificationIndicator: transmission.benefitsAssignmentCertificationIndicator,
    releaseInformationCode: transmission.releaseInformationCode,
    healthCareCodeInformation: claim.diagnosisCodes.map((diagnosisCode, index) => ({
      diagnosisTypeCode: index === 0 ? "ABK" : "ABF",
      diagnosisCode: normalizeDiagnosis(diagnosisCode),
    })),
    serviceLines: claim.lines.map((line) => ({
      serviceDate: compactDate(claim.serviceFrom),
      professionalService: {
        procedureIdentifier: "HC",
        procedureCode: line.procedureCode.toUpperCase(),
        ...(line.modifiers.length ? { procedureModifiers: line.modifiers.map((modifier) => modifier.toUpperCase()) } : {}),
        lineItemChargeAmount: money(line.chargeAmount),
        measurementUnit: "UN",
        serviceUnitCount: String(line.units),
        compositeDiagnosisCodePointers: {
          diagnosisCodePointers: line.diagnosisPointers.map(String),
        },
      },
      providerControlNumber: `${patientControlNumber}-${line.lineNumber}`,
      ...(renderingProvider ? { renderingProvider } : {}),
    })),
    ...(transmission.serviceFacilityLocation ? { serviceFacilityLocation: transmission.serviceFacilityLocation } : {}),
  };

  const payload: StediProfessionalClaimPayload = {
    tradingPartnerServiceId: transmission.tradingPartnerServiceId,
    tradingPartnerName: transmission.tradingPartnerName,
    submitter: transmission.submitter,
    receiver: transmission.receiver,
    subscriber: {
      ...transmission.subscriber,
      dateOfBirth: compactDate(transmission.subscriber.dateOfBirth),
    },
    billing: {
      ...transmission.billing,
      providerType: "BillingProvider",
      taxonomyCode: transmission.billing.taxonomyCode.toUpperCase(),
    },
    claimInformation,
    ...(transmission.dependent ? {
      dependent: {
        ...transmission.dependent,
        dateOfBirth: compactDate(transmission.dependent.dateOfBirth),
      },
    } : {}),
  };

  return { payload, issues: [] };
}
