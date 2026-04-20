import "@/styles/landing-aurora-scene.css";
import "@/styles/landing-hero-next.css";
import "@/styles/landing-nav-next.css";
import "@/styles/landing-reveal.css";

import type { ReactNode } from "react";
import { AuroraScene } from "@/components/landing-next/AuroraScene";

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="landingAurora min-h-screen relative">
      <AuroraScene />
      <main className="ln-container min-h-screen flex items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md">
      {/* Use the same premium glass surface as the Landing hero preview */}
      <div className="ln-preview p-0">
        <div className="relative p-8 sm:p-10">
          {/* Brand (reuse landing navbar bar-mark styles) */}
          <div className="flex items-center justify-center gap-3">
            <div className="ln-bars" aria-hidden="true">
              <span className="ln-bar" />
              <span className="ln-bar" />
              <span className="ln-bar" />
              <span className="ln-bar" />
              <span className="ln-bar" />
            </div>

            <div className="flex flex-col leading-none">
              <span className="text-[14px] font-black tracking-[-0.03em] text-[hsl(var(--foreground))]">
                CODICAL
              </span>
              <span className="mt-1 text-[10px] font-black tracking-[0.28em] uppercase text-[rgba(16,185,129,0.95)]">
                Health
              </span>
            </div>
          </div>

          {/* Head */}
          <div className="mt-6 text-center">
            <div className="text-[12px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))]">
              Secure access
            </div>
            <h1 className="mt-3 text-[26px] sm:text-[28px] font-black tracking-[-0.03em] text-[hsl(var(--foreground))]">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 text-[14px] leading-[1.8] text-[hsl(var(--muted-foreground))]">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </div>

      <div className="mt-6 text-center text-[12px] font-black tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
        © {new Date().getFullYear()} Codical Health · Healthcare Intelligence Reimagined
      </div>
    </div>
  );
}
