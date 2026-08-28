import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const REVENUE_SESSION_COOKIE = "codical_ri_session";
export const REVENUE_SESSION_TTL_SECONDS = 10 * 60;

export type RevenueSessionIdentity = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

type RevenueSessionPayload = RevenueSessionIdentity & {
  audience: "codical-revenue-integrity";
  tokenFingerprint: string;
  expiresAt: number;
};

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function revenueTokenFingerprint(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function createRevenueSession(input: {
  identity: RevenueSessionIdentity;
  bearerToken: string;
  secret: string;
  now?: number;
}) {
  if (!input.secret || !input.bearerToken || !input.identity.id) throw new Error("Revenue session inputs are incomplete.");
  const now = input.now ?? Date.now();
  const metadata = input.identity.user_metadata || {};
  const payload: RevenueSessionPayload = {
    id: input.identity.id,
    email: input.identity.email || null,
    user_metadata: {
      full_name: metadata.full_name,
      name: metadata.name,
    },
    audience: "codical-revenue-integrity",
    tokenFingerprint: revenueTokenFingerprint(input.bearerToken),
    expiresAt: now + REVENUE_SESSION_TTL_SECONDS * 1000,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded, input.secret)}`;
}

export function verifyRevenueSession(input: {
  sessionToken: string;
  bearerToken: string;
  secret: string;
  now?: number;
}): RevenueSessionIdentity | null {
  try {
    const [encoded, receivedSignature, extra] = input.sessionToken.split(".");
    if (!encoded || !receivedSignature || extra || !input.secret || !input.bearerToken) return null;
    const expectedSignature = signature(encoded, input.secret);
    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(receivedSignature);
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as RevenueSessionPayload;
    if (payload.audience !== "codical-revenue-integrity" || !payload.id) return null;
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= (input.now ?? Date.now())) return null;
    if (payload.tokenFingerprint !== revenueTokenFingerprint(input.bearerToken)) return null;
    return { id: payload.id, email: payload.email || null, user_metadata: payload.user_metadata || {} };
  } catch {
    return null;
  }
}

export function cookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return "";
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const key = entry.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(entry.slice(separator + 1).trim());
  }
  return "";
}

export function serializeRevenueSessionCookie(sessionToken: string, secure: boolean) {
  return [
    `${REVENUE_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
    `Max-Age=${REVENUE_SESSION_TTL_SECONDS}`,
    "Path=/api/revenue-integrity",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}
