import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  BarChart2,
  BookOpen,
  Bookmark,
  Calculator,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Pill,
  Search,
  Settings,
  Shield,
  Tag,
  User,
  X,
  Brain,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "MAIN" },
  { href: "/intelligence", label: "Coverage & Guidelines", icon: BookOpen, section: "MAIN", badge: "Live" },
  { href: "/search", label: "Code Search", icon: Search, section: "MAIN" },
  { href: "/workspace", label: "Codical AI Coder", icon: Brain, section: "MAIN" },
  { href: "/voice-transcription", label: "Codical AI Transcription", icon: Mic, section: "MAIN" },
  { href: "/chat", label: "Codical Chat", icon: MessageSquare, section: "MAIN" },
  { href: "/analytics", label: "Analytics", icon: BarChart2, section: "MAIN" },
  { href: "/compliance", label: "Compliance", icon: Shield, section: "ADMIN", badge: "Review" },
  { href: "/ncci", label: "NCCI Checker", icon: Shield, section: "TOOLS" },
  { href: "/rvu", label: "RVU Calculator", icon: Calculator, section: "TOOLS" },
  { href: "/anesthesia", label: "Anesthesia Calc", icon: Activity, section: "TOOLS" },
  { href: "/npi", label: "NPI Lookup", icon: User, section: "TOOLS" },
  { href: "/codelookup", label: "POS & Modifiers", icon: Tag, section: "TOOLS" },
  { href: "/druglookup", label: "Drug Lookup", icon: Pill, section: "TOOLS" },
  { href: "/reports", label: "Reports", icon: FileBarChart, section: "TOOLS" },
  { href: "/favorites", label: "Saved Workspace", icon: Bookmark, section: "TOOLS" },
];

export function IconRail() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out", description: "See you next time." });
  };

  const sections = ["MAIN", "ADMIN", "TOOLS"] as const;

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="h-[76px] flex items-center px-4 border-b border-[var(--co-line)] gap-3">
        <Link href="/dashboard" onClick={() => mobile && setMobileOpen(false)} className="min-w-0">
          <BrandMark />
        </Link>
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto p-2 hover:bg-white/10 rounded-full transition-colors" aria-label="Close navigation">
            <X className="w-5 h-5 text-[var(--co-muted)]" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {sections.map(section => (
          <div key={section} className="mb-6">
            <p className="px-3 mb-2 text-[10px] font-black text-[var(--co-muted)] uppercase tracking-[0.22em]">{section}</p>
            <div className="grid gap-1.5">
              {NAV_ITEMS.filter(item => item.section === section).map(item => {
                const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      onClick={() => { if (mobile) setMobileOpen(false); }}
                      className={
                        "co-nav-pill flex items-center gap-3 px-3 py-2.5 rounded-[17px] cursor-pointer transition-all border " +
                        (isActive
                          ? "bg-[rgba(55,208,198,0.10)] border-[rgba(55,208,198,0.22)] text-[var(--co-ink)] shadow-[0_0_24px_rgba(55,208,198,0.08)]"
                          : "border-transparent text-[var(--co-muted)] hover:bg-white/10 hover:border-[var(--co-line)] hover:text-[var(--co-ink)]")
                      }
                    >
                      <item.icon className={isActive ? "co-nav-pill-icon w-5 h-5 text-[var(--co-cyan)]" : "co-nav-pill-icon w-5 h-5"} />
                      <span className="text-sm font-bold truncate">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto text-[9px] font-black text-[var(--co-cyan)] border border-[rgba(55,208,198,0.24)] bg-[rgba(55,208,198,0.10)] px-1.5 py-0.5 rounded-full uppercase">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--co-line)] p-3 grid gap-1">
        <Link href="/settings">
          <div className="co-nav-pill flex items-center gap-3 px-3 py-2.5 rounded-[17px] text-[var(--co-muted)] hover:bg-white/10 hover:text-[var(--co-ink)] cursor-pointer transition-all">
            <Settings className="w-5 h-5" />
            <span className="text-sm font-bold">Settings</span>
          </div>
        </Link>
        <button onClick={() => { handleLogout(); if (mobile) setMobileOpen(false); }} className="co-nav-pill w-full flex items-center gap-3 px-3 py-2.5 rounded-[17px] text-[var(--co-muted)] hover:bg-red-500/10 hover:text-red-300 cursor-pointer transition-all text-left">
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-bold">Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(true)} className="lg:hidden fixed top-4 left-4 z-50 p-2.5 co-shell-surface rounded-full text-[var(--co-muted)] hover:text-[var(--co-ink)] transition-colors appFocusRing" aria-label="Open navigation">
        <Menu className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:hidden fixed inset-0 bg-black/55 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="lg:hidden fixed left-0 top-0 bottom-0 w-72 z-50 shadow-2xl co-shell-surface border-r border-[var(--co-line)]">
              <NavContent mobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden lg:flex flex-col w-72 co-shell-surface border-r border-[var(--co-line)]">
        <NavContent />
      </aside>
    </>
  );
}
