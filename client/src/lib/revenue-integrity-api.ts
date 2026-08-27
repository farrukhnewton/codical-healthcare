import type { RevenueTransmissionInput } from "@shared/revenue-integrity";

export async function revenueIntegrityRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { supabase } = await import("./supabase");
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Your session expired. Sign in again to continue.");

  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || `Revenue Integrity request failed (${response.status}).`);
  return payload as T;
}

export type RevenueIntegrityOverview = {
  generatedAt: string;
  organization: { id: string; name: string; slug: string };
  metrics: {
    openClaims: number;
    readyToSubmit: number;
    rejectedClaims: number;
    deniedClaims: number;
    openWorkItems: number;
    revenueAtRisk: number;
    underpaymentOpportunity: number;
  };
  statusCounts: Array<{ status: string; count: number }>;
  integration: {
    provider: string;
    mode: string;
    status: string;
    liveSubmissionEnabled: boolean;
    testSubmissionEnabled: boolean;
    credentialsConfigured: boolean;
    blockers: string[];
    capabilities: Record<string, boolean>;
    operations: {
      queuedWebhooks: number;
      failedWebhooks: number;
      testSubmissions: number;
      productionSubmissions: number;
    };
  };
  validationPartners?: Array<{
    provider: string;
    environment: string;
    credentialsConfigured: boolean;
    validationEnabled: boolean;
    submissionEnabled: boolean;
    blockers: string[];
    capabilities: Record<string, boolean>;
  }>;
};

export type RevenueIntegrityClaim = {
  id: string;
  patientControlNumber: string;
  patientName?: string | null;
  status: string;
  payerId: string;
  payerName: string;
  serviceFrom: string;
  totalCharge: string | number;
  expectedAmount?: string | number | null;
  paidAmount: string | number;
  integrityScore: number;
  riskLevel: string;
  openWorkItems: number;
  updatedAt: string;
};

export type RevenueIntegrityWorkItem = {
  id: number;
  claimId: string;
  patientControlNumber: string;
  payerName: string;
  category: string;
  issueCode: string;
  title: string;
  description: string;
  recommendedAction: string;
  status: string;
  severity: string;
  priorityScore: number;
  recoverableAmount?: string | number | null;
  dueAt?: string | null;
  createdAt: string;
};

export type OptumValidationEdit = {
  field: string;
  value: string | null;
  description: string;
  location: string | null;
};

export type OptumCertificationResult = {
  claimId: string;
  patientControlNumber: string;
  scenario: "success" | "edits";
  reused: boolean;
  provider: "optum";
  environment: "sandbox";
  valid: boolean;
  claimStatus: string;
  integrityScore: number;
  status: string;
  editStatus: string | null;
  controlNumber: string | null;
  correlationId: string | null;
  edits: OptumValidationEdit[];
};

export type RevenueIntegrityClaimDetail = {
  claim: RevenueIntegrityClaim & {
    patientControlNumber: string;
    payerClaimControlNumber?: string | null;
    serviceTo?: string | null;
    diagnosisCodes: string[];
    billingProviderNpi: string;
    renderingProviderNpi?: string | null;
    expectedAmount?: string | number | null;
    version: number;
    clearinghouseProvider: string;
    dataClassification?: string | null;
  };
  lines: Array<{
    id: number;
    lineNumber: number;
    procedureCode: string;
    description?: string | null;
    modifiers: string[];
    diagnosisPointers: number[];
    placeOfService?: string | null;
    units: string | number;
    chargeAmount: string | number;
    expectedAmount?: string | number | null;
    paidAmount: string | number;
    status: string;
  }>;
  events: Array<{ id: number; eventType: string; source: string; summary: Record<string, unknown>; occurredAt: string }>;
  workItems: Array<{
    id: number;
    category: string;
    issueCode: string;
    title: string;
    description: string;
    recommendedAction: string;
    status: string;
    severity: string;
    priorityScore: number;
    resolutionNote?: string | null;
    startedAt?: string | null;
    resolvedAt?: string | null;
  }>;
  evidence: Array<{ id: number; evidenceType: string; sourceLabel?: string | null; ruleRef?: string | null; confidence?: string | number | null }>;
  submissions: Array<{ id: number; provider: string; mode: string; status: string; externalTransactionId?: string | null; correlationId?: string | null; lastError?: string | null; submittedAt?: string | null; createdAt: string }>;
  remittances: Array<{ id: number; provider: string; transactionId: string; payerClaimControlNumber?: string | null; claimStatusCode?: string | null; totalCharge: string | number; paidAmount: string | number; patientResponsibilityAmount: string | number; receivedAt: string }>;
  transmission: {
    schemaVersion: string;
    transmissionData: RevenueTransmissionInput;
    source: string;
    verifiedAt?: string | null;
    updatedAt: string;
  } | null;
};

export type RevenueClaimCorrectionResult = {
  claimId: string;
  version: number;
  status: string;
  integrity: { ready: boolean; score: number; issues: Array<{ code: string; message: string; recommendedAction: string }> };
  changedFields: string[];
  requiresRevalidation: boolean;
};
