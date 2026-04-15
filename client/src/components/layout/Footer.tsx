import { Shield, Lock, Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl border-t border-emerald-100/40 dark:border-emerald-900/30 py-2.5 px-6 flex items-center justify-between flex-shrink-0 gap-4">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
        © {new Date().getFullYear()} Codical Health Solutions
      </p>
      <div className="hidden sm:flex items-center gap-4">
        {[
          { icon: Shield, label: "HIPAA Compliant" },
          { icon: Lock, label: "256-bit SSL" },
          { icon: Zap, label: "SOC 2 Ready" },
        ].map((badge, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
            <badge.icon className="w-3 h-3 text-emerald-500/60" />
            {badge.label}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium whitespace-nowrap">
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        All Systems Operational
      </div>
    </footer>
  );
}
