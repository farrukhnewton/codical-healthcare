import "@/styles/landing-aurora-scene.css";
import "@/styles/landing-hero-next.css";
import "@/styles/landing-nav-next.css";
import "@/styles/landing-reveal.css";

import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroNext } from "@/components/landing-next/HeroNext";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { AIEngineSection } from "@/components/landing/AIEngineSection";
import { ToolsSection } from "@/components/landing/ToolsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { CTASection } from "@/components/landing/CTASection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { AuroraScene } from "@/components/landing-next/AuroraScene";
import { useLandingReveal } from "@/components/landing-next/useLandingReveal";

export function Landing() {
  useLandingReveal();

  return (
    <div className="landingAurora min-h-screen relative">
      <AuroraScene />
      <LandingNavbar />

      <main>
        <HeroNext />
        <FeaturesSection />
        <AIEngineSection />
        <ToolsSection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
      </main>

      <LandingFooter />
    </div>
  );
}
