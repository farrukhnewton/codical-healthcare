import { useLocation } from "wouter";
import { Search, Shield, BookOpen, ArrowRight } from "lucide-react";

const CATEGORIES = [
  {
    title: "Medical Coding",
    desc: "Fast lookup with relationships, crosswalks, and explainable suggestions.",
    Icon: Search,
    accent: "ln-accentMint",
    chips: ["ICD-10 Search", "CPT Lookup", "HCPCS Browser", "Crosswalks", "AI Suggestions"],
  },
  {
    title: "Compliance & Audit",
    desc: "Catch problems only when they matter—then get a clear next action.",
    Icon: Shield,
    accent: "ln-accentCyan",
    chips: ["NCCI Checker", "LCD/NCD Lookup", "Modifier Guidance", "Audit Risk", "Denial Prevention"],
  },
  {
    title: "Clinical Reference",
    desc: "Reference utilities that live inside the workflow, not in separate tabs.",
    Icon: BookOpen,
    accent: "ln-accentLilac",
    chips: ["Drug Lookup", "NPI Registry", "RVU Calculator", "Fee Schedule", "Anesthesia Calc"],
  },
];

export function ToolsSection() {
  const [, setLocation] = useLocation();

  return (
    <section id="tools" className="ln-section">
      <div className="ln-container">
        <header className="ln-sectionHead">
          <div className="ln-pill">Tools</div>
          <h2 className="ln-h2">One platform, every tool.</h2>
          <p className="ln-sub">
            Stop switching apps. Codical keeps coding, compliance, and reference utilities in one premium workspace.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-6">
          {CATEGORIES.map((c) => (
            <div key={c.title} className="ln-glass ln-card ln-cardHover p-7">
              <div className="flex items-start justify-between gap-4">
                <div className={"ln-stepIcon " + c.accent} aria-hidden="true">
                  <c.Icon size={18} className="ln-accentText" />
                </div>
                <div className="text-[12px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))]">
                  Category
                </div>
              </div>

              <div className="mt-4 text-[18px] font-black tracking-[-0.02em] text-[hsl(var(--foreground))]">
                {c.title}
              </div>
              <p className="mt-2 text-[14px] leading-[1.7] text-[hsl(var(--muted-foreground))]">{c.desc}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {c.chips.map((t) => (
                  <span key={t} className="ln-chip">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-10">
          <div className="text-[13px] font-black tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
            Includes NCCI, RVU, NPI, drug lookup, fee schedules, and more.
          </div>

          <button className="ln-btn ln-btnSecondary ln-magnetic" onClick={() => setLocation("/signup")}>
            See all tools <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
