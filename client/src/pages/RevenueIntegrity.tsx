import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  DollarSign,
  FileCheck2,
  Link2,
  ListChecks,
  PencilLine,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { RevenueClaimCorrection } from "@/components/revenue-integrity/RevenueClaimCorrection";
import {
  revenueIntegrityRequest,
  type OptumCertificationResult,
  type RevenueIntegrityClaim,
  type RevenueIntegrityClaimDetail,
  type RevenueIntegrityOverview,
  type RevenueIntegrityWorkItem,
} from "@/lib/revenue-integrity-api";

type ViewMode = "claims" | "work" | "integration";

function currency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    .format(Number(value || 0));
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function EmptyState({ mode }: { mode: ViewMode }) {
  const content = mode === "work"
    ? { icon: ListChecks, title: "No integrity tasks yet", body: "Issues found during claim validation, clearinghouse processing and remittance review will appear here." }
    : mode === "integration"
      ? { icon: Link2, title: "Production connection is onboarding", body: "The adapter is installed. A clearinghouse agreement, credentials, provider enrollment and certification are required before live submission can be enabled." }
      : { icon: FileCheck2, title: "No production claims imported", body: "Claims will appear after an EHR or practice-management import, API creation, or clearinghouse migration feed is configured." };
  const Icon = content.icon;
  return (
    <div className="ri-empty">
      <span><Icon size={24} /></span>
      <h3>{content.title}</h3>
      <p>{content.body}</p>
    </div>
  );
}

export function RevenueIntegrity() {
  const claimDetailRef = useRef<HTMLElement | null>(null);
  const [view, setView] = useState<ViewMode>("claims");
  const [search, setSearch] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [claimAction, setClaimAction] = useState<{ state: "idle" | "running" | "success" | "error"; message?: string }>({ state: "idle" });
  const [workActionId, setWorkActionId] = useState<number | null>(null);
  const [optumHealth, setOptumHealth] = useState<{ state: "idle" | "testing" | "success" | "error"; message?: string }>({ state: "idle" });
  const [availityHealth, setAvailityHealth] = useState<{ state: "idle" | "testing" | "success" | "error"; message?: string }>({ state: "idle" });
  const [optumCertification, setOptumCertification] = useState<{
    state: "idle" | "running" | "complete" | "error";
    scenario?: "success" | "edits";
    result?: OptumCertificationResult;
    message?: string;
  }>({ state: "idle" });

  const overviewQuery = useQuery({
    queryKey: ["revenue-integrity", "overview"],
    queryFn: () => revenueIntegrityRequest<RevenueIntegrityOverview>("/api/revenue-integrity/overview"),
    staleTime: 30_000,
  });
  const claimsQuery = useQuery({
    queryKey: ["revenue-integrity", "claims"],
    queryFn: () => revenueIntegrityRequest<{ claims: RevenueIntegrityClaim[] }>("/api/revenue-integrity/claims"),
    staleTime: 30_000,
  });
  const workQuery = useQuery({
    queryKey: ["revenue-integrity", "work-items"],
    queryFn: () => revenueIntegrityRequest<{ workItems: RevenueIntegrityWorkItem[] }>("/api/revenue-integrity/work-items"),
    staleTime: 30_000,
  });
  const detailQuery = useQuery({
    queryKey: ["revenue-integrity", "claim", selectedClaimId],
    queryFn: () => revenueIntegrityRequest<RevenueIntegrityClaimDetail>(`/api/revenue-integrity/claims/${selectedClaimId}`),
    enabled: Boolean(selectedClaimId),
    staleTime: 15_000,
  });
  const overview = overviewQuery.data;

  const claims = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = claimsQuery.data?.claims || [];
    if (!query) return rows;
    return rows.filter((claim) => [claim.patientControlNumber, claim.patientName, claim.payerName, claim.status]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [claimsQuery.data, search]);

  const workItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = workQuery.data?.workItems || [];
    if (!query) return rows;
    return rows.filter((item) => [item.patientControlNumber, item.payerName, item.title, item.category]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [search, workQuery.data]);

  const refresh = () => Promise.all([overviewQuery.refetch(), claimsQuery.refetch(), workQuery.refetch()]);
  const testOptumConnection = async () => {
    setOptumHealth({ state: "testing" });
    try {
      const result = await revenueIntegrityRequest<{ ok: boolean; status: string }>("/api/revenue-integrity/integrations/optum/health", { method: "POST" });
      setOptumHealth({ state: result.ok ? "success" : "error", message: result.ok ? `Connected · ${result.status}` : "Connection failed" });
    } catch (error) {
      setOptumHealth({ state: "error", message: error instanceof Error ? error.message : "Connection failed" });
    }
  };
  const testAvailityConnection = async () => {
    setAvailityHealth({ state: "testing" });
    try {
      const result = await revenueIntegrityRequest<{ ok: boolean; status: string; payerCount: number }>("/api/revenue-integrity/integrations/availity/health", { method: "POST" });
      setAvailityHealth({
        state: result.ok ? "success" : "error",
        message: result.ok ? `Connected · ${result.payerCount.toLocaleString()} payer records accessible` : "Connection failed",
      });
    } catch (error) {
      setAvailityHealth({ state: "error", message: error instanceof Error ? error.message : "Connection failed" });
    }
  };
  const runOptumCertification = async (scenario: "success" | "edits") => {
    setOptumCertification({ state: "running", scenario });
    try {
      const result = await revenueIntegrityRequest<OptumCertificationResult>("/api/revenue-integrity/certification/optum", {
        method: "POST",
        body: JSON.stringify({ scenario }),
      });
      setOptumCertification({ state: "complete", scenario, result });
      await refresh();
    } catch (error) {
      setOptumCertification({
        state: "error",
        scenario,
        message: error instanceof Error ? error.message : "Optum certification failed.",
      });
    }
  };
  const openCertifiedClaim = (claimId: string) => {
    setSelectedClaimId(claimId);
    setIsCorrecting(false);
    setClaimAction({ state: "idle" });
    setView("claims");
  };
  useEffect(() => {
    if (!selectedClaimId || detailQuery.data?.claim.id !== selectedClaimId) return;
    const frame = window.requestAnimationFrame(() => claimDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [detailQuery.data?.claim.id, selectedClaimId]);
  const refreshClaim = async () => {
    await Promise.all([detailQuery.refetch(), refresh()]);
  };
  const revalidateSelectedClaim = async () => {
    if (!selectedClaimId) return;
    setClaimAction({ state: "running", message: "Revalidating the corrected 837P with Optum..." });
    try {
      const result = await revenueIntegrityRequest<{ valid: boolean; edits: Array<{ description: string }> }>(`/api/revenue-integrity/claims/${selectedClaimId}/validate-optum`, { method: "POST" });
      setClaimAction({
        state: "success",
        message: result.valid ? "Optum revalidation passed. Provider validation work items were resolved." : `Optum returned ${result.edits.length} remaining edit${result.edits.length === 1 ? "" : "s"}.`,
      });
      await refreshClaim();
    } catch (actionError) {
      setClaimAction({ state: "error", message: actionError instanceof Error ? actionError.message : "Optum revalidation failed." });
    }
  };
  const startWorkItem = async (workItemId: number, claimId: string) => {
    setWorkActionId(workItemId);
    setClaimAction({ state: "running", message: "Assigning the integrity task to your active work..." });
    try {
      await revenueIntegrityRequest(`/api/revenue-integrity/work-items/${workItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "start" }),
      });
      setSelectedClaimId(claimId);
      setIsCorrecting(false);
      setView("claims");
      setClaimAction({ state: "success", message: "Work item started. Correct the claim, then revalidate it to resolve the edit." });
      await refreshClaim();
    } catch (actionError) {
      setClaimAction({ state: "error", message: actionError instanceof Error ? actionError.message : "The work item could not be started." });
    } finally {
      setWorkActionId(null);
    }
  };
  const beginClaimCorrection = async () => {
    const detail = detailQuery.data;
    if (!detail) return;
    const task = detail.workItems.find((item) => ["open", "blocked", "in_progress"].includes(item.status));
    setClaimAction({ state: "running", message: task?.status === "in_progress" ? "Opening the correction workspace..." : "Starting the integrity task..." });
    try {
      if (task && task.status !== "in_progress") {
        setWorkActionId(task.id);
        await revenueIntegrityRequest(`/api/revenue-integrity/work-items/${task.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "start" }),
        });
        await Promise.all([detailQuery.refetch(), workQuery.refetch(), overviewQuery.refetch()]);
      }
      setClaimAction({ state: "idle" });
      setIsCorrecting(true);
    } catch (actionError) {
      setClaimAction({ state: "error", message: actionError instanceof Error ? actionError.message : "The correction workspace could not be opened." });
    } finally {
      setWorkActionId(null);
    }
  };
  const loading = overviewQuery.isLoading || claimsQuery.isLoading || workQuery.isLoading;
  const error = overviewQuery.error || claimsQuery.error || workQuery.error;
  // Local development can briefly serve the pre-integration overview shape
  // while the API process is restarting. Keep the route usable until the
  // expanded response arrives instead of throwing at the app error boundary.
  const organization = overview?.organization;
  const overviewMetrics = overview?.metrics;
  const integration = overview?.integration;
  const optumValidator = overview?.validationPartners?.find((partner) => partner.provider === "optum");
  const availityDemo = overview?.validationPartners?.find((partner) => partner.provider === "availity");
  const integrationReady = Boolean(integration?.liveSubmissionEnabled);

  const metrics = [
    { label: "Open claims", value: overviewMetrics?.openClaims || 0, icon: FileCheck2, tone: "blue" },
    { label: "Open work items", value: overviewMetrics?.openWorkItems || 0, icon: ListChecks, tone: "violet" },
    { label: "Revenue at risk", value: currency(overviewMetrics?.revenueAtRisk), icon: AlertTriangle, tone: "orange" },
    { label: "Underpayment opportunity", value: currency(overviewMetrics?.underpaymentOpportunity), icon: DollarSign, tone: "green" },
  ];

  return (
    <div className="ri-page">
      <section className="ri-hero">
        <div>
          <span className="ri-eyebrow"><CircleDollarSign size={16} /> Revenue Integrity</span>
          <h1>Follow every claim to the correct payment.</h1>
          <p>One traceable workflow for claim readiness, clearinghouse responses, denials, appeals and payment accuracy.</p>
        </div>
        <div className="ri-hero-status">
          <span className={integrationReady ? "is-ready" : "is-onboarding"}>
            {integrationReady ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
            {integrationReady ? "Production connected" : "Production onboarding"}
          </span>
          <small>{organization?.name || "Loading organization…"}</small>
        </div>
      </section>

      <section className="ri-metrics" aria-label="Revenue Integrity metrics">
        {metrics.map((metric) => (
          <article key={metric.label} data-tone={metric.tone}>
            <span><metric.icon size={18} /></span>
            <div><strong>{metric.value}</strong><p>{metric.label}</p></div>
          </article>
        ))}
      </section>

      <section className="ri-control-panel">
        <div className="ri-tabs" role="tablist" aria-label="Revenue Integrity views">
          <button type="button" className={view === "claims" ? "is-active" : ""} onClick={() => setView("claims")}>Claims</button>
          <button type="button" className={view === "work" ? "is-active" : ""} onClick={() => setView("work")}>Work queue</button>
          <button type="button" className={view === "integration" ? "is-active" : ""} onClick={() => setView("integration")}>Integration readiness</button>
        </div>
        <div className="ri-controls">
          {view !== "integration" ? (
            <label>
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search claim, patient, payer…" />
            </label>
          ) : null}
          <button type="button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? "ri-spin" : ""} /> Refresh</button>
        </div>
      </section>

      {error ? (
        <section className="ri-error"><AlertTriangle size={18} /><div><strong>Revenue Integrity is not available</strong><p>{error instanceof Error ? error.message : "The request failed."}</p></div></section>
      ) : null}

      {selectedClaimId ? (
        <section ref={claimDetailRef} className="ri-card ri-claim-detail" aria-label="Claim review">
          <header>
            <div>
              <span className="ri-detail-kicker">Claim review</span>
              <h2>{detailQuery.data?.claim.patientControlNumber || "Loading claim..."}</h2>
              <p>Trace the validated claim through submission, acknowledgement and remittance.</p>
            </div>
            <div className="ri-detail-actions">
              {detailQuery.data && ["draft", "needs_review", "ready", "rejected"].includes(detailQuery.data.claim.status) && !isCorrecting ? (
                <button type="button" className="ri-primary-action" onClick={beginClaimCorrection} disabled={claimAction.state === "running"}><PencilLine size={15} /> {detailQuery.data.workItems.some((item) => item.issueCode.startsWith("OPTUM_VALIDATION_") && ["open", "blocked", "in_progress"].includes(item.status)) ? "Resolve Optum edit" : "Correct claim"}</button>
              ) : null}
              {detailQuery.data && (detailQuery.data.claim.clearinghouseProvider === "optum" || detailQuery.data.transmission?.schemaVersion.startsWith("optum-")) && !isCorrecting ? (
                <button type="button" className="ri-primary-action" onClick={revalidateSelectedClaim} disabled={claimAction.state === "running"}><PlayCircle size={15} /> {claimAction.state === "running" ? "Revalidating..." : "Revalidate"}</button>
              ) : null}
              <button type="button" className="ri-detail-close" onClick={() => { setSelectedClaimId(null); setIsCorrecting(false); setClaimAction({ state: "idle" }); }} aria-label="Close claim review"><X size={18} /></button>
            </div>
          </header>
          {detailQuery.isLoading ? <div className="ri-detail-loading">Loading the claim evidence and transaction history...</div> : null}
          {detailQuery.error ? <div className="ri-detail-loading is-error">{detailQuery.error instanceof Error ? detailQuery.error.message : "Claim review failed."}</div> : null}
          {claimAction.message ? <div className={`ri-claim-action-message is-${claimAction.state}`}>{claimAction.state === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}<span>{claimAction.message}</span></div> : null}
          {detailQuery.data && !isCorrecting && detailQuery.data.workItems.some((item) => item.issueCode.startsWith("OPTUM_VALIDATION_") && ["open", "blocked", "in_progress"].includes(item.status)) ? (
            <div className="ri-resolution-banner">
              <div>
                <span>Action required</span>
                <strong>Resolve the Optum 837P edit</strong>
                <p>Open the controlled correction workspace, apply the synthetic correction, and revalidate the claim in one guided flow.</p>
              </div>
              <button type="button" onClick={beginClaimCorrection} disabled={claimAction.state === "running"}>
                <PencilLine size={15} /> {claimAction.state === "running" ? "Opening..." : "Correct & revalidate"}
              </button>
            </div>
          ) : null}
          {detailQuery.data && isCorrecting ? (
            <RevenueClaimCorrection
              key={`${detailQuery.data.claim.id}-${detailQuery.data.claim.version}`}
              detail={detailQuery.data}
              onCancel={() => setIsCorrecting(false)}
              onSaved={async (message) => {
                setIsCorrecting(false);
                setClaimAction({ state: "success", message });
                await refreshClaim();
              }}
            />
          ) : detailQuery.data ? (
            <>
              <div className="ri-detail-summary">
                <div><span>Status</span><strong className={`ri-status status-${detailQuery.data.claim.status}`}>{label(detailQuery.data.claim.status)}</strong></div>
                <div><span>Total charge</span><strong>{currency(detailQuery.data.claim.totalCharge)}</strong></div>
                <div><span>Paid</span><strong>{currency(detailQuery.data.claim.paidAmount)}</strong></div>
                <div><span>Integrity</span><strong>{detailQuery.data.claim.integrityScore}%</strong></div>
                <div><span>837P profile</span><strong>{detailQuery.data.transmission?.verifiedAt ? "Verified" : "Pending"}</strong></div>
              </div>
              <div className="ri-detail-grid">
                <article>
                  <h3>Service lines</h3>
                  {detailQuery.data.lines.map((line) => (
                    <div className="ri-detail-row" key={line.id}>
                      <span>Line {line.lineNumber} · {line.procedureCode}{line.modifiers.length ? `-${line.modifiers.join("-")}` : ""}</span>
                      <strong>{currency(line.paidAmount)} / {currency(line.chargeAmount)}</strong>
                    </div>
                  ))}
                </article>
                <article>
                  <h3>Clearinghouse activity</h3>
                  {detailQuery.data.submissions.length ? detailQuery.data.submissions.map((submission) => (
                    <div className="ri-detail-row" key={submission.id}>
                      <span>{label(submission.mode)} submission</span><strong>{label(submission.status)}</strong>
                    </div>
                  )) : <p className="ri-detail-empty">No submissions recorded.</p>}
                  {detailQuery.data.remittances.map((remittance) => (
                    <div className="ri-detail-row" key={remittance.id}>
                      <span>835 remittance · {remittance.payerClaimControlNumber || "Payer reference pending"}</span><strong>{currency(remittance.paidAmount)}</strong>
                    </div>
                  ))}
                </article>
                  <article className="ri-evidence-tasks">
                    <h3>Evidence and tasks</h3>
                    <div className="ri-detail-row"><span>Diagnosis evidence</span><strong>{detailQuery.data.claim.diagnosisCodes.join(", ")}</strong></div>
                    <div className="ri-detail-row"><span>Evidence links</span><strong>{detailQuery.data.evidence.length}</strong></div>
                    <div className="ri-detail-row"><span>Open integrity tasks</span><strong>{detailQuery.data.workItems.filter((item) => ["open", "in_progress", "blocked"].includes(item.status)).length}</strong></div>
                    <div className="ri-detail-task-list">
                      {detailQuery.data.workItems.filter((item) => ["open", "in_progress", "blocked"].includes(item.status)).map((item) => (
                        <div className="ri-detail-task" key={item.id}>
                          <div>
                            <span>{label(item.status)} · {label(item.severity)}</span>
                            <strong>{item.title}</strong>
                            <p>{item.recommendedAction}</p>
                          </div>
                          {item.status !== "in_progress" ? (
                            <button type="button" onClick={() => startWorkItem(item.id, detailQuery.data!.claim.id)} disabled={workActionId === item.id}>
                              <PlayCircle size={14} /> {workActionId === item.id ? "Starting..." : "Start"}
                            </button>
                          ) : <span className="ri-task-active">In progress</span>}
                        </div>
                      ))}
                    </div>
                  </article>
                <article>
                  <h3>Timeline</h3>
                  {detailQuery.data.events.slice(0, 6).map((event) => (
                    <div className="ri-detail-row" key={event.id}>
                      <span>{label(event.eventType)} · {event.source}</span><strong>{new Date(event.occurredAt).toLocaleDateString()}</strong>
                    </div>
                  ))}
                </article>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {!error && view === "claims" ? (
        <section className="ri-card">
          <header><div><h2>Claim lifecycle</h2><p>Professional claims ordered by risk and most recent activity.</p></div><span>{claims.length} claims</span></header>
          {claims.length ? (
            <div className="ri-table-wrap">
              <table>
                <thead><tr><th>Claim</th><th>Patient</th><th>Payer</th><th>Status</th><th>Integrity</th><th>Open tasks</th><th>Charge</th></tr></thead>
                <tbody>{claims.map((claim) => (
                  <tr key={claim.id}>
                    <td><button type="button" className="ri-claim-link" onClick={() => openCertifiedClaim(claim.id)}><strong>{claim.patientControlNumber}</strong><small>{claim.serviceFrom}</small></button></td>
                    <td>{claim.patientName || "Patient linked by source system"}</td>
                    <td>{claim.payerName}</td>
                    <td><span className={`ri-status status-${claim.status}`}>{label(claim.status)}</span></td>
                    <td><strong>{claim.integrityScore}%</strong><small>{label(claim.riskLevel)} risk</small></td>
                    <td>{claim.openWorkItems}</td>
                    <td><strong>{currency(claim.totalCharge)}</strong></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState mode="claims" />}
        </section>
      ) : null}

      {!error && view === "work" ? (
        <section className="ri-card">
          <header><div><h2>Prioritized work queue</h2><p>Tasks ranked by severity, financial exposure, deadline and confidence.</p></div><span>{workItems.length} open</span></header>
          {workItems.length ? (
            <div className="ri-work-list">{workItems.map((item) => (
              <article key={item.id} data-severity={item.severity}>
                <div className="ri-priority"><strong>{item.priorityScore}</strong><span>Priority</span></div>
                <div className="ri-work-copy"><span>{label(item.category)} · {item.payerName}</span><h3>{item.title}</h3><p>{item.recommendedAction}</p><small>Claim {item.patientControlNumber}</small></div>
                <div className="ri-work-value">
                  <strong>{currency(item.recoverableAmount)}</strong>
                  <span>{label(item.severity)}</span>
                  <button type="button" onClick={() => item.status === "in_progress" ? openCertifiedClaim(item.claimId) : startWorkItem(item.id, item.claimId)} disabled={workActionId === item.id}>
                    {workActionId === item.id ? "Starting..." : item.status === "in_progress" ? "Open claim" : "Start task"}
                  </button>
                </div>
              </article>
            ))}</div>
          ) : <EmptyState mode="work" />}
        </section>
      ) : null}

      {!error && view === "integration" ? (
        <section className="ri-integration-grid">
          <article className="ri-card ri-connection-card">
            <header><div><h2>Clearinghouse connection</h2><p>Vendor-neutral adapter with Stedi as the first production connector.</p></div><ShieldCheck size={20} /></header>
            <div className="ri-connection-state">
              <span className={integrationReady ? "is-ready" : "is-onboarding"}>{integration?.status ? label(integration.status) : "Not configured"}</span>
              <dl>
                <div><dt>Provider</dt><dd>{integration?.provider || "Stedi"}</dd></div>
                <div><dt>Mode</dt><dd>{label(integration?.mode || "not_configured")}</dd></div>
                <div><dt>Credentials</dt><dd>{integration?.credentialsConfigured ? "Configured" : "Pending"}</dd></div>
                <div><dt>Test submissions</dt><dd>{integration?.testSubmissionEnabled ? "Enabled" : "Locked"}</dd></div>
                <div><dt>Live submission</dt><dd>{integrationReady ? "Enabled" : "Locked"}</dd></div>
                <div><dt>Certification submissions</dt><dd>{integration?.operations?.testSubmissions || 0}</dd></div>
                <div><dt>Webhook queue</dt><dd>{integration?.operations?.queuedWebhooks || 0} queued · {integration?.operations?.failedWebhooks || 0} failed</dd></div>
              </dl>
            </div>
          </article>
          <article className="ri-card ri-connection-card">
            <header><div><h2>Optum sandbox validation</h2><p>Free synthetic 837P validation with payer submission disabled.</p></div><ShieldCheck size={20} /></header>
            <div className="ri-connection-state">
              <span className={optumValidator?.validationEnabled ? "is-ready" : "is-onboarding"}>
                {optumValidator?.validationEnabled ? "Validation ready" : "Validation onboarding"}
              </span>
              <dl>
                <div><dt>Environment</dt><dd>{label(optumValidator?.environment || "sandbox")}</dd></div>
                <div><dt>Credentials</dt><dd>{optumValidator?.credentialsConfigured ? "Configured" : "Pending"}</dd></div>
                <div><dt>837P validation</dt><dd>{optumValidator?.validationEnabled ? "Enabled" : "Locked"}</dd></div>
                <div><dt>Claim submission</dt><dd>Disabled</dd></div>
                <div><dt>Data policy</dt><dd>Synthetic only</dd></div>
              </dl>
              <div className="ri-connection-test">
                <button type="button" onClick={testOptumConnection} disabled={!optumValidator?.validationEnabled || optumHealth.state === "testing"}>
                  {optumHealth.state === "testing" ? "Testing…" : "Test sandbox connection"}
                </button>
                {optumHealth.state !== "idle" && optumHealth.state !== "testing" ? (
                  <small className={optumHealth.state === "success" ? "is-success" : "is-error"}>{optumHealth.message}</small>
                ) : null}
              </div>
              <div className="ri-certification-panel">
                <div>
                  <strong>837P certification cases</strong>
                  <p>Creates only published-style synthetic data, validates it through Optum, and records the response in the claim timeline.</p>
                </div>
                <div className="ri-certification-actions">
                  <button
                    type="button"
                    onClick={() => runOptumCertification("success")}
                    disabled={!optumValidator?.validationEnabled || optumCertification.state === "running"}
                  >
                    {optumCertification.state === "running" && optumCertification.scenario === "success" ? "Running clean case..." : "Run clean claim"}
                  </button>
                  <button
                    type="button"
                    className="is-secondary"
                    onClick={() => runOptumCertification("edits")}
                    disabled={!optumValidator?.validationEnabled || optumCertification.state === "running"}
                  >
                    {optumCertification.state === "running" && optumCertification.scenario === "edits" ? "Running edit case..." : "Run edit-response claim"}
                  </button>
                </div>
                {optumCertification.state === "complete" && optumCertification.result ? (
                  <div className={`ri-certification-result ${optumCertification.result.valid ? "is-valid" : "has-edits"}`}>
                    <span>{optumCertification.result.valid ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span>
                    <div>
                      <strong>{optumCertification.result.valid ? "Optum validation passed" : `${optumCertification.result.edits.length} Optum edit${optumCertification.result.edits.length === 1 ? "" : "s"} returned`}</strong>
                      <p>Claim {optumCertification.result.patientControlNumber} · {optumCertification.result.status}{optumCertification.result.correlationId ? ` · Correlation ${optumCertification.result.correlationId}` : ""}</p>
                      {optumCertification.result.edits.slice(0, 3).map((edit, index) => (
                        <small key={`${edit.field}-${index}`}>{edit.field}: {edit.description}</small>
                      ))}
                    </div>
                    <button type="button" onClick={() => openCertifiedClaim(optumCertification.result!.claimId)}>Open claim</button>
                  </div>
                ) : null}
                {optumCertification.state === "error" ? <small className="ri-certification-error">{optumCertification.message}</small> : null}
              </div>
            </div>
          </article>
          <article className="ri-card ri-connection-card">
            <header>
              <div>
                <h2>Availity API Demo</h2>
                <p>OAuth and payer-directory connectivity with predefined transaction scenarios only.</p>
              </div>
              <ShieldCheck size={20} />
            </header>
            <div className="ri-connection-state">
              <span className={availityDemo?.validationEnabled ? "is-ready" : "is-onboarding"}>
                {availityDemo?.validationEnabled ? "Demo ready" : "Demo onboarding"}
              </span>
              <dl>
                <div><dt>Environment</dt><dd>Demo</dd></div>
                <div><dt>Credentials</dt><dd>{availityDemo?.credentialsConfigured ? "Configured" : "Pending"}</dd></div>
                <div><dt>OAuth and payer directory</dt><dd>{availityDemo?.validationEnabled ? "Enabled" : "Locked"}</dd></div>
                <div><dt>Claim status</dt><dd>Predefined scenarios</dd></div>
                <div><dt>Claim submission</dt><dd>Unavailable</dd></div>
                <div><dt>Data policy</dt><dd>Predefined demo data only</dd></div>
              </dl>
              <div className="ri-connection-test">
                <button type="button" onClick={testAvailityConnection} disabled={!availityDemo?.validationEnabled || availityHealth.state === "testing"}>
                  {availityHealth.state === "testing" ? "Testing…" : "Test Availity connection"}
                </button>
                {availityHealth.state !== "idle" && availityHealth.state !== "testing" ? (
                  <small className={availityHealth.state === "success" ? "is-success" : "is-error"}>{availityHealth.message}</small>
                ) : null}
              </div>
              <div className="ri-certification-panel">
                <strong>Free Demo safety boundary</strong>
                <p>Codical does not send PHI or live claims through this connector. Transaction calls remain locked until an exact Availity predefined scenario is implemented and tested.</p>
              </div>
            </div>
          </article>
          <article className="ri-card ri-readiness-card">
            <header><div><h2>Production activation gates</h2><p>Live claims cannot be released until every control is complete.</p></div></header>
            <ol>
              {[
                "Execute clearinghouse agreement and BAA",
                "Create restricted production API credentials",
                "Enroll billing providers for 837P and 835",
                "Configure authenticated and idempotent webhooks",
                "Pass 277CA and 835 certification cases",
                "Approve controlled live submission policy",
              ].map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}
            </ol>
          </article>
          <article className="ri-card ri-safety-card">
            <ShieldCheck size={20} />
            <div><h3>Live-submit safety lock</h3><p>Production submission requires both an organization approval and the server-side <code>REVENUE_INTEGRITY_LIVE_SUBMISSION_ENABLED</code> control. UI actions alone cannot bypass it.</p></div>
          </article>
          <EmptyState mode="integration" />
        </section>
      ) : null}
    </div>
  );
}

export default RevenueIntegrity;
