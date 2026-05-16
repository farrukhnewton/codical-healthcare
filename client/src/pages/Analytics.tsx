import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Database, Search, ShieldCheck, TrendingUp } from "lucide-react";

const COLORS = ["#0f7b4c", "#0b5ee8", "#b45309", "#168f91", "#b42336"];

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
  { category: "Surgery", value: 3456 },
  { category: "Pathology", value: 2345 },
  { category: "Medicine", value: 1635 },
  { category: "Anesthesia", value: 1234 },
  { category: "Radiology", value: 987 },
];

const complianceData = [
  { name: "CMS Compliant", value: 97, tone: "success" },
  { name: "ICD Accuracy", value: 99, tone: "info" },
  { name: "CPT Accuracy", value: 95, tone: "warning" },
  { name: "HCPCS Valid", value: 98, tone: "teal" },
];

const hourlyUsage = [
  { hour: "00", queries: 5 },
  { hour: "03", queries: 3 },
  { hour: "06", queries: 12 },
  { hour: "09", queries: 85 },
  { hour: "12", queries: 112 },
  { hour: "15", queries: 98 },
  { hour: "18", queries: 67 },
  { hour: "21", queries: 34 },
];

const metricsCards = [
  { label: "Total Searches", value: "12,847", trend: "+18%", icon: Search, tone: "success" },
  { label: "Avg Response", value: "42ms", trend: "-12%", icon: Activity, tone: "info" },
  { label: "Codes Retrieved", value: "284,930", trend: "+23%", icon: Database, tone: "warning" },
  { label: "Compliance Score", value: "97.4%", trend: "+0.8%", icon: ShieldCheck, tone: "teal" },
] as const;

export function Analytics() {
  return (
    <div className="tool-page secondary-page analytics-page">
      <section className="tool-panel tool-page-header">
        <div>
          <h1>Analytics Hub</h1>
          <p>Search volume, code usage, and compliance quality signals.</p>
        </div>
        <div className="search-header-meta">
          <span>30 day view</span>
          <span>Updated live</span>
        </div>
      </section>

      <section className="analytics-metric-grid">
        {metricsCards.map((metric) => (
          <div className="tool-panel analytics-metric-card" data-tone={metric.tone} key={metric.label}>
            <span>
              <metric.icon size={17} />
              {metric.label}
            </span>
            <strong>{metric.value}</strong>
            <small>
              <TrendingUp size={13} />
              {metric.trend}
            </small>
          </div>
        ))}
      </section>

      <section className="tool-panel secondary-chart-panel analytics-volume-panel">
        <div className="secondary-section-head">
          <div>
            <h2>Search Volume by Code Type</h2>
            <p>8-week trend across major code categories.</p>
          </div>
          <div className="analytics-legend">
            {["ICD-10-CM", "CPT", "HCPCS"].map((label, index) => (
              <span key={label}>
                <i style={{ background: COLORS[index] }} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={weeklyTrend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <defs>
              {["icd", "cpt", "hcpcs"].map((key, index) => (
                <linearGradient key={key} id={`phase5f-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[index]} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={COLORS[index]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6eef7" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fontWeight: 700, fill: "#667b98" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#667b98" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #c8d7ea", fontSize: 12 }} />
            <Area type="monotone" dataKey="icd" stroke={COLORS[0]} strokeWidth={2} fill="url(#phase5f-icd)" />
            <Area type="monotone" dataKey="cpt" stroke={COLORS[1]} strokeWidth={2} fill="url(#phase5f-cpt)" />
            <Area type="monotone" dataKey="hcpcs" stroke={COLORS[2]} strokeWidth={2} fill="url(#phase5f-hcpcs)" />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="analytics-lower-grid">
        <div className="tool-panel secondary-chart-panel">
          <div className="secondary-section-head">
            <div>
              <h2>CPT Category Breakdown</h2>
              <p>Distribution by medical specialty.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={categoryDistribution} layout="vertical" margin={{ top: 0, right: 14, left: 12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6eef7" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#667b98" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fontWeight: 700, fill: "#365472" }} axisLine={false} tickLine={false} width={88} />
              <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Codes"]} contentStyle={{ borderRadius: 8, border: "1px solid #c8d7ea", fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {categoryDistribution.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="tool-panel secondary-chart-panel">
          <div className="secondary-section-head">
            <div>
              <h2>Compliance Metrics</h2>
              <p>Data quality and coding accuracy scores.</p>
            </div>
          </div>
          <div className="analytics-compliance-list">
            {complianceData.map((item) => (
              <div data-tone={item.tone} key={item.name}>
                <div>
                  <span>{item.name}</span>
                  <strong>{item.value}%</strong>
                </div>
                <i><b style={{ width: `${item.value}%` }} /></i>
              </div>
            ))}
          </div>
          <div className="tool-callout compact" data-tone="success">
            <ShieldCheck size={15} />
            Overall Compliance: 97.4%
          </div>
        </div>
      </section>

      <section className="tool-panel secondary-chart-panel">
        <div className="secondary-section-head">
          <div>
            <h2>Peak Usage Hours</h2>
            <p>Query volume by hour of day.</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={hourlyUsage} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6eef7" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fontWeight: 700, fill: "#667b98" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}:00`} />
            <YAxis tick={{ fontSize: 10, fill: "#667b98" }} axisLine={false} tickLine={false} />
            <Tooltip labelFormatter={(label) => `${label}:00`} contentStyle={{ borderRadius: 8, border: "1px solid #c8d7ea", fontSize: 12 }} />
            <Bar dataKey="queries" fill="#0f7b4c" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
