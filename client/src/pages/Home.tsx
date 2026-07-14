import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  AlertTriangle,
  BarChart2,
  BookOpen,
  Brain,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const KPI_CARDS = [
  { label: "Claims in review", value: "128", delta: "+18%", trend: "up", icon: ClipboardCheck },
  { label: "NCCI clear", value: "94.2%", delta: "+2.6 pts", trend: "up", icon: CheckCircle2 },
  { label: "First pass yield", value: "88.1%", delta: "+4.3 pts", trend: "up", icon: FileCheck2 },
  { label: "Turnaround time", value: "2.6 hrs", delta: "-0.7 hrs", trend: "down", icon: BarChart2 },
];

const WORKFLOW_COLUMNS = [
  {
    title: "Routed",
    count: 42,
    items: [
      ["MRN 845729", "Office Visit - Established", "Routine"],
      ["MRN 763284", "Post-op Follow Up", "Routine"],
      ["MRN 558912", "Annual Wellness Visit", "Preventive"],
    ],
  },
  {
    title: "Review",
    count: 28,
    items: [
      ["MRN 334455", "Knee arthroscopy", "Surgical"],
      ["MRN 221190", "ER Visit - Chest Pain", "ED"],
      ["MRN 662341", "Laparoscopic cholecystectomy", "Surgical"],
    ],
  },
  {
    title: "Query",
    count: 14,
    items: [
      ["MRN 119988", "Back pain evaluation", "Query"],
      ["MRN 667788", "Hypertension follow up", "Query"],
      ["MRN 445566", "Diabetes w/ complications", "Query"],
    ],
  },
  {
    title: "Finalized",
    count: 96,
    items: [
      ["MRN 990011", "Colonoscopy w/ biopsy", "Complete"],
      ["MRN 880099", "Cardiac stress test", "Complete"],
      ["MRN 770088", "E/M - New patient", "Complete"],
    ],
  },
];

const ACTIVITY = [
  ["Claim 1234567890 approved", "+ $1,245.00", "success"],
  ["Query created for MRN 119988", "Back pain evaluation", "query"],
  ["Code recommendation accepted", "99214", "info"],
  ["NCCI edit identified", "2 lines", "warning"],
  ["Claim 0987654321 approved", "+ $987.50", "success"],
];

const TRENDING_CODES = [
  ["99213", "Office/outpatient visit, est", "+18%"],
  ["99214", "Office/outpatient visit, est", "+12%"],
  ["99203", "Office/outpatient visit, new", "-5%"],
  ["93000", "Electrocardiogram", "+8%"],
  ["80053", "Comprehensive metabolic panel", "+6%"],
];

const WEEK_DATA = [
  { day: "May 7", encounters: 120, codes: 88, queries: 42 },
  { day: "May 8", encounters: 142, codes: 96, queries: 48 },
  { day: "May 9", encounters: 148, codes: 94, queries: 46 },
  { day: "May 10", encounters: 150, codes: 101, queries: 50 },
  { day: "May 11", encounters: 134, codes: 89, queries: 39 },
  { day: "May 12", encounters: 163, codes: 106, queries: 52 },
  { day: "May 13", encounters: 145, codes: 96, queries: 36 },
];

const QUICK_ACTIONS = [
  { href: "/workspace", label: "Analyze note", icon: Brain },
  { href: "/search", label: "Search codes", icon: Search },
  { href: "/claim-validator", label: "Validate claim", icon: ShieldCheck },
  { href: "/intelligence", label: "Coverage context", icon: BookOpen },
  { href: "/anesthesia", label: "Anesthesia units", icon: Stethoscope },
];

const HERO_SIGNALS = [
  { icon: FileText, label: "Documentation", value: "Clinical note indexed" },
  { icon: Sparkles, label: "Suggested codes", value: "4 high-confidence matches" },
  { icon: AlertTriangle, label: "Claim checks", value: "Modifier review needed" },
  { icon: UserRoundCheck, label: "Certified review", value: "Ready to route" },
];

const WORKFLOW_TOTAL = WORKFLOW_COLUMNS.reduce((total, column) => total + column.count, 0);
const WORKFLOW_MAX = Math.max(...WORKFLOW_COLUMNS.map((column) => column.count));

export function Home() {
  const [, setLocation] = useLocation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hour = time.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="macos-dashboard">
      <section className="macos-dashboard-hero">
        <div className="macos-hero-copy">
          <span className="macos-hero-chip"><CalendarCheck2 size={16} /> {greeting}</span>
          <h2>Cleaner claim review, from code search to payer checks.</h2>
          <p>
            Move documentation through ICD/CPT suggestions, NCCI edits, payer policy,
            NPI verification and certified review without losing the evidence trail.
          </p>
          <div className="macos-hero-actions">
            <button type="button" onClick={() => setLocation("/workspace")}>
              <Brain size={17} />
              Analyze note
            </button>
            <button type="button" onClick={() => setLocation("/claim-validator")}>
              <ShieldCheck size={17} />
              Validate claim
            </button>
          </div>
        </div>

        <div className="macos-hero-console" aria-label="Live coding review preview">
          <div className="macos-console-top">
            <div>
              <strong>Case #C-48291</strong>
              <span>Outpatient claim packet</span>
            </div>
            <em>Live</em>
          </div>

          <div className="macos-console-code">
            <div>
              <span>Claim review</span>
              <strong>Ready</strong>
            </div>
            <p>98% source-linked rationale</p>
          </div>

          <div className="macos-console-signals">
            {HERO_SIGNALS.map((signal) => (
              <article key={signal.label}>
                <signal.icon size={15} />
                <div>
                  <strong>{signal.label}</strong>
                  <span>{signal.value}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="macos-console-progress" aria-hidden="true">
            {["Upload", "Suggest", "Validate", "Review"].map((step, index) => (
              <span className={index < 3 ? "is-done" : ""} key={step}>{step}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="macos-kpi-grid" aria-label="Dashboard metrics">
        {KPI_CARDS.map((card) => (
          <article className="macos-kpi-card" key={card.label}>
            <span className={`macos-kpi-icon dash-trend-${card.trend}`}>
              <card.icon size={20} />
            </span>
            <div>
              <strong>{card.value}</strong>
              <p>{card.label}</p>
              <em className={`dash-trend-${card.trend}`}>
                {card.trend === "down" ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                {card.delta}
              </em>
            </div>
          </article>
        ))}
      </section>

      <div className="macos-dashboard-grid">
        <div className="macos-dashboard-main">
          <section className="macos-panel">
            <div className="macos-panel-head">
              <div>
                <h3>Revenue cycle funnel</h3>
                <p>{WORKFLOW_TOTAL} active encounters across routed, review, query and finalized stages.</p>
              </div>
              <button type="button" className="macos-panel-action" onClick={() => setLocation("/workspace")}>
                View worklist <ArrowRight size={15} />
              </button>
            </div>

            <div className="macos-funnel-list">
              {WORKFLOW_COLUMNS.map((column) => (
                <div className="macos-funnel-row" key={column.title}>
                  <strong>{column.title}</strong>
                  <div className="macos-funnel-track" aria-hidden="true">
                    <div
                      className="macos-funnel-fill"
                      style={{ width: `${Math.max(12, (column.count / WORKFLOW_MAX) * 100)}%` }}
                    />
                  </div>
                  <span>{column.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="macos-panel">
            <div className="macos-panel-head">
              <div>
                <h3>Coding activity</h3>
                <p>Last 7 days</p>
              </div>
              <div className="macos-chart-legend" aria-hidden="true">
                <span className="is-blue">Encounters</span>
                <span className="is-teal">Codes assigned</span>
                <span className="is-violet">Queries</span>
              </div>
            </div>
            <div className="macos-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={WEEK_DATA} margin={{ top: 12, right: 18, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--mac-separator)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "var(--mac-text-tertiary)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--mac-text-tertiary)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--mac-elevated-bg)",
                      border: "1px solid var(--mac-separator)",
                      borderRadius: "12px",
                      boxShadow: "var(--mac-shadow-md)",
                      color: "var(--mac-text-primary)",
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="encounters" stroke="#0071e3" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="codes" stroke="#00a7a0" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="queries" stroke="#af52de" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="macos-panel">
            <div className="macos-panel-head">
              <div>
                <h3>Coding workflow</h3>
                <p>Track routed cases, reviews, queries and finalized claims.</p>
              </div>
              <button type="button" className="macos-panel-action" onClick={() => setLocation("/workspace")}>
                Open workspace <ArrowRight size={15} />
              </button>
            </div>

            <div className="macos-workflow-board">
              {WORKFLOW_COLUMNS.map((column) => (
                <div className="macos-workflow-column" key={column.title}>
                  <div className="macos-column-head">
                    <strong>{column.title}</strong>
                    <span>{column.count}</span>
                  </div>
                  <div className="macos-column-list">
                    {column.items.map(([mrn, label, status]) => (
                      <article className="macos-case-card" key={mrn}>
                        <strong>{mrn}</strong>
                        <p>{label}</p>
                        <div>
                          <time>05/13/2025</time>
                          <em>{status}</em>
                        </div>
                      </article>
                    ))}
                  </div>
                  <button type="button" className="macos-column-more">+ {column.count - 3} more</button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="macos-dashboard-aside">
          <section className="macos-panel">
            <div className="macos-panel-head compact">
              <h3>Recent activity</h3>
              <button type="button">View all</button>
            </div>
            <div className="macos-activity-list">
              {ACTIVITY.map(([label, value, tone]) => (
                <article className={`macos-activity-item tone-${tone}`} key={label}>
                  <span><CheckCircle2 size={16} /></span>
                  <div>
                    <strong>{label}</strong>
                    <p>05/13/2025 12:32 PM</p>
                  </div>
                  <em>{value}</em>
                </article>
              ))}
            </div>
          </section>

          <section className="macos-panel">
            <div className="macos-panel-head compact">
              <h3>Review packet</h3>
            </div>
            <div className="macos-grouped-list">
              {HERO_SIGNALS.map((signal) => (
                <article className="macos-grouped-row" key={signal.label}>
                  <signal.icon size={15} />
                  <div>
                    <strong>{signal.label}</strong>
                    <span>{signal.value}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="macos-panel">
            <div className="macos-panel-head compact">
              <h3>Trending codes</h3>
              <p>7 days</p>
            </div>
            <div className="macos-code-list">
              {TRENDING_CODES.map(([code, label, delta]) => (
                <button type="button" key={code} onClick={() => setLocation(`/intel/${code}`)}>
                  <strong>{code}</strong>
                  <span>{label}</span>
                  <em className={delta.startsWith("-") ? "is-down" : ""}>{delta}</em>
                </button>
              ))}
            </div>
          </section>

          <section className="macos-panel">
            <div className="macos-panel-head compact">
              <h3>Quick actions</h3>
            </div>
            <div className="macos-action-list">
              {QUICK_ACTIONS.map((action) => (
                <button type="button" key={action.href} onClick={() => setLocation(action.href)}>
                  <action.icon size={17} />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
