import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  Activity,
  ArrowRight,
  BarChart2,
  BookOpen,
  Brain,
  Calculator,
  Clock,
  FileText,
  Hash,
  Pill,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TOOLS = [
  { href: "/search", icon: Search, label: "Code Search", desc: "ICD-10, CPT, HCPCS" },
  { href: "/intel/99214", icon: Zap, label: "Code Intelligence", desc: "RVU, guidance and risk" },
  { href: "/workspace", icon: Brain, label: "Codical AI Coder", desc: "Suggest codes from notes" },
  { href: "/intelligence", icon: BookOpen, label: "Coverage Hub", desc: "LCD, NCD, payer policies" },
  { href: "/ncci", icon: Shield, label: "NCCI Checker", desc: "Code pair edit review" },
  { href: "/rvu", icon: Calculator, label: "RVU Calculator", desc: "Fee schedule modeling" },
  { href: "/anesthesia", icon: Activity, label: "Anesthesia Calc", desc: "Base and time units" },
  { href: "/npi", icon: User, label: "NPI Lookup", desc: "Provider registry" },
  { href: "/druglookup", icon: Pill, label: "Drug Lookup", desc: "NDC database" },
];

const DB_STATS = [
  { label: "ICD-10-CM Codes", value: "FY 2026", icon: FileText },
  { label: "CPT / HCPCS Search", value: "Live", icon: Hash },
  { label: "NCCI Review", value: "Edit check", icon: Shield },
  { label: "CMS Coverage", value: "LCD/NCD", icon: BookOpen },
];

const TRENDING_CODES = [
  { code: "99213", type: "CPT", desc: "Office visit, established" },
  { code: "99214", type: "CPT", desc: "Office visit, moderate" },
  { code: "45378", type: "CPT", desc: "Diagnostic colonoscopy" },
  { code: "Z23", type: "ICD-10", desc: "Encounter for immunization" },
  { code: "G0439", type: "HCPCS", desc: "Annual wellness visit" },
  { code: "M54.50", type: "ICD-10", desc: "Low back pain, unspecified" },
];

const WEEK_DATA = [
  { day: "Mon", searches: 42, reviews: 12 },
  { day: "Tue", searches: 78, reviews: 18 },
  { day: "Wed", searches: 55, reviews: 15 },
  { day: "Thu", searches: 91, reviews: 24 },
  { day: "Fri", searches: 63, reviews: 19 },
  { day: "Sat", searches: 30, reviews: 8 },
  { day: "Sun", searches: 48, reviews: 10 },
];

export function Home() {
  const [, setLocation] = useLocation();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem("codicalhealth_search_history") || "[]");
      setRecentSearches(history.slice(0, 6));
    } catch {
      setRecentSearches([]);
    }
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hour = time.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="co-dashboard">
      <div className="co-dashboard-grid">
        <div className="co-dashboard-hero">
          <section className="co-dashboard-card">
            <div className="co-eyebrow"><span className="co-live-dot" /> Command center</div>
            <h2>{greeting}. <span className="co-gradient-text">Route the next coding decision.</span></h2>
            <p className="mt-5 max-w-2xl text-[var(--co-muted)] leading-7">
              Start with search, AI review, NCCI, RVU, coverage or Codical Chat. Each tool is built to keep the code set,
              rationale and review trail close to the case.
            </p>
            <div className="co-hero-actions mt-6">
              <button className="co-btn co-btn-primary" onClick={() => setLocation("/workspace")}>
                Analyze op note <ArrowRight size={16} />
              </button>
              <button className="co-btn co-btn-ghost" onClick={() => setLocation("/search")}>
                Search codes
              </button>
            </div>
            <div className="co-trust-row mt-3">
              <span className="co-trust-pill"><Sparkles size={15} /> AI assistive review</span>
              <span className="co-trust-pill"><Shield size={15} /> NCCI and coverage checks</span>
              <span className="co-trust-pill"><Clock size={15} /> Audit-ready history</span>
            </div>
          </section>

          <section className="co-dashboard-card">
            <div className="co-dash-top">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--co-muted)]">Today</div>
                <h3 className="co-heading text-2xl font-black mt-1">Coding workload</h3>
              </div>
              <span className="co-badge">Live workspace</span>
            </div>
            <div className="co-code-table">
              {[
                ["128", "Cases routed", "Team"],
                ["18", "NCCI pairs checked", "Risk"],
                ["2.80", "Sample RVU estimate", "RVU"],
                ["4", "Open provider queries", "Query"],
              ].map((row) => (
                <div className="co-code-row" key={row[1]}>
                  <span className="co-mono co-green">{row[0]}</span>
                  <span>{row[1]}</span>
                  <span className="co-mono">{row[2]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {DB_STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="co-dashboard-card !p-4 flex items-center gap-3"
            >
              <div className="co-tool-icon"><stat.icon size={16} /></div>
              <div>
                <div className="text-xl font-black text-[var(--co-ink)] leading-none">{stat.value}</div>
                <div className="text-[11px] text-[var(--co-muted)] font-semibold mt-1">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-5">
          <section className="co-dashboard-card">
            <div className="co-dash-top">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--co-ink)]">
                <Zap size={15} className="text-[var(--co-cyan)]" /> Professional tool stack
              </div>
              <span className="text-[11px] text-[var(--co-muted)]">Daily workflow</span>
            </div>
            <div className="co-dashboard-tools">
              {TOOLS.map((tool, index) => (
                <motion.button
                  key={tool.href}
                  onClick={() => setLocation(tool.href)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.035 }}
                  className="co-dashboard-tool"
                >
                  <div className="co-tool-icon mb-3"><tool.icon size={15} /></div>
                  <div className="text-sm font-black text-[var(--co-ink)]">{tool.label}</div>
                  <div className="text-[12px] text-[var(--co-muted)] mt-1">{tool.desc}</div>
                </motion.button>
              ))}
            </div>
          </section>

          <aside className="grid gap-5">
            <section className="co-dashboard-card">
              <div className="text-xs font-bold text-[var(--co-ink)] mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2"><Clock size={13} className="text-[var(--co-cyan)]" /> Recent Searches</span>
                {recentSearches.length > 0 && (
                  <button onClick={() => { localStorage.removeItem("codicalhealth_search_history"); setRecentSearches([]); }} className="text-[10px] text-[var(--co-muted)] hover:text-[var(--co-ink)]">Clear</button>
                )}
              </div>
              {recentSearches.length > 0 ? (
                <div className="grid gap-1.5">
                  {recentSearches.map((item) => (
                    <button key={item} onClick={() => setLocation("/intel/" + item.split(" - ")[0])} className="co-tool-pill text-left">
                      <Clock size={12} />
                      <span className="truncate">{item}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-[var(--co-muted)]">No recent searches yet</div>
              )}
            </section>

            <section className="co-dashboard-card">
              <div className="text-xs font-bold text-[var(--co-ink)] mb-3 flex items-center gap-2">
                <TrendingUp size={13} className="text-[var(--co-cyan)]" /> Trending codes
              </div>
              <div className="grid gap-1.5">
                {TRENDING_CODES.map((code) => (
                  <button key={code.code} onClick={() => setLocation("/intel/" + code.code)} className="co-tool-pill text-left">
                    <span className="co-tool-icon co-mono">{code.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[var(--co-ink)]">{code.desc}</span>
                      <span className="block text-[10px] text-[var(--co-muted)]">{code.type}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <section className="co-dashboard-card">
          <div className="co-dash-top">
            <div className="text-sm font-bold text-[var(--co-ink)] flex items-center gap-2">
              <BarChart2 size={15} className="text-[var(--co-cyan)]" /> Activity this week
            </div>
            <span className="text-[11px] text-[var(--co-muted)]">Sample operational data</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={WEEK_DATA}>
              <defs>
                <linearGradient id="coSearches" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#37d0c6" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="#37d0c6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="coReviews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d7be7a" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#d7be7a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(205,217,228,0.10)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--co-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--co-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "16px", border: "1px solid var(--co-line)", fontSize: "12px", background: "rgba(4,10,16,0.86)", backdropFilter: "blur(18px)", color: "var(--co-ink)" }} />
              <Area type="monotone" dataKey="searches" stroke="#37d0c6" strokeWidth={2} fill="url(#coSearches)" />
              <Area type="monotone" dataKey="reviews" stroke="#d7be7a" strokeWidth={2} fill="url(#coReviews)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  );
}
