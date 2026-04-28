import { Shield, Lock, Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="appGlassStrong appCard border-t border-border/60 py-2.5 px-6 flex items-center justify-between flex-shrink-0 gap-4">
      <p className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
        (c) {new Date().getFullYear()} Codical Health Solutions
      </p>
      <div className="hidden sm:flex items-center gap-4">
        {[
          { icon: Shield, label: "HIPAA Compliant" },
          { icon: Lock, label: "256-bit SSL" },
          { icon: Zap, label: "SOC 2 Ready" },
        ].map((badge, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/70">
            <badge.icon className="w-3 h-3 text-emerald-500/60" />
            {badge.label}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium whitespace-nowrap">
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        All Systems Operational
      </div>
    </footer>
  );
}


