import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  FileText,
  LockKeyhole,
  MessageSquare,
  Pill,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

type ToolPreview = {
  icon: LucideIcon;
  title: string;
  text: string;
  rows: [string, string, string][];
};

const WORKFLOW = [
  { icon: FileText, title: "Ingest", text: "Add notes or upload clinical documents." },
  { icon: Search, title: "Search and suggest", text: "Find codes and get relevant suggestions." },
  { icon: ClipboardCheck, title: "Validate", text: "Run NCCI edits, coverage checks and payer context." },
  { icon: UsersRound, title: "Human review", text: "Collaborate with auditors and final reviewers." },
  { icon: FileCheck2, title: "Finalize", text: "Generate clean, audit-ready coding reports." },
];

const TOOLS: ToolPreview[] = [
  {
    icon: Search,
    title: "Code search",
    text: "Search ICD, CPT, HCPCS, NPI, NDC and related coding references.",
    rows: [
      ["99214", "Office/outpatient established patient visit", "CPT"],
      ["E11.9", "Type 2 diabetes without complications", "ICD"],
      ["J1100", "Dexamethasone sodium phosphate", "HCPCS"],
    ],
  },
  {
    icon: Brain,
    title: "Coding assistance",
    text: "Review suggested codes, gaps and rationale while keeping final control with coders.",
    rows: [
      ["29881", "Arthroscopic meniscectomy suggested", "Review"],
      ["M23.221", "Posterior horn medial meniscus derangement", "ICD"],
      ["Gap", "Confirm laterality and approach", "Query"],
    ],
  },
  {
    icon: Calculator,
    title: "RVU calculator",
    text: "Estimate work RVU, practice expense, malpractice RVU and reimbursement.",
    rows: [
      ["wRVU", "Work value from selected procedure", "1.92"],
      ["PE RVU", "Practice expense estimate", "0.70"],
      ["Total", "Estimated total RVU", "2.80"],
    ],
  },
  {
    icon: ShieldCheck,
    title: "Claim validator",
    text: "Validate diagnosis and procedure sets with coverage and edit context.",
    rows: [
      ["NCCI", "Mutually exclusive edit review", "Pass"],
      ["LCD", "Policy context available", "Covered"],
      ["Risk", "Modifier support needs review", "Medium"],
    ],
  },
  {
    icon: Stethoscope,
    title: "Anesthesia calculator",
    text: "Calculate base units, time units, modifiers and estimated reimbursement.",
    rows: [
      ["00731", "Upper GI endoscopic anesthesia", "Base 5"],
      ["Time", "62 minutes documented", "4.1"],
      ["Total", "Base + time + modifier units", "9.1"],
    ],
  },
  {
    icon: MessageSquare,
    title: "Team Chat",
    text: "Keep provider queries, denial review and team decisions attached to the case.",
    rows: [
      ["Room", "coding-review", "Live"],
      ["Case", "99214-25 + 20610", "Open"],
      ["Action", "Provider query drafted", "Ready"],
    ],
  },
  {
    icon: BookOpen,
    title: "Coverage context",
    text: "Review Medicare coverage and payer policy context beside the code set.",
    rows: [
      ["LCD", "Medical necessity context", "Covered"],
      ["NCD", "National coverage signal", "Review"],
      ["Payer", "Policy note attached", "Ready"],
    ],
  },
  {
    icon: UserRoundSearch,
    title: "NPI lookup",
    text: "Verify provider identifiers, taxonomy and billing provider details.",
    rows: [
      ["NPI", "1750384806", "Active"],
      ["Taxonomy", "Internal Medicine", "Primary"],
      ["Location", "New Jersey", "Verified"],
    ],
  },
  {
    icon: Pill,
    title: "Drug lookup",
    text: "Search NDC drug records and related product details quickly.",
    rows: [
      ["NDC", "0002-8215", "Active"],
      ["Route", "Injection", "Drug"],
      ["Package", "Single-dose vial", "Verified"],
    ],
  },
];

const PROOF_POINTS = [
  { icon: ShieldCheck, title: "Human review at every step" },
  { icon: BookOpen, title: "Payer policy aware" },
  { icon: LockKeyhole, title: "Secure and compliant" },
  { icon: UsersRound, title: "Built for teams, not silos" },
];

const CAPABILITIES = [
  { icon: Search, title: "Code search", text: "Search ICD, CPT, HCPCS, NPI, NDC and more." },
  { icon: Brain, title: "Coding assistance", text: "Suggestions based on clinical documentation and context." },
  { icon: Calculator, title: "Anesthesia calculator", text: "Calculate anesthesia time, units and base units." },
  { icon: ShieldCheck, title: "Claim validator", text: "Validate codes, modifiers and place of service." },
  { icon: ClipboardCheck, title: "NCCI edits", text: "Instant NCCI checks with clear edit explanations." },
  { icon: FileCheck2, title: "Audit-ready reports", text: "Generate clean reports with rationale and references." },
  { icon: BookOpen, title: "Coverage context", text: "View coverage and payer policy requirements." },
  { icon: UserRoundSearch, title: "NPI lookup", text: "Verify provider NPIs and taxonomy details." },
];

const REVIEW_ITEMS = [
  "Certified coder review for complex or high-risk cases",
  "Payer policy and Medicare coverage context",
  "Rationale, references and reviewer notes",
  "Clear status at every step",
];

const SECURITY_ITEMS = [
  "Role-based workspace access",
  "256-bit encryption in transit and at rest",
  "SOC 2 Type II ready controls",
  "Detailed audit logs and activity tracking",
];

function ProductPreview() {
  return (
    <div className="lp-product" aria-label="Codical Health product preview">
      <aside className="lp-product-sidebar">
        <BrandMark compact className="lp-product-brand" />
        <nav aria-label="Preview navigation">
          {["Dashboard", "Coverage & Guidelines", "Code Search", "Coding Assistant", "Clinical Transcription", "Team Chat"].map((item) => (
            <span className={item === "Coding Assistant" ? "is-active" : ""} key={item}>
              {item}
            </span>
          ))}
        </nav>
      </aside>

      <div className="lp-product-main">
        <header className="lp-product-top">
          <div>
            <strong>Coding Assistant</strong>
            <span>Assistive clinical coding workflows</span>
          </div>
          <div className="lp-product-search">
            <Search size={14} />
            <span>Search ICD, CPT, HCPCS, RVU, NPI, NDC and coverage policies...</span>
          </div>
        </header>

        <div className="lp-review-grid">
          <section className="lp-review-console">
            <div className="lp-preview-title">
              <span>Coding Review Console</span>
              <em>Human review required</em>
            </div>
            <div className="lp-mini-search">
              <Search size={13} />
              <span>Search ICD, CPT, HCPCS, NPI, NDC</span>
              <strong>99214</strong>
            </div>
            {[
              ["99214", "Office/outpatient established patient visit", "92%"],
              ["E11.9", "Type 2 diabetes without complications", "ICD"],
              ["25", "Separately identifiable E/M modifier", "Review"],
              ["G2211", "Longitudinal care complexity indicator", "Payer?"],
            ].map(([code, text, status]) => (
              <div className="lp-code-line" key={code}>
                <strong>{code}</strong>
                <span>{text}</span>
                <em>{status}</em>
              </div>
            ))}
            <div className="lp-metric-grid">
              <div><span>RVU estimate</span><strong>2.80</strong></div>
              <div><span>Anesthesia units</span><strong>8.4</strong></div>
              <div><span>Claim risk</span><strong>Medium</strong></div>
              <div><span>NCCI edits</span><strong>0</strong></div>
            </div>
            <div className="lp-note-input">
              <span>Clinical note input</span>
              <p>Example: Laparoscopic cholecystectomy. Diagnosis: acute cholecystitis with cholelithiasis...</p>
              <button type="button">Analyze & Code</button>
            </div>
          </section>

          <aside className="lp-policy-panel">
            <div className="lp-policy-card">
              <span>Coverage signal</span>
              <strong>Covered</strong>
              <p>LCD/NCD and payer policy context should be reviewed before final claim submission.</p>
              <a href="#workflow">View workflow <ArrowRight size={13} /></a>
            </div>
            <div className="lp-policy-card">
              <span>Team review status</span>
              {["Coder - Completed", "Auditor - In review", "Final reviewer - Pending"].map((item, index) => (
                <div className="lp-status-row" key={item}>
                  <b>{index + 1}</b>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <div className="lp-section-head">
      <span>{label}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export function Landing() {
  const [activeTool, setActiveTool] = useState(0);
  const active = TOOLS[activeTool];

  return (
    <div className="lp-page">
      <header className="lp-nav-wrap">
        <nav className="lp-navbar" aria-label="Primary navigation">
          <a className="lp-brand-link" href="#top" aria-label="Codical Health home">
            <BrandMark />
          </a>
          <div className="lp-nav-links">
            <a href="#platform">Platform</a>
            <a href="#tools">Tools</a>
            <a href="#assistant">Coding Assistance</a>
            <a href="#workflow">Workflow</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="lp-nav-actions">
            <Link className="lp-link-button" href="/login">Sign in</Link>
            <Link className="lp-button lp-button-primary" href="/signup">Request access</Link>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="lp-hero" id="platform">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy">
              <h1>Healthcare coding work, organized in one workspace.</h1>
              <p>
                Search codes, get coding assistance, run NCCI checks, calculate RVUs and anesthesia units,
                review payer coverage context, and collaborate in Team Chat - all in one workspace built
                for coders and RCM teams.
              </p>
              <div className="lp-hero-actions">
                <Link className="lp-button lp-button-primary" href="/signup">Request access <ArrowRight size={17} /></Link>
                <a className="lp-button lp-button-secondary" href="#workflow">View workflow</a>
              </div>
              <div className="lp-proof-row">
                {PROOF_POINTS.map((item) => (
                  <span key={item.title}>
                    <item.icon size={16} />
                    {item.title}
                  </span>
                ))}
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section className="lp-workflow-strip" id="workflow">
          <div className="lp-container">
            <h2>One workspace. End-to-end coding workflow.</h2>
            <div className="lp-workflow-steps">
              {WORKFLOW.map((step, index) => (
                <article key={step.title}>
                  <div className="lp-step-icon"><step.icon size={22} /></div>
                  <div>
                    <span>{index + 1}. {step.title}</span>
                    <p>{step.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section" id="tools">
          <div className="lp-container">
            <SectionHead
              label="Tools"
              title="Tools and capabilities built for coding teams."
              text="Keep search, calculators, coverage checks, validation and review notes together so each case keeps its context."
            />
            <div className="lp-capability-grid">
              {CAPABILITIES.map((item) => (
                <article key={item.title}>
                  <div><item.icon size={20} /></div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>

            <div className="lp-tool-demo">
              <aside className="lp-tool-tabs" aria-label="Tool preview selector">
                {TOOLS.map((tool, index) => (
                  <button
                    type="button"
                    className={activeTool === index ? "is-active" : ""}
                    onClick={() => setActiveTool(index)}
                    key={tool.title}
                  >
                    <tool.icon size={17} />
                    <span>{tool.title}</span>
                  </button>
                ))}
              </aside>
              <section className="lp-tool-panel">
                <div className="lp-tool-panel-head">
                  <div>
                    <h3>{active.title}</h3>
                    <p>{active.text}</p>
                  </div>
                  <span>Interactive preview</span>
                </div>
                <div className="lp-tool-screen">
                  {active.rows.map(([code, text, status]) => (
                    <div className="lp-result-row" key={`${active.title}-${code}`}>
                      <strong>{code}</strong>
                      <span>{text}</span>
                      <em>{status}</em>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-tint" id="assistant">
          <div className="lp-container lp-review-layout">
            <div>
              <SectionHead
                label="Coding assistance"
                title="Human review stays at the center."
                text="Every suggestion is reviewed by a certified coder. Keep your team in control with built-in review steps, notes and audit trails."
              />
              <ul className="lp-check-list">
                {REVIEW_ITEMS.map((item) => (
                  <li key={item}><CheckCircle2 size={16} /> {item}</li>
                ))}
              </ul>
            </div>

            <div className="lp-review-card">
              <div className="lp-example-bar">
                <span>Example: 99214</span>
                <em>Human review required</em>
              </div>
              <div className="lp-review-card-grid">
                <div>
                  <span>Coding suggestion</span>
                  <strong>99214</strong>
                  <p>Office/outpatient established patient visit</p>
                </div>
                <div>
                  <span>Payer context</span>
                  <strong>Covered</strong>
                  <p>Medical necessity context should be reviewed.</p>
                </div>
                <div>
                  <span>Reviewer note</span>
                  <strong>In review</strong>
                  <p>MDM is moderate based on data, risk and complexity documented.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container lp-two-up">
            <section>
              <SectionHead
                label="Collaboration"
                title="Built for collaboration around the case."
                text="Work together across roles with Team Chat, mentions, tasks and real-time updates tied to the code set."
              />
              <div className="lp-chat-card">
                <div><strong>Aisha K.</strong><span>10:32 AM</span><p>Please review the anesthesia units.</p></div>
                <div><strong>Samir P.</strong><span>10:38 AM</span><p>On it. Reviewing now.</p></div>
              </div>
              <ul className="lp-check-list">
                <li><CheckCircle2 size={16} /> Context stays with the case</li>
                <li><CheckCircle2 size={16} /> Role-based permissions</li>
                <li><CheckCircle2 size={16} /> Actionable notifications</li>
              </ul>
            </section>

            <section>
              <SectionHead
                label="Security"
                title="Compliance and controls without clutter."
                text="Enterprise-grade security, access controls and audit activity tracking are built into the workspace."
              />
              <div className="lp-security-visual">
                <ShieldCheck size={80} />
                <div>
                  {SECURITY_ITEMS.map((item) => <span key={item}>{item}</span>)}
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="lp-section" id="pricing">
          <div className="lp-container">
            <SectionHead
              label="Access"
              title="Simple packages for growing coding operations."
              text="Start with search and calculators, then bring coding assistance, validation, coverage review and team collaboration into the same workflow."
            />
            <div className="lp-pricing-grid">
              {[
                ["Starter", "Pilot", "For solo coders and small practices.", ["Code search", "RVU and anesthesia calculators", "NPI and drug lookup", "Saved workspace"]],
                ["Professional", "Team", "For billing companies and RCM teams.", ["Everything in Starter", "Coding assistance", "Team Chat and case cards", "Coverage and payer policy hub"]],
                ["Enterprise", "Custom", "For MSOs, hospitals and larger teams.", ["Role controls", "Audit activity logs", "Admin reporting", "Implementation support"]],
              ].map(([name, price, text, features], index) => (
                <article className={index === 1 ? "is-featured" : ""} key={String(name)}>
                  <h3>{String(name)}</h3>
                  <strong>{String(price)}</strong>
                  <p>{String(text)}</p>
                  <ul>
                    {(features as string[]).map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                  <Link className={index === 1 ? "lp-button lp-button-primary" : "lp-button lp-button-secondary"} href="/signup">
                    {index === 2 ? "Contact sales" : "Request access"}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-container">
            <h2>Ready to streamline your coding workflow?</h2>
            <p>Join coding and RCM teams who work smarter and close faster with Codical Health.</p>
            <div>
              <Link className="lp-button lp-button-primary" href="/signup">Request access <ArrowRight size={17} /></Link>
              <a className="lp-button lp-button-secondary" href="#workflow">View workflow</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <BrandMark />
          <div className="lp-footer-links">
            <a href="#platform">Platform</a>
            <a href="#tools">Tools</a>
            <a href="#assistant">Coding Assistance</a>
            <a href="#workflow">Workflow</a>
            <a href="#pricing">Pricing</a>
            <Link href="/login">Sign in</Link>
          </div>
          <p>(c) {new Date().getFullYear()} Codical Health. Assistive tooling only. Final coding decisions require professional review.</p>
        </div>
      </footer>
    </div>
  );
}
