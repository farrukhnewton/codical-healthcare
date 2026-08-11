import "@/styles/landing-stitch.css";
import "@/styles/landing-refresh.css";

import heroLaptopPremierFrame from "@/assets/landing/hero-concept-laptop-clean-premier.png";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  AudioLines,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
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
  Play,
  ScanSearch,
  Search,
  ShieldCheck,
  ShieldPlus,
  Stethoscope,
  Workflow,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import {
  DifferenceSection,
  FeatureDemoBand,
  GlassLogoCta,
  PricingSection,
  ProductFilmsSection,
  RevenueRibbonSection,
  SolutionsSection,
  VerifiedCustomerStoriesSection,
  VerifiedTestimonialsSection,
} from "@/components/landing/PremiumLandingSections";

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

type CommandDemoId = "coding" | "transcription" | "specialty";

type CommandDemo = {
  id: CommandDemoId;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  metric: string;
  status: string;
};

const NAV_ITEMS = [
  { label: "Platform", href: "#platform" },
  { label: "Solutions", href: "#solutions" },
  { label: "Ecosystem", href: "#ecosystem" },
  { label: "Stories", href: "#stories" },
  { label: "Pricing", href: "#pricing" },
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
    label: "Payer network",
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
    label: "Claims network",
    logos: [
      { name: "Availity", domain: "availity.com", logo: "/assets/logos/insurers/availity.svg", color: "#f7941e", size: "wide" },
      { name: "Change Healthcare", domain: "changehealthcare.com", logo: "/assets/logos/insurers/change-healthcare.png", color: "#f72b55", size: "wide" },
      { name: "Optum", domain: "optum.com", logo: "/assets/logos/insurers/optum.svg", color: "#ff612b", size: "wide" },
    ],
  },
];

const COMMAND_DEMOS: CommandDemo[] = [
  {
    id: "coding",
    label: "AI coding",
    icon: BrainCircuit,
    title: "AI coding review",
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
    id: "specialty",
    label: "Specialty coding",
    icon: Stethoscope,
    title: "Specialty coding engines",
    description: "Purpose-built PGx, burn, ambulance, transplant and high-acuity coding workspaces stay in one system.",
    metric: "12 engines",
    status: "Specialty workspace open",
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
      <strong className="nex-button-label">
        <span>{children}</span>
        <span aria-hidden="true">{children}</span>
      </strong>
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
          <BrandMark animated />
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
          <a className="nex-nav-item nex-nav-link" href="#pricing">
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
          <a className="nex-mobile-group" href="#pricing" onClick={() => setMobileOpen(false)}>
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

function MiniSidebar({ activeIndex = 0 }: { activeIndex?: number }) {
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
          <span className={index === activeIndex ? "is-active" : ""} key={label as string}>
            <SidebarIcon size={15} />
            {label as string}
          </span>
        );
      })}
    </aside>
  );
}

function DashboardScreen({ compact = false, animated = false }: { compact?: boolean; animated?: boolean }) {
  const [activeNav, setActiveNav] = useState(0);

  useEffect(() => {
    if (!animated) return;
    const timer = window.setInterval(() => setActiveNav((current) => (current + 1) % 6), 2200);
    return () => window.clearInterval(timer);
  }, [animated]);

  return (
    <div className={`nex-dashboard-screen ${compact ? "is-compact" : ""}${animated ? " is-live-preview" : ""}`}>
      <MiniSidebar activeIndex={activeNav} />
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
      <div className="nex-laptop-system-bar" data-rendered="native" aria-hidden="true">
        <div className="nex-laptop-system-brand">
          <span className="nex-laptop-native-bars">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <strong>Codical Health</strong>
        </div>
        <div className="nex-laptop-system-menu">
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span>Go</span>
          <span>Window</span>
          <span>Help</span>
        </div>
        <div className="nex-laptop-system-status">
          <span className="is-battery"><i /></span>
          <span className="is-controls"><i /><i /><i /><i /></span>
          <span className="is-search" />
          <span className="is-wifi"><i /><i /><i /></span>
          <span className="is-date">Mon Jun 22</span>
          <span>9:41 AM</span>
        </div>
      </div>
      <div className={`nex-hero-laptop-screen ${screenClassName}`} aria-hidden={decorative ? true : undefined}>
        {children}
      </div>
    </div>
  );
}

function HeroSection() {
  const heroRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof document === "undefined" ? 1440 : document.documentElement.clientWidth,
  );
  const { scrollY } = useScroll();
  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(document.documentElement.clientWidth);
    window.addEventListener("resize", updateViewportWidth);
    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);
  const shellMaxWidth = viewportWidth <= 980 ? 920 : 1360;
  const shellGutter = viewportWidth <= 980 ? 16 : 32;
  const initialPanelInset = Math.max(shellGutter, (viewportWidth - shellMaxWidth) / 2);
  const panelInsetX = useTransform(
    scrollY,
    [0, 720],
    prefersReducedMotion ? [initialPanelInset, initialPanelInset] : [initialPanelInset, 0],
  );
  const panelInsetBottom = useTransform(scrollY, [0, 720], prefersReducedMotion ? ["32px", "32px"] : ["32px", "0px"]);
  const panelRadius = useTransform(scrollY, [0, 390, 720], prefersReducedMotion ? [30, 30, 30] : [30, 18, 0]);
  const laptopScale = useTransform(scrollY, [0, 720], prefersReducedMotion ? [1, 1] : [1, 1]);
  const laptopRevealWidth = "min(1290px, calc(100vw - 100px), calc(165.18svh - 320.4px))";
  const laptopWidth = useTransform(
    scrollY,
    [0, 720],
    prefersReducedMotion
      ? [laptopRevealWidth, laptopRevealWidth]
      : [laptopRevealWidth, laptopRevealWidth],
  );
  const laptopY = useTransform(scrollY, [0, 720], prefersReducedMotion ? [0, 0] : [0, -430]);
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
            aria-hidden="true"
          >
            <source src="/assets/videos/hero-loop-healthcare.mp4" type="video/mp4" />
          </video>
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
            <BrandMark animated compact className="nex-hero-premier-badge-mark" />
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
              <DashboardScreen compact animated />
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
  const caseRows = [
    ["CH-83472", "J47.1", "98%", "Ready"],
    ["CH-83473", "E11.65", "96%", "Review"],
    ["CH-83474", "K21.9", "97%", "Ready"],
    ["CH-83475", "M54.16", "95%", "Hold"],
  ];

  return (
    <div className="nex-command-screen">
      <header className="nex-command-osbar">
        <div>
          <BrandMark animated compact />
          <strong>Codical Health</strong>
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
              onClick={() => onChange(demo.id)}
            >
              <DemoIcon size={14} />
              {demo.label}
            </button>
          );
        })}
      </nav>

      <main className="nex-command-workspace" data-mode={activeDemo}>
        <aside className="nex-command-rail" aria-hidden="true">
          {[Activity, ClipboardCheck, FileAudio, MessagesSquare, ShieldCheck].map((Icon, index) => (
            <i className={index === COMMAND_DEMOS.findIndex((demo) => demo.id === activeDemo) + 1 ? "is-active" : ""} key={index}>
              <Icon size={13} />
            </i>
          ))}
        </aside>

        <section className="nex-command-mainboard" key={activeDemo}>
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
                    <button type="button" key={caseId}>
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
                  <button type="button">Finalize structured note</button>
                </div>
              )}
              {activeDemo === "specialty" && (
                <div className="nex-command-specialties">
                  {["PGx", "Burn & graft", "Ambulance", "Transplant", "NICU", "Cardiac"].map((label, index) => (
                    <button type="button" className={index === 0 ? "is-active" : ""} key={label}>
                      <Stethoscope size={13} />
                      <strong>{label}</strong>
                      <span>{index === 0 ? "Open" : "Ready"}</span>
                    </button>
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
              <button type="button">{active.status}</button>
            </aside>
          </div>
        </section>
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveDemo((current) => {
        const currentIndex = COMMAND_DEMOS.findIndex((demo) => demo.id === current);
        return COMMAND_DEMOS[(currentIndex + 1) % COMMAND_DEMOS.length].id;
      });
    }, 4600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="nex-command nex-command-premier" id="platform">
      <div className="nex-command-glow" aria-hidden="true" />
      <div className="nex-command-copy">
        <span className="nex-section-label">Command center</span>
        <h2>One workspace. Every revenue cycle signal in motion.</h2>
        <p>
          The actual application shell cycles through AI coding, clinical transcription and specialty coding so teams can preview the workflow before signing in.
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

export function Landing() {
  return (
    <div className="nex-page">
      <Header />
      <main>
        <HeroSection />
        <EcosystemMarquee />
        <CommandCenterSection />
        <SolutionsSection />
        <FeatureDemoBand />
        <ProductFilmsSection />
        <VerifiedCustomerStoriesSection />
        <VerifiedTestimonialsSection />
        <DifferenceSection />
        <RevenueRibbonSection />
        <PricingSection />
        <GlassLogoCta CtaButton={CtaButton} />
      </main>
      <footer className="nex-footer">
        <div className="ch-footer-brand-card">
          <BrandMark animated tagline />
          <p>Healthcare coding intelligence built for reviewable, connected revenue-cycle work.</p>
        </div>
        <div className="ch-footer-links">
          <nav aria-label="Product footer links">
            <strong>Product</strong>
            <a href="#platform">Platform</a>
            <a href="#solutions">Solutions</a>
            <a href="#stories">Product films</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <nav aria-label="Account footer links">
            <strong>Access</strong>
            <Link href="/signup">Start free</Link>
            <Link href="/signup?intent=demo">Request a demo</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </div>
        <div className="ch-footer-bottom">
          <BrandMark animated compact />
          <p>&copy; 2026 Codical Health. All rights reserved.</p>
          <span>Precision in coding, power in revenue</span>
        </div>
      </footer>
    </div>
  );
}
