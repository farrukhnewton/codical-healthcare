import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { 
  Box, Terminal, Globe, Zap, Database, Lock, 
  Check, ArrowRight, Github, Twitter
} from "lucide-react";

import "@/styles/landing-nextlevel.css";
import { AuroraCanvasBackground } from "@/components/landing-next/AuroraCanvasBackground";
import { CursorFX } from "@/components/landing-next/CursorFX";
import { LandingNavbarNext } from "@/components/landing-next/LandingNavbarNext";
import { HeroNext } from "@/components/landing-next/HeroNext";
import { useRevealOnScroll } from "@/components/landing-next/hooks/useRevealOnScroll";
import { useMagneticButtons } from "@/components/landing-next/hooks/useMagneticButtons";
import { useTilt } from "@/components/landing-next/hooks/useTilt";

// Secondary Sections Inline for Landing Assembly

function FeaturesSection() {
  const features = [
    { icon: <Box />, title: "Instant Search", desc: "Type in natural language, and let Codical instantly map it to the corresponding ICD-10 or CPT codes with semantic context." },
    { icon: <Database />, title: "Centralized Data", desc: "No more disconnected sheets. Access global standard code tables directly connected to your billing workflows." },
    { icon: <Terminal />, title: "Developer API", desc: "RESTful endpoints dropping straight into your existing clinical software, complete with SDKs for Node and Python." },
    { icon: <Zap />, title: "Edge Performance", desc: "Inferences occur locally where possible, and cached globally, achieving ms-level latencies." },
    { icon: <Globe />, title: "Live Updates", desc: "Code sets automatically sync with CMS and WHO, ensuring you're never using deprecated medical codes." },
    { icon: <Lock />, title: "Enterprise Grade", desc: "Encrypted at rest and in transit. BAAs available on request for HIPAA compliance needs." }
  ];

  return (
    <section id="features" className="ln-section">
      <div className="ln-sectionHeader reveal">
        <h2 className="ln-sectionTitle">Engineered for accuracy</h2>
        <p className="ln-sectionDesc">Everything you need to automate medical coding operations, built into a single glass-smooth platform.</p>
      </div>
      <div className="ln-grid3">
        {features.map((f, i) => (
          <div key={i} className="ln-card ln-glass reveal" style={{ transitionDelay: `${i * 100}ms` }}>
            <div className="ln-cardIcon">{f.icon}</div>
            <h3 className="ln-cardTitle">{f.title}</h3>
            <p className="ln-cardDesc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="ln-section">
      <div className="ln-sectionHeader reveal">
        <h2 className="ln-sectionTitle">Your workflow, streamlined</h2>
        <p className="ln-sectionDesc">Drop the cumbersome books. In three steps, codify the entire encounter.</p>
      </div>
      <div className="ln-grid3">
        {[
          { step: "01", title: "Input Clinical Notes", desc: "Paste unstructured SOAP notes directly or pipe them via API." },
          { step: "02", title: "Codical Inference", desc: "Our engine uses natural language processing to extract diagnoses and procedures." },
          { step: "03", title: "Review & Export", desc: "Approve the generated codes and push directly to your EHR/RCM." }
        ].map((w, i) => (
          <div key={i} className="ln-card ln-glassStrong reveal" style={{ transitionDelay: `${i * 150}ms` }}>
            <div className="text-[var(--mint)] font-mono text-2xl font-bold mb-2">{w.step}</div>
            <h3 className="ln-cardTitle">{w.title}</h3>
            <p className="ln-cardDesc">{w.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingSection() {
  const [, setLocation] = useLocation();
  const plans = [
    { name: "Starter", price: "Free", desc: "For individual practitioners.", features: ["1,000 queries/mo", "Community Support", "Standard code sets"] },
    { name: "Pro", price: "$49", desc: "For small clinics.", features: ["Unlimited queries", "Priority Support", "API Access", "Export to EHR"], popular: true },
    { name: "Enterprise", price: "Custom", desc: "For large hospitals.", features: ["Custom fine-tuning", "Dedicated account rep", "On-premise option", "BAA included"] }
  ];

  return (
    <section id="pricing" className="ln-section">
      <div className="ln-sectionHeader reveal">
        <h2 className="ln-sectionTitle">Transparent pricing</h2>
        <p className="ln-sectionDesc">Scale your practice with plans designed for maximum ROI.</p>
      </div>
      <div className="ln-grid3">
        {plans.map((p, i) => (
          <div key={i} className={`ln-card ln-glass reveal ${p.popular ? 'ln-gBorder scale-105 z-10' : ''}`} style={{ transitionDelay: `${i * 100}ms` }} data-tilt>
            <div className="ln-previewInner h-full flex flex-col p-6 rounded-2xl bg-[var(--bg0)]" style={p.popular ? {} : {background: "transparent"}}>
              {p.popular && <div className="text-xs uppercase tracking-wider text-[var(--mint)] font-bold mb-4">Most Popular</div>}
              <h3 className="text-2xl font-bold">{p.name}</h3>
              <div className="text-4xl font-extrabold my-4">{p.price}<span className="text-lg text-[var(--muted)] font-normal">{p.price !== "Custom" && p.price !== "Free" ? "/mo" : ""}</span></div>
              <p className="text-[var(--muted)] mb-8 h-10">{p.desc}</p>
              
              <ul className="flex flex-col gap-4 mb-8 flex-grow">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm">
                    <Check size={16} className="text-[var(--mint)]" /> {f}
                  </li>
                ))}
              </ul>
              
              <button 
                onClick={() => setLocation('/signup')} 
                className={`ln-btn w-full ${p.popular ? 'ln-btnPrimary magnet-target' : 'ln-btnSecondary'}`}
              >
                Get Started
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTASection() {
  const [, setLocation] = useLocation();
  return (
    <section id="cta" className="ln-section reveal">
      <div className="ln-glassStrong p-12 lg:p-20 rounded-[var(--radius-lg)] ln-gBorder text-center" data-tilt>
        <div className="ln-previewInner flex flex-col items-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to decode healthcare?</h2>
          <p className="text-xl text-[var(--muted)] max-w-2xl mb-10">
            Join thousands of providers who have already modernized their coding workflow with Codical.
          </p>
          <button 
            onClick={() => setLocation('/signup')}
            className="ln-btn ln-btnPrimary magnetic py-4 px-10 text-lg"
          >
            Start free trial <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer className="border-t border-[var(--border)] pt-16 pb-8 text-center sm:text-left text-sm text-[var(--muted)]">
      <div className="max-w-[1200px] mx-auto px-4 grid grid-cols-1 sm:grid-cols-4 gap-8 mb-12">
        <div className="col-span-1 sm:col-span-2">
          <div className="font-bold text-lg text-[var(--fg)] mb-4 flex items-center gap-2 justify-center sm:justify-start">
            <Zap size={20} className="text-[var(--mint)]" /> Codical
          </div>
          <p className="max-w-xs mx-auto sm:mx-0">
            Advanced medical coding software powering the next generation of healthcare operations.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-[var(--fg)] mb-4">Product</h4>
          <ul className="flex flex-col gap-2">
            <li><a href="#features" className="hover:text-[var(--fg)] transition">Features</a></li>
            <li><a href="#pricing" className="hover:text-[var(--fg)] transition">Pricing</a></li>
            <li><a href="#" className="hover:text-[var(--fg)] transition">API</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-[var(--fg)] mb-4">Company</h4>
          <ul className="flex flex-col gap-2">
            <li><a href="#" className="hover:text-[var(--fg)] transition">About</a></li>
            <li><a href="#" className="hover:text-[var(--fg)] transition">Blog</a></li>
            <li><a href="#" className="hover:text-[var(--fg)] transition">Terms</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-[var(--border)] gap-4">
        <p>&copy; {new Date().getFullYear()} Codical. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="#" className="hover:text-[var(--fg)] transition"><Twitter size={18} /></a>
          <a href="#" className="hover:text-[var(--fg)] transition"><Github size={18} /></a>
        </div>
      </div>
    </footer>
  );
}

export function Landing() {
  // Initialize global connection hooks for scroll, magnetic, and tilt
  useRevealOnScroll();
  useMagneticButtons();
  useTilt();

  return (
    <div className="landingNext">
      {/* Background Layers */}
      <AuroraCanvasBackground />
      <div className="ln-bgMesh" />
      <div className="ln-bgGrid" />
      <div className="ln-bgNoise" />
      <div className="ln-bgScan" />
      
      {/* Cursor Effects */}
      <CursorFX />

      {/* Navigation */}
      <LandingNavbarNext />

      {/* Main Content */}
      <main className="ln-main">
        <HeroNext />
        <FeaturesSection />
        <WorkflowSection />
        <PricingSection />
        <CTASection />
      </main>

      {/* Footer */}
      <FooterSection />
    </div>
  );
}
