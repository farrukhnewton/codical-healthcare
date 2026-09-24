import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, FileSearch,
  History, Loader2, PlayCircle, ReceiptText, ShieldCheck,
} from "lucide-react";
import type { ClaimStatusInquiryInput } from "@shared/revenue-cycle";
import { revenueCycleRequest, type RevenueClaimStatusInquiry } from "@/lib/revenue-cycle-api";

const request: ClaimStatusInquiryInput = { scenario: "standard_complete", dataClassification: "synthetic" };
const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: string | number | null) => value === null
  ? "—"
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));

export function ClaimStatus() {
  const [selected, setSelected] = useState<RevenueClaimStatusInquiry | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["revenue-cycle", "claim-status"],
    queryFn: () => revenueCycleRequest<{ inquiries: RevenueClaimStatusInquiry[] }>("/api/revenue-cycle/claim-status"),
  });
  const inquiries = query.data?.inquiries || [];
  const current = selected || inquiries[0] || null;
  const counts = useMemo(() => ({
    open: inquiries.filter((item) => item.status === "received" || item.status === "processing").length,
    resolved: inquiries.filter((item) => item.status === "paid" || item.status === "denied").length,
  }), [inquiries]);

  async function runInquiry() {
    setRunning(true);
    setError("");
    try {
      const result = await revenueCycleRequest<{ inquiry: RevenueClaimStatusInquiry }>("/api/revenue-cycle/claim-status/check", {
        method: "POST",
        body: JSON.stringify(request),
      });
      setSelected(result.inquiry);
      await query.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Claim status inquiry failed.");
    } finally {
      setRunning(false);
    }
  }

  return <div className="rc-page rc-claim-status-page">
    <section className="rc-sandbox-banner" role="status"><ShieldCheck size={17}/><div><strong>Availity demo environment</strong><span>Fixed synthetic 276/277 data only. No patient or claim information can be entered.</span></div></section>
    <header className="rc-workspace-header">
      <div><Link href="/revenue-cycle"><ArrowLeft size={15}/> Revenue Cycle</Link><span className="rc-eyebrow"><FileSearch size={16}/> Claim Status</span><h1>Know where every claim stands.</h1><p>Send a controlled synthetic 276 inquiry, retrieve its 277 detail, and translate payer status codes into a biller-ready next action.</p></div>
      <div className="rc-workspace-stats"><span><strong>{inquiries.length}</strong> Inquiries</span><span><strong>{counts.open}</strong> Monitoring</span><span><strong>{counts.resolved}</strong> Resolved</span></div>
    </header>

    <div className="rc-eligibility-layout">
      <section className="rc-card rc-check-builder">
        <header><div><span>New inquiry</span><h2>Run the published demo transaction</h2></div><ReceiptText size={22}/></header>
        <p className="rc-card-intro">Codical sends Availity's fixed synthetic claim-status example. This validates OAuth, the standard transaction path, response retrieval, normalization, and audit persistence without accepting PHI.</p>
        <div className="rc-fixed-profile"><span>Transaction</span><strong>Standard HIPAA 276/277</strong><small>Availity Claim Statuses Demo · Florida Blue fixture</small></div>
        <button className="rc-primary" type="button" disabled={running} onClick={runInquiry}>{running ? <Loader2 size={16} className="rc-spin"/> : <PlayCircle size={16}/>} {running ? "Running 276/277 inquiry…" : "Run claim status inquiry"}</button>
        {error ? <div className="rc-inline-error"><AlertTriangle size={15}/>{error}</div> : null}
      </section>

      <section className="rc-card rc-result-panel" aria-live="polite">
        <header><div><span>Normalized 277 response</span><h2>{current ? current.claimNumberMasked : "No claim status response yet"}</h2></div>{current?.status === "paid" ? <CheckCircle2 className="is-success" size={24}/> : current?.status === "denied" ? <AlertTriangle className="is-error" size={24}/> : current ? <FileSearch className="is-pending" size={24}/> : <ShieldCheck size={24}/>}</header>
        {!current ? <div className="rc-empty"><FileSearch size={30}/><strong>Run the first synthetic inquiry</strong><p>The payer response, status codes, and recommended next action will appear here.</p></div> : <>
          <div className="rc-result-summary"><div><span>Workflow status</span><strong data-status={current.status}>{label(current.status)}</strong></div><div><span>Payer</span><strong>{current.payerName}</strong></div><div><span>Claim amount</span><strong>{money(current.claimAmount)}</strong></div><div><span>Service lines</span><strong>{current.response.claim.serviceLineCount}</strong></div></div>
          <div className="rc-status-action"><FileSearch size={18}/><div><span>Recommended next action</span><strong>{current.response.nextAction}</strong></div></div>
          <div className="rc-status-detail-list">{current.response.statusDetails.length ? current.response.statusDetails.map((detail, index) => <article key={`${detail.categoryCode}-${detail.statusCode}-${index}`}><div><span>{detail.categoryCode}</span><strong>{detail.category}</strong></div><div><span>{detail.statusCode}</span><strong>{detail.status}</strong></div><div><small>{detail.entity || "Claim"}{detail.entityCode ? ` (${detail.entityCode})` : ""}</small><strong>{detail.paymentAmount === null ? "No payment reported" : money(detail.paymentAmount)}</strong></div></article>) : <div className="rc-no-benefits"><AlertTriangle size={18}/><div><strong>No status detail rows returned</strong><p>Review the payer response and identifiers before retrying.</p></div></div>}</div>
          <footer className="rc-response-foot"><span>Response {current.responseId}</span><span>Mock verified: {current.response.mockVerified ? "Yes" : "No"}</span><span>{new Date(current.checkedAt).toLocaleString()}</span></footer>
        </>}
      </section>
    </div>

    <section className="rc-card rc-history"><header><div><span>Inquiry register</span><h2>Saved claim status checks</h2></div><History size={20}/></header>{query.error ? <div className="rc-inline-error"><AlertTriangle size={15}/>{query.error instanceof Error ? query.error.message : "History failed to load."}</div> : null}{inquiries.length ? <div className="rc-history-list">{inquiries.map((item) => <button type="button" key={item.id} className={current?.id === item.id ? "is-active" : ""} onClick={() => setSelected(item)}><span data-status={item.status}>{label(item.status)}</span><strong>{item.claimNumberMasked}</strong><em>{item.payerName} · {money(item.claimAmount)}</em><small>{new Date(item.checkedAt).toLocaleString()}</small></button>)}</div> : <div className="rc-empty compact"><History size={24}/><strong>No saved claim status inquiries</strong></div>}</section>
  </div>;
}

export default ClaimStatus;
