import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Dr. Sarah Chen",
    role: "Medical Director, Pacific Health Group",
    text: "Codical Health transformed our coding accuracy. The suggestions are precise, and the compliance cues are clear enough that my team trusts the output.",
    rating: 5,
    impact: "+12% Revenue",
  },
  {
    name: "Marcus Williams",
    role: "CPC, Revenue Cycle Manager",
    text: "The NCCI checker alone paid for itself. It catches what matters and doesn’t flood the UI with noise—just the next action.",
    rating: 5,
    impact: "$340K Recovered",
  },
  {
    name: "Jennifer Martinez",
    role: "Billing Supervisor, Metro Clinic",
    text: "One workspace replaced multiple subscriptions. The UI feels premium and calm, and the speed is exactly what we needed under volume.",
    rating: 5,
    impact: "3× Productivity",
  },
  {
    name: "Dr. Robert Kim",
    role: "Orthopedic Surgeon",
    text: "I need coding to be fast and accurate. Codical gives me confidence that every claim is optimized without compliance risk.",
    rating: 5,
    impact: "40% Time Saved",
  },
];

export function TestimonialsSection() {
  return (
    <section className="ln-section" aria-label="Testimonials">
      <div className="ln-container">
        <header className="ln-sectionHead">
          <div className="ln-pill">Testimonials</div>
          <h2 className="ln-h2">Real results from real teams.</h2>
          <p className="ln-sub">Premium workflows earn trust when they’re calm, fast, and explainable.</p>
        </header>

        <div className="grid grid-flow-col auto-cols-[minmax(320px,1fr)] gap-6 overflow-x-auto snap-x snap-mandatory pb-2 ln-scroller">
          {TESTIMONIALS.map((t) => (
            <article key={t.name} className="ln-glass ln-card ln-cardHover p-7 snap-start">
              <div className="flex items-center justify-between gap-4">
                <div className="flex gap-1" aria-label={`${t.rating} out of 5 stars`}>
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={16} className="fill-[rgba(251,191,36,0.95)] text-[rgba(251,191,36,0.95)]" />
                  ))}
                </div>

                <div className="px-3 py-2 rounded-full border border-[rgba(255,255,255,0.34)] bg-[rgba(255,255,255,0.14)] text-[12px] font-black tracking-[-0.01em] text-[hsl(var(--foreground))]">
                  {t.impact}
                </div>
              </div>

              <div className="mt-4 flex items-start gap-3">
                <div className="mt-1">
                  <Quote size={18} className="text-[rgba(56,189,248,0.85)]" />
                </div>
                <p className="text-[14px] leading-[1.85] text-[hsl(var(--muted-foreground))]">“{t.text}”</p>
              </div>

              <div className="mt-6">
                <div className="text-[14px] font-black text-[hsl(var(--foreground))]">{t.name}</div>
                <div className="text-[12px] font-black tracking-[0.02em] text-[hsl(var(--muted-foreground))]">{t.role}</div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center text-[12px] font-black tracking-[0.14em] uppercase text-[hsl(var(--muted-foreground))]">
          Designed for clarity: no noisy motion, only intentional emphasis.
        </div>
      </div>
    </section>
  );
}
