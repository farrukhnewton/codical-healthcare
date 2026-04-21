import { UnifiedSearch } from "@/components/layout/UnifiedSearch";
import { Bell, Search, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Command Center", subtitle: "Real-time healthcare intelligence overview" },
  "/search": { title: "Code Directory", subtitle: "ICD-10-CM, CPT & HCPCS search" },
  "/analytics": { title: "Analytics Hub", subtitle: "Usage trends, patterns & performance insights" },
  "/workspace": { title: "Workspace", subtitle: "AI-assisted clinical coding workflows" },
  "/workbench": { title: "Workbench", subtitle: "Draft, review, and refine coding outputs" },
  "/chat": { title: "Team Chat", subtitle: "Collaborate on cases and coding questions" },
  "/compliance": { title: "Compliance", subtitle: "Risk signals, audit readiness & guidance" },
  "/reports": { title: "Reports Center", subtitle: "Generate, export & audit coding reports" },
  "/ncci": { title: "NCCI Checker", subtitle: "National Correct Coding Initiative edits" },
  "/rvu": { title: "RVU Calculator", subtitle: "Medicare Physician Fee Schedule modeling" },
  "/anesthesia": { title: "Anesthesia Calculator", subtitle: "Locality-adjusted conversion factors" },
  "/npi": { title: "NPI Lookup", subtitle: "NPPES provider registry search" },
  "/codelookup": { title: "POS & Modifiers", subtitle: "Place of service and modifier reference" },
  "/druglookup": { title: "Drug / NDC Lookup", subtitle: "FDA NDC drug database" },

  "/intelligence": { title: "Coverage & Guidelines", subtitle: "Medicare LCD/NCD, payer policies & official coding guidelines" },

  /* Compatibility alias (route redirects to /intelligence) */
  "/coverage": { title: "Coverage & Guidelines", subtitle: "Medicare LCD/NCD, payer policies & official coding guidelines" },
};

function getPageMeta(pathname: string) {
  if (pathname?.startsWith("/intel/")) {
    return { title: "Code Intelligence", subtitle: "Deep code context, RVU, policies & compliance signals" };
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

  // Global shortcut: "/" opens command bar (UnifiedSearch)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || (target as any)?.isContentEditable;

      if (typing) return;

      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "CH";

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-14 flex items-center justify-between px-4 lg:px-6 appGlassStrong appCard border-b border-white/20 dark:border-white/10 z-40 flex-shrink-0 gap-4"
    >
      <div className="flex-shrink-0 min-w-0">
        <h1 className="text-sm lg:text-base font-bold text-foreground leading-tight truncate">
          {page.title}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block truncate">
          {page.subtitle}
        </p>
      </div>

      <div className="flex-1 max-w-xl">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-3 h-9 px-4 appGlass appCard border border-white/30 dark:border-white/10 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open search"
        >
          <Search className="w-4 h-4 flex-shrink-0 text-emerald-500" />
          <span className="flex-1 text-left text-sm">Search codes, providers, drugs...</span>
          <kbd className="px-2 py-0.5 rounded text-xs font-mono hidden sm:block border border-white/30 dark:border-white/10 bg-white/30 dark:bg-white/5">
            /
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl appGlass border border-white/30 dark:border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors appFocusRing"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          className="w-9 h-9 rounded-xl appGlass border border-white/30 dark:border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative appFocusRing"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border border-white/70" />
        </button>

        <div className="hidden sm:flex items-center gap-2 px-2 py-1.5 appGlass appCard border border-white/30 dark:border-white/10">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg, #15803D, #0369A1)" }}
          >
            {userInitials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground leading-none truncate max-w-[140px]">
              {userEmail ? userEmail.split("@")[0] : "Account"}
            </p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
              Plan: Pro
            </p>
          </div>
        </div>
      </div>

      <UnifiedSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </motion.header>
  );
}
