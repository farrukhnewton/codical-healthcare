import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, BadgeDollarSign, CheckCircle2, Clock3, FileCheck2, Gavel, History, Loader2, PlayCircle, ShieldCheck } from "lucide-react";
import type { DenialActionInput, DenialDemoInput } from "@shared/revenue-cycle";
import { revenueCycleRequest, type RevenueDenialCase } from "@/lib/revenue-cycle-api";

type DenialList = { cases: RevenueDenialCase[]; metrics: { total: number; open: number; submitted: number; overturned: number; amountAtRisk: number } };
const money = (value: string | number | null) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const scenarios: Array<{ id: DenialDemoInput["scenario"]; title: string; copy: string }> = [
  { id: "minor_coding_error", title: "Minor coding error", copy: "Routes a missing-modifier clerical issue to reopening, not a formal appeal." },
  { id: "medical_necessity", title: "Medical necessity", copy: "Builds a first-level redetermination case with evidence and deadline controls." },
  { id: "duplicate_dispute", title: "Duplicate dispute", copy: "Verifies whether the service is truly duplicate before choosing closure or appeal." },
];

export function DenialsAppeals() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["revenue-cycle", "denials"], queryFn: () => revenueCycleRequest<DenialList>("/api/revenue-cycle/denials") });
  const cases = query.data?.cases || [];
  const current = cases.find((item) => item.id === selectedId) || cases[0] || null;
  const metrics = query.data?.metrics || { total: 0, open: 0, submitted: 0, overturned: 0, amountAtRisk: 0 };
  const daysLeft = useMemo(() => current?.filingDeadline ? Math.ceil((new Date(`${current.filingDeadline}T23:59:59Z`).getTime() - Date.now()) / 86400000) : null, [current]);

  async function createCase(scenario: DenialDemoInput["scenario"]) {
    setRunning(scenario); setError("");
    try {
      const result = await revenueCycleRequest<{ denialId: string }>("/api/revenue-cycle/denials/demo", { method: "POST", body: JSON.stringify({ scenario, dataClassification: "synthetic" } satisfies DenialDemoInput) });
      await query.refetch(); setSelectedId(result.denialId); setNote("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The denial case could not be created."); }
    finally { setRunning(""); }
  }

  async function act(action: DenialActionInput["action"]) {
    if (!current) return;
    setRunning(action); setError("");
    try {
      await revenueCycleRequest(`/api/revenue-cycle/denials/${current.id}/action`, { method: "POST", body: JSON.stringify({ action, note } satisfies DenialActionInput) });
      setNote(""); await query.refetch();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The denial action could not be saved."); }
    finally { setRunning(""); }
  }

  const actions: DenialActionInput["action"][] = current?.status === "evidence_needed" ? ["add_evidence"] : current?.status === "evidence_added" ? ["add_evidence", "mark_ready"] : current?.status === "ready" ? ["submit"] : current?.status === "submitted" ? ["overturn", "uphold"] : [];

  return <div className="rc-page rc-denials-page">
    <section className="rc-sandbox-banner" role="status"><ShieldCheck size={17}/><div><strong>Controlled denial sandbox</strong><span>Synthetic Medicare-style cases only. Submission records stay inside Codical and are never sent to a payer.</span></div></section>
    <header className="rc-workspace-header"><div><Link href="/revenue-cycle"><ArrowLeft size={15}/> Revenue Cycle</Link><span className="rc-eyebrow"><Gavel size={16}/> Denials &amp; Appeals</span><h1>Choose the right response before the deadline.</h1><p>Translate remittance codes into a reopening, redetermination, or duplicate-review pathway; assemble evidence; and preserve a complete action timeline.</p></div><div className="rc-workspace-stats"><span><strong>{metrics.open}</strong> Open</span><span><strong>{metrics.submitted}</strong> Submitted</span><span><strong>{money(metrics.amountAtRisk)}</strong> At risk</span></div></header>

    <section className="rc-denial-metrics"><article><BadgeDollarSign/><span>Total cases</span><strong>{metrics.total}</strong></article><article><AlertTriangle/><span>Open cases</span><strong>{metrics.open}</strong></article><article><FileCheck2/><span>Submitted</span><strong>{metrics.submitted}</strong></article><article><CheckCircle2/><span>Overturned</span><strong>{metrics.overturned}</strong></article></section>

    <div className="rc-denial-layout">
      <section className="rc-card rc-denial-builder"><header><div><span>Certification scenarios</span><h2>Create a denial case</h2></div><Gavel size={22}/></header><p className="rc-card-intro">The routing engine keeps minor corrections out of the formal appeal queue and tracks the evidence and deadlines required for true coverage disputes.</p><div className="rc-denial-scenarios">{scenarios.map((scenario) => <article key={scenario.id}><div><strong>{scenario.title}</strong><p>{scenario.copy}</p></div><button type="button" disabled={Boolean(running)} onClick={() => createCase(scenario.id)}>{running === scenario.id ? <Loader2 className="rc-spin" size={15}/> : <PlayCircle size={15}/>} Run</button></article>)}</div>{error ? <div className="rc-inline-error"><AlertTriangle size={15}/>{error}</div> : null}</section>

      <section className="rc-card rc-denial-detail" aria-live="polite"><header><div><span>Case workspace</span><h2>{current?.patientControlNumber || "No denial case selected"}</h2></div>{current ? <span className="rc-case-status" data-status={current.status}>{label(current.status)}</span> : <ShieldCheck/>}</header>{!current ? <div className="rc-empty"><Gavel size={30}/><strong>Run the first synthetic denial case</strong><p>Routing, evidence requirements, deadlines, and actions will appear here.</p></div> : <>
        <div className="rc-denial-summary"><div><span>Pathway</span><strong>{label(current.pathway)}</strong></div><div><span>Adjustment</span><strong>{current.groupCode}-{current.carc}{current.rarcs.length ? ` / ${current.rarcs.join(", ")}` : ""}</strong></div><div><span>Amount at risk</span><strong>{money(current.amountAtRisk)}</strong></div><div><span>Filing deadline</span><strong>{current.filingDeadline || "No formal appeal deadline"}</strong></div></div>
        <div className="rc-denial-reason"><AlertTriangle size={18}/><div><strong>{current.denialReason}</strong><p>{current.normalizedCase.routing.rationale}</p></div></div>
        {daysLeft !== null ? <div className="rc-deadline"><Clock3 size={17}/><strong>{daysLeft} days remaining</strong><span>Includes CMS's presumed 5-day notice receipt period for this synthetic first-level case.</span></div> : null}
        <div className="rc-evidence-grid"><article><span>Required evidence</span>{current.requiredEvidence.map((item) => <p key={item}><FileCheck2 size={14}/>{item}</p>)}</article><article><span>Recommended next action</span><strong>{current.normalizedCase.routing.nextAction}</strong>{current.evidenceNotes.length ? <small>{current.evidenceNotes.length} evidence note(s) recorded</small> : null}</article></div>
        {actions.length ? <div className="rc-denial-action"><label htmlFor="denial-note">Action note</label><textarea id="denial-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Document the evidence, review, submission, or payer determination..."/><div>{actions.map((action) => <button type="button" key={action} disabled={note.trim().length < 10 || Boolean(running)} onClick={() => act(action)}>{running === action ? <Loader2 className="rc-spin" size={14}/> : <PlayCircle size={14}/>} {label(action)}</button>)}</div></div> : <div className="rc-case-complete"><CheckCircle2 size={17}/>{current.status === "overturned" ? "Denial overturned and claim marked paid." : "Payer determination recorded."}</div>}
        <div className="rc-denial-timeline"><span>Case timeline</span>{current.events.map((event) => <article key={event.id}><i/><div><strong>{label(event.action)}</strong><p>{event.note}</p></div><small>{new Date(event.createdAt).toLocaleString()}</small></article>)}</div>
      </>}</section>
    </div>

    <section className="rc-card rc-history"><header><div><span>Denial register</span><h2>Saved cases</h2></div><History size={20}/></header>{cases.length ? <div className="rc-history-list">{cases.map((item) => <button type="button" key={item.id} className={current?.id === item.id ? "is-active" : ""} onClick={() => { setSelectedId(item.id); setNote(""); }}><span data-status={item.status}>{label(item.status)}</span><strong>{item.patientControlNumber}</strong><em>{label(item.pathway)} / {money(item.amountAtRisk)}</em><small>{new Date(item.createdAt).toLocaleString()}</small></button>)}</div> : <div className="rc-empty compact"><History size={24}/><strong>No saved denial cases</strong></div>}</section>
  </div>;
}

export default DenialsAppeals;
