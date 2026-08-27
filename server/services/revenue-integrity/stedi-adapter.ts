import {
  ClearinghouseConfigurationError,
  type ClaimSubmissionRequest,
  type ClaimSubmissionResponse,
  type ClearinghouseAdapter,
  type ClearinghouseCapabilities,
  type ClearinghouseMode,
} from "./clearinghouse";

const STEDI_PROFESSIONAL_CLAIMS_PATH = "/2024-04-01/change/medicalnetwork/professionalclaims/v3/submission";
const STEDI_REPORTS_PATH = "/2024-04-01/change/medicalnetwork/reports/v2";

export type StediAdapterOptions = {
  apiKey?: string;
  baseUrl?: string;
  mode?: ClearinghouseMode;
  liveSubmissionEnabled?: boolean;
  testSubmissionEnabled?: boolean;
  fetchImpl?: typeof fetch;
};

export class StediClearinghouseAdapter implements ClearinghouseAdapter {
  readonly provider = "stedi";
  readonly mode: ClearinghouseMode;
  readonly capabilities: ClearinghouseCapabilities = {
    professionalClaims: true,
    institutionalClaims: true,
    claimAcknowledgments: true,
    remittances: true,
    realTimeClaimStatus: true,
    claimAttachments: true,
    transactionEnrollment: true,
  };

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly liveSubmissionEnabled: boolean;
  private readonly testSubmissionEnabled: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(options: StediAdapterOptions = {}) {
    this.apiKey = options.apiKey?.trim() || undefined;
    this.baseUrl = (options.baseUrl || "https://healthcare.us.stedi.com").replace(/\/$/, "");
    this.mode = options.mode || "test";
    this.liveSubmissionEnabled = Boolean(options.liveSubmissionEnabled);
    this.testSubmissionEnabled = Boolean(options.testSubmissionEnabled);
    this.fetchImpl = options.fetchImpl || fetch;
  }

  readiness() {
    const blockers: string[] = [];
    if (!this.apiKey) blockers.push("STEDI_API_KEY is not configured.");
    if (this.mode === "test" && !this.testSubmissionEnabled) {
      blockers.push("REVENUE_INTEGRITY_TEST_SUBMISSION_ENABLED is not true.");
    }
    if (this.mode === "production" && !this.liveSubmissionEnabled) {
      blockers.push("REVENUE_INTEGRITY_LIVE_SUBMISSION_ENABLED is not true.");
    }

    return {
      configured: Boolean(this.apiKey),
      testSubmissionEnabled: this.mode === "test" && this.testSubmissionEnabled,
      liveSubmissionEnabled: this.mode === "production" && this.liveSubmissionEnabled,
      blockers,
    };
  }

  async submitProfessionalClaim(request: ClaimSubmissionRequest): Promise<ClaimSubmissionResponse> {
    const readiness = this.readiness();
    if (!readiness.configured) {
      throw new ClearinghouseConfigurationError(readiness.blockers.join(" "));
    }
    if (this.mode === "test" && !readiness.testSubmissionEnabled) {
      throw new ClearinghouseConfigurationError(readiness.blockers.join(" "));
    }
    if (this.mode === "production" && !readiness.liveSubmissionEnabled) {
      throw new ClearinghouseConfigurationError(readiness.blockers.join(" "));
    }

    const payload = {
      ...request.payload,
      usageIndicator: this.mode === "production" ? "P" : "T",
    };
    const response = await this.fetchImpl(`${this.baseUrl}${STEDI_PROFESSIONAL_CLAIMS_PATH}`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey!,
        "Content-Type": "application/json",
        "Idempotency-Key": request.idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof raw.message === "string" ? raw.message : `Stedi returned HTTP ${response.status}.`;
      const error = new Error(message) as Error & { status?: number; response?: Record<string, unknown> };
      error.status = response.status;
      error.response = raw;
      throw error;
    }

    const transactionId = typeof raw.transactionId === "string"
      ? raw.transactionId
      : typeof raw.id === "string"
        ? raw.id
        : null;
    const claimReference = raw.claimReference && typeof raw.claimReference === "object"
      ? raw.claimReference as Record<string, unknown>
      : {};
    const correlationId = typeof claimReference.correlationId === "string" ? claimReference.correlationId : null;

    return {
      provider: this.provider,
      transactionId: transactionId || correlationId,
      correlationId,
      status: "accepted_for_processing",
      raw,
    };
  }

  private async retrieveReport(transactionId: string, reportType: "277" | "835") {
    const readiness = this.readiness();
    if (!readiness.configured) throw new ClearinghouseConfigurationError(readiness.blockers.join(" "));
    if (!/^[A-Za-z0-9-]{8,80}$/.test(transactionId)) throw new Error("Invalid Stedi transaction identifier.");
    const response = await this.fetchImpl(`${this.baseUrl}${STEDI_REPORTS_PATH}/${transactionId}/${reportType}`, {
      headers: { Authorization: this.apiKey!, Accept: "application/json" },
    });
    const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof raw.message === "string" ? raw.message : `Stedi returned HTTP ${response.status}.`;
      const error = new Error(message) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return raw;
  }

  retrieveClaimAcknowledgment(transactionId: string) {
    return this.retrieveReport(transactionId, "277");
  }

  retrieveRemittance(transactionId: string) {
    return this.retrieveReport(transactionId, "835");
  }
}

export function createStediAdapterFromEnvironment() {
  const mode = process.env.STEDI_MODE === "production" ? "production" : "test";
  return new StediClearinghouseAdapter({
    apiKey: process.env.STEDI_API_KEY,
    baseUrl: process.env.STEDI_API_BASE_URL,
    mode,
    liveSubmissionEnabled: process.env.REVENUE_INTEGRITY_LIVE_SUBMISSION_ENABLED === "true",
    testSubmissionEnabled: process.env.REVENUE_INTEGRITY_TEST_SUBMISSION_ENABLED === "true",
  });
}
