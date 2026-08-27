import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AudioLines,
  BadgeInfo,
  BookOpen,
  Calculator,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ClipboardCheck,
  CircleDollarSign,
  FileChartColumnIncreasing,
  FileCode2,
  Dna,
  GitCompareArrows,
  Home,
  LogOut,
  Menu,
  MessagesSquare,
  Pill,
  Search,
  ShieldCheck,
  Settings,
  Stethoscope,
  Tag,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { BrandMark } from "@/components/BrandMark";

type NavSection = "MAIN" | "TOOLS" | "ACCOUNT";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section: NavSection;
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, section: "MAIN" },
  { href: "/revenue-integrity", label: "Revenue Integrity", icon: CircleDollarSign, section: "MAIN", badge: "New" },
  { href: "/intelligence", label: "Coverage & Guidelines", icon: BookOpen, section: "MAIN", badge: "Live" },
  { href: "/crosswalk", label: "ICD/CPT Crosswalk", icon: GitCompareArrows, section: "MAIN" },
  { href: "/search", label: "Code Search", icon: Search, section: "MAIN" },
  { href: "/specialty", label: "Specialty Coding", icon: Dna, section: "MAIN" },
  { href: "/workspace", label: "AI Coder", icon: FileCode2, section: "MAIN" },
  { href: "/voice-transcription", label: "Clinical Transcription", icon: AudioLines, section: "MAIN" },
  { href: "/chat", label: "Team Chat", icon: MessagesSquare, section: "MAIN" },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesColumnIncreasing, section: "MAIN" },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck, section: "MAIN" },
  { href: "/ncci", label: "NCCI Checker", icon: GitCompareArrows, section: "TOOLS" },
  { href: "/claim-validator", label: "Claim Validator", icon: ClipboardCheck, section: "TOOLS" },
  { href: "/rvu", label: "RVU Calculator", icon: Calculator, section: "TOOLS" },
  { href: "/anesthesia", label: "Anesthesia Calculator", icon: Stethoscope, section: "TOOLS" },
  { href: "/npi", label: "NPI Lookup", icon: BadgeInfo, section: "TOOLS" },
  { href: "/codelookup", label: "POS & Modifiers", icon: Tag, section: "TOOLS" },
  { href: "/druglookup", label: "Drug Lookup", icon: Pill, section: "TOOLS" },
  { href: "/reports", label: "Reports", icon: FileChartColumnIncreasing, section: "ACCOUNT" },
  { href: "/settings", label: "Settings", icon: Settings, section: "ACCOUNT" },
];

const SECTIONS: NavSection[] = ["MAIN", "TOOLS", "ACCOUNT"];
const SECTION_LABELS: Record<NavSection, string> = {
  MAIN: "Command center",
  TOOLS: "Validation tools",
  ACCOUNT: "Workspace",
};

function isActiveRoute(location: string, href: string) {
  return location === href || (href !== "/dashboard" && location.startsWith(href));
}

export function IconRail() {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { toast } = useToast();

  const groupedItems = useMemo(
    () => SECTIONS.map((section) => ({ section, items: NAV_ITEMS.filter((item) => item.section === section) })),
    [],
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out", description: "See you next time." });
  };

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="app-sidebar-inner">
      <div className="app-sidebar-titlebar">
        <div className="app-sidebar-window-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {mobile ? (
          <button type="button" onClick={() => setMobileOpen(false)} className="app-sidebar-close" aria-label="Close navigation">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <Link href="/dashboard" onClick={() => mobile && setMobileOpen(false)} aria-label="Codical dashboard" className="app-sidebar-brand">
        <BrandMark compact />
        <span className="app-sidebar-brand-copy">
          <strong>Codical Health</strong>
          <em>Revenue Intelligence OS</em>
        </span>
      </Link>

      <button type="button" className="app-workspace-switch" onClick={() => setLocation("/dashboard")}>
        <span aria-hidden="true" />
        <strong>Revenue cycle workspace</strong>
        <ChevronDown size={14} />
      </button>

      <button type="button" className="app-sidebar-search" onClick={() => setLocation("/search")} aria-label="Open search">
        <Search size={15} />
        <span>Search or jump to...</span>
        <kbd>Ctrl K</kbd>
      </button>

      <nav className="app-sidebar-scroll" aria-label="Main navigation">
        {groupedItems.map(({ section, items }) => (
          <div key={section}>
            <section className="app-nav-section">
              <p>{SECTION_LABELS[section]}</p>
              <div className="app-nav-list">
                {items.map((item) => {
                  const active = isActiveRoute(location, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => mobile && setMobileOpen(false)}
                      className={`app-nav-item${active ? " is-active" : ""}`}
                    >
                      <span className="app-nav-glyph" aria-hidden="true">
                        <item.icon size={15} />
                      </span>
                      <span className="app-nav-text">{item.label}</span>
                      {item.badge ? <em>{item.badge}</em> : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        <div className="app-sidebar-profile">
          <span aria-hidden="true">FY</span>
          <div>
            <strong>Farrukh Yaqoob</strong>
            <em>Teksoft Solutions</em>
          </div>
          <button
            type="button"
            onClick={() => {
              handleLogout();
              if (mobile) setMobileOpen(false);
            }}
            aria-label="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!mobileOpen ? (
        <button type="button" onClick={() => setMobileOpen(true)} className="app-mobile-menu-button" aria-label="Open navigation">
          <Menu size={20} />
        </button>
      ) : null}

      {mobileOpen ? (
        <>
          <div className="app-sidebar-overlay" onClick={() => setMobileOpen(false)} />
          <aside className="app-sidebar app-sidebar-mobile">
            <NavContent mobile />
          </aside>
        </>
      ) : null}

      <aside className="app-sidebar app-sidebar-desktop">
        <NavContent />
      </aside>
    </>
  );
}
