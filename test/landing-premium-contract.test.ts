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
const brandBarsMaster = readFileSync("client/public/assets/brand/codical-bars-master.svg", "utf8");
const brandBarsWaveSample = readFileSync("client/public/assets/brand/codical-bars-wave-sample.svg", "utf8");
const brandBarsFluidSample = readFileSync("client/public/assets/brand/codical-bars-fluid-wave-sample.svg", "utf8");
const brandBarsSignatureSample = readFileSync("client/public/assets/brand/codical-bars-signature-wave-sample.svg", "utf8");
const brandBarsPremiumIdent = readFileSync("client/public/assets/brand/codical-bars-premium-ident-sample.svg", "utf8");
const brandBarsPremiumIdentV2 = readFileSync("client/public/assets/brand/codical-bars-premium-ident-v2-sample.svg", "utf8");

test("landing uses the centralized authoritative brand assets", () => {
  assert.match(brandMark, /codical-bars-animated-web\.gif/);
  assert.match(brandMark, /codical-bars-static-web\.png/);
  assert.match(brandStyles, /prefers-reduced-motion:\s*reduce/);
  assert.match(indexHtml, /logo-bars-192\.png/);
});

test("navbar brand bars have no capsule treatment", () => {
  assert.doesNotMatch(landingStitchStyles, /\.nex-brand \.co-logo-bars\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(landingStitchStyles, /\.nex-brand \.co-logo-bars\s*\{[^}]*background:\s*transparent/s);
});

test("landing navbar uses the approved precision ident and single brand name", () => {
  assert.match(landing, /function NavbarBrandIdent\(\)/);
  assert.match(landing, /<span className="nex-navbar-brand-name">Codical Health<\/span>/);
  assert.match(landingStitchStyles, /\.nex-header \.nex-navbar-ident\s*\{[^}]*width:\s*56px;[^}]*height:\s*40px/s);
  assert.match(landingStitchStyles, /\.nex-header \.nex-navbar-brand-name\s*\{[^}]*color:\s*#0f1eb4/s);
  assert.doesNotMatch(landingStitchStyles, /\.nex-navbar-brand-name::after/);
  assert.match(landingStitchStyles, /animation:\s*nex-navbar-trace 5\.2s[^;]*infinite/);
  assert.match(landingStitchStyles, /@keyframes nex-navbar-cap-top/);
  assert.match(landingStitchStyles, /prefers-reduced-motion:\s*reduce/);
});

test("vector brand master preserves the approved five-bar geometry", () => {
  assert.match(brandBarsMaster, /viewBox="0 0 1720 1120"/);
  assert.equal(brandBarsMaster.match(/<rect /g)?.length, 5);
  for (const height of ["520", "1120", "560", "1080"]) {
    assert.match(brandBarsMaster, new RegExp(`height="${height}"`));
  }
  for (const color of ["#EE7D4B", "#0F1EB4", "#EB966E", "#F5B250", "#4132A0"]) {
    assert.match(brandBarsMaster, new RegExp(color));
  }
});

test("brand wave sample stays subtle and motion-accessible", () => {
  assert.match(brandBarsWaveSample, /codical-intelligence-wave 2\.8s/);
  assert.match(brandBarsWaveSample, /scaleY\(1\.075\)/);
  assert.match(brandBarsWaveSample, /prefers-reduced-motion:\s*reduce/);
  assert.equal(brandBarsWaveSample.match(/class="codical-wave-bar"/g)?.length, 5);
});

test("fluid wave sample preserves circular caps without clipping", () => {
  assert.match(brandBarsFluidSample, /viewBox="0 -110 1720 1340"/);
  assert.match(brandBarsFluidSample, /animation-duration:\s*2\.6s/);
  assert.equal(brandBarsFluidSample.match(/rx="160"/g)?.length, 5);
  assert.doesNotMatch(brandBarsFluidSample, /scaleY\(/);
  assert.match(brandBarsFluidSample, /prefers-reduced-motion:\s*reduce/);
});

test("signature wave uses compositor-friendly motion while preserving exact round caps", () => {
  assert.match(brandBarsSignatureSample, /viewBox="0 -80 1720 1280"/);
  assert.match(brandBarsSignatureSample, /animation: signature-lift 5\.4s/);
  assert.match(brandBarsSignatureSample, /transform-box:\s*fill-box/);
  assert.equal(brandBarsSignatureSample.match(/<circle class="signature-cap/g)?.length, 10);
  assert.equal(brandBarsSignatureSample.match(/<rect class="signature-stem"/g)?.length, 5);
  assert.doesNotMatch(brandBarsSignatureSample, /will-change:\s*(?:y|height)/);
  assert.match(brandBarsSignatureSample, /prefers-reduced-motion:\s*reduce/);
});

test("premium ident resolves once into the exact static master", () => {
  assert.match(brandBarsPremiumIdent, /animation-duration:\s*\.7s/);
  assert.match(brandBarsPremiumIdent, /animation-iteration-count:\s*1/);
  assert.doesNotMatch(brandBarsPremiumIdent, /animation-iteration-count:\s*infinite/);
  assert.equal(brandBarsPremiumIdent.match(/<circle class="ident-cap/g)?.length, 10);
  assert.equal(brandBarsPremiumIdent.match(/<rect class="ident-stem"/g)?.length, 5);
  assert.match(brandBarsPremiumIdent, /stroke-dashoffset:\s*1840/);
  assert.match(brandBarsPremiumIdent, /prefers-reduced-motion:\s*reduce/);
  for (const color of ["#EE7D4B", "#0F1EB4", "#EB966E", "#F5B250", "#4132A0"]) {
    assert.match(brandBarsPremiumIdent, new RegExp(color));
  }
});

test("polished premium ident uses mass-aware one-shot choreography", () => {
  assert.match(brandBarsPremiumIdentV2, /animation: precision-trace \.92s/);
  assert.match(brandBarsPremiumIdentV2, /--duration:\.62s/);
  assert.match(brandBarsPremiumIdentV2, /--duration:\.72s/);
  assert.doesNotMatch(brandBarsPremiumIdentV2, /infinite/);
  assert.equal(brandBarsPremiumIdentV2.match(/<circle class="precision-echo"/g)?.length, 5);
  assert.equal(brandBarsPremiumIdentV2.match(/<circle class="precision-cap/g)?.length, 10);
  assert.equal(brandBarsPremiumIdentV2.match(/<rect class="precision-stem"/g)?.length, 5);
  assert.match(brandBarsPremiumIdentV2, /C 1352 580 1434 540 1560 540/);
  assert.match(brandBarsPremiumIdentV2, /prefers-reduced-motion:\s*reduce/);
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
  assert.match(landing, /\[0, -430\]/);
  assert.match(landingStitchStyles, /height:\s*calc\(100svh \+ 920px\)/);
  assert.match(landingStitchStyles, /calc\(165\.18svh - 320\.4px\)/);
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
