import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  Search, Brain, Shield, Activity, BookOpen, Pill,
  User, FileText, TrendingUp, Clock, ArrowRight,
  Zap, Hash, ChevronRight, BarChart2, Building2
} from "lucide-react";
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts";

const TOOLS = [
  { href: "/search", icon: Search, label: "Code Search", desc: "ICD-10, CPT, HCPCS", variant: "forest" },
  { href: "/intel/99213", icon: Zap, label: "Code Intelligence", desc: "Full code details", variant: "aurora" },
  { href: "/workspace", icon: Brain, label: "AI Op Note Coder", desc: "Auto-code documents", variant: "ocean" },
  { href: "/intelligence", icon: BookOpen, label: "Intelligence Hub", desc: "National coverage & guidelines", variant: "forest" },
  { href: "/rvu", icon: BarChart2, label: "RVU Calculator", desc: "Fee schedule data", variant: "forest" },
  { href: "/anesthesia", icon: Activity, label: "Anesthesia Calc", desc: "Auto base units", variant: "coral" },
  { href: "/npi", icon: User, label: "NPI Lookup", desc: "Provider registry", variant: "aurora" },
  { href: "/druglookup", icon: Pill, label: "Drug Lookup", desc: "FDA NDC database", variant: "sunrise" },
  { href: "/codelookup", icon: Hash, label: "POS & Modifiers", desc: "Code reference", variant: "forest" },
];

const DB_STATS = [
  { label: "ICD-10-CM Codes", value: "98,200", icon: FileText, color: "#0369A1" },
  { label: "CPT Codes", value: "9,657", icon: Hash, color: "#15803D" },
  { label: "NCCI Edits", value: "1.6M+", icon: Shield, color: "#EA580C" },
  { label: "LCD Policies", value: "Live", icon: BookOpen, color: "#7C3AED" },
];

const TRENDING_CODES = [
  { code: "99213", type: "CPT", desc: "Office Visit, Established" },
  { code: "99214", type: "CPT", desc: "Office Visit, Established, Mod" },
  { code: "45378", type: "CPT", desc: "Colonoscopy, Diagnostic" },
  { code: "Z23", type: "ICD-10", desc: "Encounter for Immunization" },
  { code: "G0439", type: "HCPCS", desc: "Annual Wellness Visit" },
  { code: "M54.5", type: "ICD-10", desc: "Low Back Pain" },
];

const WEEK_DATA = [
  { day: "Mon", searches: 42 }, { day: "Tue", searches: 78 },
  { day: "Wed", searches: 55 }, { day: "Thu", searches: 91 },
  { day: "Fri", searches: 63 }, { day: "Sat", searches: 30 },
  { day: "Sun", searches: 48 },
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  CPT: { bg: "bg-emerald-50", text: "text-emerald-600" },
  "ICD-10": { bg: "bg-sky-50", text: "text-sky-600" },
  HCPCS: { bg: "bg-amber-50", text: "text-amber-600" },
};

const ICON_BG: Record<string, string> = {
  forest: "from-emerald-100/80 to-green-50/50",
  ocean: "from-sky-100/80 to-blue-50/50",
  aurora: "from-violet-100/80 to-purple-50/50",
  sunrise: "from-amber-100/80 to-orange-50/50",
  coral: "from-pink-100/80 to-rose-50/50",
};
const ICON_CLR: Record<string, string> = {
  forest: "text-emerald-600", ocean: "text-sky-600",
  aurora: "text-violet-600", sunrise: "text-amber-600", coral: "text-pink-600",
};

export function Home() {
  const [, setLocation] = useLocation();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [greeting, setGreeting] = useState("Good morning");
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
    try {
      const history = JSON.parse(localStorage.getItem("codicalhealth_search_history") || "[]");
      setRecentSearches(history.slice(0, 6));
    } catch {}
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto min-h-screen">
      {/* Hero welcome banner */}
      <div className="relative overflow-hidden px-6 py-7" style={{ background: "linear-gradient(135deg, #14532D 0%, #0C4A6E 50%, #1E1B4B 100%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute rounded-full" style={{ width: "400px", height: "400px", top: "-200px", left: "-100px", background: "radial-gradient(circle, rgba(74,222,128,0.15), transparent)", filter: "blur(60px)" }} />
          <div className="absolute rounded-full" style={{ width: "300px", height: "300px", bottom: "-100px", right: "-50px", background: "radial-gradient(circle, rgba(56,189,248,0.15), transparent)", filter: "blur(60px)" }} />
        </div>
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-end gap-[3px] h-8">
              {[{c:"#E8541A",h:16},{c:"#C43B0E",h:22},{c:"#1B2F6E",h:28},{c:"#F0A500",h:22},{c:"#E8541A",h:16}].map((b,i) => (
                <div key={i} className="w-[5px] rounded-sm" style={{ backgroundColor: b.c, height: b.h+"px" }} />
              ))}
            </div>
            <div>
              <div className="text-xl font-extrabold text-white">{greeting} ðŸ‘‹</div>
              <div className="text-sm text-white/40 mt-0.5">{time.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              { label: "CY 2026", sub: "Fee Schedule", color: "#4ADE80" },
              { label: "FY 2026", sub: "ICD-10-CM", color: "#38BDF8" },
              { label: "Live", sub: "CMS Data", color: "#FBBF24" },
            ].map((badge, i) => (
              <div key={i} className="px-3 py-2 rounded-xl text-center bg-white/10 dark:bg-white/5 border border-white/10 dark:border-white/10">
                <div className="text-sm font-extrabold" style={{ color: badge.color }}>{badge.label}</div>
                <div className="text-[10px] text-white/40 font-semibold">{badge.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-[1100px] mx-auto space-y-6">
        {/* DB Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {DB_STATS.map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="rounded-2xl p-4 flex items-center gap-3 appGlass appCard border border-white/15 dark:border-white/10">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: stat.color + "15" }}>
                <stat.icon size={20} color={stat.color} />
              </div>
              <div>
                <div className="text-xl font-black text-foreground leading-none">{stat.value}</div>
                <div className="text-[11px] text-muted-foreground font-semibold mt-1">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          {/* Tools grid */}
          <div>
            <div className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Zap size={14} className="text-emerald-500" /> Professional Workbench
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TOOLS.map((tool, i) => (
                <motion.button key={i} onClick={() => setLocation(tool.href)}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="p-3.5 rounded-2xl flex items-center gap-3 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group appGlass appCard border border-white/15 dark:border-white/10">
                  <div className={"w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 " + (ICON_BG[tool.variant] || ICON_BG.forest)}>
                    <tool.icon size={18} className={ICON_CLR[tool.variant] || ICON_CLR.forest} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground">{tool.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{tool.desc}</div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground/50 group-hover:text-emerald-500 transition-colors" />
                </motion.button>
              ))}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Recent searches */}
            <div className="rounded-2xl p-4 appGlass appCard border border-white/15 dark:border-white/10">
              <div className="text-xs font-bold text-foreground mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2"><Clock size={13} className="text-emerald-500" /> Recent Searches</span>
                {recentSearches.length > 0 && (
                  <button onClick={() => { localStorage.removeItem("codicalhealth_search_history"); setRecentSearches([]); }} className="text-[10px] text-muted-foreground/70 hover:text-muted-foreground">Clear</button>
                )}
              </div>
              {recentSearches.length > 0 ? (
                <div className="space-y-1.5">
                  {recentSearches.map((s, i) => (
                    <button key={i} onClick={() => setLocation("/intel/" + s.split(" â€” ")[0])} className="w-full flex items-center gap-2 px-3 py-2 bg-background/40 backdrop-blur-md border border-white/10 dark:border-white/10 rounded-lg hover:bg-emerald-500/10 transition-colors text-left">
                      <Clock size={11} className="text-muted-foreground/50 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">{s}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground/70">No recent searches yet</div>
              )}
            </div>

            {/* Trending codes */}
            <div className="rounded-2xl p-4 appGlass appCard border border-white/15 dark:border-white/10">
              <div className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp size={13} className="text-emerald-500" /> Trending Codes
              </div>
              <div className="space-y-1.5">
                {TRENDING_CODES.map((c, i) => {
                  const s = TYPE_COLORS[c.type] || TYPE_COLORS["CPT"];
                  return (
                    <button key={i} onClick={() => setLocation("/intel/" + c.code)} className="w-full flex items-center gap-2 px-3 py-2 bg-background/40 backdrop-blur-md border border-white/10 dark:border-white/10 rounded-lg hover:bg-emerald-500/10 transition-colors text-left">
                      <span className={"px-1.5 py-0.5 rounded text-[10px] font-bold font-mono flex-shrink-0 " + s.bg + " " + s.text}>{c.code}</span>
                      <span className="text-xs text-muted-foreground truncate flex-1">{c.desc}</span>
                      <ChevronRight size={11} className="text-muted-foreground/50" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Activity chart */}
        <div className="rounded-2xl p-5 appGlass appCard border border-white/15 dark:border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart2 size={14} className="text-emerald-500" /> Search Activity This Week
            </div>
            <span className="text-[11px] text-muted-foreground/70">Sample data</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={WEEK_DATA}>
              <defs>
                <linearGradient id="colorSearches" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4ADE80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--app-glass-border)", fontSize: "12px", background: "var(--app-glass-strong-bg)", backdropFilter: "blur(18px)", color: "hsl(var(--foreground))" }} />
              <Area type="monotone" dataKey="searches" stroke="#15803D" strokeWidth={2} fill="url(#colorSearches)" dot={{ fill: "#15803D", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* CMS Updates banner */}
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: "linear-gradient(135deg, rgba(240,253,244,0.8), rgba(240,249,255,0.8))", border: "1px solid rgba(74,222,128,0.2)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #15803D, #0369A1)" }}>
            <Zap size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-foreground">CY 2026 Data Active</div>
            <div className="text-xs text-muted-foreground mt-0.5">RVU data, anesthesia conversion factors, and NCCI edits current for CY 2026. ICD-10-CM FY2026 effective Oct 1, 2025.</div>
          </div>
          <button onClick={() => setLocation("/guidelines")} className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 flex-shrink-0 hover:scale-105 transition-transform" style={{ background: "linear-gradient(135deg, #15803D, #0369A1)" }}>
            View <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

