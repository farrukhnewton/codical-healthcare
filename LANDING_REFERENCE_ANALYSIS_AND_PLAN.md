# Landing Reference Analysis And Clone Plan

Date: June 9, 2026

Reference URL: https://automation-saas-tailwind.vercel.app/

## Goal

Upgrade only the Codical Health landing page to reach at least the design level of the Automation SaaS/Nexsas landing page, while adapting the experience to healthcare coding, claim validation, payer intelligence, and certified coder review.

This is an approval report only. No implementation should start until approved.

## Important Boundary

We should clone the reference's layout quality, motion language, section rhythm, and premium polish, not copy its protected brand, exact visual assets, source code, or copy. Codical should get its own healthcare-specific imagery, product mockups, text, data, and interactions.

## Reference Page Anatomy

The reference landing page has these major sections:

- Floating pill header with logo, dropdown nav, and strong CTA.
- Full-bleed hero with scenic photographic background.
- Social proof avatars above the headline.
- Huge centered headline and restrained subcopy.
- Two large pill CTAs.
- Large product mockup overlapping the hero and fading into the next section.
- About section with editorial image composition and large type.
- Feature/results section with white rounded modules and custom UI illustrations.
- Process section with numbered workflow cards.
- Core features/benefits sections.
- Pricing, integrations, testimonials, FAQ, CTA, and footer.

The strongest design moves are:

- Real visual background in the hero, not only abstract gradients.
- First viewport feels spacious, confident, and expensive.
- Header is simple and memorable.
- Product mockup is large and acts as the bridge between hero and content.
- Section rhythm varies: full-bleed image hero, editorial about, feature grid, workflow, pricing, integrations.
- CTA buttons have a recognizable icon-pill treatment.
- Soft fades and depth make the page feel less flat.

## Current Codical Landing Status

Your current page already borrows part of the reference structure:

- Fixed pill header.
- Dropdown mega menu.
- Oversized centered hero headline.
- Avatar proof row.
- Two CTA buttons.
- Floating motion elements around the hero.
- Large product preview panel.
- About/team section.
- Results/features grid.
- Four-step workflow section.
- Final CTA.

This is a strong base, but it does not yet match the reference quality.

## Current Gaps

Visual impact:

- Current hero is abstract grid/orbit driven; the reference has a much stronger cinematic background.
- The current first viewport feels like a UI composition. The reference feels like a polished product website with a designed environment.
- The background animation competes with the headline instead of supporting it.

Header/menu:

- Current header is close, but still feels more utilitarian than premium.
- Mega menu works structurally, but needs better card hierarchy, spacing, image treatment, and hover polish.
- Mobile header currently has clipping/overflow problems.

Hero:

- Current floating chips are useful but over-emphasized.
- The headline is too large for mobile and clips horizontally.
- Product preview is good, but it should become more realistic and more integrated into the hero scene.

Sections:

- Current sections are directionally right, but need stronger visual continuity and more section-to-section polish.
- The reference has richer image-led editorial moments; Codical needs healthcare-specific visual assets or generated hero/background imagery.
- Feature cards need better custom visuals, not only generic UI panels.

Motion:

- Current CSS motion exists, but it needs tighter choreography.
- Motion should support the reference-like premium feeling: soft reveal, gentle drift, CTA hover, hero depth, product mockup entrance, section transitions.

Mobile:

- Current mobile hero has serious right-side clipping.
- The reference mobile screenshot also clips in places, but Codical should improve on it, not copy the flaw.
- Mobile product preview and CTAs need stable width and clean wrapping.

## Target Creative Direction

Create a Codical-specific version of the reference:

- Hero background: a healthcare command-center environment, clinical sky/light, or generated cinematic medical operations scene.
- Product mockup: Codical claim validation/coding workspace, not Nexsas tax/automation UI.
- Palette: keep a premium light background system inspired by the reference, but use Codical navy, clinical blue, orange, teal, and clean white.
- Typography: large, confident, clean, with better mobile scaling.
- Motion: premium but controlled.
- Layout: preserve the reference's spacious hero + overlapping product mockup + editorial section rhythm.

## Proposed Page Structure

1. Header

- Pill-shaped floating header.
- Codical Health logo.
- Nav: Platform, Solutions, Resources, Pricing.
- Dropdown mega menus.
- CTA: Request access or Start review workflow.
- Mobile: compact logo + menu button + full-screen drawer.

2. Hero

- Full-bleed generated healthcare/coding background.
- Social proof row.
- H1: healthcare coding/claim validation message.
- Subcopy focused on upload, AI suggestions, claim checks, and certified review.
- CTAs: Start review workflow, Book demo / See process.
- Large Codical product mockup overlaps the lower hero.
- Soft fade into next section.

3. Editorial/About Section

- Image-led layout like the reference.
- Healthcare operations photo/generated image.
- Copy about Codical's purpose and clinical coding team workflow.
- Small stats row.

4. Results/Features Section

- Four premium cards:
  - Code intelligence
  - Claim validation
  - Payer/NCCI intelligence
  - Certified review/reporting
- Each card gets a custom mini-visual.

5. Workflow Process Section

- Four-step interaction:
  - Upload report
  - Get coding suggestions
  - Validate claim
  - Certified coder review
- Animated or tabbed panel.
- Use Framer Motion/GSAP for transitions.

6. Product Depth Section

- Bigger product UI panel showing real Codical flows:
  - CPT/ICD search
  - NCCI flag
  - NPI validation
  - payer rule context
  - final report

7. Integrations/Trust Section

- Replace generic app logos with healthcare-relevant systems:
  - CMS
  - clearinghouse
  - payer policies
  - EHR
  - NPI/NPPES
- Keep the reference's connected/network visual style.

8. FAQ And Final CTA

- Short FAQ focused on healthcare coding, security, human review, and claim validation.
- Final scenic CTA section.

## Recommended Technical Approach

Use current repo stack plus installed libraries:

- React + TypeScript.
- Existing `Landing.tsx` and `landing-stitch.css` as the base.
- Framer Motion for component/state transitions.
- GSAP for hero and scroll choreography.
- Lenis only for the public landing page if smooth scroll improves the experience.
- React Three Fiber only if the final approved design needs a real 3D hero/background. Otherwise use generated bitmap imagery plus CSS/GSAP for better performance.
- Lucide icons for UI controls.
- Generated imagery or Stitch concepts for Codical-specific hero/background/product sections.

## Google Stitch MCP Plan After Approval

After approval, use Stitch MCP to create design concepts before coding:

- Desktop full landing reference adaptation.
- Mobile landing closed state.
- Mobile menu open state.
- Product mockup/detail concept.
- Feature/results section concept.
- Workflow/process section concept.

Stitch prompt should explicitly say:

- Use the Automation SaaS reference only for layout quality and rhythm.
- Do not copy Nexsas branding/assets/copy.
- Create a Codical Health healthcare coding landing page.
- Keep product UI realistic and healthcare-specific.
- Fix mobile overflow.

## Implementation Phases

Phase A: Stitch concept generation

- Generate the landing designs through Stitch MCP.
- Save screenshots/HTML locally.
- Review against this plan.

Phase B: Design system extraction

- Extract tokens, typography, section spacing, button anatomy, image treatment, card rules, menu behavior, and responsive rules from the approved Stitch concept.

Phase C: Hero/header rebuild

- Polish header and mega menu.
- Replace abstract hero background with approved healthcare visual scene.
- Fix mobile clipping.
- Rebuild product preview to match the concept.

Phase D: Section upgrade

- Editorial/about section.
- Feature/results cards.
- Workflow/process interaction.
- Integrations/trust.
- FAQ/final CTA.

Phase E: Motion/passive 3D polish

- Add GSAP/Framer transitions.
- Add optional R3F only where it clearly improves the page.
- Add reduced-motion fallback.

Phase F: QA

- Desktop, tablet, and mobile screenshots.
- No horizontal overflow.
- Header and menu interactions.
- Reduced-motion behavior.
- `npm run check`.
- Browser visual comparison against approved Stitch concepts.

## Approval Decision

Recommended approval: approve Phase A only.

That means the next step would be using Google Stitch MCP to generate the new reference-inspired Codical landing concepts. No production implementation should happen until the concept is accepted.
