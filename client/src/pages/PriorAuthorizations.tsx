import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, FileCheck2, History, Loader2, PlayCircle, ShieldCheck } from "lucide-react";
import type { AuthorizationCheckInput } from "@shared/revenue-cycle";
import { revenueCycleRequest, type RevenueAuthorization } from "@/lib/revenue-cycle-api";

const initialInput: AuthorizationCheckInput = { scenario: "approved", sampleProfile: "outpatient_imaging", dataClassification: "synthetic" };
const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function PriorAuthorizations() {
  const [form, setForm] = useState(initialInput);
  const [selected, setSelected] = useState<RevenueAuthorization | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["revenue-cycle", "authorizations"], queryFn: () => revenueCycleRequest<{ authorizations: RevenueAuthorization[] }>("/api/revenue-cycle/authorizations") });
  const authorizations = query.data?.authorizations || [];
  const current = selected || authorizations[0] || null;
  const counts = useMemo(() => ({ approved: authorizations.filter((item) => item.status === "approved").length, pended: authorizations.filter((item) => item.status === "pended").length }), [authorizations]);

  async function runWorkflow() {
    setRunning(true); setError("");
    try {
      const result = await revenueCycleRequest<{ authorization: RevenueAuthorization }>("/api/revenue-cycle/authorizations/check", { method: "POST", body: JSON.stringify(form) });
      setSelected(result.authorization);
      await query.refetch();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Authorization workflow failed."); }
    finally { setRunning(false); }
  }

  return <div className="rc-page rc-authorization-page">
    <section className="rc-sandbox-banner" role="status"><ShieldCheck size={17}/><div><strong>Sandbox environment</strong><span>Synthetic authorization cases only. No request is sent to a payer.</span></div></section>
    <header className="rc-workspace-header"><div><Link href="/revenue-cycle"><ArrowLeft size={15}/> Revenue Cycle</Link><span className="rc-eyebrow"><ClipboardCheck size={16}/> Prior Authorizations</span><h1>Know the requirement. Track the determination.</h1><p>Model authorization-required checks, clinical-document requirements, decisions, approved dates, units, and next actions in one traceable workflow.</p></div><div className="rc-workspace-stats"><span><strong>{authorizations.length}</strong> Cases</span><span><strong>{counts.approved}</strong> Approved</span><span><strong>{counts.pended}</strong> Pended</span></div></header>
    <div className="rc-eligibility-layout">
      <section className="rc-card rc-check-builder"><header><div><span>New case</span><h2>Run a synthetic 278-style workflow</h2></div><FileCheck2 size={22}/></header><p className="rc-card-intro">This creates a controlled sandbox case. Production Optum prior-authorization credentials remain a separate activation gate.</p>
        <label>Service profile<select value={form.sampleProfile} onChange={(event)=>setForm({...form,sampleProfile:event.target.value as AuthorizationCheckInput["sampleProfile"]})}><option value="outpatient_imaging">Outpatient imaging</option><option value="ambulance_transport">Non-emergency ambulance</option><option value="specialty_medication">Specialty medication</option></select></label>
        <label>Sandbox determination<select value={form.scenario} onChange={(event)=>setForm({...form,scenario:event.target.value as AuthorizationCheckInput["scenario"]})}><option value="approved">Authorization approved</option><option value="not_required">Authorization not required</option><option value="pended">Pended for clinical review</option><option value="denied">Authorization denied</option></select></label>
        <button className="rc-primary" type="button" disabled={running} onClick={runWorkflow}>{running?<Loader2 size={16} className="rc-spin"/>:<PlayCircle size={16}/>} {running?"Running workflow…":"Run authorization workflow"}</button>{error?<div className="rc-inline-error"><AlertTriangle size={15}/>{error}</div>:null}
      </section>
      <section className="rc-card rc-result-panel" aria-live="polite"><header><div><span>Determination</span><h2>{current?current.response.patient.displayName:"No authorization case yet"}</h2></div>{current?.status==="approved"||current?.status==="not_required"?<CheckCircle2 className="is-success" size={24}/>:current?<AlertTriangle className={current.status==="pended"?"is-pending":"is-error"} size={24}/>:<ShieldCheck size={24}/>}</header>
        {!current?<div className="rc-empty"><ClipboardCheck size={30}/><strong>Run the first synthetic case</strong><p>The requirement, determination, and next action will appear here.</p></div>:<><div className="rc-result-summary"><div><span>Status</span><strong data-status={current.status}>{label(current.status)}</strong></div><div><span>Procedure</span><strong>{current.procedureCode}</strong></div><div><span>Diagnosis</span><strong>{current.diagnosisCode}</strong></div><div><span>Units</span><strong>{current.requestedUnits}</strong></div></div>
          <div className="rc-authorization-detail"><article><span>Requirement</span><strong>{current.response.requirement.required?"Prior authorization required":"Not required"}</strong><p>{current.response.requirement.summary}</p></article><article><span>Authorization number</span><strong>{current.authorizationNumber||"Not assigned"}</strong><p>{current.response.determination.effectiveFrom?`${current.response.determination.effectiveFrom} through ${current.response.determination.effectiveTo}`:"No approved service window"}</p></article><article><span>Next action</span><strong>{current.response.determination.nextAction}</strong></article></div>
          {current.response.requirement.documentation.length?<div className="rc-document-list"><strong>Documentation checklist</strong>{current.response.requirement.documentation.map((item)=><span key={item}><CheckCircle2 size={14}/>{item}</span>)}</div>:null}<footer className="rc-response-foot"><span>Codical synthetic sandbox</span><span>Member {current.memberIdMasked}</span><span>{new Date(current.checkedAt).toLocaleString()}</span></footer></>}
      </section>
    </div>
    <section className="rc-card rc-history"><header><div><span>Authorization register</span><h2>Saved synthetic cases</h2></div><History size={20}/></header>{authorizations.length?<div className="rc-history-list">{authorizations.map((item)=><button type="button" key={item.id} className={current?.id===item.id?"is-active":""} onClick={()=>setSelected(item)}><span data-status={item.status}>{label(item.status)}</span><strong>{item.response.patient.displayName}</strong><em>{item.procedureCode} · {item.payerName}</em><small>{new Date(item.checkedAt).toLocaleString()}</small></button>)}</div>:<div className="rc-empty compact"><History size={24}/><strong>No saved authorization cases</strong></div>}</section>
  </div>;
}

export default PriorAuthorizations;
