import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Search, Bookmark, FileText,
  BarChart2, FileBarChart, Shield, Calculator, Tag,
  Settings, LogOut, Pill, Menu, X, Activity, User, MessageSquare,
  ClipboardList, Building2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "MAIN" },
  { href: "/intelligence", label: "Intelligence Hub", icon: BookOpen, section: "MAIN", badge: "New" },
  { href: "/search", label: "Code Search", icon: Search, section: "MAIN" },
  { href: "/chat", label: "Team Chat", icon: MessageSquare, section: "MAIN" },
  { href: "/compliance", label: "Compliance", icon: Shield, section: "ADMIN", badge: "Lock" },
  { href: "/analytics", label: "Analytics", icon: BarChart2, section: "MAIN" },
  { href: "/workspace", label: "AI Op Note Coder", icon: Bookmark, section: "MAIN" },

  { href: "/ncci", label: "NCCI Checker", icon: Shield, section: "TOOLS" },
  { href: "/coverage", label: "Coverage Policies", icon: FileText, section: "TOOLS" },
  { href: "/rvu", label: "RVU Calculator", icon: Calculator, section: "TOOLS" },
  { href: "/anesthesia", label: "Anesthesia Calc", icon: Activity, section: "TOOLS" },
  { href: "/npi", label: "NPI Lookup", icon: User, section: "TOOLS" },
  { href: "/codelookup", label: "POS & Modifiers", icon: Tag, section: "TOOLS" },
  { href: "/druglookup", label: "Drug Lookup", icon: Pill, section: "TOOLS" },
  { href: "/reports", label: "Reports", icon: FileBarChart, section: "TOOLS" },
];

const BAR_COLORS = [
  { c: "#E8541A", h: 10 },
  { c: "#C43B0E", h: 14 },
  { c: "#1B2F6E", h: 18 },
  { c: "#F0A500", h: 14 },
  { c: "#E8541A", h: 10 },
];

export function IconRail() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out", description: "See you next time!" });
  };

  const sections = ["MAIN", "ADMIN", "TOOLS"] as const;

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center px-4 border-b border-emerald-700/20 gap-3">
        <div className="flex items-end gap-[3px] h-7">
          {BAR_COLORS.map((bar, i) => (
            <div key={i} className="rounded-sm" style={{ width: "4px", backgroundColor: bar.c, height: bar.h + "px" }} />
          ))}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black text-white tracking-wide">CODICAL</span>
          <span className="text-[9px] text-emerald-300 font-bold tracking-wider">HEALTH</span>
        </div>
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/70" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {sections.map(section => (
          <div key={section}>
            <p className="px-3 mb-2 text-[9px] font-black text-emerald-300/40 uppercase tracking-widest">{section}</p>
            <div className="space-y-1">
              {NAV_ITEMS.filter(i => i.section === section).map(item => {
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      onClick={() => { if (mobile) setMobileOpen(false); }}
                      className={"flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all " + (isActive ? "bg-white/95 text-emerald-800 shadow-lg shadow-emerald-900/20" : "text-white/70 hover:bg-white/10 hover:text-white")}
                    >
                      <item.icon className={"w-5 h-5 flex-shrink-0 " + (isActive ? "text-emerald-600" : "")} />
                      <span className="text-sm font-bold whitespace-nowrap">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto text-[9px] font-black bg-emerald-400 text-white px-1.5 py-0.5 rounded-full uppercase">{item.badge}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-emerald-700/20 p-3 space-y-1">
        <Link href="/settings">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white cursor-pointer transition-all">
            <Settings className="w-5 h-5" />
            <span className="text-sm font-bold">Settings</span>
          </div>
        </Link>
        <button onClick={() => { handleLogout(); if (mobile) setMobileOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:bg-red-500/20 hover:text-red-400 cursor-pointer transition-all">
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-bold">Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(true)} className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-white rounded-xl shadow-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
        <Menu className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="lg:hidden fixed left-0 top-0 bottom-0 w-72 z-50 shadow-2xl" style={{ background: "linear-gradient(180deg, #14532D 0%, #0C4A6E 100%)" }}>
              <NavContent mobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden lg:flex flex-col w-64 border-r border-emerald-800/20" style={{ background: "linear-gradient(180deg, #14532D 0%, #0C4A6E 100%)" }}>
        <NavContent />
      </aside>
    </>
  );
}
