import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Ban,
  Boxes,
  ChevronDown,
  Database,
  Home,
  LogOut,
  Menu,
  Search,
  Send,
  Settings,
  Table2,
  TrendingUp,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type NavSection = "WORKSPACE" | "DATA OPS" | "CONFIGURATION";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section: NavSection;
  badge?: string;
  live?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: Home, section: "WORKSPACE" },
  { href: "/search", label: "Leads", icon: Table2, section: "WORKSPACE", badge: "8,214" },
  { href: "/analytics", label: "Enrichment Waterfall", icon: TrendingUp, section: "WORKSPACE" },
  { href: "/chat", label: "Sequences", icon: Send, section: "WORKSPACE", live: "3 live" },
  { href: "/workspace", label: "Segments", icon: Boxes, section: "WORKSPACE" },
  { href: "/intelligence", label: "Sources", icon: Database, section: "DATA OPS", badge: "32" },
  { href: "/compliance", label: "Suppression", icon: Ban, section: "DATA OPS" },
  { href: "/settings", label: "Settings", icon: Settings, section: "CONFIGURATION" },
];

const SECTIONS: NavSection[] = ["WORKSPACE", "DATA OPS", "CONFIGURATION"];

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
        <span className="app-sidebar-mark" aria-hidden="true">CH</span>
        <span className="app-sidebar-brand-copy">
          <strong>Codical</strong>
          <em>Revenue Intelligence OS</em>
        </span>
      </Link>

      <button type="button" className="app-workspace-switch" onClick={() => setLocation("/dashboard")}>
        <span aria-hidden="true" />
        <strong>New Jersey — RCM Q3</strong>
        <ChevronDown size={14} />
      </button>

      <button type="button" className="app-sidebar-search" onClick={() => setLocation("/search")} aria-label="Open search">
        <Search size={15} />
        <span>Search or jump to...</span>
        <kbd>⌘K</kbd>
      </button>

      <nav className="app-sidebar-scroll" aria-label="Main navigation">
        {groupedItems.map(({ section, items }) => (
          <section className="app-nav-section" key={section}>
            <p>{section}</p>
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
                    {item.live ? <b>{item.live}</b> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        <div className="app-sidebar-usage">
          <div className="app-sidebar-usage-head">
            <strong>AI credits used</strong>
            <span>6,420 / 10,000</span>
          </div>
          <div className="app-sidebar-meter" aria-hidden="true"><span /></div>
          <p>Free plan resets in 12 days. Upgrade for unlimited enrichment + live sending.</p>
          <button type="button" onClick={() => setLocation("/settings")}>Upgrade Plan</button>
        </div>

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
