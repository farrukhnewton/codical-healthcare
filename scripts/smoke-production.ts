import "dotenv/config";

type SmokeCheck = {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  detail?: unknown;
};

const baseUrl = normalizeBaseUrl(process.env.PROD_BASE_URL || "https://codical-healthcare.vercel.app");
const requireMcd = process.env.PROD_SMOKE_REQUIRE_MCD === "true";
const includeAi = process.env.PROD_SMOKE_INCLUDE_AI === "true";
const checks: SmokeCheck[] = [];

const EXAMPLE_DIAGNOSIS_CODES = ["M17.0", "E11.9"];
const EXAMPLE_PROCEDURE_CODES = ["29877", "99214", "99213"];

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function maskEmail(value: string | undefined) {
  if (!value || !value.includes("@")) return value || "";
  const [name, domain] = value.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function record(name: string, status: SmokeCheck["status"], detail?: unknown) {
  checks.push({ name, status, detail });
  const suffix = detail === undefined ? "" : ` ${JSON.stringify(detail)}`;
  console.log(`${status} ${name}${suffix}`);
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

async function requestJson<T>(
  pathOrUrl: string,
  init: RequestInit = {},
  expectedStatus?: number,
) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
  const response = await fetch(url, init);
  const data = await readJson(response);

  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new Error(`${url} returned ${response.status}; expected ${expectedStatus}: ${JSON.stringify(data)}`);
  }

  if (expectedStatus === undefined && !response.ok) {
    throw new Error(`${url} returned ${response.status}: ${JSON.stringify(data)}`);
  }

  return { response, data: data as T };
}

async function signIn() {
  const supabaseUrl = requireEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");
  const email = requireEnv("PROD_SMOKE_EMAIL");
  const password = requireEnv("PROD_SMOKE_PASSWORD");

  const { response, data } = await requestJson<{
    access_token?: string;
    user?: {
      id?: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    };
    error_description?: string;
    msg?: string;
  }>(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );

  if (!response.ok || !data?.access_token || !data.user?.id) {
    throw new Error(data?.error_description || data?.msg || "Supabase password sign-in failed");
  }

  record("Supabase password sign-in", "PASS", { userId: data.user.id, email: maskEmail(data.user.email) });
  return {
    token: data.access_token,
    user: data.user,
  };
}

async function checkHealth() {
  const { data } = await requestJson<{ status?: string }>("/api/health");
  if (data?.status !== "ok") {
    throw new Error(`Unexpected health response: ${JSON.stringify(data)}`);
  }
  record("Production health endpoint", "PASS", data);
}

async function checkChatUserSync(auth: Awaited<ReturnType<typeof signIn>>) {
  const metadata = auth.user.user_metadata || {};
  const profile = {
    supabaseId: auth.user.id,
    email: auth.user.email,
    fullName: String(metadata.full_name || auth.user.email?.split("@")[0] || "User"),
    avatarUrl: metadata.avatar_url || null,
  };

  const calls = await Promise.all(
    [0, 1].map(async () => {
      const { response, data } = await requestJson<{ id?: number; email?: string }>("/api/chat/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      return { status: response.status, id: data?.id, email: maskEmail(data?.email) };
    }),
  );

  if (!calls.every((call) => call.status === 200 && call.id)) {
    throw new Error(`Chat sync did not return two valid users: ${JSON.stringify(calls)}`);
  }

  record("Authenticated chat user sync race", "PASS", calls);
}

function formatClaimReport(result: any) {
  return [
    "Codical production smoke claim validation",
    `Diagnosis codes: ${EXAMPLE_DIAGNOSIS_CODES.join(" ")}`,
    `Procedure codes: ${EXAMPLE_PROCEDURE_CODES.join(" ")}`,
    `NCCI edits: ${result?.summary?.ncciEditCount ?? "unknown"}`,
    `Coverage evidence: ${result?.summary?.coverageEvidenceCount ?? "unknown"}`,
  ].join("\n");
}

async function checkClaimValidation() {
  const { data } = await requestJson<any>("/api/claim/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      diagnosisCodes: EXAMPLE_DIAGNOSIS_CODES,
      procedureCodes: EXAMPLE_PROCEDURE_CODES,
      ncciType: "practitioner",
      coverageLimit: 8,
    }),
  });

  if (!data?.summary || !data?.ncciValidation) {
    throw new Error(`Claim validation response is missing summary or NCCI data: ${JSON.stringify(data)}`);
  }

  const mcdMissing = Array.isArray(data.warnings)
    && data.warnings.some((warning: string) => warning.includes("Cloudflare MCD coverage intelligence is not configured"));

  if (requireMcd && (!data.coverageValidation || mcdMissing)) {
    throw new Error("Cloudflare MCD coverage evidence is required but is not available in production.");
  }

  record("Claim Validator NCCI result", "PASS", {
    ncciEditCount: data.summary.ncciEditCount,
    ncciPairCount: data.ncciValidation.pairCount,
  });

  record("Claim Validator MCD coverage result", data.coverageValidation ? "PASS" : "WARN", {
    configured: Boolean(data.coverageValidation),
    warning: mcdMissing ? "Cloudflare MCD coverage intelligence is not configured" : undefined,
  });

  return data;
}

async function checkSavedValidation(auth: Awaited<ReturnType<typeof signIn>>, claimResult: any) {
  const created = await requestJson<any>("/api/saved-ai-files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      module: "claim_validation",
      fileName: `Smoke claim validation - ${new Date().toISOString()}`,
      patientName: "Smoke QA",
      content: formatClaimReport(claimResult),
      sourceText: [
        `Diagnosis codes: ${EXAMPLE_DIAGNOSIS_CODES.join(" ")}`,
        `Procedure codes: ${EXAMPLE_PROCEDURE_CODES.join(" ")}`,
        "NCCI type: practitioner",
      ].join("\n"),
      structuredData: {
        result: claimResult,
        generatedAt: new Date().toISOString(),
        diagnosisCodes: EXAMPLE_DIAGNOSIS_CODES,
        procedureCodes: EXAMPLE_PROCEDURE_CODES,
        ncciType: "practitioner",
      },
    }),
  }, 201);

  const savedFile = created.data;
  if (!savedFile?.id) {
    throw new Error(`Saved validation was not created: ${JSON.stringify(savedFile)}`);
  }

  try {
    const pdfResponse = await fetch(`${baseUrl}/api/saved-ai-files/${savedFile.id}/pdf`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    const pdfBytes = await pdfResponse.arrayBuffer();

    if (!pdfResponse.ok || pdfBytes.byteLength < 1000) {
      throw new Error(`PDF export failed with ${pdfResponse.status}; bytes=${pdfBytes.byteLength}`);
    }

    record("Saved Claim Validation PDF export", "PASS", {
      id: savedFile.id,
      bytes: pdfBytes.byteLength,
    });
  } finally {
    if (process.env.PROD_SMOKE_KEEP_SAVED_FILE !== "true") {
      await requestJson(`/api/saved-ai-files/${savedFile.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.token}` },
      }, 204);

      record("Temporary saved validation cleanup", "PASS", { id: savedFile.id });
    }
  }
}

async function checkAiCoder() {
  if (!includeAi) {
    record("AI Coder analysis", "WARN", "Skipped. Set PROD_SMOKE_INCLUDE_AI=true to exercise Gemini-backed analysis.");
    return;
  }

  const { data } = await requestJson<any>("/api/workspace/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: [
        "PROCEDURE: Arthroscopic chondroplasty of right knee.",
        "DIAGNOSIS: Bilateral primary osteoarthritis of knees.",
        "HISTORY: Established patient with chronic bilateral knee pain and type 2 diabetes.",
      ].join(" "),
    }),
  });

  if (!data?.success || !data.result?.cpt_codes?.length || !data.result?.icd10_codes?.length) {
    throw new Error(`AI Coder analysis did not return expected codes: ${JSON.stringify(data)}`);
  }

  record("AI Coder analysis", "PASS", {
    cptCodes: data.result.cpt_codes.map((code: any) => code.code),
    icd10Codes: data.result.icd10_codes.map((code: any) => code.code),
  });
}

async function main() {
  try {
    console.log(`Running production smoke checks against ${baseUrl}`);

    await checkHealth();
    const auth = await signIn();
    await checkChatUserSync(auth);
    const claimResult = await checkClaimValidation();
    await checkSavedValidation(auth, claimResult);
    await checkAiCoder();

    const failures = checks.filter((check) => check.status === "FAIL");
    const warnings = checks.filter((check) => check.status === "WARN");
    console.log(`\nProduction smoke complete: ${checks.length - failures.length - warnings.length} passed, ${warnings.length} warning(s), ${failures.length} failure(s).`);

    if (failures.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    record("Production smoke fatal error", "FAIL", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

void main();
