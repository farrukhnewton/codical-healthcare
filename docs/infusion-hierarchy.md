# Infusion Hierarchy module

## Scope

`/specialty/infusion` creates a coder-review worksheet for physician-office and hospital-outpatient Part B drug administrations. It evaluates documented administration timing, access sites, sequential and concurrent relationships, CMS Part B drug billing units, JW/JZ evidence, and NCCI edits. It does not create or submit a claim.

## Corrections to the original outline

- Chemotherapy infusion is not blindly made the initial service for every workflow. Hospital outpatient facility hierarchy and physician-office chronological selection are distinct.
- More than one initial service is held unless separate medically necessary vascular access sites are documented. A double-lumen catheter remains one access site.
- Hydration used for patency, as a carrier, or concurrently with another administration is not separately reportable.
- Timed services require source-supported start and stop times. OCR-derived values remain review candidates.
- Administration codes and HCPCS drug units are calculated on separate worksheet lines.
- The July 2026 ASP file is date-bounded and does not establish coverage or medical necessity.
- JW/JZ depends on separate payment, container type, applicability, actual discarded amount, and rounding at the HCPCS billing-unit level.
- Practitioner and hospital-outpatient NCCI pathways are checked separately.
- Licensed CPT validation and human approval remain required before release.

## Versioned sources

- CMS 2026 Medicare NCCI Policy Manual, Chapter XI
- CMS July 2026 Medicare Part B Drug Payment Limit File
- CMS July 2026 ASP NDC-HCPCS Crosswalk
- Medicare Claims Processing Manual, Chapter 17
- CMS Medicare Coverage Database article A53778
- CMS Q3 2026 NCCI PTP, MUE, and add-on code files

The source CSVs are stored unmodified under `server/data/infusion/2026Q3/`. `scripts/generate-infusion-asp-data.ts` compiles 890 payment-limit entries and 1,052 drug aliases into server-only TypeScript data.

## Safety boundaries

- OCR never confirms an administration, drug classification, route, dose, or timestamp.
- The engine does not infer coverage from an ASP entry.
- Reference allowance values are not payment guarantees.
- Unsupported ASC, inpatient, pump/prolonged, stale-quarter, and incomplete-evidence pathways are held.
- No autonomous claim submission is permitted.
