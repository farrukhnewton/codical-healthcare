import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bell, Command, Moon, Search, Sun } from "lucide-react";
import { UnifiedSearch } from "@/components/layout/UnifiedSearch";
import { UserProfileMenu } from "@/components/chat/UserProfileMenu";
import { useTheme } from "@/lib/theme";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Coding, coverage and reimbursement overview" },
  "/search": { title: "Code Directory", subtitle: "ICD-10-CM, CPT and HCPCS search" },
  "/analytics": { title: "Analytics Hub", subtitle: "Usage trends, patterns and performance insights" },
  "/workspace": { title: "Coding Assistant", subtitle: "Assistive clinical coding workflows" },
  "/workbench": { title: "Workbench", subtitle: "Draft, review and refine coding outputs" },
  "/chat": { title: "Team Chat", subtitle: "Collaborate on cases and coding questions" },
  "/compliance": { title: "Compliance", subtitle: "Risk signals, audit readiness and guidance" },
  "/reports": { title: "Reports Center", subtitle: "Generate, export and audit coding reports" },
  "/ncci": { title: "NCCI Checker", subtitle: "National Correct Coding Initiative edit review" },
  "/claim-validator": { title: "Claim Validator", subtitle: "Coverage and NCCI code-set validation" },
  "/rvu": { title: "RVU Calculator", subtitle: "Medicare Physician Fee Schedule modeling" },
  "/anesthesia": { title: "Anesthesia Calculator", subtitle: "Base, time and modifier unit modeling" },
  "/npi": { title: "NPI Lookup", subtitle: "NPPES provider registry search" },
  "/codelookup": { title: "POS & Modifiers", subtitle: "Place of service and modifier reference" },
  "/druglookup": { title: "Drug / NDC Lookup", subtitle: "FDA NDC drug database" },
  "/voice-transcription": { title: "Clinical Transcription", subtitle: "Medical voice-to-record transcription" },
  "/intelligence": { title: "Coverage & Guidelines", subtitle: "Medicare LCD/NCD, payer policies and coding guidelines" },
  "/coverage": { title: "Coverage & Guidelines", subtitle: "Medicare LCD/NCD, payer policies and coding guidelines" },
  "/favorites": { title: "Saved Workspace", subtitle: "Curated codes and coding references" },
  "/settings": { title: "Settings", subtitle: "Profile, preferences and account controls" },
};

function getPageMeta(pathname: string) {
  if (pathname?.startsWith("/intel/")) {
    return { title: "Code Details", subtitle: "Code context, RVU, policies and compliance signals" };
  }
  return PAGE_TITLES[pathname] || { title: "Codical Health", subtitle: "Healthcare coding workflow platform" };
}

export function TopBar() {
  const [location] = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  const page = useMemo(() => getPageMeta(location), [location]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (typing) return;

      if (event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="app-topbar">
      <div className="app-page-title">
        <h1>{page.title}</h1>
        <p>{page.subtitle}</p>
      </div>

      <button type="button" onClick={() => setSearchOpen(true)} className="app-global-search" aria-label="Open search">
        <Search size={18} />
        <span>Search codes, descriptions, guidelines, docs...</span>
        <kbd><Command size={12} /> /</kbd>
      </button>

      <div className="app-topbar-actions">
        <button type="button" onClick={() => setSearchOpen(true)} className="app-icon-button app-mobile-search" aria-label="Open search">
          <Search size={18} />
        </button>
        <button type="button" onClick={toggleTheme} className="app-icon-button" aria-label="Toggle theme">
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button type="button" className="app-icon-button app-notification-button" aria-label="Notifications">
          <Bell size={18} />
          <span />
        </button>
        <UserProfileMenu />
      </div>

      <UnifiedSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
