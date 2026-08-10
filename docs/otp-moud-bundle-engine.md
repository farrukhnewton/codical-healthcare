# OTP / MOUD Bundle Engine

## Outcome

This module converts documented opioid treatment program services into an auditable Medicare billing worksheet. It does not diagnose opioid use disorder, authorize take-home medication, make treatment decisions, or submit a claim autonomously.

The engine is service-date-aware, produces one professional or institutional claim context, and keeps program eligibility, treatment bundle, add-ons, telecommunications, claim readiness, and payment readiness as separate decisions.

## Research corrections to the original plan

The original plan was expanded before implementation because it treated the workflow as a small professional-claim calculator. The production design adds:

- CMS-1500/837P with POS 58 for professional OTP claims, including eligible telecom services.
- CMS-1450/837I paths for freestanding, provider-based, hospital-based, and CAH-based OTPs.
- CY 2026 primary bundles and add-ons, including G0532, G0534-G0536, G0137, G2215, G2216, and G1028.
- one primary weekly bundle, including the medication-used-most-days rule when treatment changes during the week.
- take-home drug matching, seven-day units, three-unit limit, supply-date overlap review, and a hard boundary between billing and clinical authorization.
- IOP certification, nine-service threshold, seven-contiguous-day window, and protection against counting the same service toward another bundle/add-on.
- Medicare telecom use of POS 58 and modifiers 95/93, with the additional safeguards applicable to audio-only intake.
- limited duplicate-bundle/59 review for documented guest dosing, transfer, or synchronization situations.
- national payment components, non-drug locality adjustment, and explicit contractor-pricing holds.
- SAMHSA certification, accreditation, Medicare enrollment, DEA/state authority, evidence lineage, and mandatory human review.

## Deterministic workflow

1. Select the service date, payer, claim entity, and OTP site.
2. Verify effective program credentials independently.
3. Enter only the documented OUD diagnosis and provider identifiers.
4. Identify the medication furnished and at least one furnished component.
5. Resolve medication changes to one primary weekly bundle.
6. Add assessments, timed recovery supports, IOP services, take-home supply, and overdose-reversal medication only when their individual evidence gates pass.
7. Apply telecommunications and duplicate-bundle checks independently.
8. Assemble claim context and reference payment, holding unknown or contractor-priced amounts.
9. Require a human coder to approve the source-linked worksheet.

## Claim contexts

| Setting | Format | Required context |
| --- | --- | --- |
| Professional OTP | 837P / CMS-1500 | POS 58; organization and ordering NPIs |
| Freestanding OTP | 837I / CMS-1450 | TOB 087x; appropriate 090x-091x/0949 revenue code |
| Provider-based OTP | 837I / CMS-1450 | TOB 087x; condition code 89; appropriate revenue code |
| Hospital-based OTP | 837I / CMS-1450 | TOB 013x; appropriate revenue code |
| CAH-based OTP | 837I / CMS-1450 | TOB 085x; appropriate revenue code |

The UI presently renders revenue code `0900` as a reviewable default category, because the final subcategory must follow the actual institutional service and payer edit.

## Safety boundaries

- Diagnosis values are code-shape filtered but never inferred or repaired.
- No claim line is a coverage determination.
- An absent MCD pair match is not treated as noncoverage.
- Take-home billing units do not create clinical take-home eligibility.
- State law and payer rules are unresolved until verified for the service date.
- G2075 and G2216 remain contractor priced when no verified amount is loaded.
- Uploaded documents are preliminary evidence; handwritten/scanned pages require approved OCR/vision processing and source-page verification.
- All claim previews require human approval; autonomous submission is disabled in code and database constraints.

## Data architecture

Cloudflare D1 migration `0007_otp_mat_bundle_engine.sql` provides:

- source and version registries;
- date-effective payment rates and billing rules;
- tenant-scoped program and case records;
- encrypted object references for case payloads, documents, and claim lines;
- medication episode and take-home ledgers;
- service events and allocation records preventing IOP double counting;
- telecom and duplicate-bundle reviews;
- evaluation, claim-preview, and audit records.

The schema stores encrypted object keys and hashes rather than raw PHI in D1.

## Primary sources

- CMS, [OTP payment rates](https://www.cms.gov/medicare/payment/opioid-treatment-programs-otp/billing-payment/otp-payment-rates)
- CMS, [OTP billing and payment](https://www.cms.gov/medicare/payment/opioid-treatment-program/billing-payment)
- CMS, [Medicare Claims Processing Manual, Chapter 39](https://www.cms.gov/files/document/chapter-39-opioid-treatment-programs-otps.pdf)
- CMS, [CR 14347 / R13572BP](https://www.cms.gov/medicare/regulations-guidance/transmittals/2026-transmittals/r13572bp)
- CMS, [OTP enrollment](https://www.cms.gov/medicare/payment/opioid-treatment-program/enrollment)
- SAMHSA, [42 CFR Part 8](https://www.samhsa.gov/substance-use/treatment/opioid-treatment-program/42-cfr-part-8)
- SAMHSA, [Federal Guidelines for OTPs, Fall 2024](https://store.samhsa.gov/sites/default/files/federal-guidelines-opioid-treatment-pep24-02-011.pdf)

## Validation

The test suite covers professional and institutional paths, program gates, component requirements, medication switches, matching take-home codes, overlap and unit limits, additional counseling, IOP counting, telecom modifiers, limited duplicate bundles, contractor pricing, locality adjustment, diagnosis non-inference, and the human-approval boundary.
