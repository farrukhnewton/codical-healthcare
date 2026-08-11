import {
  motion,
  type MotionStyle,
  type MotionValue,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Landmark,
  Play,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  Workflow,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

type FeaturedModule = {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  image: string;
  accent: string;
};

type VideoStory = {
  id: string;
  title: string;
  category: string;
  video: string;
  fallback: string;
  poster: string;
  duration: string;
  note: string;
};

type CustomerVideo = {
  id: string;
  person: string;
  role: string;
  company: string;
  quote: string;
  video: string;
  poster: string;
  duration: string;
};

type WrittenTestimonial = {
  id: string;
  person: string;
  role: string;
  company: string;
  quote: string;
  portrait?: string;
};

const PUBLIC_MEDIA_BASE = (
  import.meta.env.VITE_PUBLIC_MEDIA_URL ||
  "https://codical-public-assets.farrukhnewton.workers.dev"
).replace(/\/$/, "");

const FEATURED_MODULES: FeaturedModule[] = [
  {
    id: "ai-coding",
    eyebrow: "Evidence-first automation",
    title: "AI Medical Coding",
    summary:
      "Source-linked code suggestions, documentation evidence and claim checks stay together until coder signoff.",
    image: "/assets/landing/ai-coding.webp",
    accent: "#19c6c3",
  },
  {
    id: "ai-transcription",
    eyebrow: "Clinical speech to structure",
    title: "AI Clinical Transcription",
    summary:
      "Encounter audio becomes a reviewable transcript, structured note and coding context without leaving the workspace.",
    image: "/assets/landing/ai-transcription.webp",
    accent: "#8667f6",
  },
  {
    id: "specialty-coding",
    eyebrow: "Purpose-built clinical logic",
    title: "Specialty Coding",
    summary:
      "Dedicated PGx, burn, ambulance, transplant and high-acuity workflows bring specialty evidence into focused coding engines.",
    image: "/assets/landing/specialty-coding.webp",
    accent: "#ff8b58",
  },
  {
    id: "claim-validation",
    eyebrow: "Review before handoff",
    title: "Claim Validation",
    summary:
      "NCCI, documentation and claim checks surface while corrections are still actionable and reviewer context is intact.",
    image: "/assets/landing/claim-validation.webp",
    accent: "#ef6681",
  },
];

const PRODUCT_FILMS: VideoStory[] = FEATURED_MODULES.map((module) => ({
  id: module.id,
  title: module.title,
  category: module.eyebrow,
  video: `${PUBLIC_MEDIA_BASE}/landing-media/${module.id}-tour.mp4`,
  fallback: `/assets/videos/landing/${module.id}-tour.mp4`,
  poster: module.image,
  duration: "0:07",
  note: module.summary,
}));

// Publish only approved, company-controlled customer media and quotes here.
// The repository and public-source audit found none that can currently be verified.
const VERIFIED_CUSTOMER_VIDEOS: CustomerVideo[] = [];
const VERIFIED_TESTIMONIALS: WrittenTestimonial[] = [];

function FeaturedModuleMoment({
  module,
  index,
  progress,
}: {
  module: FeaturedModule;
  index: number;
  progress: MotionValue<number>;
}) {
  const segment = 1 / FEATURED_MODULES.length;
  const start = index * segment;
  const enter = Math.max(0, start - segment * 0.18);
  const visible = start + segment * 0.08;
  const hold = start + segment * 0.76;
  const exit = Math.min(1, start + segment);
  const opacity = index === 0
    ? useTransform(progress, [0, hold, exit], [1, 1, 0])
    : index === FEATURED_MODULES.length - 1
      ? useTransform(progress, [enter, visible, 1], [0, 1, 1])
      : useTransform(progress, [enter, visible, hold, exit], [0, 1, 1, 0]);
  const filter = index === 0
    ? useTransform(progress, [0, hold, exit], ["blur(0px)", "blur(0px)", "blur(18px)"])
    : useTransform(progress, [enter, visible, hold, exit], ["blur(18px)", "blur(0px)", "blur(0px)", "blur(18px)"]);
  const copyY = useTransform(progress, [enter, visible, exit], ["42px", "0px", "-36px"]);
  const imageScale = useTransform(progress, [enter, visible, exit], [0.92, 1, 1.035]);

  return (
    <motion.article
      className="ch-feature-moment"
      style={{ opacity, filter, "--feature-accent": module.accent } as unknown as MotionStyle}
    >
      <motion.div className="ch-feature-copy" style={{ y: copyY }}>
        <span>{module.eyebrow}</span>
        <h3>{module.title}</h3>
        <p>{module.summary}</p>
        <span className="ch-feature-action">Explore the workflow <ArrowRight size={16} /></span>
      </motion.div>
      <motion.figure className="ch-feature-visual" style={{ scale: imageScale }}>
        <img src={module.image} alt={`${module.title} product visualization`} loading="lazy" />
        <div className="ch-feature-logo"><BrandMark animated compact /></div>
        <figcaption>{String(index + 1).padStart(2, "0")} / {String(FEATURED_MODULES.length).padStart(2, "0")}</figcaption>
      </motion.figure>
    </motion.article>
  );
}

export function SolutionsSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });

  return (
    <section className="ch-feature-scroll" id="solutions" ref={sectionRef}>
      <div className="ch-feature-sticky">
        <div className="ch-feature-progress" aria-hidden="true"><motion.span style={{ scaleX: scrollYProgress }} /></div>
        <header>
          <span>Featured workflows</span>
          <p>Built inside Codical Health</p>
        </header>
        <div className="ch-feature-stage">
          {FEATURED_MODULES.map((module, index) => (
            <FeaturedModuleMoment key={module.id} module={module} index={index} progress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeatureDemoBand() {
  return (
    <section className="ch-feature-demo-band">
      <BrandMark animated compact />
      <p>See the complete workflow with your team.</p>
      <Link href="/signup">Free demo <ArrowRight size={16} /></Link>
    </section>
  );
}

function VideoPlayer({ story }: { story: VideoStory }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="nex-video-frame">
      {playing ? (
        <video title={story.title} controls autoPlay playsInline poster={story.poster} preload="metadata">
          <source src={story.video} type="video/mp4" />
          <source src={story.fallback} type="video/mp4" />
        </video>
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={`Play ${story.title}`}>
          <img src={story.poster} alt="" loading="lazy" />
          <span aria-hidden="true"><Play size={24} /></span>
          <small>{story.duration}</small>
        </button>
      )}
    </div>
  );
}

export function ProductFilmsSection() {
  return (
    <section className="nex-video-stories" id="stories">
      <div className="nex-section-center">
        <span className="nex-section-label">Codical product films</span>
        <h2>See the workflows in motion.</h2>
        <p>Four original Codical product previews, served from the Cloudflare media layer.</p>
      </div>
      <div className="nex-video-grid">
        {PRODUCT_FILMS.map((story) => (
          <article className="nex-video-card" key={story.id}>
            <VideoPlayer story={story} />
            <div className="nex-video-copy">
              <small>{story.category}</small>
              <h3>{story.title}</h3>
              <p>{story.note}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function VerifiedCustomerStoriesSection() {
  if (VERIFIED_CUSTOMER_VIDEOS.length === 0) return null;

  return (
    <section className="nex-video-stories" aria-labelledby="customer-stories-title">
      <div className="nex-section-center">
        <span className="nex-section-label">Customer feedback</span>
        <h2 id="customer-stories-title">Hear from Codical teams.</h2>
      </div>
      <div className="nex-video-grid">
        {VERIFIED_CUSTOMER_VIDEOS.map((story) => (
          <article className="nex-video-card" key={story.id}>
            <div className="nex-video-frame">
              <video title={`${story.person}, ${story.company}`} controls playsInline poster={story.poster} preload="none">
                <source src={story.video} type="video/mp4" />
              </video>
            </div>
            <div className="nex-video-copy">
              <small>{story.role} · {story.company}</small>
              <h3>{story.person}</h3>
              <p>{story.quote}</p>
              <span className="sr-only">Duration {story.duration}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function VerifiedTestimonialsSection() {
  if (VERIFIED_TESTIMONIALS.length === 0) return null;

  return (
    <section className="nex-profile-stories" aria-labelledby="testimonials-title">
      <div className="nex-section-center">
        <span className="nex-section-label">Customer perspectives</span>
        <h2 id="testimonials-title">What verified Codical customers say.</h2>
      </div>
      <div className="nex-profile-grid">
        {VERIFIED_TESTIMONIALS.map((story) => (
          <article className="nex-profile-card" key={story.id}>
            <blockquote>{story.quote}</blockquote>
            <div className="nex-profile-person">
              {story.portrait ? <img src={story.portrait} alt="" loading="lazy" /> : null}
              <div>
                <strong>{story.person}</strong>
                <span>{story.role}</span>
                <small>{story.company}</small>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DifferenceSection() {
  const differences = [
    [BrainCircuit, "Evidence before automation", "Suggestions stay connected to source context so a reviewer can verify why a code is present."],
    [Stethoscope, "Specialty-native workflows", "PGx, burn, ambulance, transplant and high-acuity engines use purpose-built inputs and logic."],
    [ShieldCheck, "Validation before submission", "Coding and claim checks live in the workflow while corrections are still actionable."],
    [UsersRound, "Human approval by design", "Codical supports coder judgment and auditability; it does not hide decisions behind a black box."],
    [Workflow, "One connected workspace", "Coding, transcription, reference tools, specialty modules and team collaboration share one operating view."],
    [Landmark, "CMS-aware foundations", "Reference data and policy context are versioned so teams can review the basis for a recommendation."],
  ] as const;

  return (
    <section className="ch-difference" id="difference">
      <div className="ch-difference-heading">
        <span>How we're different</span>
        <h2>Clinical depth without workflow sprawl.</h2>
        <p>Codical Health brings specialty intelligence and revenue-cycle controls into a coherent, reviewable system.</p>
      </div>
      <div className="ch-difference-grid">
        {differences.map(([Icon, title, copy], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <Icon size={24} />
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function RevenueRibbonSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [-9, 8]);
  const y = useTransform(scrollYProgress, [0, 1], [90, -80]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.88, 1.04, 0.95]);

  return (
    <section className="ch-revenue-ribbon" ref={sectionRef} aria-label="Connected revenue cycle animation">
      <div className="ch-ribbon-copy">
        <span>One connected operating layer</span>
        <h2>From clinical signal to claim-ready review.</h2>
      </div>
      <motion.img
        src="/assets/landing/revenue-ribbon.webp"
        alt="Abstract purple and coral ribbon representing connected revenue workflows"
        loading="lazy"
        style={{ rotate, y, scale }}
      />
    </section>
  );
}

const PRICING_PLANS = [
  {
    name: "Starter",
    price: "Free",
    note: "For essential research and reference work.",
    features: ["Code Search", "CMS Guidelines", "RVU Calculator", "NPI Lookup"],
    featured: false,
  },
  {
    name: "Premium",
    price: "$249",
    note: "For connected coding and validation teams.",
    features: ["Everything in Starter", "ICD/CPT Crosswalk", "Team Chats", "All Validation Tools"],
    featured: false,
  },
  {
    name: "Enterprise",
    price: "$399",
    note: "For AI-enabled specialty operations.",
    features: ["Everything in Premium", "AI Coding", "AI Transcription", "Specialty Coding"],
    featured: true,
  },
] as const;

export function PricingSection() {
  return (
    <section className="ch-pricing" id="pricing">
      <div className="nex-section-center">
        <span className="nex-section-label">Simple plans</span>
        <h2>Choose the workspace depth your team needs.</h2>
        <p>Start with core reference tools, then add connected validation and AI specialty workflows.</p>
      </div>
      <div className="ch-pricing-grid">
        {PRICING_PLANS.map((plan) => (
          <article className={plan.featured ? "is-featured" : ""} key={plan.name}>
            {plan.featured ? <span className="ch-plan-badge">Complete workspace</span> : null}
            <BrandMark animated compact />
            <h3>{plan.name}</h3>
            <div><strong>{plan.price}</strong></div>
            <p>{plan.note}</p>
            <ul>
              {plan.features.map((feature) => <li key={feature}><BadgeCheck size={16} />{feature}</li>)}
            </ul>
            <Link href="/signup">Get started <ArrowRight size={15} /></Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function GlassLogoCta({ CtaButton }: { CtaButton: ComponentType<{ href: string; variant?: "primary" | "secondary"; children: ReactNode }> }) {
  return (
    <section className="nex-final" id="cta">
      <div className="ch-cta-stars" aria-hidden="true" />
      <div className="nex-final-copy">
        <BrandMark animated inverse />
        <h2>Start free, or request a guided demo.</h2>
        <p>Explore the essential tools now, then see how Codical connects AI coding, transcription, validation and specialty workflows.</p>
        <div className="nex-final-actions">
          <CtaButton href="/signup">Start free</CtaButton>
          <CtaButton href="/signup?intent=demo" variant="secondary">Request a demo</CtaButton>
        </div>
      </div>
    </section>
  );
}
