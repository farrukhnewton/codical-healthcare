# NICU Daily Coder

## Purpose

The NICU module creates a longitudinal coder-review ledger for professional neonatal and pediatric inpatient daily services. It does not diagnose critical illness, determine coverage, replace licensed CPT content, calculate a facility DRG, authorize a modifier, or submit a claim.

Engine: `2026.08.10.1`
Policy: `CMS-NCCI-AAP-FY2026`

## Roadmap corrections

The original roadmap reduced selection to age, birth weight, status, and a static procedure list. That was expanded because those facts are not sufficient for a defensible claim.

- Calendar age is calculated from date of birth and service date.
- Critical status and intensive services must be explicitly documented; location or treatment does not establish either level.
- Continuing intensive tiers use present body weight for that date, never birth weight.
- Initial versus subsequent history is tracked across the admission and separately across applicable critical-care age categories.
- A continuing intensive tier requires an earlier critical or intensive per-diem service in the same admission.
- The reporting provider must be identified, direct the inpatient care, perform a medically appropriate bedside examination, and direct the plan of care.
- Generally only one directing provider reports a neonatal/pediatric per-diem service on a date.
- Same-day intensive-to-critical transitions receive a narrow exception review rather than automatic duplicate reporting.
- The professional and facility pathways are separated. Facility billing remains held for a date-effective inpatient grouper, POA, revenue/accommodation rules, and the payer contract.
- Procedures use current NCCI/PTP, MUE, global-period, licensed CPT, and payer checks. No static list is treated as universally separately payable.
- Modifier 25 is never automatically assigned.
- Diagnoses are limited to provider-documented, clinically significant evidence. Measurements and treatments never generate diagnoses.
- Z38 birth-record logic is enforced for receiving hospitals.
- State Medicaid, CHIP, or commercial payer coverage is a required, date-effective release gate.
- Human approval and licensed CPT verification remain mandatory.

## Daily selection model

### Critical care

- Age 0 through 28 days: initial/subsequent neonatal critical pathway.
- Age 29 days through the day before the second birthday: initial/subsequent infant critical pathway.
- Age 2 through the day before the sixth birthday: initial/subsequent young-child critical pathway.
- Older patients are held for the time-based general critical-care workflow.

An initial service is tracked once per applicable age category during the stay. A day that crosses into a new critical-care age category is not treated as a simple continuation of the earlier category.

### Intensive care

- An initial neonatal intensive day is available only when the patient is 28 days or younger, intensive services are documented, and there is no earlier critical/intensive per-diem service in the ledger.
- Continuing intensive care requires earlier per-diem history, explicit recovering-low-birth-weight status, and present body weight:
  - under 1500 g
  - 1500 through 2500 g
  - 2501 through 5000 g
- Above 5000 g, the engine does not select a continuing NICU weight-tier code.

### Other levels

- Routine inpatient and comfort-care days are held for documented MDM/time and the licensed hospital E/M pathway.
- Discharge selection requires documented discharge-management minutes and suppresses another same-provider E/M service for that date.

## Document understanding

Authenticated users may upload PDF, PNG, or JPEG records. Native text extraction and visual document understanding inspect daily progress notes, handwritten weights, flowsheets, transfers, procedure logs, and discharge records. Extracted facts always enter the workspace as unverified candidates.

Files can be stored under the `nicu` specialty namespace in R2 when configured. Storage failure does not silently convert OCR candidates into verified evidence.

## API

- `GET /api/nicu/references`
- `POST /api/nicu/documents/extract`
- `POST /api/nicu/evaluate`

All endpoints require an authenticated Supabase session.

## Production data model

Migration `0011_nicu_daily_coder.sql` creates versioned source, policy, code, rule, case, document, daily record, diagnosis, procedure, decision, NCCI, payer-policy, approval, and audit tables in Cloudflare D1.

The source registry separates coding controls from coverage determinations. Presence in NCCI or a code catalog does not establish coverage or payment.

## Primary references

- CMS 2026 Medicare NCCI Policy Manual, Chapter XI
- CMS 2026 Q3 Medicare NCCI PTP files
- CMS 2026 Q3 Medicaid NCCI files
- CDC/NCHS FY 2026 ICD-10-CM Official Guidelines
- AAP Global Per Diem Critical Care: Direct Supervision and Reporting Guidelines
- Current licensed AMA CPT guidance
- Date-effective state Medicaid, CHIP, or commercial payer policy
