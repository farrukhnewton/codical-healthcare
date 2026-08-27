import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { RevenueIntegrity } from "../client/src/pages/RevenueIntegrity";

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
