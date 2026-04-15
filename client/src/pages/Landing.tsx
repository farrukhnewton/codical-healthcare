import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { AIEngineSection } from "@/components/landing/AIEngineSection";
import { ToolsSection } from "@/components/landing/ToolsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { CTASection } from "@/components/landing/CTASection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LivingBackground } from "@/components/ui/LivingBackground";
import { CursorGlow } from "@/components/ui/CursorGlow";

export function Landing() {
  return (
    <div className="min-h-screen relative">
      <LivingBackground />
      <CursorGlow />
      <LandingNavbar />
      <main>
        <HeroSection />
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
