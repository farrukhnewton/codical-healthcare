import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDollarSign, History, Landmark, Loader2, PlayCircle, ShieldCheck } from "lucide-react";
import type { PaymentDemoInput } from "@shared/revenue-cycle";
import { revenueCycleRequest, type RevenuePayment } from "@/lib/revenue-cycle-api";

type PaymentList = { remittances: RevenuePayment[]; metrics: { total: number; paidAmount: number; exceptions: number; unmatched: number } };
const money = (value: string | number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const scenarios: Array<{ id: PaymentDemoInput["scenario"]; title: string; description: string }> = [
  { id: "clean_payment", title: "Balanced payment", description: "Payment, contractual adjustment, and patient responsibility balance to the charge." },
  { id: "payment_variance", title: "Payment variance", description: "Creates an unexplained balance that must be held from automatic posting." },
  { id: "denied_claim", title: "Denied claim", description: "Uses explicit 835 claim status and CO-16 to route a denial work item." },
];

export function PaymentsRemittances() {
  const [selected, setSelected] = useState<RevenuePayment | null>(null);
  const [running, setRunning] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["revenue-cycle", "payments"],
    queryFn: () => revenueCycleRequest<PaymentList>("/api/revenue-cycle/payments"),
  });
  const payments = query.data?.remittances || [];
  const current = selected ? payments.find((item) => item.id === selected.id) || selected : payments[0] || null;
  const metrics = query.data?.metrics || { total: 0, paidAmount: 0, exceptions: 0, unmatched: 0 };
  const adjustmentTotal = useMemo(() => current?.lines.reduce((total, line) => total + (line.adjustments || []).reduce((sum, item) => sum + Number(item.amount), 0), 0) || 0, [current]);

  async function runScenario(scenario: PaymentDemoInput["scenario"]) {
    setRunning(scenario);
    setError("");
    try {
      const result = await revenueCycleRequest<{ remittanceId: number }>("/api/revenue-cycle/payments/demo", {
        method: "POST",
        body: JSON.stringify({ scenario, dataClassification: "synthetic" } satisfies PaymentDemoInput),
      });
      const refreshed = await query.refetch();
      setSelected(refreshed.data?.remittances.find((item) => item.id === result.remittanceId) || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The synthetic 835 could not be processed.");
    } finally {
      setRunning("");
    }
  }

  async function reconcile() {
    if (!current) return;
    setRunning("reconcile");
    setError("");
    try {
      await revenueCycleRequest(`/api/revenue-cycle/payments/${current.id}/reconcile`, { method: "PATCH", body: JSON.stringify({ note }) });
      setNote("");
      await query.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The ERA could not be reconciled.");
    } finally {
      setRunning("");
    }
  }

  return <div className="rc-page rc-payments-page">
    <section className="rc-sandbox-banner" role="status"><ShieldCheck size={17}/><div><strong>Controlled 835 sandbox</strong><span>Synthetic payment data only. Live ERA enrollment and polling remain locked until production credentials are approved.</span></div></section>
    <header className="rc-workspace-header">
      <div><Link href="/revenue-cycle"><ArrowLeft size={15}/> Revenue Cycle</Link><span className="rc-eyebrow"><Landmark size={16}/> Payments &amp; Remittances</span><h1>Turn every ERA into a balanced posting decision.</h1><p>Normalize 835 payment facts, explain CARC groups, reconcile service lines, and route payment variances or denials to the right work queue.</p></div>
      <div className="rc-workspace-stats"><span><strong>{metrics.total}</strong> ERAs</span><span><strong>{money(metrics.paidAmount)}</strong> Paid</span><span><strong>{metrics.exceptions}</strong> Exceptions</span></div>
    </header>

    <section className="rc-payment-metrics">
      <article><CircleDollarSign/><span>Payment total</span><strong>{money(metrics.paidAmount)}</strong></article>
      <article><CheckCircle2/><span>Balanced</span><strong>{payments.filter((item) => Number(item.reconciliationVariance) === 0 && item.claimStatusCode !== "4").length}</strong></article>
      <article><AlertTriangle/><span>Needs action</span><strong>{metrics.exceptions}</strong></article>
      <article><History/><span>Unmatched</span><strong>{metrics.unmatched}</strong></article>
    </section>

    <div className="rc-payment-layout">
      <section className="rc-card rc-payment-builder">
        <header><div><span>Certification scenarios</span><h2>Process a synthetic 835</h2></div><Landmark size={22}/></header>
        <p className="rc-card-intro">Each case creates a synthetic claim, service line, ERA, adjustment trail, and—when needed—an exception work item. No patient data is accepted.</p>
        <div className="rc-payment-scenarios">{scenarios.map((scenario) => <article key={scenario.id}><div><strong>{scenario.title}</strong><p>{scenario.description}</p></div><button type="button" onClick={() => runScenario(scenario.id)} disabled={Boolean(running)}>{running === scenario.id ? <Loader2 className="rc-spin" size={15}/> : <PlayCircle size={15}/>} Run</button></article>)}</div>
        {error ? <div className="rc-inline-error"><AlertTriangle size={15}/>{error}</div> : null}
      </section>

      <section className="rc-card rc-payment-detail" aria-live="polite">
        <header><div><span>Reconciliation detail</span><h2>{current?.patientControlNumber || "No ERA selected"}</h2></div>{current?.reconciliationStatus === "exception" ? <AlertTriangle className="is-error"/> : current ? <CheckCircle2 className="is-success"/> : <ShieldCheck/>}</header>
        {!current ? <div className="rc-empty"><Landmark size={30}/><strong>Run the first synthetic remittance</strong><p>Payment, adjustment, variance, and posting guidance will appear here.</p></div> : <>
          <div className="rc-payment-status"><span data-status={current.reconciliationStatus}>{label(current.reconciliationStatus)}</span><small>{current.payerName} / {current.paymentReference}</small></div>
          <div className="rc-payment-totals">
            <div><span>Charge</span><strong>{money(current.totalCharge)}</strong></div><div><span>Allowed</span><strong>{money(current.lines[0]?.allowedAmount)}</strong></div><div><span>Paid</span><strong>{money(current.paidAmount)}</strong></div><div><span>Adjustments</span><strong>{money(adjustmentTotal)}</strong></div><div><span>Patient responsibility</span><strong>{money(current.patientResponsibilityAmount)}</strong></div><div><span>Variance</span><strong className={Number(current.reconciliationVariance) ? "is-danger" : "is-good"}>{money(current.reconciliationVariance)}</strong></div>
          </div>
          <div className="rc-payment-guidance"><strong>{current.summary?.reconciliation?.explanation || "ERA reconciliation completed."}</strong><p>{current.summary?.reconciliation?.nextAction}</p></div>
          <div className="rc-payment-lines"><div className="rc-payment-line-head"><span>Service / CARC</span><span>Charge</span><span>Allowed</span><span>Paid</span></div>{current.lines.map((line) => <article key={line.id}><div><strong>{line.procedureCode}</strong><small>{line.lineItemControlNumber}</small>{(line.adjustments || []).map((adjustment) => <em key={`${adjustment.groupCode}-${adjustment.reasonCode}`}>{adjustment.groupCode}-{adjustment.reasonCode}: {adjustment.description} ({money(adjustment.amount)})</em>)}</div><span>{money(line.chargeAmount)}</span><span>{money(line.allowedAmount)}</span><span>{money(line.paidAmount)}</span></article>)}</div>
          {Number(current.reconciliationVariance) === 0 && current.claimStatusCode !== "4" && current.reconciliationStatus !== "reconciled" ? <div className="rc-reconcile-box"><label htmlFor="reconcile-note">Reviewer note</label><textarea id="reconcile-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Confirm the payment and adjustments were reviewed..."/><button className="rc-primary" type="button" disabled={running === "reconcile" || note.trim().length < 10} onClick={reconcile}>{running === "reconcile" ? <Loader2 className="rc-spin" size={15}/> : <CheckCircle2 size={15}/>} Mark reconciled</button></div> : null}
          {current.reconciliationStatus === "reconciled" ? <div className="rc-reconciled"><CheckCircle2 size={17}/> Reconciled {current.reconciledAt ? new Date(current.reconciledAt).toLocaleString() : ""}</div> : null}
        </>}
      </section>
    </div>

    <section className="rc-card rc-history"><header><div><span>ERA register</span><h2>Saved remittances</h2></div><History size={20}/></header>{query.error ? <div className="rc-inline-error"><AlertTriangle size={15}/>{query.error instanceof Error ? query.error.message : "Remittances failed to load."}</div> : null}{payments.length ? <div className="rc-history-list">{payments.map((item) => <button type="button" key={item.id} className={current?.id === item.id ? "is-active" : ""} onClick={() => setSelected(item)}><span data-status={item.reconciliationStatus}>{label(item.reconciliationStatus)}</span><strong>{item.patientControlNumber}</strong><em>{item.payerName} / {money(item.paidAmount)}</em><small>{new Date(item.receivedAt).toLocaleString()}</small></button>)}</div> : <div className="rc-empty compact"><History size={24}/><strong>No saved remittances</strong></div>}</section>
  </div>;
}

export default PaymentsRemittances;
