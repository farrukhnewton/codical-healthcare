import type { AuthorizationCheckInput, EligibilityCheckInput, NormalizedAuthorizationResponse, NormalizedEligibilityResponse } from "@shared/revenue-cycle";

export async function revenueCycleRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  if (!response.ok) throw new Error(payload.message || `Revenue Cycle request failed (${response.status}).`);
  return payload as T;
}

export type RevenueCycleModule = {
  id: string;
  name: string;
  status: "active" | "foundation" | "planned";
  href: string | null;
};

export type RevenueCycleOverview = {
  generatedAt: string;
  organization: { id: string; name: string; slug: string };
  environment: "sandbox";
  dataPolicy: "synthetic_only";
  eligibility: { totalChecks: number; activeChecks: number; exceptionChecks: number; latestCheckAt: string | null };
  authorizations: { total: number; approved: number; pending: number };
  modules: RevenueCycleModule[];
};

export type EligibilityCheck = {
  id: string;
  provider: "availity";
  environment: "demo";
  dataClassification: "synthetic";
  scenario: EligibilityCheckInput["scenario"];
  sampleProfile: EligibilityCheckInput["sampleProfile"];
  serviceType: EligibilityCheckInput["serviceType"];
  status: NormalizedEligibilityResponse["status"];
  payerId: string | null;
  payerName: string | null;
  memberIdMasked: string | null;
  response: NormalizedEligibilityResponse;
  checkedAt: string;
  createdAt?: string;
};

export type RevenueAuthorization = {
  id: string;
  provider: "codical";
  environment: "sandbox";
  dataClassification: "synthetic";
  scenario: AuthorizationCheckInput["scenario"];
  sampleProfile: AuthorizationCheckInput["sampleProfile"];
  status: NormalizedAuthorizationResponse["status"];
  payerId: string;
  payerName: string;
  memberIdMasked: string;
  procedureCode: string;
  diagnosisCode: string;
  serviceFrom: string;
  serviceTo: string;
  requestedUnits: string | number;
  authorizationNumber: string | null;
  response: NormalizedAuthorizationResponse;
  checkedAt: string;
};
