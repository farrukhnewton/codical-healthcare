import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { RevenueIntegrity } from "../client/src/pages/RevenueIntegrity";
import { RevenueCycle } from "../client/src/pages/RevenueCycle";
import { EligibilityBenefits } from "../client/src/pages/EligibilityBenefits";
import { PriorAuthorizations } from "../client/src/pages/PriorAuthorizations";
import { ClaimStatus } from "../client/src/pages/ClaimStatus";
import { PaymentsRemittances } from "../client/src/pages/PaymentsRemittances";
import { DenialsAppeals } from "../client/src/pages/DenialsAppeals";

test("Revenue Cycle command center renders the module map and sandbox boundary", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["revenue-cycle", "overview"], {
    organization: { id: "demo-org", name: "Demo Revenue Workspace", slug: "demo" },
    environment: "sandbox",
    dataPolicy: "synthetic_only",
    eligibility: { totalChecks: 2, activeChecks: 1, exceptionChecks: 1, latestCheckAt: null },
    modules: [{ id: "eligibility", name: "Eligibility & Benefits", status: "active", href: "/revenue-cycle/eligibility" }],
  });
  const html = renderToStaticMarkup(
    <Router ssrPath="/revenue-cycle"><QueryClientProvider client={queryClient}><RevenueCycle /></QueryClientProvider></Router>,
  );
  assert.match(html, /Sandbox environment/i);
  assert.match(html, /Revenue operations/i);
  assert.match(html, /Eligibility &amp; Benefits/i);
});

test("Eligibility workspace renders its controlled synthetic inquiry", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <Router ssrPath="/revenue-cycle/eligibility"><QueryClientProvider client={queryClient}><EligibilityBenefits /></QueryClientProvider></Router>,
  );
  assert.match(html, /synthetic Availity scenarios/i);
  assert.match(html, /Run eligibility check/i);
  assert.match(html, /No eligibility response yet/i);
});

test("Prior Authorizations renders the synthetic 278-style workflow", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <Router ssrPath="/revenue-cycle/authorizations"><QueryClientProvider client={queryClient}><PriorAuthorizations /></QueryClientProvider></Router>,
  );
  assert.match(html, /Prior Authorizations/i);
  assert.match(html, /synthetic 278-style workflow/i);
  assert.match(html, /No authorization case yet/i);
});

test("Claim Status renders the controlled synthetic 276/277 workflow", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <Router ssrPath="/revenue-cycle/claim-status"><QueryClientProvider client={queryClient}><ClaimStatus /></QueryClientProvider></Router>,
  );
  assert.match(html, /Claim Status/i);
  assert.match(html, /Run claim status inquiry/i);
  assert.match(html, /No claim status response yet/i);
});

test("Payments and Remittances renders the controlled synthetic 835 workflow", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <Router ssrPath="/revenue-cycle/payments"><QueryClientProvider client={queryClient}><PaymentsRemittances /></QueryClientProvider></Router>,
  );
  assert.match(html, /Payments &amp; Remittances/i);
  assert.match(html, /Process a synthetic 835/i);
  assert.match(html, /No ERA selected/i);
});

test("Denials and Appeals renders the controlled routing workflow", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <Router ssrPath="/revenue-cycle/denials"><QueryClientProvider client={queryClient}><DenialsAppeals /></QueryClientProvider></Router>,
  );
  assert.match(html, /Denials &amp; Appeals/i);
  assert.match(html, /Create a denial case/i);
  assert.match(html, /No denial case selected/i);
});

test("Revenue Integrity renders its initial route state without throwing", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <RevenueIntegrity />
    </QueryClientProvider>,
  );

  assert.match(html, /Revenue Integrity/i);
  assert.match(html, /Claim lifecycle/i);
  assert.match(html, /Integration readiness/i);
});

test("Revenue Integrity accepts the legacy local overview shape without integration", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(["revenue-integrity", "overview"], {
    organization: { id: "local-org", name: "Local Revenue Workspace" },
    metrics: {
      openClaims: 0,
      openWorkItems: 0,
      revenueAtRisk: 0,
      underpaymentOpportunity: 0,
    },
    statusCounts: [],
  });
  queryClient.setQueryData(["revenue-integrity", "claims"], { claims: [] });
  queryClient.setQueryData(["revenue-integrity", "work-items"], { workItems: [] });

  const html = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <RevenueIntegrity />
    </QueryClientProvider>,
  );

  assert.match(html, /Local Revenue Workspace/i);
  assert.match(html, /Production onboarding/i);
});
