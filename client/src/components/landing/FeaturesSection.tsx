import { Brain, FileText, BadgeDollarSign, ShieldCheck, BarChart3, Workflow } from "lucide-react";

const FEATURES = [
  {
    title: "AI Medical Coding",
    desc: "Gemini-assisted suggestions across ICD-10, CPT, and HCPCS—optimized for clarity and speed.",
    Icon: Brain,
    accent: "ln-accentMint",
  },
  {
    title: "Smart Documentation",
    desc: "Extract coding-relevant facts from clinical notes and surface the next best action.",
    Icon: FileText,
    accent: "ln-accentCyan",
  },
  {
    title: "Revenue Optimizer",
    desc: "RVU, fee schedules, and reimbursement cues—without turning the UI into a spreadsheet.",
    Icon: BadgeDollarSign,
    accent: "ln-accentAmber",
  },
  {
    title: "Compliance Engine",
    desc: "NCCI, LCD/NCD, and modifier guidance appears only when it changes the decision.",
    Icon: ShieldCheck,
    accent: "ln-accentLilac",
  },
  {
    title: "Analytics Dashboard",
    desc: "Understand denial patterns and trends with calm, readable hierarchy.",
    Icon: BarChart3,
    accent: "ln-accentRose",
  },
  {
    title: "Workflow Automation",
    desc: "Batch processing, smart queues, and assignments that scale with your team.",
    Icon: Workflow,
    accent: "ln-accentMint",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="ln-section">
      <div className="ln-container">
        <header className="ln-sectionHead">
          <div className="ln-pill">Platform</div>
          <h2 className="ln-h2">
            Everything you need to
            <br />
            code smarter.
          </h2>
          <p className="ln-sub">
            Built for coders, billers, and revenue cycle teams—premium surfaces, explainable signals, and intentional motion.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="ln-glass ln-card ln-cardHover p-7">
              <div className="flex items-start justify-between gap-4">
                <div className={"ln-stepIcon " + f.accent} aria-hidden="true">
                  <f.Icon size={18} className="ln-accentText" />
                </div>
                <div className="text-[12px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))]">
                  Feature
                </div>
              </div>

              <div className="mt-4 text-[18px] font-black tracking-[-0.02em] text-[hsl(var(--foreground))]">
                {f.title}
              </div>
              <p className="mt-2 text-[14px] leading-[1.75] text-[hsl(var(--muted-foreground))]">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


