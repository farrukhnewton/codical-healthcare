import { ClearinghouseConfigurationError } from "./clearinghouse";

const AVAILITY_DEMO_SCOPE = "healthcare-hipaa-transactions-demo";
const AVAILITY_PAYER_LIST_PATH = "/availity/v1/availity-payer-list?limit=1";
const AVAILITY_COVERAGES_PATH = "/availity/v1/coverages";
const AVAILITY_CLAIM_STATUSES_PATH = "/availity/v1/claim-statuses";

export const AVAILITY_COVERAGE_SCENARIOS = {
  complete: { id: "Coverages-Complete-i", expectedStatus: 200, outcome: "complete" },
  providerIneligible: { id: "Coverages-PayerError1-i", expectedStatus: 200, outcome: "payer_error" },
  invalidSubscriberName: { id: "Coverages-PayerError2-i", expectedStatus: 200, outcome: "payer_error" },
  inProgress: { id: "Coverages-InProgress-i", expectedStatus: 202, outcome: "in_progress" },
  retrying: { id: "Coverages-Retrying-i", expectedStatus: 202, outcome: "retrying" },
  requestErrorOne: { id: "Coverages-RequestError1-i", expectedStatus: 400, outcome: "request_error" },
  requestErrorTwo: { id: "Coverages-RequestError2-i", expectedStatus: 400, outcome: "request_error" },
} as const;

export type AvailityCoverageScenario = keyof typeof AVAILITY_COVERAGE_SCENARIOS;

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

function invalidScenario(message: string) {
  const error = new Error(message) as Error & { status?: number; publicMessage?: string };
  error.status = 400;
  error.publicMessage = message;
  return error;
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) : [];
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedMessages(...values: unknown[]) {
  const messages: string[] = [];
  for (const value of values) {
    for (const entry of records(value)) {
      const message = text(entry.message) || text(entry.errorMessage) || text(entry.userMessage) || text(entry.developerMessage);
      if (message && !messages.includes(message)) messages.push(message);
    }
  }
  return messages;
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

  async runCoverageScenario(scenario: AvailityCoverageScenario) {
    const definition = AVAILITY_COVERAGE_SCENARIOS[scenario];
    if (!definition) throw invalidScenario("Unsupported Availity Coverage demo scenario.");
    const accessToken = await this.accessToken();
    const response = await this.fetchImpl(`${this.apiBaseUrl}${AVAILITY_COVERAGES_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Api-Mock-Scenario-ID": definition.id,
        "X-Response-Encoding-Context": "HTML",
      },
      // Availity's Demo scenario contract requires a canned request. Sending no
      // member fields ensures this endpoint can never be repurposed for PHI.
      body: new URLSearchParams(),
    });
    const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
    const mockVerified = response.headers.get("x-api-mock-response") === "true";
    if (response.status !== definition.expectedStatus || !mockVerified) {
      throw upstreamError(messageFromAvaility(raw, `Availity Coverage Demo returned unexpected HTTP ${response.status}.`));
    }
    const coverage = records(raw.coverages)[0] || {};
    const payer = coverage.payer && typeof coverage.payer === "object" ? coverage.payer as Record<string, unknown> : {};
    const messages = normalizedMessages(raw.errors, raw.validationMessages, coverage.validationMessages);
    return {
      scenario,
      scenarioId: definition.id,
      outcome: definition.outcome,
      httpStatus: response.status,
      mockVerified,
      totalCount: Number(raw.totalCount || raw.count || (coverage.id ? 1 : 0)),
      coverageStatus: text(coverage.status),
      coverageStatusCode: text(coverage.statusCode),
      payerId: text(payer.payerId),
      planCount: records(coverage.plans).length,
      messages,
    };
  }

  async runClaimStatusScenario() {
    const accessToken = await this.accessToken();
    // These values are Availity's published synthetic request. This method has
    // no input argument by design, so real patient or claim data cannot enter it.
    const request = new URLSearchParams({
      "payer.id": "BCBSF",
      "submitter.lastName": "SUBMITTERLASTNAME",
      "submitter.firstName": "SUBMITTERFIRSTNAME",
      "submitter.id": "SUBMITTERID",
      "providers.lastName": "PROVIDERLASTNAME",
      "providers.firstName": "PROVIDERFIRSTNAME",
      "providers.npi": "1234567893",
      "subscriber.memberId": "ABC123456789",
      "subscriber.lastName": "SUBSCRIBERLASTNAME",
      "subscriber.firstName": "SUBSCRIBERFIRSTNAME",
      "patient.lastName": "PATIENTLASTNAME",
      "patient.firstName": "PATIENTFIRSTNAME",
      "patient.birthDate": "1999-09-09",
      "patient.genderCode": "M",
      "patient.accountNumber": "PAT1ENTACC0UNTNUMB3R",
      "patient.subscriberRelationshipCode": "01",
      fromDate: "2025-05-15",
      toDate: "2025-05-19",
      claimNumber: "CL4IM2TATUSNUM8ER",
      claimAmount: "12345678.90",
      facilityTypeCode: "12",
      frequencyTypeCode: "1",
    });
    const summaryResponse = await this.fetchImpl(`${this.apiBaseUrl}${AVAILITY_CLAIM_STATUSES_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-HTTP-Method-Override": "GET",
        "X-Response-Encoding-Context": "HTML",
      },
      body: request,
    });
    const summaryRaw = await summaryResponse.json().catch(() => ({})) as Record<string, unknown>;
    const summaryMock = summaryResponse.headers.get("x-api-mock-response") === "true";
    if (summaryResponse.status !== 200 || !summaryMock) {
      throw upstreamError(messageFromAvaility(summaryRaw, `Availity Claim Status Demo returned HTTP ${summaryResponse.status}.`));
    }
    const summary = records(summaryRaw.claimStatuses)[0] || {};
    const id = text(summary.id);
    if (!id) throw upstreamError("Availity Claim Status Demo did not return a response ID.");

    const detailResponse = await this.fetchImpl(`${this.apiBaseUrl}${AVAILITY_CLAIM_STATUSES_PATH}/${encodeURIComponent(id)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-Response-Encoding-Context": "HTML",
      },
    });
    const detailRaw = await detailResponse.json().catch(() => ({})) as Record<string, unknown>;
    const detailMock = detailResponse.headers.get("x-api-mock-response") === "true";
    if (detailResponse.status !== 200 || !detailMock) {
      throw upstreamError(messageFromAvaility(detailRaw, `Availity Claim Status detail Demo returned HTTP ${detailResponse.status}.`));
    }
    const payer = detailRaw.payer && typeof detailRaw.payer === "object" ? detailRaw.payer as Record<string, unknown> : {};
    const claimStatuses = records(detailRaw.claimStatuses);
    const statusDetails = claimStatuses.flatMap((claimStatus) => records(claimStatus.statusDetails)).slice(0, 5).map((detail) => ({
      category: text(detail.category),
      categoryCode: text(detail.categoryCode),
      status: text(detail.status),
      statusCode: text(detail.statusCode),
      entity: text(detail.entity),
      entityCode: text(detail.entityCode),
      paymentAmount: text(detail.paymentAmount),
    }));
    const serviceLineCount = claimStatuses.reduce((count, claimStatus) => count + records(claimStatus.serviceLines).length, 0);
    return {
      scenario: "complete" as const,
      httpStatus: detailResponse.status,
      mockVerified: summaryMock && detailMock,
      responseId: id,
      status: text(detailRaw.status),
      statusCode: text(detailRaw.statusCode),
      payerId: text(payer.id) || text(payer.payerId),
      claimAmount: text(detailRaw.claimAmount),
      claimCount: Number(detailRaw.claimCount || claimStatuses.length),
      serviceLineCount,
      statusDetails,
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
