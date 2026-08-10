# Organ Transplant Lifecycle Coding & Billing Engine

## Release boundary

This release activates `/specialty/transplant` as an authenticated decision-support workspace. It does not make a final coverage determination, reproduce a licensed CPT data set, group a claim without a licensed/versioned grouper, transmit X12/NCPDP transactions, send provider queries, post charges, or submit claims.

Every evaluation returns `requiresHumanApproval: true` and `autonomousClaimSubmission: false`. The D1 claim-preview constraint also forces autonomous submission to zero.

## Research-driven plan corrections

The original plan was strengthened in the following areas before implementation:

1. **Historical approval instead of current-only approval.** CMS change request 14262, implemented April 6, 2026, makes PECOS the system of record for hospital transplant-program and organ-type records. The engine requires an exact, date-effective organ record for 2026-04-06 and later, and does not treat generic hospital approval as sufficient.
2. **Program prerequisites.** Pancreas requires an effective kidney program; intestine and multivisceral require liver; heart-lung requires exact heart-lung plus heart and lung program records. Adult and pediatric records are not interchangeable.
3. **Part B-ID is kidney-specific.** It is not a generic post-transplant benefit. The pathway requires a qualifying kidney transplant, ESRD-based Medicare ending after 36 months, no disqualifying other coverage, and Part B-ID enrollment. It covers continuous immunosuppressive drugs, not comprehensive medical benefits.
4. **Lung is not assigned a fabricated NCD.** The engine routes lung and heart-lung coverage through effective program approval plus current reasonable-and-necessary and payer review.
5. **Islet and whole-organ pancreas are separate.** An islet-cell case is held for its applicable trial/policy workflow and is not allowed through the whole-organ logic.
6. **Liver follow-up is an independent decision.** NCD 260.1 permits follow-up care to be assessed for independent reasonable-and-necessary coverage even if the original transplant was noncovered.
7. **Current cost-report source.** Organ-acquisition schema metadata uses the February 2026, Revision 25 CMS-2552-10 Worksheet D-4 source rather than the older revision cited in the initial plan.
8. **Provider-neutral allocation integration.** HRSA's 2026 OPTN modernization is moving toward a government-managed, multi-vendor data architecture. The design stores source/provider identifiers and versions instead of hardwiring one contractor.
9. **No single “transplant claim” decision.** Professional coding, inpatient facility coding, organ acquisition/SAC, donor billing, coverage, drug benefits, and each claim lane remain independently auditable.

## Deterministic decision domains

`shared/transplant-coding.ts` evaluates:

- Exact-organ, age-category, service-date, CCN, and prerequisite program approval.
- Organ-specific coverage gates for kidney, liver, heart, pancreas, intestine/multivisceral, lung/heart-lung, and combined cases.
- Professional coding readiness through a tenant licensed-CPT adapter only.
- Inpatient facility readiness through versioned ICD-10-PCS and discharge-effective MS-DRG/MCE inputs; CPT is never substituted for facility PCS.
- Organ-acquisition direct/shared/unresolved classification, balanced shared-cost allocation, and organ-specific SAC reconciliation.
- Donor-to-recipient acquisition-account linkage, kidney-only Q3 complication handling, occurrence code 36, patient relationship 39, and paired-exchange reconciliation.
- Ordinary Part B, Part B-ID, Part D, and other drug-benefit pathways without treating them as interchangeable.
- Professional, institutional, DME, and pharmacy preview lanes.

Unknown or contradictory evidence produces `review` or `hold`; it never silently becomes `pass`. Diagnosis input is shape-validated but never inferred, repaired, or promoted from symptoms.

## Document intake

`POST /api/transplant/documents/extract` accepts up to eight PDF, PNG, JPEG, or TXT documents through the existing authenticated route and memory/size controls. It validates file signatures, hashes each source, extracts native PDF/TXT text, performs conservative document classification, and stores the binary under a PHI-neutral specialty R2 key when configured.

Images and image-only PDFs are explicitly held for an approved OCR/vision service and human source-page verification. Extracted text is preliminary evidence; no diagnosis, rejection, complication, procedure, or coverage fact is automatically accepted as claim-bound truth.

## API inventory

- `GET /api/transplant/references`
- `POST /api/transplant/documents/extract`
- `POST /api/transplant/evaluate`

All routes require the existing Supabase bearer session. A browser evaluation is created first so a temporary server/network outage leaves a deterministic worksheet and a visible evidence warning instead of crashing the page.

## D1 and R2 architecture

Migration `cloudflare/d1/migrations/0006_transplant_lifecycle_engine.sql` is additive and contains:

- Public source registry and immutable source-version metadata.
- Date-effective program approvals and prerequisite rules.
- Coverage-rule, ICD version, grouper-version, and licensed-adapter boundaries.
- Tenant-scoped encrypted case/object references and hashes.
- Documents, field-level evidence, program validations, operative review, professional/facility candidates, acquisition/SAC ledgers, donor review, drug-benefit review, queries, claim previews, and audit events.

The migration seeds metadata only. It does not seed PHI, prices, protected CPT descriptors, NUBC/X12/NCPDP implementation content, program approvals, payer contracts, or unvalidated code/grouper rows. Discovered source versions cannot control a result until a reviewed importer promotes them.

## Authoritative source inventory

- [CMS Organ Transplant Program certification](https://www.cms.gov/medicare/health-safety-standards/certification-compliance/organ-transplant-program)
- [CMS R13757CP / CR 14262 PECOS transplant-program records](https://www.cms.gov/medicare/regulations-guidance/transmittals/2026-transmittals/r13757cp)
- [Medicare Claims Processing Manual, Chapter 3](https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c03.pdf)
- [Medicare Benefit Policy Manual, Chapter 11](https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/bp102c11.pdf)
- [NCD 260.1 Adult Liver Transplantation](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=70)
- [NCD 260.3 Pancreas Transplants](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=107)
- [NCD 260.5 Intestinal and Multi-Visceral Transplantation](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=280)
- [NCD 260.9 Heart Transplants](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=112)
- [CMS Part B-ID provider information](https://www.cms.gov/partbid-provider)
- [Medicare Claims Processing Manual, Chapter 17](https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c17.pdf)
- [CMS-2552-10, February 2026 Revision 25](https://www.cms.gov/files/document/r26p240f.pdf)
- [CMS IOTA model](https://www.cms.gov/priorities/innovation/innovation-models/iota)
- [HRSA OPTN policies](https://www.hrsa.gov/optn/policies-bylaws/policies)
- [HRSA January 2026 OPTN modernization update](https://www.hrsa.gov/optn-modernization/updates/january-2026)

## Verification inventory

`test/transplant-coding.test.ts` covers exact/historical/adult-pediatric approvals; PECOS cutover; pancreas, intestine, and heart-lung prerequisites; organ-specific coverage gaps; acquisition allocation; donor Q3 and paired exchange; Part B-ID; diagnosis non-inference; licensed CPT boundary; facility PCS/grouper boundary; and the human-approval gate.

`test/transplant-workspace-render.test.tsx` verifies that the route renders its lifecycle boundaries and safety language server-side.

## Production gaps intentionally not disguised

- Import and reconcile official PECOS organ-program records with effective periods before presenting a program result as verified in production.
- Run reviewed importers for full CMS NCD/manual text and current ICD-10-CM/PCS content.
- Connect a properly licensed CPT/MPFS/NCCI adapter and licensed MS-DRG/MCE grouper.
- Configure payer-specific Medicare Advantage, Medicaid, and commercial transplant policies and contracts.
- Obtain cost-report, finance, transplant-center, coder, compliance, pharmacy, security, and revenue-integrity acceptance.
- Add an approved OCR/vision provider with a BAA and no-training/retention controls for scanned clinical records.
- Complete authenticated visual and keyboard QA in a connected browser session before general availability.

## Rollback

1. Change the transplant registry entry back to `coming-soon` to remove user access while retaining data and audit history.
2. Remove the `/specialty/transplant` client route and stylesheet import for a client-only rollback.
3. Disable the three `/api/transplant/*` routes for a server-only rollback.
4. Migration 0006 is additive. During an incident, stop writers and preserve evidence/audit rows; do not drop the tables as an emergency rollback.
