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

test("navigation spacing and hero glass use the same centered shell", () => {
  assert.match(landingStitchStyles, /--nex-shell-max:\s*1360px/);
  assert.match(landingStitchStyles, /--nex-shell-gutter:\s*32px/);
  assert.match(landingStitchStyles, /--nex-shell-inline:\s*64px/);
  assert.ok((landingStitchStyles.match(/var\(--nex-shell-max\)/g) ?? []).length >= 2);
  assert.match(landingStitchStyles, /\.nex-button\s*>\s*span\s*\{/);
  assert.doesNotMatch(landingStitchStyles, /\.nex-button span\s*\{/);
  assert.match(landing, /panelInsetX/);
  assert.match(landingStitchStyles, /height:\s*calc\(100svh - 98px\)/);
});

test("hero reveals the complete laptop before the ecosystem section enters", () => {
  assert.match(landing, /laptopRevealWidth/);
  assert.match(landingStitchStyles, /height:\s*calc\(100svh \+ 920px\)/);
  assert.match(landingStitchStyles, /calc\(165\.18svh - 280\.8px\)/);
});

test("hero keeps one glass-wave source without legacy duplicate layers", () => {
  assert.equal(landing.match(/hero-loop-healthcare\.mp4/g)?.length, 1);
  for (const legacy of ["loop_optimized.mp4", "hero-poster.jpg", "hero-orb-left.svg", "hero-orb-right.svg", "anim-frame-original.jpg", "hero-grid-texture.svg"]) {
    assert.doesNotMatch(landing, new RegExp(legacy.replace(".", "\\.")));
    assert.doesNotMatch(landingStitchStyles, new RegExp(legacy.replace(".", "\\.")));
  }
  assert.doesNotMatch(landing, /nex-hero-premier-(texture|grid|orb)/);
});

test("approved laptop shells contain Codical product screens without legacy overlays", () => {
  assert.equal(landing.match(/<LaptopHardwareFrame/g)?.length, 2);
  assert.match(landing, /LaptopHardwareFrame/);
  assert.match(landing, /DashboardScreen compact animated/);
  assert.match(landing, /CommandCenterScreen/);
  assert.match(landing, /nex-laptop-system-bar" data-rendered="native"/);
  assert.match(landing, /nex-laptop-system-brand/);
  assert.match(landing, /nex-laptop-native-bars/);
  assert.match(landingStyles, /\.nex-laptop-native-bars i:nth-child\(5\)/);
  assert.match(landingStyles, /\.nex-laptop-system-bar[\s\S]*?width:\s*79\.84%/);
  assert.doesNotMatch(landing, /brandSystemBar/);
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
