# Burn & Skin Graft Coding — validated implementation basis

Status: decision-support rules for engine version `2026.08`

Scope: `/specialty/burn`

Policy baseline: FY/CY 2026; always evaluate the policy effective on the date of service

## Safety boundary

The engine calculates reproducible clinical extent, produces code candidates only from a documented performed service, and exposes unresolved documentation or payer questions as holds. It does not submit a claim or equate the absence of a local CMS article with noncoverage. Final coding requires the complete record, current licensed CPT content, NCCI edits, applicable payer policy, and qualified coder review.

## Lund–Browder model

The implementation uses 19 regions and six age bands: under 1, 1–4, 5–9, 10–14, 15–19, and adult 20+. Region weights were reconciled to the supplied adult/pediatric worksheet and the published Lund–Browder references. Head weight decreases and leg/thigh weight increases with age; stable regions retain the same weight.

For each selected region:

`TBSA contribution = age-band region maximum × affected share of region`

Anterior and posterior surfaces are stored independently. For regions whose published maximum is circumferential (head, neck, limbs, hands, and feet), each surface carries one-half of the region maximum. Selecting both surfaces produces the full circumferential weight; selecting one never mirrors to the other. Trunk, buttock, and perineal rows already represent a single published surface and therefore retain their full listed weight.

Only partial- and full-thickness contributions are included in counted TBSA. Superficial burns remain visible for reconciliation but are excluded. The 3D model uses a detailed CC0 MakeHuman mesh with age-adjusted proportions, 360-degree camera controls, independent anterior/posterior hit surfaces, and region color rendered directly on the anatomical mesh. The inferior-to-superior percentage fill is a proportional UI visualization; it is not an inferred wound boundary.

The 3D mesh asset and its CC0 provenance are documented in `client/public/models/MODEL-LICENSE.md`. The Lund–Browder region weights and calculation remain independent from the presentation mesh.

References:

- Supplied `Lund_Browder_Burn_Estimate_Diagram_Adult-Pediatric.pdf`
- Almutlaq et al., *Lund and Browder chart—modified versus original: a comparative study*: https://pmc.ncbi.nlm.nih.gov/articles/PMC6895471/
- American Burn Association, *Advanced Burn Life Support Provider Manual*: https://ameriburn.org/wp-content/uploads/2019/08/2018-abls-providermanual.pdf

## Document understanding

The intake uses two complementary passes:

1. PDF.js renders scanned pages at high resolution and Tesseract extracts searchable text.
2. A constrained multimodal model reviews the whole PDF plus up to 12 high-priority page images for handwriting, circles, checkmarks, burn diagrams, and operative facts.

The model is instructed to return only visible patient-specific facts. It must distinguish planned from performed procedures and must not convert total TBSA into a per-region percentage. Every result stays editable. Manual changes in the review UI are the values submitted to `/api/burn/analyze`.

## ICD-10-CM logic

| Clinical region | Site-family prompt |
| --- | --- |
| Head/neck | T20.- |
| Trunk/buttock/perineum | T21.- |
| Shoulder/upper limb except wrist/hand | T22.- |
| Wrist/hand | T23.- |
| Hip/lower limb except ankle/foot | T24.- |
| Ankle/foot | T25.- |

These are prompts, not complete codes. Exact coding requires documented subsite, depth, laterality when applicable, and encounter character. T31/T32 extent is conditional/additional; it does not replace the site-specific diagnosis and is not generated for sequela encounters.

Source: CDC/NCHS, *FY 2026 ICD-10-CM Official Guidelines for Coding and Reporting*: https://ftp.cdc.gov/pub/health_statistics/nchs/publications/ICD10CM/2026/ICD-10-CM-October-2025-Guidelines.pdf

## Procedure logic

- Local burn treatment: 16000 or 16020–16030 only for a confirmed performed service without anesthesia. Anesthesia-dependent work is held at the 16010–16015 family for descriptor review.
- Escharotomy: 16035 plus 16036 units only from documented incisions.
- Recipient-site preparation: 15002–15005 from site group and treated area, with a mandatory NCCI gate for distinct excisional preparation.
- Split-thickness autograft: 15100/15101 or 15120/15121 by site group and area.
- Full-thickness autograft: 15200/15201, 15220/15221, 15240/15241, or 15260/15261 by site group and area.
- Sheet-form CTP/skin substitute: 15271–15278 by site group and area. Product identity, HCPCS, package, applied/discarded amount, indication, setting, state, MAC, and effective date remain required.
- General debridement: 11042–11047 and 97597–97598 are withheld for burned surfaces unless a separate qualifying wound is documented.
- NPWT: 97605–97608 remains a family-level review until equipment type and surface area are documented.

CMS NCCI source: https://www.cms.gov/files/document/2026-ncci-medicare-policy-manual-all-chapters.pdf

## CMS/MAC evidence catalog

CMS article content remains normalized in Cloudflare D1 tables (`mcd_documents`, `mcd_codes`, `mcd_document_codes`, `mcd_code_groups`, and `mcd_coverage_rules`). Migration `0004_mcd_burn_specialty_catalog.sql` adds code-family routing and the live `mcd_burn_specialty_documents` view. This avoids copying article text and automatically includes newly imported current versions.

The current all-MAC MCD scan found relevant records for wound, debridement, negative-pressure therapy, recipient-site preparation, and CTP application, including:

- A53001, *Billing and Coding: Wound Care / Debridement Services*: https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=53001
- A54117, *Billing and Coding: Bioengineered Skin Substitutes*: https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=54117
- A56696, *Billing and Coding: Wound Application of Cellular and/or Tissue Based Products (CTPs), Lower Extremities*: https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=56696
- A57680, *Billing and Coding: Skin Substitute Grafts for Diabetic Foot Ulcers and Venous Leg Ulcers*: https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=57680
- L34032, *Debridement Services*: https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?LCDId=34032
- L36377, *Skin Substitute Grafts/CTPs*: https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?LCDId=36377
- L36690, *Wound Application of CTPs*: https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=36690

Acute burn treatment and autograft codes may have no matching local coverage article. The API returns `not_found` for that state and explicitly labels it as “no matching local CMS article evidence,” not “noncovered.”

## Maintenance

Review rules at every annual ICD-10-CM/CPT/NCCI cycle, each quarterly HCPCS update, and whenever CMS or a MAC changes a CTP product classification, coverage rule, application limit, or documentation requirement. Every rule change requires tests and a dated knowledge-base update.
