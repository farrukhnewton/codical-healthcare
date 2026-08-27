export type ClearinghouseMode = "test" | "production";

export type ClearinghouseCapabilities = {
  professionalClaims: boolean;
  institutionalClaims: boolean;
  claimAcknowledgments: boolean;
  remittances: boolean;
  realTimeClaimStatus: boolean;
  claimAttachments: boolean;
  transactionEnrollment: boolean;
};

export type ClaimSubmissionRequest = {
  payload: Record<string, unknown>;
  idempotencyKey: string;
};

export type ClaimSubmissionResponse = {
  provider: string;
  transactionId: string | null;
  correlationId: string | null;
  status: "accepted_for_processing" | "rejected";
  raw: Record<string, unknown>;
};

export interface ClearinghouseAdapter {
  readonly provider: string;
  readonly mode: ClearinghouseMode;
  readonly capabilities: ClearinghouseCapabilities;
  readiness(): {
    configured: boolean;
    testSubmissionEnabled: boolean;
    liveSubmissionEnabled: boolean;
    blockers: string[];
  };
  submitProfessionalClaim(request: ClaimSubmissionRequest): Promise<ClaimSubmissionResponse>;
  retrieveClaimAcknowledgment(transactionId: string): Promise<Record<string, unknown>>;
  retrieveRemittance(transactionId: string): Promise<Record<string, unknown>>;
}

export class ClearinghouseConfigurationError extends Error {
  readonly code = "CLEARINGHOUSE_NOT_READY";

  constructor(message: string) {
    super(message);
    this.name = "ClearinghouseConfigurationError";
  }
}
