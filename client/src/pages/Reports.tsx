import { motion } from "framer-motion";
import { useState } from "react";
import {
  FileBarChart, Download, Filter, Calendar, CheckCircle2,
  FileText, Database, ShieldCheck, BarChart2, Clock,
  ArrowRight, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const reportTypes = [
  {
    id: "compliance",
    icon: ShieldCheck,
    title: "CMS Compliance Report",
    desc: "Full audit of CMS coding requirements, compliance scores, and flagged exceptions.",
    tags: ["Compliance", "CMS", "Audit"],
    color: "bg-emerald-500",
    light: "bg-emerald-50",
    text: "text-emerald-600",
    lastGenerated: "Mar 10, 2026",
    status: "Ready",
  },
  {
    id: "icd",
    icon: Database,
    title: "ICD-10-CM Summary",
    desc: "Comprehensive export of all 98,186 ICD-10 diagnosis codes with descriptions and categories.",
    tags: ["ICD-10-CM", "Export", "Database"],
    color: "bg-[#0057A8]",
    light: "bg-[#0057A8]/10",
    text: "text-[#0057A8]",
    lastGenerated: "Mar 9, 2026",
    status: "Ready",
  },
  {
    id: "cpt",
    icon: FileText,
    title: "CPT Procedure Report",
    desc: "All 9,657 CPT procedure codes with billing details, categories, and procedure protocols.",
    tags: ["CPT", "Procedures", "Billing"],
    color: "bg-[#F28C28]",
    light: "bg-[#F28C28]/10",
    text: "text-[#F28C28]",
    lastGenerated: "Mar 8, 2026",
    status: "Ready",
  },
  {
    id: "hcpcs",
    icon: FileBarChart,
    title: "HCPCS Level II Report",
    desc: "Complete HCPCS Level II codes export for supplies, equipment, and non-physician services.",
    tags: ["HCPCS", "Equipment", "Supplies"],
    color: "bg-purple-500",
    light: "bg-purple-50",
    text: "text-purple-600",
    lastGenerated: "Mar 7, 2026",
    status: "Ready",
  },
  {
    id: "analytics",
    icon: BarChart2,
    title: "Usage Analytics Report",
    desc: "Search trends, usage patterns, peak hours, and productivity metrics for your team.",
    tags: ["Analytics", "Trends", "Performance"],
    color: "bg-rose-500",
    light: "bg-rose-50",
    text: "text-rose-600",
    lastGenerated: "Mar 6, 2026",
    status: "Ready",
  },
  {
    id: "favorites",
    icon: CheckCircle2,
    title: "Workspace Snapshot",
    desc: "Export your saved codes, annotations, and custom workspace collections.",
    tags: ["Workspace", "Favorites", "Custom"],
    color: "bg-amber-500",
    light: "bg-amber-50",
    text: "text-amber-600",
    lastGenerated: "Mar 5, 2026",
    status: "Ready",
  },
];

const recentReports = [
  { name: "CMS Compliance Q1 2026", type: "compliance", date: "Mar 10, 2026", size: "1.2 MB" },
  { name: "Full Code Export", type: "icd", date: "Mar 9, 2026", size: "8.4 MB" },
  { name: "Monthly Usage Analytics", type: "analytics", date: "Mar 8, 2026", size: "0.6 MB" },
  { name: "CPT Procedure Summary", type: "cpt", date: "Mar 5, 2026", size: "2.1 MB" },
];

const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export function Reports() {
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = (id: string) => {
    setGenerating(id);
    setTimeout(() => setGenerating(null), 2500);
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="p-6 space-y-6 min-h-full"
    >
      <motion.div variants={itemAnim} className="relative overflow-hidden rounded-2xl p-6 text-white" style={{ background: "linear-gradient(135deg, #0057A8, #003d75)" }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Reports Center</h2>
            <p className="text-white/60 text-sm font-medium mt-1">Generate and download comprehensive coding reports and audit documents.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="rounded-xl border-white/20 text-white hover:bg-white/10 font-bold gap-2 bg-white/10">
              <Calendar className="w-4 h-4" /> Schedule
            </Button>
            <Button size="sm" className="rounded-xl bg-[#F28C28] hover:bg-[#d47416] text-white font-bold gap-2 shadow-lg">
              <Filter className="w-4 h-4" /> Filter Reports
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemAnim}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-foreground">Available Report Templates</h2>
          <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-xl">{reportTypes.length} Templates</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reportTypes.map((report) => (
            <motion.div
              key={report.id}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all group"
            >
              <div className="flex items-start justify-between mb-5">
                <div className={`w-12 h-12 ${report.light} rounded-2xl flex items-center justify-center`}>
                  <report.icon className={`w-6 h-6 ${report.text}`} />
                </div>
                <Badge variant="outline" className="text-[10px] font-black border-emerald-200 bg-emerald-50 text-emerald-700">
                  {report.status}
                </Badge>
              </div>
              <h3 className="text-sm font-black text-foreground mb-2">{report.title}</h3>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed mb-4">{report.desc}</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {report.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{tag}</span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
                  <Clock className="w-3 h-3" /> {report.lastGenerated}
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleGenerate(report.id)}
                    className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl transition-all ${
                      generating === report.id
                        ? "bg-amber-100 text-amber-700 cursor-wait"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${generating === report.id ? "animate-spin" : ""}`} />
                    {generating === report.id ? "Building..." : "Generate"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 text-xs font-black bg-[#0057A8] text-white px-3 py-1.5 rounded-xl hover:bg-[#003d75] transition-colors shadow-lg shadow-[#0057A8]/20"
                  >
                    <Download className="w-3 h-3" /> Export
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemAnim} className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-foreground">Recent Exports</h2>
          <button className="text-xs font-bold text-[#0057A8] flex items-center gap-1 hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-3">
          {recentReports.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
            >
              <div className="w-10 h-10 bg-[#0057A8]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileBarChart className="w-5 h-5 text-[#0057A8]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground font-medium">{r.date} · {r.size}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs font-bold bg-[#0057A8] text-white px-3 py-1.5 rounded-xl"
              >
                <Download className="w-3 h-3" /> Download
              </motion.button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
