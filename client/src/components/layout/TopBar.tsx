import { UnifiedSearch } from "@/components/layout/UnifiedSearch";
import { Bell, Command, Moon, Search, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Command Center", subtitle: "Real-time coding, coverage and reimbursement overview" },
  "/search": { title: "Code Directory", subtitle: "ICD-10-CM, CPT and HCPCS search" },
  "/analytics": { title: "Analytics Hub", subtitle: "Usage trends, patterns and performance insights" },
  "/workspace": { title: "Codical AI Coder", subtitle: "Assistive clinical coding workflows" },
  "/workbench": { title: "Workbench", subtitle: "Draft, review and refine coding outputs" },
  "/chat": { title: "Codical Chat", subtitle: "Collaborate on cases and coding questions" },
  "/compliance": { title: "Compliance", subtitle: "Risk signals, audit readiness and guidance" },
  "/reports": { title: "Reports Center", subtitle: "Generate, export and audit coding reports" },
  "/ncci": { title: "NCCI Checker", subtitle: "National Correct Coding Initiative edit review" },
  "/rvu": { title: "RVU Calculator", subtitle: "Medicare Physician Fee Schedule modeling" },
  "/anesthesia": { title: "Anesthesia Calculator", subtitle: "Base, time and modifier unit modeling" },
  "/npi": { title: "NPI Lookup", subtitle: "NPPES provider registry search" },
  "/codelookup": { title: "POS & Modifiers", subtitle: "Place of service and modifier reference" },
  "/druglookup": { title: "Drug / NDC Lookup", subtitle: "FDA NDC drug database" },
  "/voice-transcription": { title: "Codical AI Transcription", subtitle: "Medical voice-to-record transcription" },
  "/intelligence": { title: "Coverage & Guidelines", subtitle: "Medicare LCD/NCD, payer policies and official coding guidelines" },
  "/coverage": { title: "Coverage & Guidelines", subtitle: "Medicare LCD/NCD, payer policies and official coding guidelines" },
  "/favorites": { title: "Saved Workspace", subtitle: "Curated codes and coding references" },
};

function getPageMeta(pathname: string) {
  if (pathname?.startsWith("/intel/")) {
    return { title: "Code Intelligence", subtitle: "Deep code context, RVU, policies and compliance signals" };
  }
  return PAGE_TITLES[pathname] || { title: "Codical Health", subtitle: "Enterprise medical coding intelligence" };
}

export function TopBar() {
  const [location] = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();
  const [userEmail, setUserEmail] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const page = useMemo(() => getPageMeta(location), [location]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || (target as any)?.isContentEditable;
      if (typing) return;

      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "CH";

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[76px] co-shell-surface border-b border-[var(--co-line)] z-40 flex-shrink-0 px-4 lg:px-6 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,210px)_minmax(220px,1fr)_auto] lg:grid-cols-[minmax(180px,280px)_minmax(260px,1fr)_auto] items-center gap-3 lg:gap-4"
    >
      <div className="flex-shrink-0 min-w-0">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--co-muted)]">
          <span className="co-live-dot" />
          Codical Health
        </div>
        <h1 className="co-heading text-lg lg:text-xl font-black leading-tight truncate text-[var(--co-ink)] mt-1">
          {page.title}
        </h1>
        <p className="text-xs text-[var(--co-muted)] hidden sm:block truncate">
          {page.subtitle}
        </p>
      </div>

      <div className="hidden md:block min-w-0 lg:max-w-2xl lg:mx-auto">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full co-universal-search co-glow-capsule !mb-0 !h-11 !py-0"
          aria-label="Open search"
        >
          <Search className="w-4 h-4 flex-shrink-0 text-[var(--co-cyan)]" />
          <span className="flex-1 min-w-0 text-left text-sm truncate">Search ICD, CPT, HCPCS, RVU, NPI, NDC, LCD/NCD...</span>
          <kbd className="px-2 py-0.5 rounded-full text-xs font-mono hidden sm:inline-flex border border-[var(--co-line)] bg-white/5 items-center gap-1">
            <Command size={11} /> /
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 justify-self-end">
        <button
          onClick={() => setSearchOpen(true)}
          className="co-glow-capsule md:hidden w-10 h-10 rounded-full border border-[var(--co-line)] bg-white/5 flex items-center justify-center text-[var(--co-muted)] hover:text-[var(--co-ink)] hover:bg-white/10 transition-colors appFocusRing"
          aria-label="Open search"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={toggleTheme}
          className="co-glow-capsule w-10 h-10 rounded-full border border-[var(--co-line)] bg-white/5 flex items-center justify-center text-[var(--co-muted)] hover:text-[var(--co-ink)] hover:bg-white/10 transition-colors appFocusRing"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          className="co-glow-capsule w-10 h-10 rounded-full border border-[var(--co-line)] bg-white/5 flex items-center justify-center text-[var(--co-muted)] hover:text-[var(--co-ink)] hover:bg-white/10 transition-colors relative appFocusRing"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[var(--co-green)] rounded-full border border-white/40" />
        </button>

        <div className="co-glow-capsule hidden sm:flex items-center gap-2 px-2 py-1.5 rounded-full border border-[var(--co-line)] bg-white/5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black bg-gradient-to-br from-[var(--co-cyan)] to-[var(--co-blue)]">
            {userInitials}
          </div>
          <div className="min-w-0 pr-2">
            <p className="text-xs font-bold text-[var(--co-ink)] leading-none truncate max-w-[140px]">
              {userEmail ? userEmail.split("@")[0] : "Account"}
            </p>
            <p className="text-[10px] text-[var(--co-muted)] leading-none mt-1">
              Coder workspace
            </p>
          </div>
        </div>
      </div>

      <UnifiedSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </motion.header>
  );
}
