import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Stethoscope, LayoutDashboard, Search, Bookmark, FileText,
  BarChart2, FileBarChart, ChevronLeft, ChevronRight,
  Shield, Bell, Settings, LogOut, Calculator, Tag
, Pill} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard, section: "main" },
  { href: "/search", label: "Code Search", icon: Search, section: "main" },
  { href: "/analytics", label: "Analytics", icon: BarChart2, section: "main" },
  { href: "/guidelines", label: "CMS Guidelines", icon: FileText, section: "main", badge: "Live" },
  { href: "/favorites", label: "Workspace", icon: Bookmark, section: "main" },
  { href: "/reports", label: "Reports", icon: FileBarChart, section: "tools" },
  { href: "/ncci", label: "NCCI Checker", icon: Shield, section: "tools" },
  { href: "/intelligence", label: "Coverage & Guidelines", icon: FileText, section: "tools" },
  { href: "/rvu", label: "RVU Calculator", icon: Calculator, section: "tools" },
  { href: "/anesthesia", label: "Anesthesia Calc", icon: Calculator, section: "tools" },
  { href: "/npi", label: "NPI Lookup", icon: Search, section: "tools" },
  { href: "/codelookup", label: "POS & Modifiers", icon: Tag, section: "tools" },
  { href: "/druglookup", label: "Drug Lookup", icon: Pill, section: "tools" },
];

const bottomItems = [
  { href: "#", label: "Compliance", icon: Shield },
  { href: "#", label: "Settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="relative h-screen flex flex-col bg-[#0057A8] shadow-2xl shadow-primary/30 z-30 flex-shrink-0 overflow-hidden"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-[#F28C28]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative flex items-center h-20 px-4 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 flex-shrink-0 bg-white/20 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/20">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col min-w-0"
              >
                <span className="text-lg font-black text-white leading-none tracking-tighter">CODICAL</span>
                <span className="text-xs font-bold text-[#F28C28] leading-none tracking-widest uppercase">Health</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
        <button
          onClick={onToggle}
          className="ml-auto flex-shrink-0 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="relative flex-1 overflow-y-auto overflow-x-hidden py-6 px-3 space-y-1">
        <AnimatePresence>
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40"
            >
              Main
            </motion.p>
          )}
        </AnimatePresence>

        {navItems.filter(i => i.section === "main").map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: collapsed ? 0 : 4 }}
                className={`
                  relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200
                  ${isActive
                    ? "bg-white text-[#0057A8] shadow-lg shadow-black/20"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#F28C28] rounded-r-full"
                  />
                )}
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-[#0057A8]" : ""}`} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex items-center justify-between flex-1 overflow-hidden"
                    >
                      <span className="text-sm font-bold whitespace-nowrap">{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] font-black bg-[#F28C28] text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                          {item.badge}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}

        <AnimatePresence>
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 mt-6 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40"
            >
              Tools
            </motion.p>
          )}
        </AnimatePresence>

        {navItems.filter(i => i.section === "tools").map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: collapsed ? 0 : 4 }}
                className={`
                  relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200
                  ${isActive
                    ? "bg-white text-[#0057A8] shadow-lg"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-bold whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-white/10 py-4 px-3 space-y-1">
        {bottomItems.map((item) => (
          <motion.div
            key={item.label}
            whileHover={{ x: collapsed ? 0 : 4 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:bg-white/10 hover:text-white cursor-pointer transition-all"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-bold whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 mx-0 p-3 bg-white/10 rounded-xl border border-white/10"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F28C28] flex items-center justify-center font-black text-white text-sm flex-shrink-0">
                  CH
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">Admin User</p>
                  <p className="text-xs text-white/50 truncate">Senior Coder</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

