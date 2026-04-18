import { Shield, Lock, Zap } from "lucide-react";

const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "AI Engine", href: "#ai-engine" },
      { label: "Tools", href: "#tools" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "API Reference", href: "#" },
      { label: "CMS Updates", href: "#" },
      { label: "Case Studies", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#cta" },
      { label: "Partners", href: "#" },
      { label: "Press", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "BAA", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="ln-footer">
      <div className="ln-container py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-10">
              <div className="ln-mark" aria-hidden="true">
                <span className="ln-markBar" />
                <span className="ln-markBar" />
                <span className="ln-markBar" />
                <span className="ln-markBar" />
                <span className="ln-markBar" />
              </div>

              <div className="flex flex-col leading-none">
                <span className="text-[14px] font-black tracking-[-0.03em] text-[hsl(var(--foreground))]">CODICAL</span>
                <span className="mt-1 text-[10px] font-black tracking-[0.28em] uppercase text-[rgba(16,185,129,0.95)]">
                  Health
                </span>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-[1.8] text-[hsl(var(--muted-foreground))]">
              Calm, explainable healthcare intelligence for coding, compliance, and revenue cycle teams.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {[
                { icon: Shield, label: "HIPAA-ready" },
                { icon: Lock, label: "SOC 2-aligned" },
                { icon: Zap, label: "TLS/SSL" },
              ].map((b) => (
                <span key={b.label} className="ln-chip">
                  <b.icon size={14} className="text-[rgba(56,189,248,0.85)]" />
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((section) => (
            <div key={section.title}>
              <h4 className="text-[12px] font-black tracking-[0.16em] uppercase text-[hsl(var(--foreground))]">
                {section.title}
              </h4>
              <ul className="mt-4 grid gap-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-[13px] font-black tracking-[-0.01em]">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-[rgba(255,255,255,0.24)] dark:border-[rgba(255,255,255,0.10)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] font-black tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
            © {new Date().getFullYear()} Codical Health Solutions. All rights reserved.
          </p>
          <p className="text-[12px] font-black tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
            Built for clarity · Powered by Gemini · 114,000+ codes
          </p>
        </div>
      </div>
    </footer>
  );
}
