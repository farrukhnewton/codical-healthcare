import {
  motion,
  type MotionValue,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef, type ComponentType, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Landmark,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  Workflow,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { ProductFilmsSection } from "@/components/landing/ProductFilmsSection";
import { ScrollDrivenWorkflowSection } from "@/components/landing/ScrollDrivenWorkflowSection";

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

// Publish only approved, company-controlled customer media and quotes here.
// The repository and public-source audit found none that can currently be verified.
const VERIFIED_CUSTOMER_VIDEOS: CustomerVideo[] = [];
const VERIFIED_TESTIMONIALS: WrittenTestimonial[] = [];

export function SolutionsSection() {
  return <ScrollDrivenWorkflowSection />;
}

export { ProductFilmsSection };

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
