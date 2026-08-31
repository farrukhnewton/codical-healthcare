import { ClearinghouseConfigurationError } from "./clearinghouse";

const AVAILITY_DEMO_SCOPE = "healthcare-hipaa-transactions-demo";
const AVAILITY_PAYER_LIST_PATH = "/availity/v1/availity-payer-list?limit=1";

export type AvailityDemoAdapterOptions = {
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  authUrl?: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

type AvailityTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
  userMessage?: string;
  developerMessage?: string;
};

type AvailityPayerListResponse = {
  totalCount?: number;
  count?: number;
  payers?: unknown[];
  error?: string;
  userMessage?: string;
  developerMessage?: string;
};

function messageFromAvaility(value: Record<string, unknown>, fallback: string) {
  for (const field of ["userMessage", "error_description", "developerMessage", "message", "error"]) {
    const candidate = value[field];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function upstreamError(message: string) {
  const error = new Error(message) as Error & { status?: number; publicMessage?: string };
  error.status = 502;
  error.publicMessage = message;
  return error;
}

export class AvailityDemoAdapter {
  readonly provider = "availity";
  readonly environment = "demo";
  readonly requiredScope = AVAILITY_DEMO_SCOPE;
  readonly capabilities = {
    oauth: true,
    payerDirectory: true,
    predefinedClaimStatusScenarios: true,
    predefinedCoverageScenarios: true,
    predefinedPredeterminationScenarios: true,
    professionalClaimSubmission: false,
    institutionalClaimSubmission: false,
    productionData: false,
  };

  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly scope: string;
  private readonly authUrl: string;
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(options: AvailityDemoAdapterOptions = {}) {
    this.clientId = options.clientId?.trim() || undefined;
    this.clientSecret = options.clientSecret?.trim() || undefined;
    this.scope = options.scope?.trim() || "";
    this.authUrl = options.authUrl || "https://api.availity.com/v1/token";
    this.apiBaseUrl = (options.apiBaseUrl || "https://api.availity.com").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl || fetch;
    this.now = options.now || Date.now;
  }

  readiness() {
    const blockers: string[] = [];
    const scopes = new Set(this.scope.split(/\s+/).filter(Boolean));
    if (!this.clientId) blockers.push("AVAILITY_CLIENT_ID is not configured.");
    if (!this.clientSecret) blockers.push("AVAILITY_CLIENT_SECRET is not configured.");
    if (!scopes.has(AVAILITY_DEMO_SCOPE)) {
      blockers.push(`AVAILITY_SCOPE must include ${AVAILITY_DEMO_SCOPE}.`);
    }
    const configured = Boolean(this.clientId && this.clientSecret && scopes.has(AVAILITY_DEMO_SCOPE));
    return {
      configured,
      demoEnabled: configured,
      submissionEnabled: false,
      blockers,
    };
  }

  private async accessToken() {
    if (this.token && this.token.expiresAt - this.now() > 30_000) return this.token.value;
    const readiness = this.readiness();
    if (!readiness.demoEnabled) throw new ClearinghouseConfigurationError(readiness.blockers.join(" "));

    const body = new URLSearchParams({
      client_id: this.clientId || "",
      client_secret: this.clientSecret || "",
      grant_type: "client_credentials",
      scope: this.scope,
    });
    const response = await this.fetchImpl(this.authUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const raw = await response.json().catch(() => ({})) as AvailityTokenResponse;
    if (!response.ok || !raw.access_token) {
      throw upstreamError(messageFromAvaility(raw as Record<string, unknown>, `Availity OAuth returned HTTP ${response.status}.`));
    }
    const expiresIn = Math.max(60, Number(raw.expires_in || 300));
    this.token = { value: raw.access_token, expiresAt: this.now() + expiresIn * 1000 };
    return raw.access_token;
  }

  async healthCheck() {
    const accessToken = await this.accessToken();
    const response = await this.fetchImpl(`${this.apiBaseUrl}${AVAILITY_PAYER_LIST_PATH}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-Response-Encoding-Context": "HTML",
      },
    });
    const raw = await response.json().catch(() => ({})) as AvailityPayerListResponse;
    if (!response.ok) {
      throw upstreamError(messageFromAvaility(raw as Record<string, unknown>, `Availity payer-directory check returned HTTP ${response.status}.`));
    }
    return {
      status: "OK",
      payerCount: Number(raw.totalCount || raw.count || raw.payers?.length || 0),
      returnedCount: Number(raw.count || raw.payers?.length || 0),
      responseIsMock: response.headers.get("x-api-mock-response") === "true",
    };
  }
}

export function createAvailityDemoAdapterFromEnvironment() {
  return new AvailityDemoAdapter({
    clientId: process.env.AVAILITY_CLIENT_ID,
    clientSecret: process.env.AVAILITY_CLIENT_SECRET,
    scope: process.env.AVAILITY_SCOPE,
    authUrl: process.env.AVAILITY_AUTH_URL,
    apiBaseUrl: process.env.AVAILITY_API_BASE_URL,
  });
}
