import "@/styles/codical-os.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Bot,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSearch,
  LockKeyhole,
  MessageSquare,
  Moon,
  Pill,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  UserRoundSearch,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useTheme } from "@/lib/theme";

const HERO_TOOLS = [
  ["ICD", "ICD-10-CM Search"],
  ["CPT", "CPT Search"],
  ["H", "HCPCS Search"],
  ["RVU", "RVU Calculator"],
  ["AN", "Anesthesia Calculator"],
  ["ID", "NPI Lookup"],
  ["Rx", "Drug Lookup"],
  ["AI", "Op Report to Codes"],
  ["CH", "Codical Chat"],
  ["LCD", "Coverage Rules"],
  ["NCCI", "Claim Edit Check"],
  ["PQ", "Provider Query"],
];

const TYPE_PHRASES = [
  "Search ICD, CPT, HCPCS, NPI, drug and RVU data...",
  "Paste an op report and suggest codes...",
  "Check NCCI edits before submission...",
  "Review LCD, NCD and payer policy context...",
  "Route provider queries to Codical Chat...",
];

const CODE_CHIPS = [
  "99214",
  "E11.9",
  "G2211",
  "J1100",
  "M54.50",
  "29881",
  "NCCI",
  "RVU26B",
  "LCD",
  "NPI",
  "NDC",
  "POS 11",
  "Modifier 25",
  "HCPCS",
];

const PLATFORM_CARDS = [
  {
    className: "wide",
    icon: Search,
    title: "One search layer for coding work.",
    text: "Search ICD-10-CM, CPT, HCPCS, modifiers, POS, NPI, drug records and related coding context without jumping between disconnected portals.",
    data: ["E11.9 -> ICD-10-CM", "99214 -> CPT", "J1100 -> HCPCS", "POS 11 -> Office"],
  },
  {
    className: "tall",
    icon: Bot,
    title: "AI assists. Coders approve.",
    text: "Paste a clinical note, scan for procedures and diagnoses, surface documentation gaps, then keep final decisions under human review.",
    data: ["Read note", "Suggest codes", "Flag gaps", "Coder approves"],
  },
  {
    className: "",
    icon: Calculator,
    title: "Payment math in context.",
    text: "RVU, anesthesia units, fee schedule signals and specialty workflow details stay attached to the case.",
    data: ["wRVU", "PE RVU", "Base units", "Locality"],
  },
  {
    className: "",
    icon: MessageSquare,
    title: "Team memory for every case.",
    text: "Discuss denials, payer rules, provider queries and coding rationale with case context attached.",
    data: ["Coding review", "Provider query", "Denial risk", "Audit notes"],
  },
];

const TOOL_PREVIEWS = [
  {
    icon: Search,
    title: "ICD / CPT / HCPCS Search",
    desc: "Search codes with specialty filters, descriptions, modifier hints and related billing logic.",
    rows: [
      ["99214", "Office/outpatient established patient visit", "CPT"],
      ["E11.9", "Type 2 diabetes without complications", "ICD"],
      ["J1100", "Injection, dexamethasone sodium phosphate", "HCPCS"],
    ],
  },
  {
    icon: Calculator,
    title: "RVU Calculator",
    desc: "Estimate work RVU, practice expense, malpractice RVU, total RVU and projected reimbursement by locality.",
    rows: [
      ["wRVU", "Work value from selected procedure", "1.92"],
      ["PE RVU", "Practice expense estimate", "0.70"],
      ["Total", "Estimated total RVU", "2.80"],
    ],
  },
  {
    icon: Stethoscope,
    title: "Anesthesia Calculator",
    desc: "Calculate base units, time units, modifying units and estimated reimbursement in one visual workflow.",
    rows: [
      ["00731", "Upper GI endoscopic anesthesia", "Base 5"],
      ["Time", "62 minutes documented", "4.1"],
      ["Total", "Base + time + modifier units", "9.1"],
    ],
  },
  {
    icon: UserRoundSearch,
    title: "NPI Lookup",
    desc: "Search provider NPI, taxonomy, address, organization, credentials and billing provider details quickly.",
    rows: [
      ["NPI", "1750384806", "Active"],
      ["Taxonomy", "Internal Medicine", "Primary"],
      ["Location", "New Jersey", "Verified"],
    ],
  },
  {
    icon: Bot,
    title: "Codical AI Coder",
    desc: "Paste an operative report and receive suggested CPT, ICD-10, modifier considerations and documentation gaps.",
    rows: [
      ["29881", "Arthroscopic meniscectomy suggested", "92%"],
      ["Gap", "Confirm laterality and approach", "Review"],
      ["Query", "Provider clarification recommended", "Draft"],
    ],
  },
  {
    icon: MessageSquare,
    title: "Codical Chat + Case Cards",
    desc: "Discuss coding questions, denials, provider queries and claim risks with the relevant case context attached.",
    rows: [
      ["Room", "coding-review", "Live"],
      ["Case", "99214-25 + 20610", "Open"],
      ["Action", "Provider query drafted", "Ready"],
    ],
  },
];

const MARQUEE = [
  "ICD-10-CM 2026",
  "CPT and HCPCS lookup",
  "NCCI edits",
  "RVU fee schedule modeling",
  "LCD and NCD coverage context",
  "CMS Open Data",
  "NPI lookup",
  "Drug and NDC lookup",
  "Codical AI coding",
  "Team chat",
  "Audit-ready history",
];

function CodeRain() {
  return (
    <div className="co-code-rain" aria-hidden="true">
      {CODE_CHIPS.map((chip, index) => (
        <span
          key={chip}
          className="co-code-chip"
          style={{
            left: `${(index * 17) % 96}%`,
            top: `${80 + ((index * 11) % 55)}%`,
            animationDuration: `${9 + (index % 6) * 2.2}s`,
            animationDelay: `${-index * 0.8}s`,
            opacity: 0.35 + (index % 5) * 0.1,
          }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function useTypingText(items: string[]) {
  const [text, setText] = useState("");

  useEffect(() => {
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: number;

    const tick = () => {
      const current = items[phraseIndex];
      setText(current.slice(0, charIndex));

      if (!deleting && charIndex < current.length) {
        charIndex += 1;
      } else if (!deleting && charIndex === current.length) {
        deleting = true;
      } else if (deleting && charIndex > 0) {
        charIndex -= 1;
      } else {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % items.length;
      }

      timer = window.setTimeout(tick, deleting ? 28 : 48);
    };

    tick();
    return () => window.clearTimeout(timer);
  }, [items]);

  return text;
}

function HeroCommandCenter() {
  const typed = useTypingText(TYPE_PHRASES);
  const stageRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);

  const carousel = useMemo(() => [...HERO_TOOLS, ...HERO_TOOLS], []);

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const area = stageRef.current;
    const center = centerRef.current;
    if (!area || !center) return;

    const rect = area.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    center.style.transform = `rotateX(${7 - y * 7}deg) rotateY(${-9 + x * 9}deg) translateY(-4px)`;
  };

  return (
    <div className="co-stage" ref={stageRef} onMouseMove={onMove} onMouseLeave={() => {
      if (centerRef.current) centerRef.current.style.transform = "rotateX(7deg) rotateY(-9deg) translateY(0)";
    }}>
      <div className="co-orbit" />
      <div className="co-orbit" />
      <div className="co-orb one" />
      <div className="co-orb two" />

      <div className="co-command-center" ref={centerRef}>
        <div className="co-dash-top">
          <div className="co-window-dots"><span /><span /><span /></div>
          <div className="co-status-chip"><span className="co-live-dot" /> Live code intelligence</div>
        </div>

        <div className="co-universal-search">
          <Search size={16} />
          <span>{typed || TYPE_PHRASES[0]}</span>
          <span className="co-mono">99214</span>
        </div>

        <div className="co-dash-grid">
          <div className="co-glass-card co-coding-panel">
            <div className="co-panel-title">
              <h4>AI Coding Console</h4>
              <span className="co-badge">Human review required</span>
            </div>
            <div className="co-code-table">
              {[
                ["99214", "Office/outpatient established patient visit", "92%"],
                ["E11.9", "Type 2 diabetes without complications", "ICD"],
                ["25", "Separately identifiable E/M modifier", "Review"],
                ["G2211", "Longitudinal care complexity indicator", "Payer?"],
              ].map((row) => (
                <div className="co-code-row" key={row[0]}>
                  <span className="co-mono">{row[0]}</span>
                  <span>{row[1]}</span>
                  <span className={`co-mono ${row[2] === "Review" ? "co-amber" : row[2] === "Payer?" ? "co-rose" : "co-green"}`}>{row[2]}</span>
                </div>
              ))}
            </div>
            <div className="co-mini-grid">
              <div className="co-metric-card"><small>RVU estimate</small><strong>2.80</strong></div>
              <div className="co-metric-card"><small>Anesthesia units</small><strong>8.4</strong></div>
              <div className="co-metric-card"><small>Claim risk</small><strong className="co-amber">Medium</strong></div>
            </div>
          </div>

          <div className="co-glass-card co-carousel">
            <div className="co-panel-title">
              <h4>Tool Stack</h4>
              <span className="co-badge">20+</span>
            </div>
            <div className="co-carousel-window">
              <div className="co-carousel-track">
                {carousel.map(([icon, label], index) => (
                  <div className={`co-tool-pill ${index % 5 === 0 ? "hot" : ""}`} key={`${label}-${index}`}>
                    <span className="co-tool-icon">{icon}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="co-floating-alert">
          <div className="co-badge">Coverage signal</div>
          <p>LCD/NCD and payer policy context should be reviewed before final claim submission.</p>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="co-section-head">
      <div className="co-eyebrow"><span className="co-live-dot" /> {eyebrow}</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export function Landing() {
  const { theme, toggle } = useTheme();
  const [activeTool, setActiveTool] = useState(0);
  const tool = TOOL_PREVIEWS[activeTool];

  return (
    <div className="landingAurora co-page">
      <div className="co-cursor-glow" aria-hidden="true" />
      <div className="co-grain" aria-hidden="true" />

      <header className="co-nav-wrap">
        <nav className="co-navbar" aria-label="Primary navigation">
          <a className="co-brand-link" href="#top" aria-label="Codical Health home">
            <BrandMark />
          </a>
          <div className="co-nav-links">
            <a href="#platform">Platform</a>
            <a href="#tools">Tools</a>
            <a href="#ai">AI Coding</a>
            <a href="#workflow">Workflow</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="co-nav-actions">
            <button className="co-theme-toggle" onClick={toggle} aria-label="Toggle light and dark mode">
              <span>{theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}</span>
            </button>
            <Link className="co-btn co-btn-ghost" href="/login">Sign in</Link>
            <Link className="co-btn co-btn-primary" href="/signup">Request access <ArrowRight size={16} /></Link>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="co-hero">
          <CodeRain />
          <div className="co-container co-hero-grid">
            <div className="co-hero-copy">
              <div className="co-eyebrow"><span className="co-live-dot" /> 2026 coding, coverage and reimbursement command center</div>
              <h1>
                <span className="co-hero-word" style={{ "--d": 1 } as React.CSSProperties}>Find</span>{" "}
                <span className="co-hero-word" style={{ "--d": 2 } as React.CSSProperties}>codes.</span><br />
                <span className="co-hero-word" style={{ "--d": 3 } as React.CSSProperties}>Calculate</span>{" "}
                <span className="co-hero-word" style={{ "--d": 4 } as React.CSSProperties}>RVUs.</span><br />
                <span className="co-hero-word co-gradient-text" style={{ "--d": 5 } as React.CSSProperties}>Audit claims.</span>
              </h1>
              <p>
                Codical Health brings code search, Codical AI coding review, NCCI checks, RVU and anesthesia calculators,
                payer policy context, CMS Open Data and Codical Chat into one calm RCM workspace.
              </p>
              <div className="co-hero-actions">
                <Link href="/signup" className="co-btn co-btn-primary">Launch workspace <ArrowRight size={16} /></Link>
                <a href="#ai" className="co-btn co-btn-ghost">Watch AI coding flow</a>
              </div>
              <div className="co-trust-row">
                <span className="co-trust-pill"><CheckCircle2 size={15} /> Human coder approval</span>
                <span className="co-trust-pill"><Database size={15} /> CMS data lanes</span>
                <span className="co-trust-pill"><ShieldCheck size={15} /> Audit-ready history</span>
              </div>
            </div>

            <HeroCommandCenter />
          </div>
        </section>

        <div className="co-marquee" aria-label="Platform capabilities">
          <div className="co-marquee-track">
            {[...MARQUEE, ...MARQUEE].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
          </div>
        </div>

        <section className="co-section" id="platform">
          <div className="co-container">
            <SectionHead
              eyebrow="One intelligent platform"
              title="Every step of the coding workflow belongs in one place."
              text="Official coding references, medical necessity context, reimbursement math and team review are most useful when they live beside the same case."
            />
            <div className="co-bento">
              {PLATFORM_CARDS.map((card) => (
                <article className={`co-bento-card ${card.className}`} key={card.title}>
                  <div className="co-big-icon"><card.icon size={28} /></div>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                  <div className="co-bento-visual">
                    {card.data.map((item) => <div className="co-tiny-data co-mono" key={item}>{item}</div>)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="co-section" id="tools">
          <div className="co-container">
            <SectionHead
              eyebrow="Operational tool stack"
              title="A product-dense workspace for coders, billers and RCM teams."
              text="The app keeps lookup, calculation, coverage review, AI suggestions and collaboration close enough for repeated daily use."
            />
            <div className="co-tools-layout">
              <aside className="co-panel co-tool-list">
                {TOOL_PREVIEWS.map((item, index) => (
                  <button
                    key={item.title}
                    className={`co-tool-btn ${activeTool === index ? "is-active" : ""}`}
                    onClick={() => setActiveTool(index)}
                  >
                    <span className="co-tool-icon"><item.icon size={15} /></span>
                    <span>{item.title}</span>
                  </button>
                ))}
              </aside>
              <div className="co-panel co-tool-preview">
                <div className="co-preview-header">
                  <div>
                    <h3>{tool.title}</h3>
                    <p>{tool.desc}</p>
                  </div>
                  <span className="co-badge">Interactive preview</span>
                </div>
                <div className="co-preview-screen">
                  <div className="co-universal-search">
                    <Search size={16} />
                    <span>Search, calculate or review case context...</span>
                    <span className="co-mono">Live</span>
                  </div>
                  {tool.rows.map((row) => (
                    <div className="co-result-line" key={row[0]}>
                      <span className="co-mono">{row[0]}</span>
                      <span>{row[1]}</span>
                      <span className="co-confidence">{row[2]}</span>
                    </div>
                  ))}
                  <div className="co-mini-grid">
                    <div className="co-metric-card"><small>Connected workflow</small><strong>Claim Review</strong></div>
                    <div className="co-metric-card"><small>Next action</small><strong>Save Case</strong></div>
                    <div className="co-metric-card"><small>Team status</small><strong>Synced</strong></div>
                  </div>
                </div>
              </div>
              <aside className="co-panel co-benefit-stack">
                <div className="co-benefit"><strong>Faster lookup</strong><p>Reduce switching between coding sites, spreadsheets, payer PDFs, calculators and chat apps.</p></div>
                <div className="co-benefit"><strong>Cleaner claims</strong><p>Surface documentation gaps, modifiers, medical necessity issues and payer review needs earlier.</p></div>
                <div className="co-benefit"><strong>Team memory</strong><p>Save decisions, payer rules, provider preferences and specialty workflows for future cases.</p></div>
                <div className="co-benefit"><strong>Data-aware</strong><p>Bring CMS, NPI, drug, fee schedule and coverage references into a single workflow.</p></div>
              </aside>
            </div>
          </div>
        </section>

        <section className="co-section" id="ai">
          <div className="co-container">
            <SectionHead
              eyebrow="AI coding with guardrails"
              title="Scan the note, surface the rationale, keep the coder in control."
              text="Codical Health is designed for assistive AI: suggested codes, documentation gaps and payer considerations should move faster without replacing professional review."
            />
            <div className="co-ai-demo">
              <div className="co-panel co-doc-panel">
                <div className="co-scan-line" />
                <div className="co-doc-text">
                  OPERATIVE NOTE<br /><br />
                  PROCEDURE PERFORMED: <span className="co-highlight">Arthroscopic partial medial meniscectomy</span> with diagnostic arthroscopy.<br /><br />
                  FINDINGS: Complex tear posterior horn medial meniscus, chondromalacia and synovitis.<br /><br />
                  ANESTHESIA: <span className="co-highlight">General anesthesia</span>.<br /><br />
                  CODER NOTE: Laterality, approach and separately identifiable E/M support should be reviewed before final billing.
                </div>
              </div>
              <div className="co-panel co-output-panel">
                <div className="co-output-list">
                  <div className="co-output-item"><small>Suggested CPT</small><strong className="co-mono">29881</strong> - Knee arthroscopy with meniscectomy</div>
                  <div className="co-output-item"><small>Possible ICD-10</small><strong className="co-mono">M23.221</strong> - Derangement of posterior horn of medial meniscus</div>
                  <div className="co-output-item"><small>Modifier / payer logic</small>Review whether additional work supports separate reporting.</div>
                  <div className="co-output-item"><small>Coder control</small>Final coding requires certified coder validation and payer-specific review.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="co-section" id="workflow">
          <div className="co-container">
            <SectionHead
              eyebrow="Workflow"
              title="From clinical note to claim-ready coding trail."
              text="A case should carry the note, suggested codes, coverage context, team discussion and audit rationale from the first review through final approval."
            />
            <div className="co-workflow">
              {[
                ["1", "Paste note", "Upload or paste an op report, progress note, procedure note or claim scenario."],
                ["2", "AI scans", "Key diagnoses, procedures, timings, units and documentation gaps are highlighted."],
                ["3", "Tools calculate", "RVU, anesthesia, code relationships and reimbursement logic become part of the case."],
                ["4", "Team reviews", "Coders, billers, managers and providers discuss the same case inside chat."],
                ["5", "Claim-ready", "Final codes, rationale, query history and audit notes stay attached to the workflow."],
              ].map(([number, title, text]) => (
                <article className="co-workflow-step" key={number}>
                  <div className="co-step-number">{number}</div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="co-section">
          <div className="co-container">
            <SectionHead
              eyebrow="Collaboration"
              title="Chat is useful when it knows the case."
              text="Provider queries, denial questions and modifier review should not get separated from the actual code set and account context."
            />
            <div className="co-panel co-chat-layout">
              <aside className="co-chat-sidebar">
                {["# coding-review", "# provider-queries", "# denials", "# anesthesia", "# credentialing", "# ar-follow-up"].map((channel, index) => (
                  <div className={`co-channel ${index === 0 ? "active" : ""}`} key={channel}>{channel}</div>
                ))}
              </aside>
              <main className="co-chat-main">
                {[
                  ["Ayesha, CPC", "Can someone review whether modifier 25 is supported with this E/M and procedure?"],
                  ["Codical AI", "Possible support found, but documentation should show separately identifiable E/M decision-making."],
                  ["Provider Query", "Drafted: Please confirm whether evaluation was performed beyond consent and pre-op assessment."],
                  ["Claim Card", "99214-25 + 20610 - Status: Ready for senior coder review"],
                ].map(([name, body]) => (
                  <div className="co-message" key={name}>
                    <div className="co-avatar" />
                    <div className="co-bubble"><strong>{name}</strong><br />{body}</div>
                  </div>
                ))}
              </main>
              <aside className="co-chat-context">
                <div className="co-context-card"><small>Patient Account</small><strong>Orthopedic follow-up</strong></div>
                <div className="co-context-card"><small>Suggested Codes</small><strong className="co-mono">99214, 20610, M25.561</strong></div>
                <div className="co-context-card"><small>Risk</small><strong>Modifier support needs review</strong></div>
                <div className="co-context-card"><small>Assigned</small><strong>Ayesha - Senior Coder</strong></div>
              </aside>
            </div>
          </div>
        </section>

        <section className="co-section" id="security">
          <div className="co-container">
            <SectionHead
              eyebrow="Controls"
              title="Compliance work should feel calm, traceable and reviewable."
              text="Security and compliance sections need less flash and more confidence: roles, review controls, logs and clear decision history."
            />
            <div className="co-bento">
              {[
                [LockKeyhole, "Role-based access", "Separate permissions for coders, billers, managers, providers, admins and client users."],
                [ClipboardList, "Audit activity logs", "Track coding suggestions, edits, approvals, provider queries, chat decisions and case history."],
                [Sparkles, "Human review controls", "AI remains assistive until reviewed, edited and approved by the coding team."],
              ].map(([Icon, title, text]) => {
                const IconComp = Icon as typeof LockKeyhole;
                return (
                  <article className="co-bento-card" key={String(title)}>
                    <div className="co-big-icon"><IconComp size={28} /></div>
                    <h3>{String(title)}</h3>
                    <p>{String(text)}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="co-section">
          <div className="co-container">
            <SectionHead
              eyebrow="Use cases"
              title="Built for the pressure points in revenue cycle teams."
              text="The product story is anchored in daily workflows: reducing lost context, surfacing gaps earlier and improving review discipline."
            />
            <div className="co-testimonials">
              {[
                ["RCM director", "Unify coding, calculators, coverage signals and conversations so teams can move faster without losing context.", "Multi-specialty RCM"],
                ["Certified coder", "Use AI review and documentation gap prompts before a claim reaches denial stage.", "Surgical coding"],
                ["Practice manager", "Keep Codical Chat connected to the account, code discussion and provider query history.", "Primary care practice"],
              ].map(([role, quote, person]) => (
                <article className="co-testimonial" key={role}>
                  <span className="co-badge">{role}</span>
                  <p className="co-quote">{quote}</p>
                  <div className="co-person"><div className="co-avatar" /><div><strong>{person}</strong><br /><span>Workflow perspective</span></div></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="co-section" id="pricing">
          <div className="co-container">
            <SectionHead
              eyebrow="Pricing"
              title="Simple packages for growing coding operations."
              text="Use Codical Health for individual coding work, small practice teams or enterprise RCM operations that need deeper controls."
            />
            <div className="co-pricing-grid">
              {[
                ["Starter", "Pilot", "For solo coders and small practices.", ["Code search", "RVU and anesthesia calculators", "NPI and drug lookup", "Saved workspace"]],
                ["Professional", "Team", "For billing companies and RCM teams.", ["Everything in Starter", "Codical AI coding", "Codical Chat and case cards", "Coverage and payer policy hub"]],
                ["Enterprise", "Custom", "For MSOs, hospitals and larger teams.", ["Role controls", "Audit activity logs", "Admin reporting", "Implementation support"]],
              ].map(([name, price, text, features], index) => (
                <article className={`co-price-card ${index === 1 ? "popular" : ""}`} key={String(name)}>
                  {index === 1 && <span className="co-badge">Most popular</span>}
                  <h3>{String(name)}</h3>
                  <div className="co-price">{String(price)}{index !== 2 && <span> access</span>}</div>
                  <p style={{ color: "var(--co-muted)" }}>{String(text)}</p>
                  <ul className="co-feature-list">
                    {(features as string[]).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <Link className={`co-btn ${index === 1 ? "co-btn-primary" : "co-btn-ghost"}`} href="/signup">
                    {index === 2 ? "Contact sales" : "Request access"}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="co-section">
          <div className="co-container">
            <div className="co-final-cta">
              <h2>Turn coding work into a connected command center.</h2>
              <p>Start with search and calculators, then bring AI coding, coverage review, payer context and team collaboration into the same workspace.</p>
              <div className="co-hero-actions" style={{ justifyContent: "center", marginBottom: 0 }}>
                <Link className="co-btn co-btn-primary" href="/signup">Request access <ArrowRight size={16} /></Link>
                <a className="co-btn co-btn-ghost" href="#tools">Explore tools</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="co-footer">
        <div className="co-footer-aurora" />
        <div className="co-container">
          <div className="co-footer-grid">
            <div className="co-footer-brand">
              <BrandMark />
              <p>Codical Health is a healthcare coding intelligence workspace for search, AI coding review, reimbursement tools, coverage context and team collaboration.</p>
            </div>
            <div className="co-footer-col"><h4>Product</h4><a href="#tools">Code Search</a><a href="#ai">AI Coding</a><a href="#tools">Calculators</a><a href="#workflow">Codical Chat</a></div>
            <div className="co-footer-col"><h4>Tools</h4><a href="#tools">ICD Search</a><a href="#tools">CPT Search</a><a href="#tools">RVU Calculator</a><a href="#tools">NPI Lookup</a></div>
            <div className="co-footer-col"><h4>Resources</h4><a href="https://www.cms.gov/medicare/coding-billing/icd-10-codes">CMS ICD-10</a><a href="https://www.cms.gov/national-correct-coding-initiative-ncci">CMS NCCI</a><a href="https://www.cms.gov/medicare/coverage/determination-process/local">LCD Process</a><a href="https://data.cms.gov/">CMS Open Data</a></div>
            <div className="co-footer-col"><h4>Access</h4><Link href="/login">Sign in</Link><Link href="/signup">Request access</Link><a href="#security">Security</a><a href="#pricing">Pricing</a></div>
          </div>
          <div className="co-footer-ticker">
            <div>
              <span>CODICAL_HEALTH</span><span>ICD10</span><span>CPT</span><span>HCPCS</span><span>NCCI</span><span>RVU</span><span>LCD_NCD</span><span>TEAM_REVIEW</span>
              <span>CODICAL_HEALTH</span><span>ICD10</span><span>CPT</span><span>HCPCS</span><span>NCCI</span><span>RVU</span><span>LCD_NCD</span><span>TEAM_REVIEW</span>
            </div>
          </div>
          <div className="co-footer-bottom">
            <span>(c) {new Date().getFullYear()} Codical Health. Coding intelligence reimagined.</span>
            <span>Assistive tooling only. Final coding decisions require professional review.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
