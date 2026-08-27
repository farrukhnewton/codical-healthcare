import { ClearinghouseConfigurationError, type ClaimSubmissionRequest } from "./clearinghouse";

const OPTUM_PROFESSIONAL_CLAIMS_VALIDATION_PATH = "/professionalclaims/v3/validation";
const OPTUM_PROFESSIONAL_CLAIMS_HEALTH_PATH = "/professionalclaims/v3/healthcheck";

export type OptumSandboxAdapterOptions = {
  clientId?: string;
  clientSecret?: string;
  authUrl?: string;
  apiBaseUrl?: string;
  validationEnabled?: boolean;
  submissionEnabled?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

type OptumTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  message?: string;
};

export type OptumValidationEdit = {
  field: string;
  value: string | null;
  description: string;
  location: string | null;
};

function normalizeValidationEdits(value: unknown): OptumValidationEdit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const description = typeof record.description === "string" ? record.description.trim() : "";
    if (!description) return [];
    return [{
      field: typeof record.field === "string" && record.field.trim() ? record.field.trim() : "claim",
      value: record.value == null ? null : String(record.value),
      description,
      location: typeof record.location === "string" && record.location.trim() ? record.location.trim() : null,
    }];
  });
}

export class OptumSandboxAdapter {
  readonly provider = "optum";
  readonly environment = "sandbox";
  readonly capabilities = {
    professionalClaimValidation: true,
    institutionalClaimValidation: true,
    eligibilityMocks: true,
    claimStatusMocks: true,
    productionSubmission: false,
  };

  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly authUrl: string;
  private readonly apiBaseUrl: string;
  private readonly validationEnabled: boolean;
  private readonly submissionEnabled: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(options: OptumSandboxAdapterOptions = {}) {
    this.clientId = options.clientId?.trim() || undefined;
    this.clientSecret = options.clientSecret?.trim() || undefined;
    this.authUrl = options.authUrl || "https://sandbox-apigw.optum.com/apip/auth/v2/token";
    this.apiBaseUrl = (options.apiBaseUrl || "https://sandbox-apigw.optum.com/medicalnetwork").replace(/\/$/, "");
    this.validationEnabled = Boolean(options.validationEnabled);
    // Sandbox submission is deliberately unsupported in Codical. Preserve the
    // environment value only so readiness can flag a dangerous configuration.
    this.submissionEnabled = Boolean(options.submissionEnabled);
    this.fetchImpl = options.fetchImpl || fetch;
    this.now = options.now || Date.now;
  }

  readiness() {
    const blockers: string[] = [];
    if (!this.clientId) blockers.push("OPTUM_CLIENT_ID is not configured.");
    if (!this.clientSecret) blockers.push("OPTUM_CLIENT_SECRET is not configured.");
    if (!this.validationEnabled) blockers.push("OPTUM_CLAIM_VALIDATION_ENABLED is not true.");
    if (this.submissionEnabled) blockers.push("OPTUM_CLAIM_SUBMISSION_ENABLED must remain false in sandbox.");
    return {
      configured: Boolean(this.clientId && this.clientSecret),
      validationEnabled: Boolean(this.clientId && this.clientSecret && this.validationEnabled && !this.submissionEnabled),
      submissionEnabled: false,
      blockers,
    };
  }

  private async accessToken() {
    if (this.token && this.token.expiresAt - this.now() > 60_000) return this.token.value;
    const readiness = this.readiness();
    if (!readiness.configured || !readiness.validationEnabled) {
      throw new ClearinghouseConfigurationError(readiness.blockers.join(" "));
    }
    const response = await this.fetchImpl(this.authUrl, {
      method: "POST",
      headers: { Accept: "*/*", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
      }),
    });
    const raw = await response.json().catch(() => ({})) as OptumTokenResponse;
    if (!response.ok || !raw.access_token) {
      const message = raw.error || raw.message || `Optum OAuth returned HTTP ${response.status}.`;
      const error = new Error(message) as Error & { status?: number };
      error.status = 502;
      throw error;
    }
    const expiresIn = Number(raw.expires_in || 3600);
    this.token = { value: raw.access_token, expiresAt: this.now() + Math.max(60, expiresIn) * 1000 };
    return this.token.value;
  }

  async healthCheck() {
    const accessToken = await this.accessToken();
    const response = await this.fetchImpl(`${this.apiBaseUrl}${OPTUM_PROFESSIONAL_CLAIMS_HEALTH_PATH}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const error = new Error(`Optum Professional Claims health check returned HTTP ${response.status}.`) as Error & { status?: number };
      error.status = 502;
      throw error;
    }
    return raw;
  }

  async validateProfessionalClaim(request: ClaimSubmissionRequest & { dataClassification?: string }) {
    if (request.dataClassification !== "synthetic") {
      throw new ClearinghouseConfigurationError("Optum sandbox validation accepts synthetic data only.");
    }
    const accessToken = await this.accessToken();
    const payload = { ...request.payload, usageIndicator: "T" };
    const response = await this.fetchImpl(`${this.apiBaseUrl}${OPTUM_PROFESSIONAL_CLAIMS_VALIDATION_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Correlation-Id": request.idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
    const edits = normalizeValidationEdits(raw.errors);
    const claimReference = raw.claimReference && typeof raw.claimReference === "object"
      ? raw.claimReference as Record<string, unknown>
      : {};
    if (!response.ok) {
      // Optum's documented test00005 canned edit is returned with HTTP 400,
      // even though it is a valid validation outcome. Structured validation
      // edits belong in Revenue Integrity's work queue, not in the transport
      // error path. A non-2xx response without structured edits is still an
      // upstream request failure.
      if (edits.length) {
        return {
          provider: this.provider,
          environment: this.environment,
          valid: false,
          status: typeof raw.status === "string" ? raw.status : "EDITS",
          editStatus: typeof raw.editStatus === "string" ? raw.editStatus : "EDITS",
          controlNumber: typeof raw.controlNumber === "string" ? raw.controlNumber : null,
          correlationId: typeof claimReference.correlationId === "string" ? claimReference.correlationId : null,
          edits,
          raw,
        };
      }
      const rawError = typeof raw.error === "string" ? raw.error : "";
      const rawMessage = typeof raw.message === "string" ? raw.message : "";
      const upstreamMessage = edits[0]?.description || rawMessage || rawError || `HTTP ${response.status}`;
      const message = `Optum rejected the synthetic 837P (${response.status}): ${upstreamMessage}`;
      const error = new Error(message) as Error & {
        status?: number;
        publicMessage?: string;
        issues?: OptumValidationEdit[];
        response?: Record<string, unknown>;
      };
      error.status = 502;
      error.publicMessage = message;
      error.issues = edits;
      error.response = raw;
      throw error;
    }
    return {
      provider: this.provider,
      environment: this.environment,
      valid: raw.status === "SUCCESS" && raw.editStatus !== "EDITS",
      status: typeof raw.status === "string" ? raw.status : "UNKNOWN",
      editStatus: typeof raw.editStatus === "string" ? raw.editStatus : null,
      controlNumber: typeof raw.controlNumber === "string" ? raw.controlNumber : null,
      correlationId: typeof claimReference.correlationId === "string" ? claimReference.correlationId : null,
      edits,
      raw,
    };
  }
}

export function createOptumSandboxAdapterFromEnvironment() {
  return new OptumSandboxAdapter({
    clientId: process.env.OPTUM_CLIENT_ID,
    clientSecret: process.env.OPTUM_CLIENT_SECRET,
    authUrl: process.env.OPTUM_AUTH_URL,
    apiBaseUrl: process.env.OPTUM_API_BASE_URL,
    validationEnabled: process.env.OPTUM_CLAIM_VALIDATION_ENABLED === "true",
    submissionEnabled: process.env.OPTUM_CLAIM_SUBMISSION_ENABLED === "true",
  });
}
