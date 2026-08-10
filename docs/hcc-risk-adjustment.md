# HCC Risk Adjustment Engine

## Released scope

The module implements the non-PACE Medicare Advantage Part C pathway for payment year 2026 using the final **2024 CMS-HCC V28** model package. It is a deterministic coding-review worksheet, not a diagnosis generator, encounter-data submission system, CMS payment determination, or RADV guarantee.

The official CMS final Python package is preserved in `server/data/hcc/2026/`. The compiled server model contains:

- 8,019 unique ICD-10-CM diagnosis mappings;
- Medicare Code Editor and model age/sex edits;
- official HCC hierarchy rows;
- diagnosis-category groupings;
- condition-count factors;
- disease and disabled interactions;
- seven continuing-enrollee coefficient segments;
- new-enrollee and new-enrollee SNP coefficients; and
- SHA-256 provenance for every source CSV.

## Original-plan corrections

The original plan was not safe or technically valid for production:

1. Its examples used legacy V24 HCC numbers while labeling the algorithm V28. In V28, for example, E11.42 maps to HCC 37—not HCC 18.
2. A risk score is not merely a demographic number plus a flat list of HCC weights. Model age/sex edits, hierarchy suppression, demographic segment, disease categories, condition counts, interactions, and enrollee status all precede the final score.
3. New enrollees use demographic model coefficients; diagnoses remain auditable but do not add HCC coefficients to that score.
4. PY 2026 non-PACE MA uses 100% of the 2024 CMS-HCC model. PACE uses a separate blend and is held by this module.
5. Dialysis, transplant, and functioning-graft beneficiaries require the ESRD models and are held.
6. The raw score, 1.067 normalization, and 5.90% MA coding-pattern adjustment are separate layers.
7. Multiplying RAF by a generic “base payment rate” is not an actual member payment calculation. Plan bids, benchmarks, county rates, rebates, enrollment, and reconciliation context are not represented by that shortcut.
8. Prior-year diagnoses are review cues only. The engine never carries them forward, upgrades specificity, or creates current diagnoses.
9. “MEAT” is treated only as a documentation-review mnemonic. It is not implemented as an invented universal CMS exclusion rule.

## Workflow

1. Select payment/program/enrollment and ESRD context.
2. Enter beneficiary demographics used by the official model.
3. Upload source records or enter diagnosis evidence manually.
4. Verify the patient, service date, encounter identity, acceptable source/provider, eligible service, signature/attestation, and current record support for each diagnosis.
5. Normalize and deduplicate ICD-10-CM codes.
6. Apply CMS model age/sex edits.
7. Exclude held, deleted, and unmapped diagnoses from scoring.
8. Map eligible diagnoses to CCs, apply the V28 hierarchy, build disease categories, condition counts, and interactions.
9. Select the official demographic coefficient segment and calculate the raw score.
10. Display normalization and statutory coding-adjustment views separately.
11. Route historical diagnoses to a non-scoring review queue.
12. Require a human reviewer before approval. Autonomous diagnosis creation and encounter-data submission remain disabled.

## Document handling

`POST /api/hcc/documents/extract` supports PDFs, common images, TIFF, and text. Native text is extracted when available. Scanned and handwritten pages are explicitly routed to the approved OCR/vision boundary when native extraction cannot read them. Extracted ICD-looking values are candidates only and start in `review` state.

When configured, the original document is stored under the encrypted specialty R2 namespace. D1 stores tenant-scoped references, hashes, structured decisions, and audit events rather than raw PHI.

## API

- `GET /api/hcc/references` — model version, source links, counts, factors, and safeguards.
- `POST /api/hcc/map-codes` — bounded official model lookup; does not establish reportability.
- `POST /api/hcc/documents/extract` — evidence extraction and encrypted object-storage handoff.
- `POST /api/hcc/evaluate` — deterministic V28 evaluation.

All routes require authentication.

## D1 architecture

Migration `0009_hcc_risk_adjustment.sql` creates namespaced source/version, model, rule, case, document, diagnosis-evidence, mapping, hierarchy, interaction, score, review-cue, approval, and audit tables. Constraints enforce:

- no generic payment estimate;
- no historical-code conversion;
- human approval;
- no autonomous submission; and
- immutable source/version provenance.

## Primary sources

- [CMS 2026 Model Software/ICD-10 Mappings](https://www.cms.gov/medicare/payment/medicare-advantage-rates-statistics/risk-adjustment/2026-model-software-icd-10-mappings)
- [CMS CY 2026 Rate Announcement](https://www.cms.gov/files/document/2026-announcement.pdf)
- [Medicare Managed Care Manual, Chapter 7](https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/mc86c07.pdf)
- [CMS Medicare Advantage RADV Program](https://www.cms.gov/data-research/monitoring-programs/medicare-risk-adjustment-data-validation-program)
- [FY 2026 ICD-10-CM Official Guidelines](https://www.cms.gov/files/document/fy-2026-icd-10-cm-coding-guidelines.pdf)
- [CMS Risk Adjustment Eligible CPT/HCPCS Codes](https://www.cms.gov/medicare/health-plans/medicareadvtgspecratestats/risk-adjustors-items/cpt-hcpcs)
- [CMS Acceptable Physician Specialty Type Lists](https://www.cms.gov/medicare/payment/medicare-advantage-rates-statistics/risk-adjustment/acceptable-physician-specialty-type-lists)
