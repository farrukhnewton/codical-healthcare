import { ClearinghouseConfigurationError, type ClaimSubmissionResponse, type ClearinghouseMode } from "./clearinghouse";
import { normalizeClaimMdEraList, normalizeClaimMdRemittances, normalizeClaimMdResponses } from "./claimmd-responses";

type FetchLike = typeof fetch;

export type ClaimMdSubmissionRequest = {
  payload: Record<string, unknown>;
  idempotencyKey: string;
  dataClassification?: "synthetic" | "production";
};

type ClaimMdAdapterOptions = {
  accountKey?: string;
  mode?: ClearinghouseMode;
  baseUrl?: string;
  testSubmissionEnabled?: boolean;
  liveSubmissionEnabled?: boolean;
  fetchImpl?: FetchLike;
};

function errorMessage(payload: Record<string, unknown>, fallback: string) {
  const result = payload.result;
  const candidate = Array.isArray(result) ? result[0] : result;
  if (candidate && typeof candidate === "object") {
    const value = candidate as Record<string, unknown>;
    return String(value.message || value.error || fallback);
  }
  return String(payload.message || payload.error || fallback);
}

function isFailure(payload: Record<string, unknown>) {
  const result = payload.result;
  const candidate = Array.isArray(result) ? result[0] : result;
  const value = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : payload;
  return String(value.success || "1") === "0" || Boolean(value.error || value.errorcode || value.error_code);
}

export class ClaimMdClearinghouseAdapter {
  readonly provider = "claimmd";
  readonly mode: ClearinghouseMode;
  readonly capabilities = {
    professionalClaims: true,
    institutionalClaims: true,
    claimAcknowledgments: true,
    remittances: true,
    realTimeClaimStatus: false,
    claimAttachments: true,
    transactionEnrollment: true,
  };
  private readonly accountKey: string;
  private readonly baseUrl: string;
  private readonly testSubmissionEnabled: boolean;
  private readonly requestedLiveSubmission: boolean;
  private readonly fetchImpl: FetchLike;

  constructor(options: ClaimMdAdapterOptions = {}) {
    this.accountKey = String(options.accountKey || "").trim();
    this.mode = options.mode === "production" ? "production" : "test";
    this.baseUrl = String(options.baseUrl || "https://svc.claim.md").replace(/\/$/, "");
    this.testSubmissionEnabled = Boolean(options.testSubmissionEnabled);
    this.requestedLiveSubmission = Boolean(options.liveSubmissionEnabled);
    this.fetchImpl = options.fetchImpl || fetch;
  }

  readiness() {
    const blockers: string[] = [];
    if (!this.accountKey) blockers.push("CLAIMMD_ACCOUNT_KEY is not configured.");
    if (this.mode !== "test") blockers.push("Claim.MD is intentionally restricted to a test account in this release.");
    if (!this.testSubmissionEnabled) blockers.push("CLAIMMD_TEST_SUBMISSION_ENABLED must be true for synthetic certification claims.");
    if (this.requestedLiveSubmission) blockers.push("CLAIMMD_LIVE_SUBMISSION_ENABLED must remain false until production onboarding and certification are approved.");
    return {
      configured: Boolean(this.accountKey),
      testSubmissionEnabled: Boolean(this.accountKey && this.mode === "test" && this.testSubmissionEnabled && !this.requestedLiveSubmission),
      liveSubmissionEnabled: false,
      blockers,
    };
  }

  private assertConfigured() {
    if (!this.accountKey) throw new ClearinghouseConfigurationError("Claim.MD test credentials are not configured.");
    if (this.mode !== "test" || this.requestedLiveSubmission) {
      throw new ClearinghouseConfigurationError("Claim.MD production submission is hard-locked in this release.");
    }
  }

  private async formRequest(path: string, values: Record<string, string>) {
    this.assertConfigured();
    const body = new URLSearchParams({ AccountKey: this.accountKey, ...values });
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || isFailure(payload)) throw new Error(errorMessage(payload, `Claim.MD returned ${response.status}.`));
    return payload;
  }

  async healthCheck() {
    const payload = await this.formRequest("/services/payerlist/", {});
    const result = payload.result;
    const directPayers = Array.isArray(result)
      && result.every((entry) => entry && typeof entry === "object" && !("payer" in entry) && !("payers" in entry));
    if (directPayers) return { status: "OK", payerCount: result.length };
    const root = Array.isArray(result) ? result[0] : result;
    const record = root && typeof root === "object" ? root as Record<string, unknown> : payload;
    const payer = record.payer ?? record.payers;
    const payerCount = Array.isArray(payer) ? payer.length : payer ? 1 : 0;
    return { status: "OK", payerCount };
  }

  async submitProfessionalClaim(request: ClaimMdSubmissionRequest): Promise<ClaimSubmissionResponse> {
    this.assertConfigured();
    if (!this.testSubmissionEnabled) throw new ClearinghouseConfigurationError("Claim.MD synthetic certification submission is disabled.");
    if (request.dataClassification !== "synthetic") {
      throw new ClearinghouseConfigurationError("Claim.MD test submission accepts explicitly synthetic data only.");
    }
    const filename = `codical-${request.idempotencyKey.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64)}.json`;
    const body = new FormData();
    body.set("AccountKey", this.accountKey);
    body.set("File", new Blob([JSON.stringify(request.payload)], { type: "application/json" }), filename);
    body.set("Filename", filename);
    const response = await this.fetchImpl(`${this.baseUrl}/services/upload/`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || isFailure(raw)) throw new Error(errorMessage(raw, `Claim.MD upload returned ${response.status}.`));
    const normalized = normalizeClaimMdResponses(raw);
    const first = normalized.claims[0];
    return {
      provider: this.provider,
      transactionId: first?.claimMdId || null,
      correlationId: first?.remoteClaimId || null,
      status: first && !first.accepted ? "rejected" : "accepted_for_processing",
      raw,
    };
  }

  async retrieveClaimAcknowledgment(responseId = "0") {
    if (!/^\d+$/.test(responseId)) throw new Error("Claim.MD ResponseID must contain digits only.");
    return normalizeClaimMdResponses(await this.formRequest("/services/response/", { ResponseID: responseId }));
  }

  async listRemittances(eraId = "0") {
    if (!/^\d+$/.test(eraId)) throw new Error("Claim.MD ERAID must contain digits only.");
    return normalizeClaimMdEraList(await this.formRequest("/services/eralist/", { ERAID: eraId, NewOnly: "0", Page: "1" }));
  }

  async retrieveRemittance(eraId: string) {
    if (!/^\d+$/.test(eraId)) throw new Error("Claim.MD ERAID must contain digits only.");
    return { provider: this.provider, eraId, remittances: normalizeClaimMdRemittances(await this.formRequest("/services/eradata/", { eraid: eraId })) };
  }
}

export function createClaimMdAdapterFromEnvironment() {
  return new ClaimMdClearinghouseAdapter({
    accountKey: process.env.CLAIMMD_ACCOUNT_KEY,
    mode: process.env.CLAIMMD_MODE === "production" ? "production" : "test",
    baseUrl: process.env.CLAIMMD_API_BASE_URL,
    testSubmissionEnabled: process.env.CLAIMMD_TEST_SUBMISSION_ENABLED === "true",
    liveSubmissionEnabled: process.env.CLAIMMD_LIVE_SUBMISSION_ENABLED === "true",
  });
}
