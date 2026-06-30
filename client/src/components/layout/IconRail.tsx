import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  BarChart2,
  BadgeCheck,
  BookOpen,
  Brain,
  Calculator,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Pill,
  PlusCircle,
  Search,
  Settings,
  Shield,
  Tag,
  User,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type NavSection = "MAIN" | "TOOLS";
type NavTone = "blue" | "teal" | "orange" | "violet" | "mint" | "slate";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section: NavSection;
  hint: string;
  tone: NavTone;
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "MAIN", hint: "Live command", tone: "blue" },
  { href: "/intelligence", label: "Coverage & Guidelines", icon: BookOpen, section: "MAIN", hint: "MCD, payer, crosswalk", tone: "teal", badge: "Live" },
  { href: "/search", label: "Code Search", icon: Search, section: "MAIN", hint: "ICD, CPT, HCPCS", tone: "violet" },
  { href: "/workspace", label: "AI Coder", icon: Brain, section: "MAIN", hint: "Review workspace", tone: "orange" },
  { href: "/voice-transcription", label: "Clinical Transcription", icon: Mic, section: "MAIN", hint: "Voice to note", tone: "mint" },
  { href: "/chat", label: "Team Chat", icon: MessageSquare, section: "MAIN", hint: "Coder collaboration", tone: "slate" },
  { href: "/analytics", label: "Analytics", icon: BarChart2, section: "MAIN", hint: "Revenue signals", tone: "blue" },
  { href: "/compliance", label: "Compliance", icon: Shield, section: "MAIN", hint: "Audit controls", tone: "teal" },
  { href: "/ncci", label: "NCCI Checker", icon: Shield, section: "TOOLS", hint: "Edit conflicts", tone: "orange" },
  { href: "/claim-validator", label: "Claim Validator", icon: ClipboardCheck, section: "TOOLS", hint: "Payer readiness", tone: "blue" },
  { href: "/rvu", label: "RVU Calculator", icon: Calculator, section: "TOOLS", hint: "Fee schedule", tone: "violet" },
  { href: "/anesthesia", label: "Anesthesia Calculator", icon: Activity, section: "TOOLS", hint: "Base + time units", tone: "mint" },
  { href: "/npi", label: "NPI Lookup", icon: User, section: "TOOLS", hint: "NPPES registry", tone: "teal" },
  { href: "/codelookup", label: "POS & Modifiers", icon: Tag, section: "TOOLS", hint: "Claim metadata", tone: "slate" },
  { href: "/druglookup", label: "Drug Lookup", icon: Pill, section: "TOOLS", hint: "NDC database", tone: "orange" },
  { href: "/reports", label: "Reports", icon: FileBarChart, section: "TOOLS", hint: "Export packets", tone: "blue" },
];

const SECTIONS: NavSection[] = ["MAIN", "TOOLS"];
const SECTION_LABELS: Record<NavSection, string> = {
  MAIN: "Command center",
  TOOLS: "Validation tools",
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

  const startNewClaim = (mobile = false) => {
    setLocation("/workspace");
    if (mobile) setMobileOpen(false);
  };

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="app-sidebar-inner">
      <div className="app-sidebar-brand">
        <Link href="/dashboard" onClick={() => mobile && setMobileOpen(false)} aria-label="Codical Health dashboard" className="app-sidebar-brand-link">
          <BrandMark />
        </Link>
        {mobile ? (
          <button type="button" onClick={() => setMobileOpen(false)} className="app-sidebar-close" aria-label="Close navigation">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="app-sidebar-status" aria-label="Coding operations status">
        <span><BadgeCheck size={15} /> Operations live</span>
        <strong>72 claims in review</strong>
        <p>NCCI, payer policy, crosswalk and NPI checks synced 2 min ago.</p>
      </div>

      <button type="button" className="app-sidebar-claim-cta" onClick={() => startNewClaim(mobile)}>
        <PlusCircle size={17} />
        <span>Start claim review</span>
      </button>

      <nav className="app-sidebar-nav" aria-label="Main navigation">
        {groupedItems.map(({ section, items }) => (
          <section className="app-nav-section" key={section}>
            <p>{SECTION_LABELS[section]}</p>
            <div className="app-nav-list">
              {items.map((item) => {
                const active = isActiveRoute(location, item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => mobile && setMobileOpen(false)} className={`app-nav-item${active ? " is-active" : ""}`}>
                    <span className={`app-nav-icon tone-${item.tone}`} aria-hidden="true">
                      <item.icon size={17} />
                    </span>
                    <span className="app-nav-copy">
                      <span className="app-nav-label">{item.label}</span>
                      <small>{item.hint}</small>
                    </span>
                    {item.badge ? <em>{item.badge}</em> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        <div className="app-sidebar-user-card">
          <User size={15} />
          <div>
            <strong>Certified coder</strong>
            <span>Coding operations</span>
          </div>
        </div>
        <Link href="/settings" onClick={() => mobile && setMobileOpen(false)} className={`app-nav-item${isActiveRoute(location, "/settings") ? " is-active" : ""}`}>
          <span className="app-nav-icon tone-slate" aria-hidden="true">
            <Settings size={17} />
          </span>
          <span className="app-nav-copy">
            <span className="app-nav-label">Settings</span>
            <small>Account controls</small>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => {
            handleLogout();
            if (mobile) setMobileOpen(false);
          }}
          className="app-nav-item app-nav-logout"
        >
          <span className="app-nav-icon tone-slate" aria-hidden="true">
            <LogOut size={17} />
          </span>
          <span className="app-nav-copy">
            <span className="app-nav-label">Sign out</span>
            <small>End session</small>
          </span>
        </button>
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
