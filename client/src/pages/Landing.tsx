import "@/styles/landing-stitch.css";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Cloud,
  FileCheck2,
  FileText,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UploadCloud,
  UserCheck,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

type MenuItem = {
  icon: LucideIcon;
  title: string;
  text: string;
  href: string;
};

type MenuGroup = {
  id: string;
  label: string;
  title: string;
  items: MenuItem[];
  image: string;
  imageTitle: string;
  imageText: string;
};

type ProcessStep = {
  icon: LucideIcon;
  label: string;
  title: string;
  text: string;
  visual: "upload" | "suggest" | "validate" | "review";
  stats: string[];
};

type FeatureCard = {
  icon: LucideIcon;
  title: string;
  text: string;
  metric: string;
  visual: "code" | "claim" | "payer" | "review";
};

type TrustNode = {
  name: string;
  text: string;
  icon: LucideIcon;
};

type FaqItem = {
  question: string;
  answer: string;
};

const TEAM_IMAGES = [
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=85",
];

const MENU_GROUPS: MenuGroup[] = [
  {
    id: "platform",
    label: "Platform",
    title: "Codical platform",
    image: TEAM_IMAGES[2],
    imageTitle: "Unified coding workspace",
    imageText: "Code search, NPI lookup, payer context and claim checks in one flow.",
    items: [
      { icon: Search, title: "Code Intelligence", text: "Search ICD, CPT, HCPCS, RVU and policy context.", href: "#results" },
      { icon: ClipboardCheck, title: "Claim Validation", text: "Run NCCI, modifier and payer checks before submit.", href: "#process" },
      { icon: UserCheck, title: "Human Review", text: "Route cases to certified coders with a complete audit trail.", href: "#process" },
      { icon: BarChart3, title: "Revenue Analytics", text: "Track value, risk and review velocity across teams.", href: "#results" },
    ],
  },
  {
    id: "solutions",
    label: "Solutions",
    title: "Healthcare teams",
    image: TEAM_IMAGES[0],
    imageTitle: "Built for coding operations",
    imageText: "Focused workspaces for coders, billers, auditors and clinical reviewers.",
    items: [
      { icon: Stethoscope, title: "Provider Groups", text: "Standardize coding review across specialties.", href: "#team" },
      { icon: ShieldCheck, title: "Compliance Teams", text: "Keep validation evidence beside every decision.", href: "#results" },
      { icon: UsersRound, title: "Revenue Cycle", text: "Reduce rework between coding, billing and review.", href: "#process" },
      { icon: LockKeyhole, title: "Security", text: "Role-aware workflows with controlled review history.", href: "#team" },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    title: "Workflow resources",
    image: TEAM_IMAGES[1],
    imageTitle: "Operational playbooks",
    imageText: "Sample workflows and reports for coding teams moving faster with control.",
    items: [
      { icon: BookOpenCheck, title: "Coding Guides", text: "Reusable guidance for common review patterns.", href: "#process" },
      { icon: FileCheck2, title: "Reports", text: "Export clean rationale and final case summaries.", href: "#results" },
      { icon: MessageSquareText, title: "Team Handoffs", text: "Reviewer comments stay attached to each case.", href: "#team" },
      { icon: Cloud, title: "Integrations", text: "Connect payer, clearinghouse and EHR context.", href: "#results" },
    ],
  },
];

const PROCESS_STEPS: ProcessStep[] = [
  {
    icon: UploadCloud,
    label: "01",
    title: "Upload medical report",
    text: "Start from an operative note, encounter summary, superbill or case packet. Codical organizes the source content into a review-ready work item.",
    visual: "upload",
    stats: ["OCR ready", "PHI-aware queue", "Case packet created"],
  },
  {
    icon: Sparkles,
    label: "02",
    title: "Get coding suggestions",
    text: "Suggested ICD, CPT, HCPCS and modifiers appear with rationale, documentation cues and source-backed context for coder review.",
    visual: "suggest",
    stats: ["ICD/CPT/HCPCS", "RVU context", "Evidence attached"],
  },
  {
    icon: ClipboardCheck,
    label: "03",
    title: "Validate the claim",
    text: "Run claim checks against NCCI, payer rules, coverage context, NPI details and common denial triggers before the claim moves forward.",
    visual: "validate",
    stats: ["NCCI edits", "NPI validation", "Denial risk flags"],
  },
  {
    icon: UserCheck,
    label: "04",
    title: "Certified coder review",
    text: "A certified coder reviews final suggestions, resolves exceptions, adds notes and exports a clean report with the case history intact.",
    visual: "review",
    stats: ["Human approval", "Audit notes", "Final report"],
  },
];

const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: Search,
    title: "Code intelligence",
    text: "Purpose-built suggestions for CPT, ICD-10 and HCPCS codes with rationale tied back to source documentation.",
    metric: "98% source-linked rationale",
    visual: "code",
  },
  {
    icon: AlertTriangle,
    title: "Claim validation",
    text: "Catch NCCI edits, missing modifiers and documentation gaps before a claim reaches billing.",
    metric: "42% fewer preventable denials",
    visual: "claim",
  },
  {
    icon: Network,
    title: "Payer/NCCI intelligence",
    text: "Attach payer policy, CMS updates, NPI/NPPES checks and coverage context to the coding decision.",
    metric: "Daily policy sync",
    visual: "payer",
  },
  {
    icon: BadgeCheck,
    title: "Certified review workspace",
    text: "Route edge cases to certified coders with comments, signoff, audit history and export-ready reports.",
    metric: "24h reviewer SLA",
    visual: "review",
  },
];

const TRUST_NODES: TrustNode[] = [
  { name: "CMS", text: "NCCI and coverage policy", icon: Building2 },
  { name: "NPI/NPPES", text: "Provider identity checks", icon: ShieldCheck },
  { name: "Clearinghouse", text: "Claim-ready handoff", icon: Cloud },
  { name: "EHR", text: "Clinical source context", icon: FileText },
  { name: "Payer policy", text: "Rule notes and rationale", icon: ClipboardCheck },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Does Codical replace human coders?",
    answer: "No. Codical prepares suggestions, validation evidence and risk flags so certified coders can make faster final decisions.",
  },
  {
    question: "Which claim checks are included?",
    answer: "The workflow is designed around NCCI edits, payer policy context, NPI/NPPES validation, modifier review and documentation completeness.",
  },
  {
    question: "Can teams export review evidence?",
    answer: "Yes. Cases can retain source highlights, rationale, coder comments, validation checks and a final claim-ready report.",
  },
  {
    question: "Is mobile navigation safe from overflow?",
    answer: "The new landing shell uses constrained gutters, wrapping CTA text and contained product panels for narrow screens.",
  },
];

const HERO_TOKENS = [
  "ICD-10 E11.9",
  "CPT 99214",
  "NCCI clear",
  "NPI verified",
  "CMS rule linked",
];

function CtaButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link className={`nex-button nex-button-${variant}`} href={href}>
      <span><ArrowRight size={18} /></span>
      <strong>{children}</strong>
    </Link>
  );
}

function Header() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeGroup = MENU_GROUPS.find((group) => group.id === activeMenu);

  return (
    <>
      <header
        className={`nex-header ${activeMenu ? "is-hovered" : ""}`}
        onMouseLeave={() => setActiveMenu(null)}
      >
        <a className="nex-brand" href="#top" aria-label="Codical Health home">
          <BrandMark />
        </a>

        <nav className="nex-nav" aria-label="Landing navigation">
          {MENU_GROUPS.map((group) => (
            <button
              className={`nex-nav-item ${activeMenu === group.id ? "is-active" : ""}`}
              key={group.id}
              type="button"
              onMouseEnter={() => setActiveMenu(group.id)}
              onFocus={() => setActiveMenu(group.id)}
              aria-expanded={activeMenu === group.id}
            >
              {group.label}
              <ChevronDown size={15} />
            </button>
          ))}
          <a className="nex-nav-item nex-nav-link" href="#faq">Pricing</a>
        </nav>

        <div className="nex-header-actions">
          <Link className="nex-login" href="/login">Sign in</Link>
          <CtaButton href="/signup">Request access</CtaButton>
        </div>

        <button
          className="nex-mobile-toggle"
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={24} />
        </button>

        {activeGroup && (
          <div className="nex-mega-menu" onMouseEnter={() => setActiveMenu(activeGroup.id)}>
            <div className="nex-mega-copy">
              <span>{activeGroup.title}</span>
              <div className="nex-mega-grid">
                {activeGroup.items.map((item) => (
                  <a href={item.href} className="nex-mega-link" key={item.title}>
                    <i><item.icon size={18} /></i>
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </a>
                ))}
              </div>
            </div>
            <a className="nex-mega-card" href="#team">
              <img src={activeGroup.image} alt="" />
              <div>
                <strong>{activeGroup.imageTitle}</strong>
                <p>{activeGroup.imageText}</p>
                <span><ArrowRight size={16} /></span>
              </div>
            </a>
          </div>
        )}
      </header>

      <aside className={`nex-mobile-drawer ${mobileOpen ? "is-open" : ""}`} aria-hidden={!mobileOpen}>
        <div className="nex-mobile-panel">
          <div className="nex-mobile-top">
            <BrandMark compact />
            <button className="nex-mobile-close" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
              <X size={24} />
            </button>
          </div>
          {MENU_GROUPS.map((group) => {
            const PrimaryIcon = group.items[0].icon;
            return (
              <a className="nex-mobile-group" href={`#${group.id === "platform" ? "results" : group.id === "solutions" ? "process" : "faq"}`} key={group.id} onClick={() => setMobileOpen(false)}>
                <i><PrimaryIcon size={24} /></i>
                <strong>{group.label}</strong>
                <span>{group.imageText}</span>
              </a>
            );
          })}
          <a className="nex-mobile-group" href="#faq" onClick={() => setMobileOpen(false)}>
            <i><BarChart3 size={24} /></i>
            <strong>Pricing</strong>
            <span>Transparent, volume-based plans for coding teams.</span>
          </a>
          <div className="nex-mobile-actions">
            <CtaButton href="/signup">Request access</CtaButton>
            <CtaButton href="#process" variant="secondary">Book a demo</CtaButton>
          </div>
          <p>NCCI, payer, NPI checks + certified review</p>
        </div>
      </aside>
    </>
  );
}

function MotionHero() {
  return (
    <section className="nex-hero" id="top">
      <div className="nex-motion-field" aria-hidden="true">
        <div className="nex-claim-orbit">
          <span className="nex-orbit-ring ring-one" />
          <span className="nex-orbit-ring ring-two" />
          <span className="nex-orbit-ring ring-three" />
        </div>
        <div className="nex-signal-stack left">
          {HERO_TOKENS.slice(0, 4).map((token) => <span key={token}>{token}</span>)}
        </div>
        <div className="nex-signal-stack right">
          {HERO_TOKENS.slice(1).map((token) => <span key={token}>{token}</span>)}
        </div>
        <span className="nex-claim-node node-upload"><FileText size={18} /> Report</span>
        <span className="nex-claim-node node-code"><Sparkles size={18} /> Codes</span>
        <span className="nex-claim-node node-check"><ClipboardCheck size={18} /> Claim</span>
        <span className="nex-claim-node node-review"><UserCheck size={18} /> Review</span>
        <span className="nex-claim-route route-one" />
        <span className="nex-claim-route route-two" />
        <span className="nex-claim-route route-three" />
      </div>

      <div className="nex-hero-content">
        <div className="nex-proof">
          <span><img src={TEAM_IMAGES[0]} alt="" /></span>
          <span><img src={TEAM_IMAGES[1]} alt="" /></span>
          <span><img src={TEAM_IMAGES[2]} alt="" /></span>
          <strong>Trusted by coding, audit and revenue-cycle teams.</strong>
        </div>
        <h1>AI coding review for cleaner claims</h1>
        <p>
          Upload clinical reports, validate codes against NCCI, payer, and NPI checks,
          then route edge cases to certified coder review.
        </p>
        <div className="nex-hero-actions">
          <CtaButton href="/signup">Start review workflow</CtaButton>
          <CtaButton href="#process" variant="secondary">Book a demo</CtaButton>
        </div>
      </div>

      <div className="nex-product-preview" aria-label="Codical Health workflow preview">
        <div className="nex-preview-topbar">
          <span />
          <span />
          <span />
          <strong>app.codical.health/review/case-8912</strong>
        </div>
        <div className="nex-preview-grid">
          <section className="nex-preview-notes">
            <div className="nex-pane-title">
              <FileText size={17} />
              <strong>Clinical notes</strong>
              <em>Report #8912</em>
            </div>
            <p>Patient presents with acute exacerbation of chronic obstructive pulmonary disease. Nebulizer treatment administered and oral medication prescribed.</p>
            <mark>Highlighted by AI: moderate complexity, active treatment, chronic condition</mark>
          </section>
          <section className="nex-preview-codes">
            <div className="nex-pane-title">
              <Sparkles size={17} />
              <strong>Suggested codes</strong>
              <em>4 matched</em>
            </div>
            {[
              ["99214", "E/M established patient", "98%"],
              ["J7613", "Nebulizer medication", "94%"],
              ["J44.1", "COPD exacerbation", "91%"],
            ].map(([code, label, confidence]) => (
              <div className="nex-code-suggestion" key={code}>
                <span>{code}</span>
                <strong>{label}</strong>
                <em>{confidence}</em>
              </div>
            ))}
            <button type="button">Accept selected</button>
          </section>
          <section className="nex-preview-validation">
            <div className="nex-pane-title">
              <ShieldCheck size={17} />
              <strong>Validation checks</strong>
              <em>Live</em>
            </div>
            <div className="nex-warning">
              <AlertTriangle size={18} />
              <strong>NCCI edit warning</strong>
              <span>Modifier 25 recommended for separate E/M service.</span>
            </div>
            <div className="nex-check-card"><CheckCircle2 size={18} /> Payer rule applied</div>
            <div className="nex-check-card"><CheckCircle2 size={18} /> NPI verified</div>
            <button type="button">Route to certified review</button>
          </section>
        </div>
      </div>
    </section>
  );
}

function TeamSection() {
  return (
    <section className="nex-team" id="team">
      <div className="nex-team-photo tall">
        <img src={TEAM_IMAGES[0]} alt="Healthcare professional reviewing clinical workflow" />
      </div>
      <div className="nex-team-copy">
        <span className="nex-section-chip"><Stethoscope size={16} /> About Codical</span>
        <h2>Remove friction from your revenue cycle.</h2>
        <p>
          Manual coding review is slow and prone to human error, leading to preventable denials.
          Codical acts as a brilliant first pass, instantly flagging NCCI conflicts and
          payer-specific rules before a human ever looks at the claim.
        </p>
        <div className="nex-team-stats">
          <strong>42%<span>fewer preventable denials</span></strong>
          <strong>24h<span>reviewer SLA</span></strong>
          <strong>NCCI<span>plus payer checks</span></strong>
        </div>
      </div>
      <div className="nex-team-side">
        <p>Designed for teams that need clinical context, coding accuracy and billing readiness to stay connected.</p>
        <CtaButton href="#results" variant="secondary">Explore results</CtaButton>
        <div className="nex-team-photo wide">
          <img src={TEAM_IMAGES[2]} alt="Clinical team discussing coding review" />
        </div>
      </div>
    </section>
  );
}

function ResultsSection() {
  return (
    <section className="nex-results" id="results">
      <div className="nex-section-center">
        <span className="nex-section-chip"><BarChart3 size={16} /> Results</span>
        <h2>Intelligence at every layer.</h2>
        <p>Purpose-built validation engines catch errors before submission and keep the final decision auditable.</p>
      </div>

      <div className="nex-result-grid">
        {FEATURE_CARDS.map((feature) => {
          const FeatureIcon = feature.icon;
          return (
            <article className={`nex-result-card feature-${feature.visual}`} key={feature.title}>
              <i><FeatureIcon size={24} /></i>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
              <div className="nex-feature-visual" aria-hidden="true">
                <strong>{feature.metric}</strong>
                <span />
                <span />
                <span />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WorkflowVisual({ step }: { step: ProcessStep }) {
  const StepIcon = step.icon;

  return (
    <div className={`nex-process-visual visual-${step.visual}`}>
      <div className="nex-workflow-canvas">
        <div className="nex-workflow-header">
          <span><StepIcon size={18} /> {step.label}</span>
          <strong>{step.title}</strong>
        </div>

        {step.visual === "upload" && (
          <div className="nex-upload-scene">
            <div className="nex-document-stack">
              <span className="sheet one"><FileText size={20} /> Operative note</span>
              <span className="sheet two">Patient encounter summary</span>
              <span className="sheet three">Supporting documentation</span>
            </div>
            <div className="nex-drop-zone">
              <UploadCloud size={34} />
              <strong>Upload packet</strong>
              <small>PDF, image, text or encounter export</small>
            </div>
          </div>
        )}

        {step.visual === "suggest" && (
          <div className="nex-suggestion-scene">
            <div className="nex-source-note">
              <strong>Documentation cues</strong>
              <span>chronic condition reviewed</span>
              <span>moderate complexity noted</span>
              <span>EKG interpreted in visit</span>
            </div>
            <div className="nex-code-suggestions">
              {["99214", "E11.9", "93000", "25"].map((code) => (
                <span key={code}><Sparkles size={14} /> {code}</span>
              ))}
            </div>
          </div>
        )}

        {step.visual === "validate" && (
          <div className="nex-validation-scene">
            {["NCCI edits", "Payer policy", "NPI taxonomy", "Coverage context"].map((label, index) => (
              <div className="nex-validation-row" key={label}>
                <span>{index + 1}</span>
                <strong>{label}</strong>
                <em>{index === 1 ? "Review" : "Clear"}</em>
              </div>
            ))}
          </div>
        )}

        {step.visual === "review" && (
          <div className="nex-review-scene">
            <div className="nex-reviewer-card">
              <UserCheck size={24} />
              <strong>Certified coder</strong>
              <small>Final approval required</small>
            </div>
            <div className="nex-review-note">
              <span>Reviewer note</span>
              <p>Modifier rationale confirmed. Documentation supports final code set.</p>
              <button type="button">Approve report</button>
            </div>
          </div>
        )}
      </div>

      <div className="nex-process-overlay">
        <span><StepIcon size={21} /> {step.label}</span>
        <strong>{step.title}</strong>
        <div>
          {step.stats.map((stat) => <em key={stat}>{stat}</em>)}
        </div>
      </div>
    </div>
  );
}

function ProcessSection() {
  const [active, setActive] = useState(0);
  const step = PROCESS_STEPS[active];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % PROCESS_STEPS.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  const progressItems = useMemo(() => PROCESS_STEPS.map((item, index) => ({ ...item, active: index === active })), [active]);

  return (
    <section className="nex-process" id="process">
      <div className="nex-process-head">
        <div>
          <span className="nex-section-chip"><ClipboardCheck size={16} /> Core workflow</span>
          <h2>Healthcare AI medical coding in four controlled steps.</h2>
        </div>
        <p>Codical keeps every case moving through a clear path: document intake, coding support, claim checks and certified review.</p>
      </div>

      <div className="nex-process-shell">
        <WorkflowVisual step={step} />

        <div className="nex-process-copy">
          <span>{step.label}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
          <div className="nex-process-tabs" role="tablist" aria-label="Coding workflow steps">
            {progressItems.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={item.active ? "is-active" : ""}
                onClick={() => setActive(index)}
                role="tab"
                aria-selected={item.active}
              >
                <b>{item.label}</b>
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function IntegrationsSection() {
  return (
    <section className="nex-integrations" id="integrations">
      <div className="nex-ecosystem">
        <div className="nex-ecosystem-orbit" aria-hidden="true">
          <BrandMark compact />
          {TRUST_NODES.map((node, index) => {
            const NodeIcon = node.icon;
            return (
              <span className={`trust-node trust-node-${index}`} key={node.name}>
                <NodeIcon size={18} />
                <strong>{node.name}</strong>
              </span>
            );
          })}
        </div>
        <div className="nex-ecosystem-copy">
          <span className="nex-section-chip"><Network size={16} /> Healthcare ecosystem</span>
          <h2>Plugs into your existing reality.</h2>
          <p>Codical sits between clinical documentation and claim submission, acting as a high-speed intelligence layer for teams already operating across EHR, payer and clearinghouse systems.</p>
          <ul>
            {TRUST_NODES.map((node) => (
              <li key={node.name}><CheckCircle2 size={17} /> <strong>{node.name}</strong> {node.text}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="nex-faq" id="faq">
      <div className="nex-section-center">
        <span className="nex-section-chip"><MessageSquareText size={16} /> FAQ</span>
        <h2>Frequently asked questions</h2>
      </div>
      <div className="nex-faq-list">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question}>
            <summary>{item.question}<ChevronDown size={18} /></summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="nex-page">
      <Header />
      <main>
        <MotionHero />
        <TeamSection />
        <ResultsSection />
        <ProcessSection />
        <IntegrationsSection />
        <FaqSection />
        <section className="nex-final">
          <div>
            <span className="nex-section-chip"><ShieldCheck size={16} /> Codical Health</span>
            <h2>Ready for zero-error coding?</h2>
            <p>Join healthcare organizations reducing denial rates and accelerating revenue cycles with Codical.</p>
            <div className="nex-final-actions">
              <CtaButton href="/signup">Get started</CtaButton>
              <CtaButton href="/login" variant="secondary">Contact sales</CtaButton>
            </div>
          </div>
        </section>
      </main>
      <footer className="nex-footer">
        <BrandMark compact />
        <nav aria-label="Footer">
          <a href="/signup">Request access</a>
          <a href="#faq">Privacy Policy</a>
          <a href="#faq">Terms of Service</a>
          <a href="#faq">HIPAA Compliance</a>
          <a href="#top">Status</a>
        </nav>
        <p>© 2026 Codical Health. Intelligent healthcare operations.</p>
      </footer>
    </div>
  );
}
