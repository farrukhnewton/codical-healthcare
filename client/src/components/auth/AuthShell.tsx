import "@/styles/codical-os.css";

import type { ReactNode } from "react";
import { Link } from "wouter";
import { BrandMark } from "@/components/BrandMark";

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="codical-auth-shell min-h-screen relative overflow-hidden">
      <div className="co-cursor-glow" aria-hidden="true" />
      <div className="co-grain" aria-hidden="true" />
      <main className="co-auth-grid">
        <section className="co-auth-copy">
          <Link href="/" aria-label="Codical Health home">
            <BrandMark />
          </Link>
          <h1>
            Secure access to your <span className="co-gradient-text">coding command center.</span>
          </h1>
          <p>
            Search codes, review AI suggestions, calculate reimbursement, check coverage context and keep the team discussion attached to the case.
          </p>
          <div className="co-auth-preview">
            <div className="co-metric-card"><small>Review model</small><strong>Human-led</strong></div>
            <div className="co-metric-card"><small>Workflow</small><strong>Case-aware</strong></div>
            <div className="co-metric-card"><small>Controls</small><strong>Audit trail</strong></div>
          </div>
        </section>

        <section className="co-auth-card">
          {children}
        </section>
      </main>
    </div>
  );
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full">
      <div className="ln-preview p-0">
        <div className="relative p-8 sm:p-10">
          <div className="flex items-center justify-center">
            <BrandMark />
          </div>

          <div className="mt-6 text-center">
            <div className="text-[12px] font-black tracking-[0.16em] uppercase text-[var(--co-muted)]">
              Secure access
            </div>
            <h1 className="co-heading mt-3 text-[26px] sm:text-[28px] font-black text-[var(--co-ink)]">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 text-[14px] leading-[1.8] text-[var(--co-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </div>

      <div className="mt-6 text-center text-[12px] font-black tracking-[-0.01em] text-[var(--co-muted)]">
        © {new Date().getFullYear()} Codical Health - Healthcare intelligence reimagined
      </div>
    </div>
  );
}
