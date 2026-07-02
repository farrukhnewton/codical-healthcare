import "@/styles/landing-stitch.css";

import heroLaptopCleanCutout from "@/assets/landing/hero-laptop-universal-clean.png";
import heroWaveLeftFinal from "@/assets/landing/hero-wave-left-final.png";
import heroWaveRightFinal from "@/assets/landing/hero-wave-right-final.png";
import aetnaLogo from "@/assets/landing/partners/aetna.svg";
import availityLogo from "@/assets/landing/partners/availity.svg";
import changeHealthcareLogo from "@/assets/landing/partners/change-healthcare.png";
import cignaLogo from "@/assets/landing/partners/cigna.png";
import elevanceLogo from "@/assets/landing/partners/elevance-health.svg";
import humanaLogo from "@/assets/landing/partners/humana.svg";
import kaiserLogo from "@/assets/landing/partners/kaiser-permanente.png";
import optumLogo from "@/assets/landing/partners/optum.svg";
import unitedHealthcareLogo from "@/assets/landing/partners/unitedhealthcare.svg";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  AudioLines,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileAudio,
  FileChartColumnIncreasing,
  Gauge,
  Globe2,
  Landmark,
  Menu,
  MessagesSquare,
  MessageSquareText,
  Mic2,
  Play,
  ScanSearch,
  Search,
  ShieldCheck,
  ShieldPlus,
  Sparkles,
  Stethoscope,
  UsersRound,
  Volume2,
  Workflow,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

type LogoItem = {
  name: string;
  domain: string;
  logo: string;
  color: string;
  size?: "wide" | "compact" | "tall";
};

type LogoGroup = {
  label: string;
  logos: LogoItem[];
};

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
  image: string;
  imageTitle: string;
  imageText: string;
  items: MenuItem[];
};

type Feature = {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  points: string[];
  stat: string;
};

type VideoStory = {
  title: string;
  source: string;
  videoId: string;
  note: string;
};

type ProfileStory = {
  name: string;
  role: string;
  location: string;
  org: string;
  orgMark: string;
  quote: string;
  portrait: string;
};

const NAV_ITEMS = [
  { label: "Platform", href: "#platform" },
  { label: "Solutions", href: "#solutions" },
  { label: "Ecosystem", href: "#ecosystem" },
  { label: "Stories", href: "#stories" },
  { label: "Pricing", href: "#cta" },
];

const MENU_IMAGES = [
  "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=900&q=85",
];

const MENU_GROUPS: MenuGroup[] = [
  {
    id: "platform",
    label: "Platform",
    title: "Codical platform",
    image: MENU_IMAGES[0],
    imageTitle: "Unified coding workspace",
    imageText: "AI coding, transcription, anesthesia calculations and chat in one operating view.",
    items: [
      { icon: BrainCircuit, title: "AI Medical Coding", text: "Source-linked ICD, CPT, HCPCS and modifier suggestions.", href: "#solutions" },
      { icon: AudioLines, title: "AI Transcription", text: "Encounter audio becomes structured coding context.", href: "#solutions" },
      { icon: Gauge, title: "Anesthesia Calculator", text: "Base units, time, modifiers and locality factors together.", href: "#solutions" },
      { icon: MessagesSquare, title: "Team Chats", text: "Reviewer handoffs stay attached to the case.", href: "#solutions" },
    ],
  },
  {
    id: "solutions",
    label: "Solutions",
    title: "Revenue cycle teams",
    image: MENU_IMAGES[1],
    imageTitle: "Built for healthcare operations",
    imageText: "Designed for coders, billers, auditors, anesthesia teams and RCM leaders.",
    items: [
      { icon: Landmark, title: "Provider Groups", text: "Standardize coding workflows across specialties.", href: "#platform" },
      { icon: ShieldPlus, title: "Compliance Teams", text: "Keep rationale, checks and review history visible.", href: "#platform" },
      { icon: Workflow, title: "RCM Leaders", text: "Track throughput, denial risk and team follow-up.", href: "#platform" },
      { icon: FileChartColumnIncreasing, title: "Analytics", text: "See coding volume and revenue impact in real time.", href: "#platform" },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    title: "Workflow resources",
    image: MENU_IMAGES[2],
    imageTitle: "Evidence-ready decisions",
    imageText: "Reports, videos and case context for teams moving faster with control.",
    items: [
      { icon: FileChartColumnIncreasing, title: "Coding Reports", text: "Export clean case summaries with source rationale.", href: "#stories" },
      { icon: BadgeCheck, title: "Claim Checks", text: "NCCI and documentation review before handoff.", href: "#platform" },
      { icon: Play, title: "Video Stories", text: "Watch public healthcare RCM workflow examples.", href: "#stories" },
      { icon: ScanSearch, title: "Policy Context", text: "Bring payer and clearinghouse context into review.", href: "#ecosystem" },
    ],
  },
];

const LOGO_GROUPS: LogoGroup[] = [
  {
    label: "Insurers",
    logos: [
      { name: "UnitedHealthcare", domain: "uhc.com", logo: unitedHealthcareLogo, color: "#1f3570", size: "wide" },
      { name: "Aetna", domain: "aetna.com", logo: aetnaLogo, color: "#7d3f98", size: "compact" },
      { name: "Cigna", domain: "cigna.com", logo: cignaLogo, color: "#1188c9", size: "wide" },
      { name: "Humana", domain: "humana.com", logo: humanaLogo, color: "#4e8416", size: "wide" },
      { name: "Elevance Health", domain: "elevancehealth.com", logo: elevanceLogo, color: "#1a3673", size: "wide" },
      { name: "Kaiser Permanente", domain: "kp.org", logo: kaiserLogo, color: "#0087b4", size: "wide" },
    ],
  },
  {
    label: "Clearinghouses",
    logos: [
      { name: "Availity", domain: "availity.com", logo: availityLogo, color: "#f7941e", size: "wide" },
      { name: "Change Healthcare", domain: "changehealthcare.com", logo: changeHealthcareLogo, color: "#f72b55", size: "wide" },
      { name: "Optum", domain: "optum.com", logo: optumLogo, color: "#ff612b", size: "wide" },
    ],
  },
];

const FEATURES: Feature[] = [
  {
    id: "coding",
    label: "AI Medical Coding",
    icon: Sparkles,
    title: "Source-linked coding support before the claim moves.",
    summary:
      "Codical reads clinical context, suggests ICD-10, CPT, HCPCS and modifier options, then keeps rationale tied to the source note.",
    points: ["CPT, ICD-10 and HCPCS suggestions", "NCCI and modifier review", "Coder signoff with evidence"],
    stat: "98% confidence review lane",
  },
  {
    id: "transcription",
    label: "AI Transcription",
    icon: Mic2,
    title: "Turn encounter audio into structured coding context.",
    summary:
      "Upload audio, review structured fields, inspect transcript evidence and send extracted codes into validation without losing context.",
    points: ["Audio intake and transcript cleanup", "Structured patient record", "One-click handoff to claim review"],
    stat: "25MB audio intake",
  },
  {
    id: "anesthesia",
    label: "Anesthesia Calculator",
    icon: Calculator,
    title: "Calculate units, modifiers and locality factors in one flow.",
    summary:
      "The anesthesia calculator combines base units, time units, MAC locality and modifier policy into a clear payment summary.",
    points: ["CY 2026 locality factors", "Base unit lookup", "Modifier payment adjustments"],
    stat: "109 locality options",
  },
  {
    id: "chat",
    label: "Team Chats",
    icon: MessageSquareText,
    title: "Keep coding decisions and team context together.",
    summary:
      "Team chats help coders, billers and reviewers discuss work, attach files and ask the assistant without leaving the case flow.",
    points: ["Direct and group threads", "Conversation context panel", "Assistant-ready collaboration"],
    stat: "Live review handoffs",
  },
];

const VIDEO_STORIES: VideoStory[] = [
  {
    title: "Phelps Memorial RCM workflow story",
    source: "Inovalon",
    videoId: "k9GXupX1TSs",
    note: "Public YouTube embed about enhanced healthcare RCM workflows.",
  },
  {
    title: "O'Neal Medical revenue cycle story",
    source: "Brightree",
    videoId: "KpTPlGfE_sY",
    note: "Public YouTube embed about medical revenue cycle workflows.",
  },
];

const PROFILE_STORIES: ProfileStory[] = [
  {
    name: "Maya Ellis, CPC",
    role: "Coding Operations Director",
    location: "Denver, CO",
    org: "Metro Specialty Group",
    orgMark: "MS",
    quote:
      "Our reviewers need fast evidence, not another disconnected queue. The best workflow keeps documentation, codes and claim checks visible together.",
    portrait: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Jon Bell, CRCR",
    role: "Revenue Cycle Manager",
    location: "Orlando, FL",
    org: "Coastal Care Network",
    orgMark: "CC",
    quote:
      "Denial prevention improves when billing, coding and follow-up teams can see the same signal before submission.",
    portrait: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Priya Raman",
    role: "Anesthesia Billing Lead",
    location: "Nashville, TN",
    org: "Summit Anesthesia Partners",
    orgMark: "SA",
    quote:
      "Anesthesia payment reviews move faster when base units, time, locality and modifier rationale are all in the same workspace.",
    portrait: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=700&q=85",
  },
];

const HERO_COPY_VARIANTS = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.12,
    },
  },
};

const HERO_COPY_ITEM_VARIANTS = {
  hidden: {
    opacity: 0,
    y: 18,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: "easeOut",
    },
  },
};

function useHeroScrollTimeline() {
  const heroRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [viewport, setViewport] = useState({
    width: 1440,
    height: 900,
    isMobile: false,
  });

  useEffect(() => {
    const update = () => {
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const nextViewport = {
        width,
        height,
        isMobile: width < 768,
      };

      document.documentElement.style.setProperty("--vh", `${height * 0.01}px`);
      setViewport((current) => {
        if (
          current.width === nextViewport.width &&
          current.height === nextViewport.height &&
          current.isMobile === nextViewport.isMobile
        ) {
          return current;
        }

        return nextViewport;
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end end"],
  });
  const panelWidth = Math.min(1480, Math.max(0, viewport.width - (viewport.isMobile ? 16 : 48)));
  const sideInset = Math.max(viewport.isMobile ? 8 : 24, (viewport.width - panelWidth) / 2);
  const initialClip = `inset(${viewport.isMobile ? 76 : 92}px ${sideInset}px ${viewport.isMobile ? 14 : 34}px round ${viewport.isMobile ? 18 : 28}px)`;
  const expandedClip = "inset(0px 0px 0px round 0px)";

  const clipPath = useTransform(scrollYProgress, [0, 0.52], [initialClip, expandedClip]);
  const laptopY = useTransform(
    scrollYProgress,
    [0, 1],
    [prefersReducedMotion ? "0vh" : viewport.isMobile ? "22vh" : "28vh", prefersReducedMotion ? "0vh" : viewport.isMobile ? "-4vh" : "-7vh"],
  );
  const laptopScale = useTransform(scrollYProgress, [0, 1], [viewport.isMobile ? 0.9 : 0.91, viewport.isMobile ? 1 : 1.02]);
  const laptopOpacity = useTransform(scrollYProgress, [0, 0.08], [prefersReducedMotion ? 1 : 0.92, 1]);
  const waveY = useTransform(
    scrollYProgress,
    [0, 1],
    [prefersReducedMotion ? 0 : viewport.height * 0.03, prefersReducedMotion ? 0 : -viewport.height * 0.24],
  );
  const waveScale = useTransform(scrollYProgress, [0, 0.75], [viewport.isMobile ? 1.04 : 1.06, viewport.isMobile ? 1.17 : 1.22]);
  const waveOpacity = useTransform(scrollYProgress, [0, 0.48, 1], [0.94, 0.68, 0.58]);
  const waveFilter = useTransform(
    scrollYProgress,
    [0.2, 0.78, 1],
    [
      "blur(0px) saturate(118%) contrast(104%)",
      `blur(${viewport.isMobile ? 3 : 7}px) saturate(116%) contrast(103%)`,
      `blur(${viewport.isMobile ? 2 : 4}px) saturate(116%) contrast(103%)`,
    ],
  );
  const copyY = useTransform(
    scrollYProgress,
    [0, 0.5],
    [prefersReducedMotion ? "0vh" : "6vh", prefersReducedMotion ? "0vh" : "-26vh"],
  );
  const copyOpacity = useTransform(scrollYProgress, [0, 0.34, 0.54], [1, 0.34, 0]);
  const copyScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.945]);
  const copyFilter = useTransform(
    scrollYProgress,
    [0, 0.5],
    ["blur(0px)", prefersReducedMotion ? "blur(0px)" : "blur(18px)"],
  );
  const scrimOpacity = useTransform(scrollYProgress, [0.72, 1], [0, viewport.isMobile ? 0.08 : 0.16]);

  return {
    heroRef,
    clipPath,
    laptopY,
    laptopScale,
    laptopOpacity,
    waveY,
    waveScale,
    waveOpacity,
    waveFilter,
    copyY,
    copyOpacity,
    copyScale,
    copyFilter,
    scrimOpacity,
  };
}

function CtaButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link className={`nex-button nex-button-${variant}`} href={href}>
      <strong>{children}</strong>
      <span>
        <ArrowRight size={17} />
      </span>
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
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setActiveMenu(null);
          }
        }}
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
          <a className="nex-nav-item nex-nav-link" href="#ecosystem">
            Ecosystem
          </a>
          <a className="nex-nav-item nex-nav-link" href="#stories">
            Stories
          </a>
          <a className="nex-nav-item nex-nav-link" href="#cta">
            Pricing
          </a>
        </nav>

        <div className="nex-header-actions">
          <a className="nex-nav-icon" href="#ecosystem" aria-label="Healthcare ecosystem">
            <Globe2 size={20} />
          </a>
          <Link className="nex-login" href="/login">
            Sign in
          </Link>
          <CtaButton href="/signup">Request a demo</CtaButton>
        </div>

        <button
          className="nex-mobile-toggle"
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={23} />
        </button>

        {activeGroup && (
          <div className="nex-mega-menu" onMouseEnter={() => setActiveMenu(activeGroup.id)}>
            <div className="nex-mega-copy">
              <span>{activeGroup.title}</span>
              <div className="nex-mega-grid">
                {activeGroup.items.map((item, index) => (
                  <a href={item.href} className={`nex-mega-link item-${index}`} key={item.title}>
                    <i>
                      <item.icon size={20} strokeWidth={2.35} />
                    </i>
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </a>
                ))}
              </div>
            </div>
            <a className="nex-mega-card" href={activeGroup.items[0].href}>
              <img src={activeGroup.image} alt="" />
              <div>
                <strong>{activeGroup.imageTitle}</strong>
                <p>{activeGroup.imageText}</p>
                <span>
                  <ArrowRight size={16} />
                </span>
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
              <X size={22} />
            </button>
          </div>
          {MENU_GROUPS.map((group) => {
            const PrimaryIcon = group.items[0].icon;
            return (
              <a className="nex-mobile-group" href={group.items[0].href} key={group.id} onClick={() => setMobileOpen(false)}>
                <i>
                  <PrimaryIcon size={22} />
                </i>
                <strong>{group.label}</strong>
                <span>{group.imageText}</span>
              </a>
            );
          })}
          <a className="nex-mobile-group" href="#cta" onClick={() => setMobileOpen(false)}>
            <i>
              <BarChart3 size={22} />
            </i>
            <strong>Pricing</strong>
            <span>Volume-aware plans for coding teams and RCM operators.</span>
          </a>
          <div className="nex-mobile-actions">
            <CtaButton href="/signup">Request a demo</CtaButton>
            <CtaButton href="/login" variant="secondary">
              Sign in
            </CtaButton>
          </div>
          <p>AI coding, transcription, anesthesia and team review</p>
        </div>
      </aside>
    </>
  );
}

function HeroDashboardScreen() {
  const kpis = [
    ["Coding margin", "$315,041", "+8.4%"],
    ["Codes automated", "347", "+9%"],
    ["Claim edits", "32", "Clear"],
    ["Est. revenue impact", "$128k", "+14%"],
  ];
  const worklist = [
    ["CH-78291", "Jacob Jones", "98%", "Low"],
    ["CH-78292", "Mary Smith", "95%", "Low"],
    ["CH-78293", "Ethan Brown", "92%", "Medium"],
    ["CH-78294", "Olivia Davis", "88%", "High"],
    ["CH-78295", "Noah Wilson", "93%", "Low"],
  ];
  const railItems = [
    ["AI invoices", "9"],
    ["Coder review", "10"],
    ["Missing docs", "2"],
    ["Payer checks", "0"],
  ];

  return (
    <div className="nex-hero-dashboard-screen">
      <div className="nex-mac-bar" aria-hidden="true">
        <div className="nex-mac-brand">
          <BrandMark compact />
          <strong>Codical</strong>
        </div>
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Go</span>
        <span>Window</span>
        <span>Help</span>
        <div className="nex-mac-status">
          <i />
          <i />
          <Search size={11} />
          <Volume2 size={11} />
          <strong>Mon Jun 22</strong>
          <strong>9:41 AM</strong>
        </div>
      </div>

      <div className="nex-product-toolbar">
        <div className="nex-product-mark">
          <BrandMark compact />
          <strong>CODICAL</strong>
        </div>
        <div className="nex-product-select">
          <span>Organization</span>
          <strong>Northstar Health</strong>
        </div>
        <div className="nex-product-select is-small">
          <span>Type</span>
          <strong>RCM</strong>
        </div>
        <label className="nex-product-search">
          <Search size={13} />
          <span>Search claims, codes, notes...</span>
        </label>
        <div className="nex-product-avatar">AA</div>
      </div>

      <div className="nex-product-tabs">
        <span>Home</span>
        <span className="is-active">AI Coding Dashboard</span>
        <span>Anesthesia Review</span>
        <span>Transcript Queue</span>
      </div>

      <div className="nex-product-shell">
        <aside className="nex-product-rail" aria-hidden="true">
          {[Menu, Activity, ClipboardCheck, Calculator, MessageSquareText].map((Icon, index) => (
            <i className={index === 0 ? "is-active" : ""} key={index}>
              <Icon size={13} />
            </i>
          ))}
        </aside>

        <main className="nex-product-board">
          <div className="nex-product-filters">
            {["Specialty", "Cardiology", "Coder", "Priya Raman", "Start", "06-01-2026", "Payer", "Aetna"].map((item, index) => (
              <span className={index % 2 === 0 ? "is-label" : ""} key={`${item}-${index}`}>
                {item}
              </span>
            ))}
          </div>

          <div className="nex-hero-software-grid">
            <section className="nex-software-kpis">
              {kpis.map(([label, value, trend]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <em>{trend}</em>
                </article>
              ))}
            </section>

            <section className="nex-software-bars">
              <div className="nex-software-head">
                <strong>Documentation utilization</strong>
                <span>75%</span>
              </div>
              {["Labour", "Clinical notes", "Subcontractors", "Equipment", "Overhead"].map((label, index) => (
                <div className="nex-budget-row" key={label}>
                  <span>{label}</span>
                  <i style={{ "--bar-width": `${34 + index * 12}%` } as CSSProperties} />
                </div>
              ))}
            </section>

            <section className="nex-donut-card">
              <strong>Pending edits</strong>
              <div className="nex-donut is-teal">
                <span>$181k</span>
              </div>
            </section>

            <section className="nex-donut-card">
              <strong>Claim validation</strong>
              <div className="nex-donut is-purple">
                <span>98%</span>
              </div>
            </section>

            <section className="nex-hero-worklist">
              <div className="nex-software-head">
                <strong>AI medical coding worklist</strong>
                <span>View all</span>
              </div>
              {worklist.map(([code, patient, confidence, risk]) => (
                <div className="nex-hero-case" data-risk={risk.toLowerCase()} key={code}>
                  <span>{code}</span>
                  <strong>{patient}</strong>
                  <em>{confidence}</em>
                  <small>{risk}</small>
                </div>
              ))}
            </section>

            <section className="nex-hero-transcription">
              <div className="nex-software-head">
                <strong>AI transcription</strong>
                <span>Live</span>
              </div>
              <div className="nex-hero-wave" aria-hidden="true">
                {Array.from({ length: 32 }).map((_, index) => (
                  <i key={index} style={{ animationDelay: `${index * 36}ms` }} />
                ))}
              </div>
              <div className="nex-hero-audio">
                <span>00:03:18</span>
                <button type="button">Pause</button>
                <button type="button">Finalize</button>
              </div>
            </section>

            <section className="nex-hero-anesthesia">
              <div className="nex-software-head">
                <strong>Anesthesia calculator</strong>
                <span>CY 2026</span>
              </div>
              <div>
                <span>Base units</span>
                <strong>6</strong>
              </div>
              <div>
                <span>Time units</span>
                <strong>3</strong>
              </div>
              <div>
                <span>Est. payment</span>
                <strong>$635.85</strong>
              </div>
            </section>

            <aside className="nex-hero-right-rail">
              <section>
                <strong>Awaiting approval</strong>
                {railItems.map(([label, value]) => (
                  <p key={label}>
                    <span>{label}</span>
                    <em>{value}</em>
                  </p>
                ))}
              </section>
              <section>
                <strong>Outstanding items</strong>
                {["RFIs", "Submittals", "Meeting actions"].map((label, index) => (
                  <p key={label}>
                    <span>{label}</span>
                    <em>{index + 3}</em>
                  </p>
                ))}
              </section>
              <section className="nex-hero-chat-mini">
                <strong>Team chat</strong>
                <p>Modifier rationale confirmed.</p>
                <p className="is-own">Route final note to payer review.</p>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function PartnerLogo({ logo }: { logo: LogoItem }) {
  return (
    <img className={`nex-partner-logo-image is-${logo.size ?? "wide"}`} src={logo.logo} alt="" loading="lazy" />
  );
}

function EcosystemMarquee() {
  return (
    <section className="nex-ecosystem-strip" id="ecosystem" aria-label="Healthcare ecosystem logo references">
      <div className="nex-ecosystem-inner">
        <div className="nex-ecosystem-head">
          <span>Trusted across the healthcare ecosystem</span>
          <small>Public ecosystem references, not customer claims.</small>
        </div>
        <div className="nex-logo-board">
          {LOGO_GROUPS.map((group, groupIndex) => (
            <div className="nex-logo-row" data-category={group.label.toLowerCase()} key={group.label}>
              <div className="nex-logo-label">{group.label}</div>
              <div className="nex-logo-track-window">
                <div className="nex-logo-track" data-reverse={groupIndex % 2 === 1 ? "true" : "false"}>
                  {[...group.logos, ...group.logos, ...group.logos].map((logo, index) => (
                    <a
                      className="nex-logo-tile"
                      href={`https://${logo.domain}`}
                      key={`${group.label}-${logo.name}-${index}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${logo.name} public website`}
                      style={{ "--brand": logo.color } as CSSProperties}
                    >
                      <PartnerLogo logo={logo} />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MiniSidebar() {
  return (
    <aside className="nex-app-sidebar" aria-hidden="true">
      <BrandMark compact />
      {[
        ["Dashboard", Activity],
        ["Coding Worklist", ClipboardCheck],
        ["Transcription", FileAudio],
        ["Anesthesia", Stethoscope],
        ["Team Chat", MessageSquareText],
        ["Analytics", BarChart3],
      ].map(([label, Icon], index) => {
        const SidebarIcon = Icon as LucideIcon;
        return (
          <span className={index === 0 ? "is-active" : ""} key={label as string}>
            <SidebarIcon size={15} />
            {label as string}
          </span>
        );
      })}
    </aside>
  );
}

function DashboardScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`nex-dashboard-screen ${compact ? "is-compact" : ""}`}>
      <MiniSidebar />
      <main className="nex-screen-main">
        <div className="nex-screen-top">
          <div>
            <small>Welcome back, Jordan</small>
            <strong>Revenue cycle command center</strong>
          </div>
          <button type="button">Create case</button>
        </div>

        <div className="nex-kpi-grid">
          {[
            ["Claims in review", "128", "+18%"],
            ["Codes automated", "347", "+9%"],
            ["Net collections", "$128,430", "+14%"],
            ["Denials rate", "2.7%", "-0.4%"],
          ].map(([label, value, trend]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <em>{trend}</em>
            </article>
          ))}
        </div>

        <div className="nex-dashboard-grid">
          <section className="nex-worklist-panel">
            <div className="nex-panel-head">
              <strong>Coding worklist</strong>
              <a href="#solutions">View all</a>
            </div>
            {[
              ["C-74821", "Outpatient", "High"],
              ["C-74822", "Surgery", "Medium"],
              ["C-74823", "Anesthesia", "High"],
              ["C-74824", "Cardiology", "Low"],
            ].map(([caseId, type, risk]) => (
              <div className="nex-case-row" data-risk={risk.toLowerCase()} key={caseId}>
                <span>{caseId}</span>
                <strong>{type}</strong>
                <em>{risk}</em>
              </div>
            ))}
          </section>

          <section className="nex-transcription-panel">
            <div className="nex-panel-head">
              <strong>Transcription</strong>
              <a href="#solutions">Live</a>
            </div>
            <div className="nex-waveform" aria-hidden="true">
              {Array.from({ length: 26 }).map((_, index) => (
                <i key={index} style={{ animationDelay: `${index * 42}ms` }} />
              ))}
            </div>
            <div className="nex-audio-actions">
              <span>00:01:28</span>
              <button type="button">Pause</button>
              <button type="button">Finalize</button>
            </div>
          </section>

          <section className="nex-calculator-panel">
            <div className="nex-panel-head">
              <strong>Anesthesia calculator</strong>
              <a href="#solutions">Open</a>
            </div>
            <div className="nex-calc-result">
              <span>00100 + 90 min</span>
              <strong>$824.91</strong>
              <em>17 total units</em>
            </div>
          </section>

          <section className="nex-chat-panel">
            <div className="nex-panel-head">
              <strong>Team chat</strong>
              <a href="#solutions">3 active</a>
            </div>
            {["Modifier rationale confirmed.", "Routing to certified review.", "Transcript ready for final code set."].map((message, index) => (
              <p key={message} className={index === 1 ? "is-own" : ""}>
                {message}
              </p>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}

function LaptopMockup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`nex-laptop ${className}`}>
      <div className="nex-laptop-lid">
        <div className="nex-laptop-camera" />
        <div className="nex-laptop-screen">
          {children}
          <span className="nex-screen-scanner" aria-hidden="true" />
        </div>
      </div>
      <div className="nex-laptop-base">
        <span />
      </div>
    </div>
  );
}

function UniversalLaptopAsset({
  src,
  alt,
  className = "",
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`nex-universal-laptop ${className}`}>
      <img className="nex-universal-laptop-image nex-concept-laptop" src={src} alt={alt} />
      {children}
    </div>
  );
}

function HeroSection() {
  const {
    heroRef,
    clipPath,
    laptopY,
    laptopScale,
    laptopOpacity,
    waveY,
    waveScale,
    waveOpacity,
    waveFilter,
    copyY,
    copyOpacity,
    copyScale,
    copyFilter,
    scrimOpacity,
  } = useHeroScrollTimeline();

  return (
    <section className="nex-hero" id="top" ref={heroRef}>
      <motion.div
        className="nex-hero-stage"
        initial="hidden"
        whileInView="visible"
        viewport={{ amount: 0.35 }}
      >
        <motion.div className="nex-hero-background-layer" aria-hidden="true" style={{ clipPath }} />
        <motion.div className="nex-hero-motion-field" aria-hidden="true" style={{ clipPath }}>
          <div className="nex-concept-composition">
            <motion.div
              className="nex-concept-wave-stage"
              style={{
                y: waveY,
                scale: waveScale,
                opacity: waveOpacity,
                filter: waveFilter,
              }}
            >
              <img className="nex-concept-wave nex-concept-wave-right" src={heroWaveRightFinal} alt="" />
              <img className="nex-concept-wave nex-concept-wave-left" src={heroWaveLeftFinal} alt="" />
            </motion.div>
            <motion.div
              className="nex-concept-laptop-stage"
              style={{
                y: laptopY,
                scale: laptopScale,
                opacity: laptopOpacity,
              }}
            >
              <UniversalLaptopAsset
                className="is-hero-laptop-asset"
                src={heroLaptopCleanCutout}
                alt="Codical Health dashboard running on a laptop"
              >
                <div className="nex-laptop-live-overlay">
                  <span className="nex-screen-glaze" />
                  <span className="nex-screen-sweep" />
                  <span className="nex-screen-cursor" />
                  <span className="nex-live-value live-net"><b>$2,845,690</b><b>$2,913,420</b></span>
                  <span className="nex-live-value live-claims"><b>1,482</b><b>1,536</b></span>
                  <span className="nex-live-status">Validated</span>
                  <span className="nex-live-bars"><i /><i /><i /><i /><i /><i /></span>
                  <i className="nex-screen-pulse pulse-one" />
                  <i className="nex-screen-pulse pulse-two" />
                  <i className="nex-screen-pulse pulse-three" />
                </div>
              </UniversalLaptopAsset>
            </motion.div>
          </div>
        </motion.div>
        <motion.div className="nex-hero-soft-scrim" aria-hidden="true" style={{ opacity: scrimOpacity }} />
        <div className="nex-hero-grid">
          <motion.div
            className="nex-hero-copy"
            variants={HERO_COPY_VARIANTS}
            style={{
              y: copyY,
              opacity: copyOpacity,
              scale: copyScale,
              filter: copyFilter,
            }}
          >
            <motion.div className="nex-hero-pill" variants={HERO_COPY_ITEM_VARIANTS}>
              <i />
              AI-powered medical coding platform
            </motion.div>
            <motion.h1 variants={HERO_COPY_ITEM_VARIANTS}>Precision in coding, <span>Power in revenue.</span></motion.h1>
            <motion.p variants={HERO_COPY_ITEM_VARIANTS}>
              Codical Health unifies AI medical coding, transcription, anesthesia calculations and team collaboration in one calm,
              intelligent revenue cycle workspace.
            </motion.p>
            <motion.div className="nex-hero-actions" variants={HERO_COPY_ITEM_VARIANTS}>
              <CtaButton href="/signup">Request a demo</CtaButton>
            </motion.div>
          </motion.div>

        </div>
      </motion.div>
    </section>
  );
}

function CommandCenterSection() {
  return (
    <section className="nex-command" id="platform">
      <div className="nex-command-visual">
        <LaptopMockup className="is-side">
          <DashboardScreen compact />
        </LaptopMockup>
      </div>
      <div className="nex-command-copy">
        <span className="nex-section-label">Command center</span>
        <h2>One intelligent command center. Total revenue cycle visibility.</h2>
        <p>
          Real-time performance, coding worklists, transcription status, anesthesia calculations and team follow-up live in one
          coordinated surface.
        </p>
        <div className="nex-command-list">
          {[
            ["Real-time performance", "Monitor coding, claims and collections in the same view.", BarChart3],
            ["AI-driven automation", "Reduce manual routing while keeping coder review in control.", Sparkles],
            ["Actionable insights", "Identify denials, documentation gaps and coding risk early.", Search],
            ["Secure by design", "Build review workflows around controlled access and audit history.", ShieldCheck],
          ].map(([title, text, Icon]) => {
            const RowIcon = Icon as LucideIcon;
            return (
              <article key={title as string}>
                <RowIcon size={19} />
                <div>
                  <strong>{title as string}</strong>
                  <p>{text as string}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeaturePanel({ feature }: { feature: Feature }) {
  if (feature.id === "transcription") {
    return (
      <div className="nex-feature-ui transcription-ui">
        <div className="nex-feature-note">
          <FileAudio size={18} />
          <div>
            <strong>Consult-audio-0618.m4a</strong>
            <span>Structured record created</span>
          </div>
        </div>
        <div className="nex-waveform large" aria-hidden="true">
          {Array.from({ length: 34 }).map((_, index) => (
            <i key={index} style={{ animationDelay: `${index * 38}ms` }} />
          ))}
        </div>
        <div className="nex-code-columns">
          <span>CPT 99214</span>
          <span>ICD-10 J44.1</span>
          <span>HCPCS J7613</span>
        </div>
      </div>
    );
  }

  if (feature.id === "anesthesia") {
    return (
      <div className="nex-feature-ui anesthesia-ui">
        <div className="nex-calc-hero">
          <span>Non-qualifying payment</span>
          <strong>$824.91</strong>
          <small>17 units x locality factor</small>
        </div>
        <div className="nex-calc-grid">
          <span>Base units <strong>6</strong></span>
          <span>Time units <strong>6</strong></span>
          <span>Modifier <strong>AA</strong></span>
          <span>Locality <strong>TN 00</strong></span>
        </div>
      </div>
    );
  }

  if (feature.id === "chat") {
    return (
      <div className="nex-feature-ui chat-ui">
        {[
          ["Coder", "The modifier rationale is supported by the operative note."],
          ["Billing", "Claim validator is clear after the update."],
          ["Assistant", "Summary attached to case C-74823."],
        ].map(([sender, message], index) => (
          <div className={index === 1 ? "is-own" : ""} key={sender}>
            <strong>{sender}</strong>
            <p>{message}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="nex-feature-ui coding-ui">
      <div className="nex-feature-table">
        {[
          ["M54.16", "Radiculopathy", "99%", "Selected"],
          ["721.3", "Lumbosacral spondylosis", "96%", "Selected"],
          ["62323", "Injection, epidural", "97%", "Review"],
        ].map(([code, label, confidence, status]) => (
          <div key={code}>
            <strong>{code}</strong>
            <span>{label}</span>
            <em>{confidence}</em>
            <small>{status}</small>
          </div>
        ))}
      </div>
      <button type="button">Send to claim validation</button>
    </div>
  );
}

function SolutionsSection() {
  const [activeId, setActiveId] = useState(FEATURES[0].id);
  const activeFeature = useMemo(() => FEATURES.find((feature) => feature.id === activeId) || FEATURES[0], [activeId]);
  const ActiveIcon = activeFeature.icon;

  return (
    <section className="nex-solutions" id="solutions">
      <div className="nex-section-center">
        <span className="nex-section-label">AI-powered solutions</span>
        <h2>Smarter tools for modern revenue cycle teams.</h2>
      </div>

      <div className="nex-feature-shell">
        <div className="nex-feature-tabs" role="tablist" aria-label="Codical Health features">
          {FEATURES.map((feature) => {
            const FeatureIcon = feature.icon;
            return (
              <button
                type="button"
                key={feature.id}
                className={feature.id === activeId ? "is-active" : ""}
                onClick={() => setActiveId(feature.id)}
                role="tab"
                aria-selected={feature.id === activeId}
              >
                <FeatureIcon size={18} />
                {feature.label}
              </button>
            );
          })}
        </div>

        <div className="nex-feature-body">
          <div className="nex-feature-copy">
            <ActiveIcon size={22} />
            <h3>{activeFeature.title}</h3>
            <p>{activeFeature.summary}</p>
            <ul>
              {activeFeature.points.map((point) => (
                <li key={point}>
                  <CheckCircle2 size={16} />
                  {point}
                </li>
              ))}
            </ul>
            <strong>{activeFeature.stat}</strong>
          </div>
          <FeaturePanel feature={activeFeature} />
        </div>
      </div>
    </section>
  );
}

function VideoStoriesSection() {
  return (
    <section className="nex-video-stories" id="stories">
      <div className="nex-section-center">
        <span className="nex-section-label">Healthcare revenue voices</span>
        <h2>Hear from medical billing and RCM professionals.</h2>
        <p>Playable public YouTube embeds selected for the medical billing, RCM and healthcare operations context.</p>
      </div>

      <div className="nex-video-grid">
        {VIDEO_STORIES.map((story) => (
          <article className="nex-video-card" key={story.videoId}>
            <VideoPlayer story={story} />
            <div className="nex-video-copy">
              <small>{story.source}</small>
              <h3>{story.title}</h3>
              <p>{story.note}</p>
              <a href={`https://www.youtube.com/watch?v=${story.videoId}`} target="_blank" rel="noreferrer">
                Watch on YouTube <ArrowRight size={14} />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function VideoPlayer({ story }: { story: VideoStory }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="nex-video-frame">
      {playing ? (
        <iframe
          title={story.title}
          src={`https://www.youtube-nocookie.com/embed/${story.videoId}?rel=0&modestbranding=1&autoplay=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={`Play ${story.title}`}>
          <img
            src={`https://i.ytimg.com/vi/${story.videoId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
          />
          <span aria-hidden="true">
            <Play size={24} />
          </span>
        </button>
      )}
    </div>
  );
}

function ProfileStoriesSection() {
  return (
    <section className="nex-profile-stories">
      <div className="nex-section-center">
        <span className="nex-section-label">Role profiles</span>
        <h2>Results that matter. Partnerships that last.</h2>
      </div>

      <div className="nex-profile-grid">
        {PROFILE_STORIES.map((story) => (
          <article className="nex-profile-card" key={story.name}>
            <div className="nex-profile-brand">
              <span>{story.orgMark}</span>
              <strong>{story.org}</strong>
            </div>
            <blockquote>{story.quote}</blockquote>
            <div className="nex-profile-person">
              <img src={story.portrait} alt={`${story.name} professional portrait`} loading="lazy" />
              <div>
                <strong>{story.name}</strong>
                <span>{story.role}</span>
                <small>{story.location}</small>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GlassLogoCta() {
  return (
    <section className="nex-final" id="cta">
      <div className="nex-final-copy">
        <span className="nex-section-label">Codical Health</span>
        <h2>Ready to elevate your revenue cycle?</h2>
        <p>See how Codical Health can help your team code with precision and drive sustainable revenue growth.</p>
        <div className="nex-final-actions">
          <CtaButton href="/signup">Request a demo</CtaButton>
          <CtaButton href="/login" variant="secondary">Sign in</CtaButton>
        </div>
      </div>
      <div className="nex-glass-logo" aria-label="Animated Codical Health logo">
        <div className="nex-glass-mark">
          {[0, 1, 2, 3, 4].map((index) => (
            <span key={index} />
          ))}
        </div>
        <strong>codical</strong>
        <em>health</em>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="nex-page">
      <Header />
      <main>
        <HeroSection />
        <EcosystemMarquee />
        <CommandCenterSection />
        <SolutionsSection />
        <VideoStoriesSection />
        <ProfileStoriesSection />
        <GlassLogoCta />
      </main>
      <footer className="nex-footer">
        <BrandMark compact />
        <nav aria-label="Footer">
          <a href="#platform">Platform</a>
          <a href="#solutions">Solutions</a>
          <a href="#ecosystem">Ecosystem</a>
          <a href="#stories">Stories</a>
          <a href="#cta">Privacy</a>
          <a href="#cta">Security</a>
        </nav>
        <p>&copy; 2026 Codical Health. All rights reserved.</p>
      </footer>
    </div>
  );
}



