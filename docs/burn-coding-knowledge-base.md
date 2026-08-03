# Burn & Skin Graft Coding — validated implementation basis

Status: production decision-support rules for engine version `2026.08`

Scope: `/specialty/burn`
Effective-policy baseline: FY/CY 2026; always validate against the date of service

## Purpose and safety boundary

This document replaces the supplied draft as the implementation basis. The source draft was useful as a broad inventory, but several statements were not safe to encode as universal rules. Codical therefore calculates facts that can be derived reproducibly, releases a CPT candidate only when a performed service is confirmed, and holds payer-, product-, or documentation-dependent choices for coder review.

The engine does not submit claims, determine coverage, or replace a licensed current-year CPT source. It provides a coder worksheet with the evidence and unresolved gates visible.

## Corrections made to the supplied draft

1. Superficial (first-degree) burns are tracked but excluded from TBSA. The original algorithm incorrectly counted every depth.
2. An extent under 10% is `T31.0` or `T32.0`, not the invalid `T31.00`/`T32.00` produced by the original string builder.
3. T31/T32 is conditional and generally additional to site-specific codes. It is not assigned for sequela encounters.
4. Burn debridement/local care is kept separate from general wound-debridement families. The engine withholds 11042–11047 and 97597–97598 when burned surfaces are entered.
5. Procedure codes are never inferred from a burn diagnosis or TBSA alone. The performed service, treated site group, and required measurements must be documented.
6. Routine debridement is not separately released with graft or skin-substitute application. Distinct recipient-site preparation is flagged for NCCI review.
7. Skin-substitute application limits are not hardcoded as a universal four-, eight-, or ten-application rule. Coverage is MAC-, indication-, product-, setting-, and effective-date-specific.
8. JW/JZ is not automatically appended. Package use, discarded amount, product classification, setting, and current CMS instructions must be reviewed.
9. C5271–C5278 are not used in the 2026 engine. They were deleted effective December 31, 2025.
10. Non-sheet and injected products are placed on hold for a current HCPCS/application-code review instead of being forced into 15271–15278.

## 1. TBSA calculation

The module uses the age-adjusted Lund–Browder chart with 19 distinct regions and six age bands. Each row records:

- region maximum for the patient's age band;
- percentage of that region affected;
- depth (superficial, partial-thickness, or full-thickness);
- contribution: `region maximum × affected fraction`.

Counted TBSA is the sum of partial- and full-thickness contributions. Full-thickness TBSA is reported separately. Superficial extent is displayed only as a reconciliation value.

Duplicate regions are rejected by the calculation layer, affected fractions are constrained to 0–100%, and patient age is constrained to 0–120.

## 2. ICD-10-CM decision logic

The engine creates two different outputs:

### Site-family prompts

| Clinical region | Family prompt |
| --- | --- |
| Head/neck | T20.- |
| Trunk/buttock/perineum | T21.- |
| Shoulder/upper limb except wrist/hand | T22.- |
| Wrist/hand | T23.- |
| Hip/lower limb except ankle/foot | T24.- |
| Ankle/foot | T25.- |

These are intentionally incomplete prompts. The exact diagnosis requires documented subsite, depth, laterality where applicable, and seventh character/encounter. The engine does not invent those facts.

### Extent code

- burn: T31 category;
- corrosion: T32 category;
- less than 10%: `.0`;
- 10% or more: total-TBSA decile followed by full-thickness decile;
- sequela: not assigned;
- role: additional/conditional, not a replacement for site-specific coding.

The FY 2026 guidelines specifically describe T31/T32 use when the burn/corrosion site is unspecified or as additional data, and advise an additional T31 code when third-degree burns involve 20% or more of body surface. The final coder remains responsible for guideline sequencing and external-cause coding.

## 3. Procedure decision logic

### Local burn treatment

For confirmed treatment without anesthesia, the module can produce a candidate from 16000 or 16020–16030 using documented depth and treated TBSA. When anesthesia is documented, the engine returns the 16010–16015 family for licensed-descriptor review rather than guessing an exact code.

### Escharotomy

16035 is released only when an initial escharotomy incision is explicitly confirmed. 16036 units follow documented additional incisions.

### Surgical recipient-site preparation

15002/15003 and 15004/15005 are calculated from the documented anatomic group and area. Their presence on the worksheet does not establish separate reportability; the output carries an NCCI review gate requiring distinct excisional preparation to viable tissue for reconstruction.

### Autografts

Split-thickness and full-thickness candidates use the selected anatomic group and measured recipient area. A single primary unit is used for the initial area and add-on units are calculated only for the additional area or part thereof.

### Sheet-form skin substitutes

For a confirmed sheet-form skin-replacement application:

- below 100 cm², the appropriate 15271/15275 primary family covers the first 25 cm², with 15272/15276 add-on units for each additional 25 cm² or part thereof;
- at 100 cm² or more, the appropriate 15273/15277 primary family covers the first 100 cm², with 15274/15278 add-on units for each additional 100 cm² or part thereof;
- the primary application code remains one unit per anatomic group;
- exact product name, current HCPCS, package size, applied/discarded amount, setting, state, MAC, and date of service are required audit facts;
- product-code units remain on hold until the HCPCS billing unit and package documentation are reconciled.

### General debridement and NPWT

General wound-debridement families are presented only for a non-burn wound workflow and require documented deepest tissue removed and aggregated surface area. NPWT remains a family-level review because equipment type and total treated area determine the exact choice.

## 4. Mandatory claim-defense gates

- each affected site and depth;
- age and date of service;
- partial/full-thickness TBSA calculation;
- performed service confirmation;
- treated area and CPT anatomic grouping;
- recipient-site preparation evidence when separately considered;
- graft/product identity and traceability;
- product package, applied, and discarded quantities;
- state, MAC, setting, indication, and policy effective date;
- NCCI bundling/edit review;
- licensed CPT descriptor validation;
- qualified coder approval.

## 5. Authoritative sources

- American Burn Association, *Advanced Burn Life Support Provider Manual* (superficial burns excluded from TBSA; Lund–Browder use): https://ameriburn.org/wp-content/uploads/2019/08/2018-abls-providermanual.pdf
- American Burn Association, *Guidelines for Burn Patient Referral*: https://www.ameriburn.org/burn-care-team/resources/guidelines-for-burn-patient-referral
- CDC/NCHS, *FY 2026 ICD-10-CM Official Guidelines for Coding and Reporting*: https://ftp.cdc.gov/pub/health_statistics/nchs/publications/ICD10CM/2026/ICD-10-CM-October-2025-Guidelines.pdf
- CMS, *2026 NCCI Medicare Policy Manual* (Chapter IV, graft/application bundling and units): https://www.cms.gov/files/document/2026-ncci-medicare-policy-manual-all-chapters.pdf
- CMS, LCD L34032, *Debridement Services* (burned surfaces excluded from standard wound-debridement policy): https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?LCDId=34032
- CMS, Article A53001, *Billing and Coding: Debridement Services*: https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=53001
- CMS, CY 2026 Physician Fee Schedule Final Rule fact sheet: https://www.cms.gov/newsroom/fact-sheets/calendar-year-cy-2026-medicare-physician-fee-schedule-final-rule-cms-1832-f
- CMS, MM14361, *Hospital Outpatient Prospective Payment System: January 2026 Update*: https://www.cms.gov/files/document/mm14361-hospital-outpatient-prospective-payment-system-january-2026-update.pdf
- CMS, skin-substitute LCD update/withdrawal fact sheet: https://www.cms.gov/newsroom/fact-sheets/upcoming-update-final-local-coverage-determinations-lcds-certain-skin-substitutes
- CMS, JW/JZ modifier FAQs: https://www.cms.gov/medicare/medicare-fee-for-service-payment/hospitaloutpatientpps/downloads/jw-modifier-faqs.pdf

## 6. Maintenance rules

Review the engine at every annual ICD-10-CM/CPT/NCCI cycle and each quarterly HCPCS update. Skin-substitute policy must also be reviewed when CMS or a MAC changes product classification, payment treatment, coverage, application limits, or documentation requirements. Rules are versioned in code; a policy update must include test changes and a dated decision-log entry.

## 7. Specialty card asset

The non-graphic wound-care photograph used for the active hub card is a 6043×4029 image by cottonbro studio, published as free to use by Pexels: https://www.pexels.com/photo/a-person-getting-his-hand-bandaged-5721555/. The original-resolution JPEG is stored at `specialty-images/burn-skin-graft-4k.jpg` in the project's public Cloudflare R2 bucket.
