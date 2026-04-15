import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar,
  Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Database, Search, ShieldCheck } from "lucide-react";

const COLORS = ["#15803D", "#0369A1", "#FBBF24", "#7C3AED", "#F472B6"];

const weeklyTrend = [
  { week: "W1 Jan", icd: 420, cpt: 180, hcpcs: 95 },
  { week: "W2 Jan", icd: 380, cpt: 210, hcpcs: 110 },
  { week: "W3 Jan", icd: 510, cpt: 195, hcpcs: 88 },
  { week: "W4 Jan", icd: 465, cpt: 230, hcpcs: 120 },
  { week: "W1 Feb", icd: 530, cpt: 245, hcpcs: 130 },
  { week: "W2 Feb", icd: 490, cpt: 260, hcpcs: 115 },
  { week: "W3 Feb", icd: 580, cpt: 275, hcpcs: 145 },
  { week: "W4 Feb", icd: 620, cpt: 290, hcpcs: 160 },
];

const categoryDistribution = [
  { category: "Anesthesiology", value: 1234, percent: 12.8 },
  { category: "Surgery", value: 3456, percent: 35.8 },
  { category: "Radiology", value: 987, percent: 10.2 },
  { category: "Pathology", value: 2345, percent: 24.3 },
  { category: "Medicine", value: 1635, percent: 16.9 },
];

const complianceData = [
  { name: "CMS Compliant", value: 97, fill: "#4ADE80" },
  { name: "ICD Accuracy", value: 99, fill: "#38BDF8" },
  { name: "CPT Accuracy", value: 95, fill: "#FBBF24" },
  { name: "HCPCS Valid", value: 98, fill: "#A78BFA" },
];

const hourlyUsage = [
  { hour: "00", queries: 5 }, { hour: "03", queries: 3 }, { hour: "06", queries: 12 },
  { hour: "09", queries: 85 }, { hour: "12", queries: 112 }, { hour: "15", queries: 98 },
  { hour: "18", queries: 67 }, { hour: "21", queries: 34 },
];

const metricsCards = [
  { label: "Total Searches (30d)", value: "12,847", trend: "+18%", up: true, icon: Search, color: "text-emerald-600", bg: "from-emerald-100/80 to-green-50/50" },
  { label: "Avg Response Time", value: "42ms", trend: "-12%", up: true, icon: Activity, color: "text-sky-600", bg: "from-sky-100/80 to-blue-50/50" },
  { label: "Codes Retrieved", value: "284,930", trend: "+23%", up: true, icon: Database, color: "text-amber-600", bg: "from-amber-100/80 to-orange-50/50" },
  { label: "Compliance Score", value: "97.4%", trend: "+0.8%", up: true, icon: ShieldCheck, color: "text-violet-600", bg: "from-violet-100/80 to-purple-50/50" },
];

const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export function Analytics() {
  return (
    <motion.div variants={container} initial="hidden" animate="visible" className="p-6 space-y-6 min-h-full">

      <motion.div variants={itemAnim} className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {metricsCards.map((m) => (
          <motion.div key={m.label} whileHover={{ y: -4 }} className="rounded-2xl p-5 transition-all hover:shadow-lg" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }}>
            <div className="flex items-start justify-between mb-4">
              <div className={"w-11 h-11 bg-gradient-to-br rounded-xl flex items-center justify-center " + m.bg}>
                <m.icon className={"w-5 h-5 " + m.color} />
              </div>
              <div className={"flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg " + (m.up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                {m.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {m.trend}
              </div>
            </div>
            <p className="text-2xl font-black text-gray-900 tracking-tight">{m.value}</p>
            <p className="text-xs font-semibold text-gray-500 mt-1">{m.label}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={itemAnim} className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-black text-gray-900">Search Volume by Code Type</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">8-week trend across all code categories</p>
          </div>
          <div className="flex gap-4 text-xs font-bold">
            {["ICD-10-CM", "CPT", "HCPCS"].map((t, i) => (
              <div key={t} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                <span className="text-gray-500">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={weeklyTrend} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
            <defs>
              {["icd", "cpt", "hcpcs"].map((key, i) => (
                <linearGradient key={key} id={"grad-" + key} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)" }} />
            <Area type="monotone" dataKey="icd" stroke={COLORS[0]} strokeWidth={2} fill="url(#grad-icd)" />
            <Area type="monotone" dataKey="cpt" stroke={COLORS[1]} strokeWidth={2} fill="url(#grad-cpt)" />
            <Area type="monotone" dataKey="hcpcs" stroke={COLORS[2]} strokeWidth={2} fill="url(#grad-hcpcs)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <motion.div variants={itemAnim} className="xl:col-span-3 rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }}>
          <h2 className="text-base font-black text-gray-900 mb-1">CPT Category Breakdown</h2>
          <p className="text-xs text-gray-500 font-medium mb-5">Distribution by medical specialty</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryDistribution} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fontWeight: 600, fill: "#64748b" }} axisLine={false} tickLine={false} width={90} />
              <Tooltip formatter={(v) => [Number(v).toLocaleString(), "Codes"]} contentStyle={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.8)" }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {categoryDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={itemAnim} className="xl:col-span-2 rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }}>
          <h2 className="text-base font-black text-gray-900 mb-1">Compliance Metrics</h2>
          <p className="text-xs text-gray-500 font-medium mb-4">Data quality &amp; accuracy scores</p>
          <div className="space-y-4">
            {complianceData.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-900">{c.name}</span>
                  <span className="text-sm font-black" style={{ color: c.fill }}>{c.value}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: c.value + "%" }} transition={{ duration: 1, delay: 0.3, ease: "easeOut" }} className="h-full rounded-full" style={{ background: c.fill }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(240,253,244,0.8), rgba(240,249,255,0.8))", border: "1px solid rgba(74,222,128,0.2)" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-black text-emerald-700">Overall Compliance: 97.4%</span>
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">All metrics within CMS thresholds</p>
          </div>
        </motion.div>
      </div>

      <motion.div variants={itemAnim} className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-black text-gray-900">Peak Usage Hours</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Query volume by hour of day (24h)</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={hourlyUsage} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v + ":00"} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip labelFormatter={(l) => l + ":00 hrs"} contentStyle={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.8)" }} />
            <Bar dataKey="queries" fill="#15803D" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </motion.div>
  );
}
