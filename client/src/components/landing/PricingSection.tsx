import { useLocation } from "wouter";
import { Check, Star } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: "Free trial",
    period: "",
    desc: "For individual coders and small practices getting started with AI assistance.",
    features: ["ICD-10 / CPT / HCPCS search", "Core compliance signals", "RVU + reference utilities", "Email support"],
    cta: "Start free trial",
    popular: false,
    tone: "secondary" as const,
  },
  {
    name: "Professional",
    price: "Talk to us",
    period: "",
    desc: "For teams that need collaboration, deeper compliance, and workflow consistency.",
    features: [
      "Everything in Starter",
      "Advanced compliance engine",
      "Team workspaces",
      "Analytics & reporting",
      "Priority support",
    ],
    cta: "Request pricing",
    popular: true,
    tone: "primary" as const,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For hospitals and health systems with integration, security, and scale requirements.",
    features: ["Everything in Professional", "API access", "EHR integration options", "Dedicated onboarding", "SLA / security review"],
    cta: "Contact sales",
    popular: false,
    tone: "secondary" as const,
  },
];

export function PricingSection() {
  const [, setLocation] = useLocation();

  return (
    <section id="pricing" className="ln-section">
      <div className="ln-container">
        <header className="ln-sectionHead">
          <div className="ln-pill">Pricing</div>
          <h2 className="ln-h2">Simple pricing, clear value.</h2>
          <p className="ln-sub">Start with a free trial. Move up when your workflow needs more power.</p>
        </header>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={
                "ln-glass ln-card p-7 " +
                (plan.popular ? "ln-cardHover" : "ln-cardHover")
              }
            >
              {plan.popular && (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[rgba(255,255,255,0.34)] bg-[rgba(255,255,255,0.14)] text-[12px] font-black tracking-[0.12em] uppercase text-[hsl(var(--foreground))]">
                  <Star size={14} className="text-[rgba(74,222,128,0.9)]" />
                  Most popular
                </div>
              )}

              <div className="mt-4 text-[18px] font-black tracking-[-0.02em] text-[hsl(var(--foreground))]">
                {plan.name}
              </div>

              <div className="mt-3 flex items-end gap-2">
                <div className="text-[34px] font-black tracking-[-0.04em] text-[hsl(var(--foreground))]">
                  {plan.price}
                </div>
                {plan.period ? (
                  <div className="pb-2 text-[13px] font-black text-[hsl(var(--muted-foreground))]">{plan.period}</div>
                ) : null}
              </div>

              <p className="mt-2 text-[14px] leading-[1.75] text-[hsl(var(--muted-foreground))]">{plan.desc}</p>

              <ul className="mt-6 grid gap-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[14px] leading-[1.6] text-[hsl(var(--foreground))]">
                    <Check size={16} className="mt-[2px] text-[rgba(74,222,128,0.9)] flex-shrink-0" />
                    <span className="text-[hsl(var(--muted-foreground))]">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <button
                  className={"w-full ln-btn " + (plan.tone === "primary" ? "ln-btnPrimary ln-magnetic" : "ln-btnSecondary ln-magnetic")}
                  onClick={() => {
                    if (plan.name === "Starter") setLocation("/signup");
                    else document.querySelector("#cta")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center text-[12px] font-black tracking-[0.14em] uppercase text-[hsl(var(--muted-foreground))]">
          Need a BAA / security review / integration? Choose Enterprise.
        </div>
      </div>
    </section>
  );
}
