import { FileText, Sparkles, ShieldCheck, Send, Link2 } from "lucide-react";

const STEPS = [
  {
    step: "01",
    title: "Bring the context",
    desc: "Notes, encounter details, prior auth hints, or a single code query—whatever you have.",
    Icon: FileText,
    accent: "ln-accentMint",
  },
  {
    step: "02",
    title: "Reason with policy",
    desc: "Gemini-assisted analysis across ICD-10, CPT, and HCPCS—plus payer and CMS guidance signals.",
    Icon: Sparkles,
    accent: "ln-accentCyan",
  },
  {
    step: "03",
    title: "Validate edits",
    desc: "NCCI, LCD/NCD, modifier logic, and combination sanity checks—only when relevant.",
    Icon: ShieldCheck,
    accent: "ln-accentLilac",
  },
  {
    step: "04",
    title: "Ship with confidence",
    desc: "Clean outputs with explainability, documentation cues, and a clear next action for the claim.",
    Icon: Send,
    accent: "ln-accentAmber",
  },
];

const METRICS = [
  { label: "Code accuracy", value: 99.2, accent: "ln-accentMint" },
  { label: "Processing speed", value: 96.0, accent: "ln-accentCyan" },
  { label: "Compliance rate", value: 98.7, accent: "ln-accentLilac" },
  { label: "Revenue recovery", value: 94.0, accent: "ln-accentAmber" },
];

export function AIEngineSection() {
  return (
    <section id="ai-engine" className="ln-section">
      <div className="ln-container">
        <header className="ln-sectionHead">
          <div className="ln-pill">AI Engine</div>
          <h2 className="ln-h2">
            From note → compliant claim.
            <br />
            Calm UI, serious signals.
          </h2>
          <p className="ln-sub">
            A four-step product pipeline that turns messy clinical inputs into explainable, validated coding decisions.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s) => (
            <div key={s.step} className="ln-glass ln-card ln-cardHover p-7">
              <div className="flex items-center justify-between gap-4">
                <div className={"ln-stepIcon " + s.accent} aria-hidden="true">
                  <s.Icon size={18} className="ln-accentText" />
                </div>
                <div className="text-[12px] font-black tracking-[0.18em] uppercase text-[hsl(var(--muted-foreground))]">
                  {s.step}
                </div>
              </div>

              <div className="mt-4 font-black text-[18px] tracking-[-0.02em] text-[hsl(var(--foreground))]">
                {s.title}
              </div>
              <p className="mt-2 text-[14px] leading-[1.7] text-[hsl(var(--muted-foreground))]">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 ln-glassStrong ln-card p-0">
          <div className="ln-gradBorder ln-ctaSurface">
            <div className="relative p-8 sm:p-10 grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="flex items-center gap-2 text-[12px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))]">
                  <Link2 size={16} />
                  Multi-code intelligence
                </div>

                <h3 className="mt-3 text-[26px] sm:text-[30px] font-black tracking-[-0.03em] text-[hsl(var(--foreground))]">
                  ICD-10, CPT, HCPCS—together.
                </h3>

                <p className="mt-3 text-[14px] sm:text-[15px] leading-[1.8] text-[hsl(var(--muted-foreground))]">
                  Codical understands relationships between codes and policy. It checks combinations, bundling rules, and
                  modifier intent—then explains what changed and why.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="ln-chip">
                    <span className="ln-chipSub">ICD-10</span> E11.65
                  </span>
                  <span className="ln-chip">
                    <span className="ln-chipSub">CPT</span> 99214
                  </span>
                  <span className="ln-chip">
                    <span className="ln-chipSub">HCPCS</span> G0108
                  </span>
                  <span className="ln-chip">
                    <span className="ln-chipSub">HCPCS</span> J7050
                  </span>
                  <span className="ln-chip">
                    <span className="ln-chipSub">CPT</span> 36415
                  </span>
                </div>
              </div>

              <div className="grid gap-4">
                {METRICS.map((m) => (
                  <div key={m.label} className={m.accent}>
                    <div className="flex items-center justify-between gap-4 text-[13px]">
                      <span className="font-black text-[hsl(var(--foreground))]">{m.label}</span>
                      <span className="font-black ln-accentText">{m.value.toFixed(1).replace(/\.0$/, "")}%</span>
                    </div>
                    <div className="mt-2 ln-meter">
                      <div className="ln-meterFill" style={{ ["--w" as any]: m.value + "%" }} />
                    </div>
                  </div>
                ))}
                <div className="mt-2 text-[12px] font-black tracking-[0.14em] uppercase text-[hsl(var(--muted-foreground))]">
                  Metrics animate on reveal (not on load)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
