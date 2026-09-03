import type { RevenueClaimCreateInput, RevenueTransmissionInput } from "@shared/revenue-integrity";
import type { ProfessionalClaimMappingIssue } from "./stedi-professional-claim";

export type ClaimMdProfessionalClaimPayload = {
  fileid: string;
  claim: Array<Record<string, unknown>>;
};

const DIAGNOSIS_REFERENCE = "ABCDEFGHIJKL";

function normalizeDiagnosis(value: string) {
  return value.trim().toUpperCase().replaceAll(".", "");
}

function money(value: number) {
  return value.toFixed(2);
}

function stableToken(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(-7);
}

export function claimMdRemoteClaimId(claim: RevenueClaimCreateInput) {
  const safePcn = claim.patientControlNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  return `C${safePcn.slice(0, 8)}${stableToken(`${claim.patientControlNumber}:${claim.serviceFrom}`)}`.slice(0, 16);
}

export function claimMdRemoteChargeId(remoteClaimId: string, lineNumber: number) {
  return `${remoteClaimId.slice(0, 9)}${lineNumber.toString(36).toUpperCase().padStart(3, "0")}`.slice(0, 12);
}

/** Maps Codical's verified canonical professional claim to Claim.MD's JSON upload format. */
export function mapProfessionalClaimToClaimMd(
  claim: RevenueClaimCreateInput,
  transmission: RevenueTransmissionInput,
): { payload: ClaimMdProfessionalClaimPayload | null; issues: ProfessionalClaimMappingIssue[]; remoteClaimId: string } {
  const issues: ProfessionalClaimMappingIssue[] = [];
  const remoteClaimId = claimMdRemoteClaimId(claim);

  if (claim.diagnosisCodes.length > DIAGNOSIS_REFERENCE.length) {
    issues.push({
      code: "CLAIMMD_DIAGNOSIS_LIMIT",
      field: "diagnosisCodes",
      message: "Claim.MD professional JSON supports at most 12 diagnosis references on this mapper.",
    });
  }
  if (transmission.billing.npi !== claim.billingProviderNpi) {
    issues.push({
      code: "BILLING_NPI_MISMATCH",
      field: "billing.npi",
      message: "The verified billing NPI does not match the claim billing NPI.",
    });
  }
  if (claim.renderingProviderNpi && transmission.rendering?.npi !== claim.renderingProviderNpi) {
    issues.push({
      code: "RENDERING_NPI_MISMATCH",
      field: "rendering.npi",
      message: "The verified rendering NPI does not match the claim rendering NPI.",
    });
  }
  for (const line of claim.lines) {
    if (!line.placeOfService) {
      issues.push({
        code: "CLAIMMD_PLACE_OF_SERVICE_REQUIRED",
        field: `lines[${line.lineNumber}].placeOfService`,
        message: `Claim.MD requires place of service on service line ${line.lineNumber}.`,
      });
    }
    if (line.diagnosisPointers.some((pointer) => pointer > DIAGNOSIS_REFERENCE.length)) {
      issues.push({
        code: "CLAIMMD_DIAGNOSIS_POINTER_LIMIT",
        field: `lines[${line.lineNumber}].diagnosisPointers`,
        message: `Service line ${line.lineNumber} contains a diagnosis pointer Claim.MD cannot encode.`,
      });
    }
  }
  if (issues.length) return { payload: null, issues, remoteClaimId };

  const patient = transmission.dependent || transmission.subscriber;
  const patientAddress = transmission.dependent?.address || transmission.subscriber.address;
  const rendering = transmission.rendering;
  const claimRecord: Record<string, unknown> = {
    claim_form: "1500",
    pcn: claim.patientControlNumber,
    remote_claimid: remoteClaimId,
    payerid: claim.payerId,
    payer_name: claim.payerName,
    accept_assign: transmission.benefitsAssignmentCertificationIndicator === "N" ? "N" : "Y",
    employment_related: "N",
    auto_accident: "N",
    total_charge: money(claim.totalCharge),
    balance_due: money(claim.totalCharge),
    bill_name: transmission.billing.organizationName,
    bill_npi: transmission.billing.npi,
    bill_taxid: transmission.billing.employerId,
    bill_taxid_type: "E",
    bill_phone: transmission.billing.contactInformation.phoneNumber,
    bill_addr_1: transmission.billing.address.address1,
    ...(transmission.billing.address.address2 ? { bill_addr_2: transmission.billing.address.address2 } : {}),
    bill_city: transmission.billing.address.city,
    bill_state: transmission.billing.address.state,
    bill_zip: transmission.billing.address.postalCode,
    prov_name_f: rendering?.firstName || transmission.billing.organizationName,
    prov_name_l: rendering?.lastName || transmission.billing.organizationName,
    prov_npi: rendering?.npi || transmission.billing.npi,
    prov_taxonomy: rendering?.taxonomyCode || transmission.billing.taxonomyCode,
    ins_name_f: transmission.subscriber.firstName,
    ins_name_l: transmission.subscriber.lastName,
    ins_number: transmission.subscriber.policyNumber || transmission.subscriber.memberId,
    ...(transmission.subscriber.groupNumber ? { ins_group: transmission.subscriber.groupNumber } : {}),
    ins_dob: transmission.subscriber.dateOfBirth,
    ins_sex: transmission.subscriber.gender,
    ins_addr_1: transmission.subscriber.address.address1,
    ...(transmission.subscriber.address.address2 ? { ins_addr_2: transmission.subscriber.address.address2 } : {}),
    ins_city: transmission.subscriber.address.city,
    ins_state: transmission.subscriber.address.state,
    ins_zip: transmission.subscriber.address.postalCode,
    pat_name_f: patient.firstName,
    pat_name_l: patient.lastName,
    pat_rel: transmission.dependent?.relationshipToSubscriberCode || "18",
    pat_dob: patient.dateOfBirth,
    pat_sex: patient.gender,
    pat_addr_1: patientAddress.address1,
    ...(patientAddress.address2 ? { pat_addr_2: patientAddress.address2 } : {}),
    pat_city: patientAddress.city,
    pat_state: patientAddress.state,
    pat_zip: patientAddress.postalCode,
    charge: claim.lines.map((line) => ({
      charge: money(line.chargeAmount),
      charge_record_type: "UN",
      from_date: claim.serviceFrom,
      thru_date: claim.serviceTo || claim.serviceFrom,
      place_of_service: line.placeOfService,
      proc_code: line.procedureCode.toUpperCase(),
      units: String(line.units),
      diag_ref: line.diagnosisPointers.map((pointer) => DIAGNOSIS_REFERENCE[pointer - 1]).join(""),
      remote_chgid: claimMdRemoteChargeId(remoteClaimId, line.lineNumber),
      ...Object.fromEntries(line.modifiers.slice(0, 4).map((modifier, index) => [`mod${index + 1}`, modifier.toUpperCase()])),
    })),
  };

  claim.diagnosisCodes.forEach((diagnosis, index) => {
    claimRecord[`diag_${index + 1}`] = normalizeDiagnosis(diagnosis);
  });

  return {
    payload: { fileid: remoteClaimId, claim: [claimRecord] },
    issues: [],
    remoteClaimId,
  };
}
