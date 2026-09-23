import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock3, History, Loader2,
  PlayCircle, ShieldCheck, Stethoscope, UserRoundSearch,
} from "lucide-react";
import type { EligibilityCheckInput } from "@shared/revenue-cycle";
import { revenueCycleRequest, type EligibilityCheck } from "@/lib/revenue-cycle-api";

const initialInput: EligibilityCheckInput = {
  scenario: "complete",
  sampleProfile: "commercial_individual",
  serviceType: "health_benefit_plan",
  dataClassification: "synthetic",
};

function money(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function EligibilityBenefits() {
  const [form, setForm] = useState<EligibilityCheckInput>(initialInput);
  const [selected, setSelected] = useState<EligibilityCheck | null>(null);
  const [running, setRunning] = useState(false);
  const [actionError, setActionError] = useState("");
  const checksQuery = useQuery({
    queryKey: ["revenue-cycle", "eligibility"],
    queryFn: () => revenueCycleRequest<{ checks: EligibilityCheck[] }>("/api/revenue-cycle/eligibility"),
  });
  const checks = checksQuery.data?.checks || [];
  const current = selected || checks[0] || null;
  const summary = useMemo(() => ({
    total: checks.length,
    active: checks.filter((check) => check.status === "active").length,
    exceptions: checks.filter((check) => check.status === "error").length,
  }), [checks]);

  async function runCheck() {
    setRunning(true);
    setActionError("");
    try {
      const result = await revenueCycleRequest<{ check: EligibilityCheck }>("/api/revenue-cycle/eligibility/check", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSelected(result.check);
      await checksQuery.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Eligibility check failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rc-page rc-eligibility-page">
      <section className="rc-sandbox-banner" role="status">
        <ShieldCheck size={17} />
        <div><strong>Sandbox environment</strong><span>Only published synthetic Availity scenarios are accepted. Do not enter patient information.</span></div>
      </section>

      <header className="rc-workspace-header">
        <div><Link href="/revenue-cycle"><ArrowLeft size={15} /> Revenue Cycle</Link><span className="rc-eyebrow"><UserRoundSearch size={16} /> Eligibility & Benefits</span><h1>Know coverage before the encounter.</h1><p>Run a controlled synthetic inquiry, normalize the payer response, and review benefit details in a biller-ready format.</p></div>
        <div className="rc-workspace-stats"><span><strong>{summary.total}</strong> Checks</span><span><strong>{summary.active}</strong> Active</span><span><strong>{summary.exceptions}</strong> Exceptions</span></div>
      </header>

      <div className="rc-eligibility-layout">
        <section className="rc-card rc-check-builder">
          <header><div><span>New inquiry</span><h2>Choose a synthetic test case</h2></div><Stethoscope size={22} /></header>
          <p className="rc-card-intro">The request contains a scenario key only. No names, dates of birth, member IDs, or other PHI are sent from this form.</p>
          <label>Sample profile<select value={form.sampleProfile} onChange={(event) => setForm({ ...form, sampleProfile: event.target.value as EligibilityCheckInput["sampleProfile"] })}><option value="commercial_individual">Commercial — individual</option><option value="commercial_family">Commercial — family</option><option value="medicare_secondary">Medicare secondary</option></select></label>
          <label>Service type<select value={form.serviceType} onChange={(event) => setForm({ ...form, serviceType: event.target.value as EligibilityCheckInput["serviceType"] })}><option value="health_benefit_plan">Health benefit plan</option><option value="medical_care">Medical care</option><option value="professional">Professional visit</option><option value="hospital">Hospital services</option></select></label>
          <label>Response scenario<select value={form.scenario} onChange={(event) => setForm({ ...form, scenario: event.target.value as EligibilityCheckInput["scenario"] })}><option value="complete">Complete active response</option><option value="providerIneligible">Provider not eligible</option><option value="invalidSubscriberName">Subscriber mismatch</option><option value="inProgress">Payer processing</option><option value="retrying">Retry in progress</option><option value="requestErrorOne">Request validation error A</option><option value="requestErrorTwo">Request validation error B</option></select></label>
          <button type="button" className="rc-primary" onClick={runCheck} disabled={running}>{running ? <Loader2 size={16} className="rc-spin" /> : <PlayCircle size={16} />}{running ? "Running demo check…" : "Run eligibility check"}</button>
          {actionError ? <div className="rc-inline-error"><AlertTriangle size={15} />{actionError}</div> : null}
        </section>

        <section className="rc-card rc-result-panel" aria-live="polite">
          <header><div><span>Normalized response</span><h2>{current ? current.response.patient.displayName : "No eligibility response yet"}</h2></div>{current?.status === "active" ? <CheckCircle2 className="is-success" size={24} /> : current?.status === "pending" ? <Clock3 className="is-pending" size={24} /> : current ? <AlertTriangle className="is-error" size={24} /> : <ShieldCheck size={24} />}</header>
          {!current ? <div className="rc-empty"><UserRoundSearch size={30} /><strong>Run the first synthetic check</strong><p>The normalized coverage and benefit response will appear here.</p></div> : <>
            <div className="rc-result-summary">
              <div><span>Coverage</span><strong data-status={current.status}>{label(current.status)}</strong></div><div><span>Plan</span><strong>{current.response.plan.name}</strong></div><div><span>Payer</span><strong>{current.response.payer.name}</strong></div><div><span>Member</span><strong>{current.response.patient.memberIdMasked}</strong></div>
            </div>
            <div className="rc-coverage-message"><strong>{current.response.coverage.summary}</strong><span>{label(current.response.coverage.serviceType)} · {label(current.response.coverage.network)}</span></div>
            {current.response.benefits.length ? <div className="rc-benefit-list">{current.response.benefits.map((benefit) => <article key={benefit.id}><div><span>{benefit.category}</span><small>{label(benefit.network)} · {label(benefit.coverageLevel)}</small></div><strong>{benefit.amountType === "coinsurance" ? `${benefit.percent}%` : money(benefit.amount)}</strong><em>{benefit.remaining !== null ? `${money(benefit.remaining)} remaining` : label(benefit.period || "service")}</em></article>)}</div> : <div className="rc-no-benefits"><AlertTriangle size={18} /><div><strong>No benefit rows returned</strong><p>{current.response.messages.join(" ")}</p></div></div>}
            <footer className="rc-response-foot"><span>Source: Availity Demo</span><span>Mock verified: {current.response.mockVerified ? "Yes" : "No"}</span><span>{new Date(current.checkedAt).toLocaleString()}</span></footer>
          </>}
        </section>
      </div>

      <section className="rc-card rc-history">
        <header><div><span>Audit history</span><h2>Saved eligibility checks</h2></div><History size={20} /></header>
        {checksQuery.error ? <div className="rc-inline-error"><AlertTriangle size={15} />{checksQuery.error instanceof Error ? checksQuery.error.message : "History failed to load."}</div> : null}
        {checks.length ? <div className="rc-history-list">{checks.map((check) => <button type="button" key={check.id} className={current?.id === check.id ? "is-active" : ""} onClick={() => setSelected(check)}><span data-status={check.status}>{label(check.status)}</span><strong>{check.response.patient.displayName}</strong><em>{check.payerName}</em><small>{new Date(check.checkedAt).toLocaleString()}</small></button>)}</div> : <div className="rc-empty compact"><History size={24} /><strong>No saved checks</strong></div>}
      </section>
    </div>
  );
}

export default EligibilityBenefits;
