import "@/styles/landing-stitch.css";

import heroLaptopPremierFrame from "@/assets/landing/hero-concept-laptop-clean-premier.png";
import creativeEyeballVideo from "@/assets/landing/creative-eyeball.mp4";
import {
  motion,
  type MotionValue,
  type MotionStyle,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
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

type CommandDemoId = "coding" | "transcription" | "chat";

type CommandDemo = {
  id: CommandDemoId;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  metric: string;
  status: string;
};

type CommandWizardStep = {
  id: CommandDemoId;
  action: string;
  title: string;
  detail: string;
  result: string;
  x: string;
  y: string;
};

type CreativeTool = Feature & {
  accent: string;
  caption: string;
};

type CreativeShowcase = CreativeTool & {
  category: string;
  line: string;
  subline: string;
  proof: string;
  visual: "coding" | "transcription" | "calculator" | "chat";
};

type AccentMotionStyle = MotionStyle & {
  "--tool-accent"?: string;
};

type WizardMotionStyle = CSSProperties & {
  "--wizard-x": string;
  "--wizard-y": string;
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
      { name: "UnitedHealthcare", domain: "uhc.com", logo: "/assets/logos/insurers/unitedhealthcare.svg", color: "#1f3570", size: "wide" },
      { name: "Aetna", domain: "aetna.com", logo: "/assets/logos/insurers/aetna.svg", color: "#7d3f98", size: "compact" },
      { name: "Cigna", domain: "cigna.com", logo: "/assets/logos/insurers/cigna.png", color: "#1188c9", size: "wide" },
      { name: "Humana", domain: "humana.com", logo: "/assets/logos/insurers/humana.svg", color: "#4e8416", size: "wide" },
      { name: "Elevance Health", domain: "elevancehealth.com", logo: "/assets/logos/insurers/elevance-health.svg", color: "#1a3673", size: "wide" },
      { name: "Kaiser Permanente", domain: "kp.org", logo: "/assets/logos/insurers/kaiser.png", color: "#0087b4", size: "wide" },
    ],
  },
  {
    label: "Clearinghouses",
    logos: [
      { name: "Availity", domain: "availity.com", logo: "/assets/logos/insurers/availity.svg", color: "#f7941e", size: "wide" },
      { name: "Change Healthcare", domain: "changehealthcare.com", logo: "/assets/logos/insurers/change-healthcare.png", color: "#f72b55", size: "wide" },
      { name: "Optum", domain: "optum.com", logo: "/assets/logos/insurers/optum.svg", color: "#ff612b", size: "wide" },
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

const COMMAND_DEMOS: CommandDemo[] = [
  {
    id: "coding",
    label: "AI coding",
    icon: BrainCircuit,
    title: "AI coding work queue",
    description: "Coder-controlled suggestions with source evidence, modifier checks and payer-ready rationale.",
    metric: "98%",
    status: "Code set accepted",
  },
  {
    id: "transcription",
    label: "AI transcription",
    icon: FileAudio,
    title: "Encounter transcription",
    description: "Live audio becomes a structured note, then key coding context is sent into review.",
    metric: "01:24",
    status: "Transcript finalized",
  },
  {
    id: "chat",
    label: "Team chat",
    icon: MessagesSquare,
    title: "Case-attached team chat",
    description: "Coders, billers and reviewers coordinate in one thread without losing claim context.",
    metric: "3 live",
    status: "Handoff routed",
  },
];

const COMMAND_WIZARD_STEPS: CommandWizardStep[] = [
  {
    id: "coding",
    action: "Accept coding set",
    title: "Step 1: review AI coding evidence",
    detail: "Click the suggested ICD and CPT bundle to lock the source-linked coding decision.",
    result: "Coding evidence accepted",
    x: "34%",
    y: "57%",
  },
  {
    id: "transcription",
    action: "Finalize transcript",
    title: "Step 2: convert audio into coding context",
    detail: "Finalize the encounter transcript and send the extracted clinical context to review.",
    result: "Transcript routed to coding",
    x: "51%",
    y: "72%",
  },
  {
    id: "chat",
    action: "Route team handoff",
    title: "Step 3: attach the team decision",
    detail: "Send the validation summary into the case thread so billing and review stay aligned.",
    result: "Handoff complete",
    x: "82%",
    y: "55%",
  },
];

const CREATIVE_TOOLS: CreativeTool[] = FEATURES.map((feature, index) => ({
  ...feature,
  accent: ["#00d0ff", "#b65cff", "#ff914d", "#38d8a5"][index] ?? "#9d4edd",
  caption: ["Evidence-first coding", "Structured clinical audio", "Payment logic in one view", "Review decisions together"][index] ?? feature.label,
}));

const CREATIVE_SHOWCASES: CreativeShowcase[] = CREATIVE_TOOLS.map((tool, index) => ({
  ...tool,
  category: ["CODING", "AUDIO", "PAYMENT", "TEAM"][index] ?? tool.label.toUpperCase(),
  line:
    [
      "AI coding that keeps evidence visible.",
      "Transcription that turns speech into structure.",
      "Anesthesia math that explains the payment.",
      "Team review that stays attached to the case.",
    ][index] ?? tool.title,
  subline:
    [
      "Source-linked ICD, CPT, HCPCS and modifier suggestions stay connected to the claim.",
      "Encounter audio becomes usable notes, coding context and review-ready language.",
      "Base units, time, modifiers and locality factors stay in one calculation view.",
      "Coders, billers and reviewers resolve questions without leaving the workflow.",
    ][index] ?? tool.summary,
  proof: ["98% confidence", "01:24 transcript", "187.5 MME", "3 live reviewers"][index] ?? tool.stat,
  visual: (["coding", "transcription", "calculator", "chat"] as const)[index] ?? "coding",
}));

const CREATIVE_SCATTER_LAYOUTS = [
  { x: -39, y: -20, r: -6, s: 0.92 },
  { x: -15, y: -27, r: 7, s: 0.82 },
  { x: 18, y: -24, r: -2, s: 0.88 },
  { x: 38, y: -17, r: 5, s: 0.86 },
  { x: -34, y: 18, r: 4, s: 0.84 },
  { x: -8, y: 25, r: -7, s: 0.86 },
  { x: 24, y: 22, r: 6, s: 0.84 },
  { x: 45, y: 28, r: -9, s: 0.8 },
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

function HeroCleanProductScreen() {
  return (
    <div className="nex-hero-clean-screen">
      <div className="nex-hero-clean-top" aria-hidden="true">
        <span className="nex-hero-clean-brand">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span />
        <span />
        <span />
      </div>
      <div className="nex-hero-clean-grid" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
      <span className="nex-hero-clean-orbit is-one" aria-hidden="true" />
      <span className="nex-hero-clean-orbit is-two" aria-hidden="true" />
      <span className="nex-hero-clean-orbit is-three" aria-hidden="true" />
      <span className="nex-hero-clean-pulse is-one" aria-hidden="true" />
      <span className="nex-hero-clean-pulse is-two" aria-hidden="true" />
      <span className="nex-hero-clean-pulse is-three" aria-hidden="true" />
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

function LaptopHardwareFrame({
  children,
  className = "",
  screenClassName = "",
  decorative = false,
  alt = "Codical Health software running on a laptop",
}: {
  children: ReactNode;
  className?: string;
  screenClassName?: string;
  decorative?: boolean;
  alt?: string;
}) {
  return (
    <div className={`nex-hero-laptop-frame ${className}`}>
      <img
        className="nex-hero-laptop-frame-image nex-concept-laptop"
        src={heroLaptopPremierFrame}
        alt={decorative ? "" : alt}
        aria-hidden={decorative ? true : undefined}
      />
      <div className={`nex-hero-laptop-screen ${screenClassName}`} aria-hidden={decorative ? true : undefined}>
        {children}
      </div>
    </div>
  );
}

function HeroSection() {
  const heroRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const panelInsetX = useTransform(scrollY, [0, 720], prefersReducedMotion ? ["32px", "32px"] : ["32px", "0px"]);
  const panelInsetBottom = useTransform(scrollY, [0, 720], prefersReducedMotion ? ["32px", "32px"] : ["32px", "0px"]);
  const panelRadius = useTransform(scrollY, [0, 390, 720], prefersReducedMotion ? [30, 30, 30] : [30, 18, 0]);
  const laptopScale = useTransform(scrollY, [0, 720], prefersReducedMotion ? [1, 1] : [1, 1]);
  const laptopWidth = useTransform(
    scrollY,
    [0, 720],
    prefersReducedMotion
      ? ["min(1290px, calc(100vw - 100px))", "min(1290px, calc(100vw - 100px))"]
      : ["min(1290px, calc(100vw - 100px))", "min(1290px, calc(100vw - 100px))"],
  );
  const laptopY = useTransform(scrollY, [0, 720], prefersReducedMotion ? [0, 0] : [0, -390]);
  const laptopRadius = useTransform(scrollY, [0, 720], [0, 0]);
  const laptopShadow = useTransform(scrollY, [0, 720], [
    "0 40px 100px rgba(0,0,0,0.75)",
    "0 10px 40px rgba(0,0,0,0.4)",
  ]);
  const copyY = useTransform(scrollY, [0, 520], prefersReducedMotion ? [0, 0] : [0, -86]);
  const copyOpacity = useTransform(scrollY, [0, 280, 520], [1, 0.18, 0]);
  const copyFilter = useTransform(scrollY, [0, 520], ["blur(0px)", "blur(10px)"]);

  return (
    <section className="nex-hero-premier" id="top" ref={heroRef}>
      <div className="nex-hero-premier-sticky">
        <motion.div
          className="nex-hero-premier-panel"
          style={{
            left: panelInsetX,
            right: panelInsetX,
            bottom: panelInsetBottom,
            borderRadius: panelRadius,
          }}
        >
          <div className="nex-hero-premier-radial" aria-hidden="true" />
          <video
            className="nex-hero-premier-video"
            autoPlay
            muted
            loop
            playsInline
            crossOrigin="anonymous"
            preload="auto"
            poster="/assets/videos/hero-poster.jpg"
            aria-hidden="true"
          >
            <source src="/assets/videos/hero-loop-healthcare.mp4" type="video/mp4" />
            <source src="/assets/videos/loop_optimized.mp4" type="video/mp4" />
          </video>
          <div className="nex-hero-premier-texture" aria-hidden="true" />
          <div className="nex-hero-premier-grid" aria-hidden="true" />
          <img className="nex-hero-premier-orb is-left" src="/assets/hero-orb-left.svg" alt="" aria-hidden="true" />
          <img className="nex-hero-premier-orb is-right" src="/assets/hero-orb-right.svg" alt="" aria-hidden="true" />
          <div className="nex-hero-premier-vignette" aria-hidden="true" />
        </motion.div>

        <div className="nex-hero-premier-inner">
        <motion.div
          className="nex-hero-premier-copy"
          initial="hidden"
          animate="visible"
          style={{
            y: copyY,
            opacity: copyOpacity,
            filter: copyFilter,
          }}
        >
          <motion.div className="nex-hero-premier-badge" variants={HERO_COPY_ITEM_VARIANTS}>
            <i />
            <span>AI-powered medical coding platform</span>
          </motion.div>
          <motion.h1 className="nex-hero-premier-title">
            <motion.span
              initial={{ y: 28, opacity: 0, filter: "blur(8px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.82, ease: [0.2, 0.8, 0.2, 1], delay: 0.06 }}
            >
              Precision in coding,
            </motion.span>{" "}
            <motion.span
              className="is-serif"
              initial={{ y: 28, opacity: 0, filter: "blur(8px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.82, ease: [0.2, 0.8, 0.2, 1], delay: 0.15 }}
            >
              Power in revenue.
            </motion.span>
          </motion.h1>
          <motion.p className="nex-hero-premier-subtitle" variants={HERO_COPY_ITEM_VARIANTS}>
            Codical Health unifies AI medical coding, transcription, anesthesia calculations and team collaboration in one calm,
            intelligent revenue cycle workspace.
          </motion.p>
          <motion.div className="nex-hero-premier-actions" variants={HERO_COPY_ITEM_VARIANTS}>
            <Link className="nex-hero-premier-primary" href="/signup">
              <span className="nex-hero-premier-primary-text">Request a demo</span>
              <span className="nex-hero-premier-primary-arrow">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
            <a className="nex-hero-premier-secondary" href="#command-center">
              See platform
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          className="nex-hero-premier-macbook"
          style={{
            width: laptopWidth,
            y: laptopY,
            scale: laptopScale,
            borderRadius: laptopRadius,
            boxShadow: laptopShadow,
          }}
        >
          <motion.div
            className="nex-hero-premier-macbook-stage"
            initial={{ opacity: 0, y: 44, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="nex-hero-premier-macbook-glow" aria-hidden="true" />
            <LaptopHardwareFrame
              className="nex-hero-premier-frame"
              screenClassName="is-hero-laptop"
              alt="Codical Health platform running on a laptop"
            >
              <DashboardScreen compact />
              <span className="nex-hero-screen-glaze" />
              <span className="nex-hero-screen-sweep" />
            </LaptopHardwareFrame>
          </motion.div>
        </motion.div>
        </div>
      </div>
    </section>
  );
}

function CommandCenterScreen({
  activeDemo,
  onChange,
}: {
  activeDemo: CommandDemoId;
  onChange: (demo: CommandDemoId) => void;
}) {
  const active = COMMAND_DEMOS.find((demo) => demo.id === activeDemo) ?? COMMAND_DEMOS[0];
  const ActiveIcon = active.icon;
  const [wizardIndex, setWizardIndex] = useState(0);
  const [wizardComplete, setWizardComplete] = useState(false);
  const wizard = COMMAND_WIZARD_STEPS[wizardIndex] ?? COMMAND_WIZARD_STEPS[0];
  const wizardStyle = { "--wizard-x": wizard.x, "--wizard-y": wizard.y } as WizardMotionStyle;
  const caseRows = [
    ["CH-83472", "J47.1", "98%", "Ready"],
    ["CH-83473", "E11.65", "96%", "Review"],
    ["CH-83474", "K21.9", "97%", "Ready"],
    ["CH-83475", "M54.16", "95%", "Hold"],
  ];
  const selectDemo = (demoId: CommandDemoId) => {
    const nextIndex = COMMAND_WIZARD_STEPS.findIndex((step) => step.id === demoId);
    if (nextIndex >= 0) {
      setWizardIndex(nextIndex);
      setWizardComplete(false);
    }
    onChange(demoId);
  };
  const advanceWizard = () => {
    if (wizardComplete) {
      setWizardComplete(false);
      setWizardIndex(0);
      onChange(COMMAND_WIZARD_STEPS[0].id);
      return;
    }

    const nextIndex = wizardIndex + 1;
    if (nextIndex < COMMAND_WIZARD_STEPS.length) {
      setWizardIndex(nextIndex);
      onChange(COMMAND_WIZARD_STEPS[nextIndex].id);
      return;
    }

    setWizardComplete(true);
  };

  useEffect(() => {
    const nextIndex = COMMAND_WIZARD_STEPS.findIndex((step) => step.id === activeDemo);
    if (nextIndex >= 0 && COMMAND_WIZARD_STEPS[wizardIndex]?.id !== activeDemo) {
      setWizardIndex(nextIndex);
      setWizardComplete(false);
    }
  }, [activeDemo, wizardIndex]);

  return (
    <div className="nex-command-screen">
      <header className="nex-command-osbar">
        <div>
          <BrandMark compact />
          <strong>CODICAL</strong>
        </div>
        <label>
          <Search size={12} />
          <span>Search patients, claims, codes...</span>
        </label>
        <div className="nex-command-os-status">
          <span>AK</span>
          <strong>Admin</strong>
        </div>
      </header>

      <nav className="nex-command-demo-tabs" aria-label="Command center demo modes">
        {COMMAND_DEMOS.map((demo) => {
          const DemoIcon = demo.icon;
          return (
            <button
              type="button"
              key={demo.id}
              className={demo.id === activeDemo ? "is-active" : ""}
              onClick={() => selectDemo(demo.id)}
            >
              <DemoIcon size={14} />
              {demo.label}
            </button>
          );
        })}
      </nav>

      <main className="nex-command-workspace" data-mode={activeDemo} style={wizardStyle}>
        <aside className="nex-command-rail" aria-hidden="true">
          {[Activity, ClipboardCheck, FileAudio, MessagesSquare, ShieldCheck].map((Icon, index) => (
            <i className={index === COMMAND_DEMOS.findIndex((demo) => demo.id === activeDemo) + 1 ? "is-active" : ""} key={index}>
              <Icon size={13} />
            </i>
          ))}
        </aside>

        <section className="nex-command-mainboard">
          <div className="nex-command-filters">
            {["Date Range", "May 01 - May 22, 2026", "Facility", "All Facilities", "Payer", "All Payers", "Filters"].map((item, index) => (
              <span className={index % 2 === 0 ? "is-label" : ""} key={`${item}-${index}`}>
                {item}
              </span>
            ))}
          </div>

          <div className="nex-command-kpis">
            {[
              ["Net revenue", "$2,845,690", "+18.6%"],
              ["Claims paid", "1,482", "+14.2%"],
              ["First pass rate", "96.4%", "+6.3%"],
              ["Denial rate", "4.2%", "-1.0%"],
            ].map(([label, value, trend], index) => (
              <article key={label} className={index === COMMAND_DEMOS.findIndex((demo) => demo.id === activeDemo) ? "is-live" : ""}>
                <span>{label}</span>
                <strong>{value}</strong>
                <em>{trend}</em>
                <i />
              </article>
            ))}
          </div>

          <div className="nex-command-content-grid">
            <section className="nex-command-live-card is-primary">
              <div className="nex-command-live-head">
                <span>
                  <ActiveIcon size={15} />
                  {active.title}
                </span>
                <strong>{active.metric}</strong>
              </div>
              <p>{active.description}</p>
              {activeDemo === "coding" && (
                <div className="nex-command-code-review">
                  {caseRows.map(([caseId, code, confidence, status]) => (
                    <button type="button" key={caseId} onClick={advanceWizard}>
                      <span>{caseId}</span>
                      <strong>{code}</strong>
                      <em>{confidence}</em>
                      <small>{status}</small>
                    </button>
                  ))}
                </div>
              )}
              {activeDemo === "transcription" && (
                <div className="nex-command-transcript">
                  <div className="nex-command-wave" aria-hidden="true">
                    {Array.from({ length: 42 }).map((_, index) => (
                      <i key={index} style={{ animationDelay: `${index * 31}ms` }} />
                    ))}
                  </div>
                  <blockquote>
                    Patient reports improved breathing after nebulizer treatment. Assessment supports J44.1 with documented exacerbation.
                  </blockquote>
                  <button type="button" onClick={advanceWizard}>Finalize structured note</button>
                </div>
              )}
              {activeDemo === "chat" && (
                <div className="nex-command-chat">
                  {[
                    ["Sarah", "EBM audit update attached to the claim."],
                    ["Raj", "Denied claim 247912 reprocessed."],
                    ["Emily", "New payer rule for Aetna effective today."],
                  ].map(([person, message], index) => (
                    <p className={index === 1 ? "is-own" : ""} key={person}>
                      <strong>{person}</strong>
                      <span>{message}</span>
                    </p>
                  ))}
                </div>
              )}
            </section>

            <section className="nex-command-live-card is-chart">
              <strong>Revenue overview</strong>
              <div className="nex-command-bars" aria-hidden="true">
                {[46, 62, 54, 74, 68, 82, 93].map((height, index) => (
                  <i key={index} style={{ "--bar-height": `${height}%`, animationDelay: `${index * 110}ms` } as CSSProperties} />
                ))}
              </div>
            </section>

            <section className="nex-command-live-card is-ring">
              <strong>Coding accuracy</strong>
              <div className="nex-command-accuracy-ring">
                <span>96.4%</span>
              </div>
            </section>

            <aside className="nex-command-live-card is-side-panel">
              <strong>Team follow-up</strong>
              <p><span>Claim validation</span><em>Clean</em></p>
              <p><span>Coder review</span><em>3</em></p>
              <p><span>Chat updates</span><em>Live</em></p>
              <button type="button" className={wizardComplete ? "is-complete" : ""} onClick={advanceWizard}>
                {wizardComplete ? "Demo complete" : active.status}
              </button>
            </aside>
          </div>
        </section>

        <button
          type="button"
          className={wizardComplete ? "nex-command-wizard-target is-complete" : "nex-command-wizard-target"}
          onClick={advanceWizard}
          aria-label={wizardComplete ? "Restart command center demo" : wizard.action}
        >
          <span>{wizardComplete ? "Done" : wizard.action}</span>
        </button>
        <div className={wizardComplete ? "nex-command-demo-wizard is-complete" : "nex-command-demo-wizard"} aria-live="polite">
          <div className="nex-command-wizard-progress" aria-hidden="true">
            {COMMAND_WIZARD_STEPS.map((step, index) => (
              <i
                key={step.id}
                className={index < wizardIndex || wizardComplete ? "is-done" : index === wizardIndex ? "is-active" : ""}
              />
            ))}
          </div>
          <span>{wizardComplete ? "Guided demo finished" : `Guided demo ${wizardIndex + 1}/${COMMAND_WIZARD_STEPS.length}`}</span>
          <strong>{wizardComplete ? "Every signal is now attached to the case." : wizard.title}</strong>
          <p>{wizardComplete ? "Coding evidence, transcript context and team handoff are visible in one command center." : wizard.detail}</p>
          <button type="button" onClick={advanceWizard}>
            {wizardComplete ? "Restart demo" : wizard.action}
            <ArrowRight size={12} />
          </button>
          <small>{wizardComplete ? "Ready for claim validation" : wizard.result}</small>
        </div>
        <span className="nex-command-cursor" aria-hidden="true" />
        <span className="nex-command-click is-a" aria-hidden="true" />
        <span className="nex-command-click is-b" aria-hidden="true" />
        <span className="nex-command-click is-c" aria-hidden="true" />
      </main>
    </div>
  );
}

function CommandCenterSection() {
  const [activeDemo, setActiveDemo] = useState<CommandDemoId>("coding");
  const active = COMMAND_DEMOS.find((demo) => demo.id === activeDemo) ?? COMMAND_DEMOS[0];
  const ActiveIcon = active.icon;

  return (
    <section className="nex-command nex-command-premier" id="platform">
      <div className="nex-command-glow" aria-hidden="true" />
      <div className="nex-command-copy">
        <span className="nex-section-label">Command center</span>
        <h2>One workspace. Every revenue cycle signal in motion.</h2>
        <p>
          A live operating view for coding, transcription and team review, with software that can be tested directly inside the laptop.
        </p>
        <div className="nex-command-mode-pills" role="tablist" aria-label="Command center demo controls">
          {COMMAND_DEMOS.map((demo) => {
            const DemoIcon = demo.icon;
            return (
              <button
                type="button"
                key={demo.id}
                className={demo.id === activeDemo ? "is-active" : ""}
                onClick={() => setActiveDemo(demo.id)}
                role="tab"
                aria-selected={demo.id === activeDemo}
              >
                <DemoIcon size={16} />
                <span>{demo.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="nex-command-showcase">
        <div className="nex-command-context-card">
          <ActiveIcon size={20} />
          <strong>{active.title}</strong>
          <p>{active.description}</p>
          <span>{active.status}</span>
        </div>
        <div className="nex-command-visual">
          <LaptopHardwareFrame className="nex-command-laptop" screenClassName="nex-command-laptop-screen">
            <CommandCenterScreen activeDemo={activeDemo} onChange={setActiveDemo} />
            <span className="nex-hero-screen-glaze" />
          </LaptopHardwareFrame>
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

function CreativeImagePanel({
  showcase,
  variant = "standard",
}: {
  showcase: CreativeShowcase;
  variant?: "standard" | "scatter" | "stack" | "sequence" | "ghost";
}) {
  const ToolIcon = showcase.icon;

  return (
    <figure className={`nex-portfolio-image is-${showcase.visual} is-${variant}`} aria-label={`${showcase.label} product visual`}>
      <div className="nex-portfolio-chrome">
        <span />
        <span />
        <span />
        <strong>{showcase.label}</strong>
      </div>
      <div className="nex-portfolio-body">
        <div className="nex-portfolio-badge">
          <ToolIcon size={16} />
          <span>{showcase.proof}</span>
        </div>

        {showcase.visual === "coding" && (
          <div className="nex-portfolio-coding">
            <BrandMark compact />
            <div className="nex-portfolio-mini-table">
              {[
                ["CH-83472", "J47.1", "98"],
                ["CH-83473", "E11.65", "96"],
                ["CH-83474", "K21.9", "97"],
              ].map(([chart, code, score]) => (
                <span key={chart}>
                  <b>{chart}</b>
                  <em>{code}</em>
                  <i>{score}%</i>
                </span>
              ))}
            </div>
            <div className="nex-portfolio-donut" aria-hidden="true" />
          </div>
        )}

        {showcase.visual === "transcription" && (
          <div className="nex-portfolio-transcription">
            <div className="nex-portfolio-wave" aria-hidden="true">
              {Array.from({ length: 34 }).map((_, index) => (
                <i key={index} style={{ animationDelay: `${index * 34}ms` }} />
              ))}
            </div>
            <p>Patient reports improved breathing. Assessment supports exacerbation coding with source language.</p>
            <strong>Structured note ready</strong>
          </div>
        )}

        {showcase.visual === "calculator" && (
          <div className="nex-portfolio-calculator">
            <strong>$824.91</strong>
            <span>17 units x locality factor</span>
            {[
              ["Base", "6"],
              ["Time", "6"],
              ["Modifier", "AA"],
              ["MME", "187.5"],
            ].map(([label, value]) => (
              <p key={label}>
                <em>{label}</em>
                <b>{value}</b>
              </p>
            ))}
          </div>
        )}

        {showcase.visual === "chat" && (
          <div className="nex-portfolio-chat">
            {[
              ["Coder", "Evidence accepted."],
              ["Billing", "Validator is clean."],
              ["Assistant", "Summary attached."],
            ].map(([sender, text], index) => (
              <p className={index === 1 ? "is-own" : ""} key={sender}>
                <strong>{sender}</strong>
                <span>{text}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

function CreativeFlowWaveBackground({ light = false }: { light?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const parent = canvas?.parentElement;

    if (!canvas || !context || !parent) return;

    const layers: Array<[number, number, number, number]> = light
      ? [
          [255, 255, 255, 0.06],
          [198, 201, 220, 0.04],
          [107, 125, 235, 0.03],
        ]
      : [
          [200, 79, 232, 0.1],
          [155, 63, 230, 0.07],
          [107, 125, 235, 0.05],
          [198, 201, 220, 0.03],
        ];

    let width = 0;
    let height = 0;
    let time = 0;
    let frameId = 0;
    let disposed = false;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawLayer = ([red, green, blue, alpha]: [number, number, number, number], layerIndex: number) => {
      const frequency = 0.003 + layerIndex * 0.001;
      const phase = layerIndex * 1.1;
      const amplitude = 45 + layerIndex * 10;
      const baseY = height * 0.5 + layerIndex * 20;

      context.beginPath();
      context.moveTo(0, height);

      for (let x = 0; x <= width; x += 3) {
        const y =
          baseY +
          Math.sin(x * frequency + time + phase) * amplitude +
          Math.sin(x * frequency * 2.2 + time * 1.3 + phase) * amplitude * 0.2;
        context.lineTo(x, y);
      }

      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = `rgba(${red},${green},${blue},${alpha})`;
      context.fill();

      if (layerIndex === 0) {
        context.beginPath();
        for (let x = 0; x <= width; x += 3) {
          const y =
            baseY +
            Math.sin(x * frequency + time + phase) * amplitude +
            Math.sin(x * frequency * 2.2 + time * 1.3 + phase) * amplitude * 0.2;
          if (x === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.strokeStyle = `rgba(${red},${green},${blue},0.22)`;
        context.lineWidth = 1.5;
        context.stroke();
      }
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      if (!prefersReducedMotion) {
        time += 0.005;
      }

      layers.forEach(drawLayer);

      if (!prefersReducedMotion && !disposed) {
        frameId = window.requestAnimationFrame(draw);
      }
    };

    resize();
    draw();

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          resize();
          if (prefersReducedMotion) draw();
        })
      : null;
    resizeObserver?.observe(parent);

    return () => {
      disposed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [light, prefersReducedMotion]);

  return (
    <div className={`nex-creative-canvas-bg${light ? " is-light" : " is-dark"}`} aria-hidden="true">
      <canvas ref={canvasRef} className="nex-creative-flow-canvas" />
    </div>
  );
}

function CreativeScatterImage({
  showcase,
  index,
  progress,
}: {
  showcase: CreativeShowcase;
  index: number;
  progress: MotionValue<number>;
}) {
  const layout = CREATIVE_SCATTER_LAYOUTS[index] ?? CREATIVE_SCATTER_LAYOUTS[0];
  const x = useTransform(progress, [0, 0.14, 0.23, 0.32], [`${layout.x}vw`, `${layout.x * 0.58}vw`, "0vw", "0vw"]);
  const y = useTransform(progress, [0, 0.14, 0.23, 0.32], [`${layout.y}vh`, `${layout.y * 0.5}vh`, "0vh", "0vh"]);
  const rotate = useTransform(progress, [0, 0.2, 0.3], [`${layout.r}deg`, `${layout.r * 0.32}deg`, "0deg"]);
  const scale = useTransform(progress, [0, 0.2, 0.32], [layout.s, 0.78, 0.58]);
  const opacity = useTransform(progress, [0, 0.18, 0.27, 0.35], [1, 1, 0.5, 0]);
  const filter = useTransform(progress, [0, 0.22, 0.34], ["blur(0px)", "blur(0px)", "blur(18px)"]);

  return (
    <motion.div className="nex-creative-scatter-item" style={{ x, y, rotate, scale, opacity, filter }}>
      <CreativeImagePanel showcase={showcase} variant="scatter" />
    </motion.div>
  );
}

function CreativeStackIntro({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.12, 0.2, 0.34, 0.41], [0, 1, 1, 0]);
  const scale = useTransform(progress, [0.12, 0.25, 0.41], [0.72, 1, 0.92]);
  const y = useTransform(progress, [0.12, 0.41], ["6vh", "-4vh"]);
  const textOpacity = useTransform(progress, [0.22, 0.29, 0.37], [0, 1, 0]);
  const textFilter = useTransform(progress, [0.22, 0.29, 0.37], ["blur(18px)", "blur(0px)", "blur(14px)"]);

  return (
    <motion.div className="nex-creative-stack-intro" style={{ opacity, scale, y }}>
      <CreativeImagePanel showcase={CREATIVE_SHOWCASES[0]} variant="stack" />
      <motion.h2 style={{ opacity: textOpacity, filter: textFilter }}>
        what moves <em>revenue</em> forward?
      </motion.h2>
    </motion.div>
  );
}

function CreativeEmptyPrompt({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.38, 0.44, 0.49, 0.54], [0, 1, 1, 0]);
  const filter = useTransform(progress, [0.38, 0.44, 0.54], ["blur(24px)", "blur(5px)", "blur(18px)"]);
  const x = useTransform(progress, [0.38, 0.5], ["7vw", "0vw"]);

  return (
    <motion.div className="nex-creative-empty-prompt" style={{ opacity, filter }}>
      <div className="nex-creative-category-ghosts" aria-hidden="true">
        {CREATIVE_SHOWCASES.map((showcase) => (
          <span key={showcase.id}>{showcase.category}</span>
        ))}
      </div>
      <motion.div className="nex-creative-empty-frame" style={{ x }} />
    </motion.div>
  );
}

function CreativeSequenceMoment({
  showcase,
  index,
  progress,
}: {
  showcase: CreativeShowcase;
  index: number;
  progress: MotionValue<number>;
}) {
  const start = 0.49 + index * 0.09;
  const hold = start + 0.055;
  const end = start + 0.095;
  const opacity = useTransform(progress, [start - 0.035, start, hold, end], [0, 1, 1, 0]);
  const filter = useTransform(progress, [start - 0.035, start, hold, end], ["blur(26px)", "blur(0px)", "blur(0px)", "blur(18px)"]);
  const imageX = useTransform(progress, [start - 0.035, start, end], ["10vw", "0vw", "-4vw"]);
  const imageRotate = useTransform(progress, [start - 0.035, start, end], ["9deg", "-2deg", "4deg"]);
  const imageScale = useTransform(progress, [start - 0.035, start, end], [0.82, 1, 0.88]);

  return (
    <motion.article className="nex-creative-sequence-moment" style={{ opacity, filter }}>
      <div className="nex-creative-word-stack" aria-hidden="true">
        {CREATIVE_SHOWCASES.map((item) => (
          <span className={item.id === showcase.id ? "is-active" : ""} key={item.id}>
            {item.category}
          </span>
        ))}
      </div>
      <div className="nex-creative-sequence-copy">
        <small>{showcase.caption}</small>
        <h3>{showcase.line}</h3>
        <p>{showcase.subline}</p>
        <strong>{showcase.proof}</strong>
      </div>
      <motion.div className="nex-creative-sequence-image" style={{ x: imageX, rotate: imageRotate, scale: imageScale }}>
        <CreativeImagePanel showcase={showcase} variant="sequence" />
      </motion.div>
    </motion.article>
  );
}

function CreativeEyeFinale({ progress }: { progress: MotionValue<number> }) {
  const prefersReducedMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 70, damping: 20, mass: 0.35 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 70, damping: 20, mass: 0.35 });
  const layerOpacity = useTransform(progress, [0.82, 0.855, 0.985, 1], [0, 1, 1, 0]);
  const cardScale = useTransform(progress, [0.84, 0.9, 0.965, 1], [0.85, 0.85, 2.5, 2.5]);
  const cardRotateY = useTransform(progress, [0.84, 0.89], ["15deg", "0deg"]);
  const cardOpacity = useTransform(progress, [0.9, 0.98, 1], [1, 0.15, 0.15]);
  const dissolveOpacity = useTransform(progress, [0.935, 0.988, 1], [0, 0.95, 0.98]);
  const captionOpacity = useTransform(progress, [0.845, 0.875, 0.94, 0.985], [0, 1, 0.78, 0]);
  const captionY = useTransform(progress, [0.845, 0.875, 0.985], ["30px", "0px", "-18px"]);
  const captionFilter = useTransform(progress, [0.845, 0.875, 0.985], ["blur(16px)", "blur(0px)", "blur(12px)"]);
  const parallaxX = useTransform(smoothMouseX, [-1, 1], prefersReducedMotion ? [0, 0] : [-10, 10]);
  const parallaxY = useTransform(smoothMouseY, [-1, 1], prefersReducedMotion ? [0, 0] : [-8, 8]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const handlePointerMove = (event: PointerEvent) => {
      mouseX.set((event.clientX / window.innerWidth - 0.5) * 2);
      mouseY.set((event.clientY / window.innerHeight - 0.5) * 2);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [mouseX, mouseY, prefersReducedMotion]);

  return (
    <motion.div className="nex-creative-eye-scene" style={{ opacity: layerOpacity }}>
      <motion.div
        className="nex-creative-eye-video-wrap"
        style={{
          scale: cardScale,
          rotateY: cardRotateY,
          x: parallaxX,
          y: parallaxY,
          opacity: cardOpacity,
        }}
      >
        <div className="nex-creative-eye-card">
          <video
            src={creativeEyeballVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Animated eye with orbiting glass waves"
          />
          <motion.div className="nex-creative-eyeball-dissolve" style={{ opacity: dissolveOpacity }} aria-hidden="true" />
        </div>
      </motion.div>
      <motion.h3 className="nex-creative-eyeball-caption" style={{ opacity: captionOpacity, y: captionY, filter: captionFilter }}>
        Built around <em>forward</em> revenue momentum.
      </motion.h3>
      <motion.div className="nex-creative-eyeball-wash" style={{ opacity: dissolveOpacity }} aria-hidden="true" />
    </motion.div>
  );
}

function CreativeFinalCTA({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.97, 0.992, 1], [0, 1, 1]);
  const y = useTransform(progress, [0.97, 1], ["18vh", "0vh"]);
  const filter = useTransform(progress, [0.97, 0.992], ["blur(18px)", "blur(0px)"]);

  return (
    <motion.div className="nex-creative-final-cta" style={{ opacity, y, filter }}>
      <p>Unlimited coding clarity & revenue-cycle follow-through</p>
      <strong>AI coding + transcription + anesthesia logic + attached team review</strong>
      <Link href="/signup">View portfolio <ArrowRight size={16} /></Link>
    </motion.div>
  );
}

function SolutionsSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const stageOpacity = useTransform(scrollYProgress, [0, 0.04, 0.98, 1], [0.94, 1, 1, 0.98]);

  return (
    <section className="nex-solutions nex-creative-tools" id="solutions" ref={sectionRef}>
      <motion.div className="nex-creative-sticky" style={{ opacity: stageOpacity }}>
        <div className="nex-creative-progress" aria-hidden="true">
          <motion.span style={{ scaleX: scrollYProgress }} />
        </div>
        <CreativeFlowWaveBackground />

        <div className="nex-creative-stage">
          <div className="nex-creative-scatter-field" aria-label="Codical Health tool visuals">
            {CREATIVE_SCATTER_LAYOUTS.map((_, index) => {
              const showcase = CREATIVE_SHOWCASES[index % CREATIVE_SHOWCASES.length];
              return <CreativeScatterImage key={`${showcase.id}-${index}`} showcase={showcase} index={index} progress={scrollYProgress} />;
            })}
          </div>
          <CreativeStackIntro progress={scrollYProgress} />
          <CreativeEmptyPrompt progress={scrollYProgress} />
          <div className="nex-creative-sequence-field">
            {CREATIVE_SHOWCASES.map((showcase, index) => (
              <CreativeSequenceMoment key={showcase.id} showcase={showcase} index={index} progress={scrollYProgress} />
            ))}
          </div>
          <CreativeEyeFinale progress={scrollYProgress} />
          <CreativeFinalCTA progress={scrollYProgress} />
        </div>
      </motion.div>
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
