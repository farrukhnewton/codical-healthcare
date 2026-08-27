import type { RevenueClaimCreateInput, RevenueTransmissionInput } from "@shared/revenue-integrity";
import type { ProfessionalClaimMappingIssue } from "./stedi-professional-claim";

export type OptumProfessionalClaimPayload = Record<string, unknown>;

function compactDate(value: string) {
  return value.replaceAll("-", "");
}

function money(value: number) {
  return value.toFixed(2);
}

function normalizeDiagnosis(value: string) {
  return value.toUpperCase().replaceAll(".", "");
}

function optumAddress(address: RevenueTransmissionInput["subscriber"]["address"]) {
  return { ...address, state: address.state.toLowerCase() };
}

/**
 * Maps Codical's verified canonical professional claim to Optum's current
 * Professional Claims v3 JSON contract. This is intentionally separate from
 * the Stedi mapper because Optum requires a nine-digit transaction control
 * number and exposes billing/rendering providers as top-level objects.
 */
export function mapProfessionalClaimToOptum(
  claim: RevenueClaimCreateInput,
  transmission: RevenueTransmissionInput,
  controlNumber: string,
): { payload: OptumProfessionalClaimPayload | null; issues: ProfessionalClaimMappingIssue[] } {
  const issues: ProfessionalClaimMappingIssue[] = [];
  const patientControlNumber = claim.patientControlNumber.trim();

  if (!/^\d{9}$/.test(controlNumber)) {
    issues.push({
      code: "OPTUM_CONTROL_NUMBER_INVALID",
      field: "controlNumber",
      message: "Optum requires a nine-digit unsigned transaction control number.",
    });
  }
  if (patientControlNumber.length > 17 || !/^[A-Za-z0-9]+$/.test(patientControlNumber)) {
    issues.push({
      code: "PCN_NOT_X12_SAFE",
      field: "patientControlNumber",
      message: "The patient control number must contain 17 or fewer letters and numbers.",
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
      message: "An Optum professional claim requires one consistent claim-level place of service.",
    });
  }
  if (issues.length) return { payload: null, issues };

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
    claimSupplementalInformation: {
      repricedClaimNumber: "00001",
      claimNumber: "12345",
    },
    healthCareCodeInformation: claim.diagnosisCodes.map((diagnosisCode, index) => ({
      diagnosisTypeCode: index === 0
        ? (claim.serviceFrom < "2015-10-01" ? "BK" : "ABK")
        : (claim.serviceFrom < "2015-10-01" ? "BF" : "ABF"),
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
    })),
    ...(transmission.serviceFacilityLocation ? {
      serviceFacilityLocation: {
        ...transmission.serviceFacilityLocation,
        address: optumAddress(transmission.serviceFacilityLocation.address),
      },
    } : {}),
  };

  return {
    payload: {
      controlNumber,
      tradingPartnerServiceId: transmission.tradingPartnerServiceId,
      tradingPartnerName: transmission.tradingPartnerName,
      usageIndicator: "T",
      submitter: {
        organizationName: transmission.submitter.organizationName,
        contactInformation: transmission.submitter.contactInformation,
      },
      receiver: { organizationName: transmission.receiver.organizationName },
      subscriber: {
        ...transmission.subscriber,
        dateOfBirth: compactDate(transmission.subscriber.dateOfBirth),
        // Optum validates DMG03 case-sensitively and only accepts M, F, or U.
        gender: transmission.subscriber.gender.toUpperCase(),
        address: optumAddress(transmission.subscriber.address),
      },
      billing: {
        providerType: "BillingProvider",
        organizationName: transmission.billing.organizationName,
        npi: transmission.billing.npi,
        employerId: transmission.billing.employerId,
        taxonomyCode: transmission.billing.taxonomyCode.toUpperCase(),
        address: optumAddress(transmission.billing.address),
        contactInformation: transmission.billing.contactInformation,
      },
      ...(transmission.rendering ? {
        rendering: {
          providerType: "RenderingProvider",
          firstName: transmission.rendering.firstName,
          lastName: transmission.rendering.lastName,
          npi: transmission.rendering.npi,
          taxonomyCode: transmission.rendering.taxonomyCode.toUpperCase(),
        },
      } : {}),
      ...(transmission.dependent ? {
        dependent: {
          ...transmission.dependent,
          dateOfBirth: compactDate(transmission.dependent.dateOfBirth),
          gender: transmission.dependent.gender.toUpperCase(),
          ...(transmission.dependent.address ? { address: optumAddress(transmission.dependent.address) } : {}),
        },
      } : {}),
      claimInformation,
    },
    issues: [],
  };
}
