import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const landing = readFileSync("client/src/pages/Landing.tsx", "utf8");
const premiumSections = readFileSync("client/src/components/landing/PremiumLandingSections.tsx", "utf8");
const brandMark = readFileSync("client/src/components/BrandMark.tsx", "utf8");
const brandStyles = readFileSync("client/src/styles/brand-system.css", "utf8");
const landingStyles = readFileSync("client/src/styles/landing-refresh.css", "utf8");
const landingStitchStyles = readFileSync("client/src/styles/landing-stitch.css", "utf8");
const indexHtml = readFileSync("client/index.html", "utf8");

test("landing uses the centralized authoritative brand assets", () => {
  assert.match(brandMark, /codical-bars-animated-web\.gif/);
  assert.match(brandMark, /codical-bars-static-web\.png/);
  assert.match(brandStyles, /prefers-reduced-motion:\s*reduce/);
  assert.match(indexHtml, /logo-bars-192\.png/);
});

test("hero eyebrow uses the animated Codical mark instead of the legacy Premier-style glyph", () => {
  assert.match(landing, /<BrandMark animated compact className="nex-hero-premier-badge-mark" \/>/);
  assert.match(landingStitchStyles, /\.nex-hero-premier-badge-mark \.co-logo-bars/);
  assert.doesNotMatch(landing, /<i \/>\s*\n\s*<span>AI-powered medical coding platform<\/span>/);
});

test("approved laptop shells contain Codical product screens without legacy overlays", () => {
  assert.match(landing, /LaptopHardwareFrame/);
  assert.match(landing, /DashboardScreen compact animated/);
  assert.match(landing, /CommandCenterScreen/);
  assert.match(landing, /nex-laptop-system-bar/);
  assert.match(landing, /nex-laptop-system-brand/);
  assert.match(landing, /nex-laptop-native-bars/);
  assert.match(landingStyles, /\.nex-laptop-native-bars i:nth-child\(5\)/);
  assert.match(landingStyles, /\.nex-laptop-system-bar[\s\S]*?width:\s*79\.84%/);
  assert.doesNotMatch(landing, /<div className="nex-laptop-system-brand"[^>]*>\s*<BrandMark/);
  assert.doesNotMatch(landing, /AI Work Queue|Guided Demo|Premier CS|PremierCS|View Portfolio/);
});

test("premium landing content uses exact pricing without an invented interval", () => {
  for (const value of ["Free", "$249", "$399", "Code Search", "CMS Guidelines", "RVU Calculator", "NPI Lookup", "ICD/CPT Crosswalk", "Team Chats", "All Validation Tools", "AI Coding", "AI Transcription", "Specialty Coding"]) {
    assert.ok(premiumSections.includes(value), `missing pricing value: ${value}`);
  }
  assert.doesNotMatch(premiumSections, /\/\s*month|monthly workspace pricing/i);
  assert.match(premiumSections, /name:\s*"Enterprise"[\s\S]*?featured:\s*true/);
});

test("product films are distinct from verified customer media", () => {
  for (const id of ["ai-coding", "ai-transcription", "specialty-coding", "claim-validation"]) {
    assert.ok(premiumSections.includes(`id: "${id}"`));
  }
  assert.match(premiumSections, /VERIFIED_CUSTOMER_VIDEOS:\s*CustomerVideo\[\]\s*=\s*\[\]/);
  assert.match(premiumSections, /VERIFIED_TESTIMONIALS:\s*WrittenTestimonial\[\]\s*=\s*\[\]/);
});

test("landing additions include responsive and reduced-motion fallbacks", () => {
  assert.match(landingStyles, /@media\s*\(max-width:\s*980px\)/);
  assert.match(landingStyles, /@media\s*\(max-width:\s*720px\)/);
  assert.match(landingStyles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
