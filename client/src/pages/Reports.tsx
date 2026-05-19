import { useState } from "react";
import {
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileBarChart,
  FileText,
  Filter,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

const reportTypes = [
  {
    id: "compliance",
    icon: ShieldCheck,
    title: "CMS Compliance Report",
    desc: "Audit coding requirements, compliance scores, and flagged exceptions.",
    tags: ["Compliance", "CMS", "Audit"],
    lastGenerated: "Mar 10, 2026",
    status: "Ready",
    tone: "success",
  },
  {
    id: "icd",
    icon: Database,
    title: "ICD-10-CM Summary",
    desc: "Export diagnosis codes with descriptions, groups, and categories.",
    tags: ["ICD-10-CM", "Export", "Database"],
    lastGenerated: "Mar 9, 2026",
    status: "Ready",
    tone: "info",
  },
  {
    id: "cpt",
    icon: FileText,
    title: "CPT Procedure Report",
    desc: "Procedure code summary with billing details and protocols.",
    tags: ["CPT", "Procedures", "Billing"],
    lastGenerated: "Mar 8, 2026",
    status: "Ready",
    tone: "warning",
  },
  {
    id: "hcpcs",
    icon: FileBarChart,
    title: "HCPCS Level II Report",
    desc: "Supplies, equipment, and non-physician service code export.",
    tags: ["HCPCS", "Equipment", "Supplies"],
    lastGenerated: "Mar 7, 2026",
    status: "Ready",
    tone: "info",
  },
  {
    id: "analytics",
    icon: BarChart2,
    title: "Usage Analytics Report",
    desc: "Search trends, peak hours, and productivity metrics for teams.",
    tags: ["Analytics", "Trends", "Performance"],
    lastGenerated: "Mar 6, 2026",
    status: "Ready",
    tone: "danger",
  },
  {
    id: "favorites",
    icon: CheckCircle2,
    title: "Workspace Snapshot",
    desc: "Saved codes, annotations, and workspace collections.",
    tags: ["Workspace", "Saved", "Custom"],
    lastGenerated: "Mar 5, 2026",
    status: "Ready",
    tone: "warning",
  },
] as const;

const recentReports = [
  { name: "CMS Compliance Q1 2026", type: "Compliance", date: "Mar 10, 2026", size: "1.2 MB" },
  { name: "Full Code Export", type: "ICD-10-CM", date: "Mar 9, 2026", size: "8.4 MB" },
  { name: "Monthly Usage Analytics", type: "Analytics", date: "Mar 8, 2026", size: "0.6 MB" },
  { name: "CPT Procedure Summary", type: "CPT", date: "Mar 5, 2026", size: "2.1 MB" },
];

export function Reports() {
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = (id: string) => {
    setGenerating(id);
    window.setTimeout(() => setGenerating(null), 1400);
  };

  return (
    <div className="tool-page secondary-page reports-page">
      <section className="tool-panel tool-page-header">
        <div>
          <h1>Reports Center</h1>
          <p>Generate and export coding, compliance, and workspace reports.</p>
        </div>
        <div className="secondary-header-actions">
          <button type="button" className="tool-secondary-button">
            <Calendar size={16} />
            Schedule
          </button>
          <button type="button" className="tool-primary-button">
            <Filter size={16} />
            Filter Reports
          </button>
        </div>
      </section>

      <section className="tool-panel secondary-section-panel">
        <div className="secondary-section-head">
          <div>
            <h2>Available Report Templates</h2>
            <p>{reportTypes.length} templates ready for export.</p>
          </div>
          <span className="secondary-count-pill">{reportTypes.length} templates</span>
        </div>

        <div className="report-template-grid">
          {reportTypes.map((report) => (
            <article className="report-template-card" data-tone={report.tone} key={report.id}>
              <div className="report-card-top">
                <span className="report-icon-box">
                  <report.icon size={19} />
                </span>
                <span className="secondary-status-pill" data-tone="success">{report.status}</span>
              </div>
              <h3>{report.title}</h3>
              <p>{report.desc}</p>
              <div className="secondary-chip-row">
                {report.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="report-card-footer">
                <small>
                  <Clock size={13} />
                  {report.lastGenerated}
                </small>
                <div>
                  <button type="button" className="tool-secondary-button" onClick={() => handleGenerate(report.id)}>
                    <RefreshCw size={14} className={generating === report.id ? "is-spinning" : ""} />
                    {generating === report.id ? "Building" : "Generate"}
                  </button>
                  <button type="button" className="tool-primary-button">
                    <Download size={14} />
                    Export
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="tool-panel secondary-section-panel">
        <div className="secondary-section-head">
          <div>
            <h2>Recent Exports</h2>
            <p>Previously generated reports and downloads.</p>
          </div>
          <button type="button" className="secondary-link-button">
            View all
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="secondary-table-wrap">
          <table className="secondary-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Type</th>
                <th>Date</th>
                <th>Size</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.map((report) => (
                <tr key={report.name}>
                  <td>
                    <span className="secondary-row-title">
                      <FileBarChart size={16} />
                      {report.name}
                    </span>
                  </td>
                  <td>{report.type}</td>
                  <td>{report.date}</td>
                  <td>{report.size}</td>
                  <td>
                    <button type="button" className="secondary-row-action">
                      <Download size={14} />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="secondary-mobile-list" aria-label="Recent exports">
          {recentReports.map((report) => (
            <article className="secondary-mobile-row" key={report.name}>
              <div>
                <strong>
                  <FileBarChart size={16} />
                  {report.name}
                </strong>
                <span>{report.type} - {report.date} - {report.size}</span>
              </div>
              <button type="button" className="secondary-row-action">
                <Download size={14} />
                Download
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
