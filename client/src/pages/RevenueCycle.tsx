import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight, BadgeDollarSign, CheckCircle2, CircleDollarSign, ClipboardCheck,
  FileClock, FileSearch, Landmark, RefreshCw, ShieldCheck, Sparkles,
} from "lucide-react";
import { revenueCycleRequest, type RevenueCycleOverview } from "@/lib/revenue-cycle-api";

const MODULE_ICONS = {
  eligibility: ShieldCheck,
  claims: ClipboardCheck,
  "claim-status": FileSearch,
  authorizations: FileClock,
  payments: Landmark,
  denials: BadgeDollarSign,
} as const;

export function RevenueCycle() {
  const overview = useQuery({
    queryKey: ["revenue-cycle", "overview"],
    queryFn: () => revenueCycleRequest<RevenueCycleOverview>("/api/revenue-cycle/overview"),
  });
  const data = overview.data;

  return (
    <div className="rc-page">
      <section className="rc-sandbox-banner" role="status">
        <ShieldCheck size={17} />
        <div><strong>Sandbox environment</strong><span>Synthetic data only. Not for patient care or billing.</span></div>
      </section>

      <section className="rc-hero">
        <div>
          <span className="rc-eyebrow"><CircleDollarSign size={16} /> Revenue Cycle</span>
          <h1>One operating system from coverage to payment.</h1>
          <p>Verify benefits, prepare clean claims, follow payer responses, and route exceptions into one accountable work queue.</p>
        </div>
        <div className="rc-hero-aside">
          <span><Sparkles size={15} /> Foundation live</span>
          <small>{data?.organization.name || "Loading revenue workspace…"}</small>
        </div>
      </section>

      <section className="rc-metric-grid" aria-label="Revenue Cycle metrics">
        <article><span>Eligibility checks</span><strong>{data?.eligibility.totalChecks || 0}</strong><small>Saved synthetic inquiries</small></article>
        <article><span>Active coverage</span><strong>{data?.eligibility.activeChecks || 0}</strong><small>Confirmed demo responses</small></article>
        <article><span>Exceptions</span><strong>{data?.eligibility.exceptionChecks || 0}</strong><small>Responses needing review</small></article>
      </section>

      <section className="rc-section-heading">
        <div><span>Workflow map</span><h2>Revenue operations</h2><p>Start with the active modules; the shared foundation is ready for each next workflow.</p></div>
        <button type="button" onClick={() => overview.refetch()} disabled={overview.isFetching}><RefreshCw size={15} className={overview.isFetching ? "rc-spin" : ""} /> Refresh</button>
      </section>

      {overview.error ? <div className="rc-error">{overview.error instanceof Error ? overview.error.message : "Revenue Cycle failed to load."}</div> : null}

      <section className="rc-module-grid">
        {(data?.modules || []).map((module) => {
          const Icon = MODULE_ICONS[module.id as keyof typeof MODULE_ICONS] || CheckCircle2;
          const content = (
            <>
              <div className="rc-module-top"><span><Icon size={20} /></span><em data-status={module.status}>{module.status === "active" ? "Live" : module.status === "foundation" ? "Foundation" : "Planned"}</em></div>
              <h3>{module.name}</h3>
              <p>{module.id === "eligibility" ? "Run safe 270/271-style demo checks and review normalized benefits." : module.id === "claims" ? "Open the validated claim lifecycle and integration workbench." : "Shared data, identity, audit, and work-queue patterns reserved."}</p>
              <footer>{module.href ? <>Open workspace <ArrowRight size={15} /></> : <>Next build phase</>}</footer>
            </>
          );
          return module.href ? <Link className="rc-module-card" href={module.href} key={module.id}>{content}</Link> : <article className="rc-module-card is-disabled" key={module.id}>{content}</article>;
        })}
      </section>
    </div>
  );
}

export default RevenueCycle;
