import React from "react";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Zap, ShieldCheck } from "lucide-react";
import { HeroPreview } from "./HeroPreview";

export function HeroNext() {
  const [, setLocation] = useLocation();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="hero" className="ln-hero items-center pt-32 pb-16">
      
      {/* Left side text */}
      <div className="reveal">
        <div className="ln-pill mb-6">
          <div className="ln-pillDot" />
          <span>Codical AI Engine 2.0 Live</span>
        </div>
        
        <h1 className="ln-heroTitle">
          Medical coding,<br />
          <span className="ln-gradTextAnimated">re-imagined for speed.</span>
        </h1>
        
        <p className="ln-heroLead">
          Instantly translate clinical notes into accurate billing codes. 
          Powered by edge-AI and designed for modern healthcare teams who cannot afford zero-day delays.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => setLocation('/signup')} 
            className="ln-btn ln-btnPrimary magnetic py-4 px-8 text-lg"
          >
            Start free trial <ArrowRight size={18} />
          </button>
          <button 
            onClick={() => scrollTo('pricing')} 
            className="ln-btn ln-btnSecondary py-4 px-8 text-lg"
          >
            See pricing
          </button>
        </div>

        <div className="ln-heroTags">
          <div className="ln-tagRow">
            <CheckCircle2 /> No credit card required
          </div>
          <div className="ln-tagRow">
            <Zap /> Sub-second inferences
          </div>
          <div className="ln-tagRow">
            <ShieldCheck /> SOC2 Compliant
          </div>
        </div>
      </div>

      {/* Right side preview */}
      <div className="reveal" style={{ transitionDelay: "200ms" }}>
        <HeroPreview />
      </div>

    </section>
  );
}
