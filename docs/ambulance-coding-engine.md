# Ambulance Coding & Billing Engine

## Release boundary

This release activates the third specialty module at `/specialty/ambulance`. It is a decision-support and coder-workspace release. It does not create or transmit an X12 claim, post charges, make a final coverage determination, or submit a claim autonomously.

Every result sets `requiresCoderApproval: true`; D1 claim previews enforce `autonomous_submission_enabled = 0`.

## Implemented workflow

The workspace captures and displays five separate decisions:

1. Level of service and HCPCS candidate.
2. Medical necessity.
3. Medicare coverage gates.
4. Payment-estimate readiness or a versioned estimate.
5. Claim readiness.

Keeping these separate prevents an emergency dispatch, a high clinical acuity, or a selected HCPCS from being presented as proof of medical necessity or payment.

The engine supports:

- Ground BLS, ALS1, ALS2, SCT, and qualifying rural paramedic intercept.
- Fixed-wing and rotary-wing base/mileage lines.
- A0425, A0426, A0427, A0428, A0429, A0430, A0431, A0432, A0433, A0434, A0435, and A0436.
- D/E/G/H/I/J/N/P/R/S/X origin/destination characters, with X rejected in origin position.
- GM, QL, QM, and QN workflows.
- POS 41 and POS 42.
- 837P for independent suppliers and 837I for institutional providers.
- CMS upward mileage rounding: tenth of a mile below 100 and whole mile at or above 100.
- ALS2 medication and procedure evidence, including the 2025 prehospital blood-transfusion expansion.
- SCT gating through interfacility transport, critical illness/injury, ongoing specialty care, and effective state paramedic scope.
- Death-before/after-dispatch claim handling.
- RSNAT documentation queries.
- Air necessity queries.
- 2026–2027 urban, rural, and super-rural adjustment records.
- Rural ground miles 1–17 and ESRD dialysis reduction calculation order.
- Manual diagnosis entry with ICD-10-CM shape validation; no diagnosis inference.

## Deterministic engine

The portable engine is in `shared/ambulance-coding.ts`. It can run in the browser for resilient worksheet generation and on the server for the authenticated evidence workflow.

The browser creates a local result first. If the server or Cloudflare MCD evidence service is temporarily unavailable, the user keeps the deterministic worksheet and sees a clear evidence-lookup notice instead of a failed page.

Payment estimates require an effective `AmbulanceRateInput`. The estimator returns `unavailable` rather than inventing a rate. A CMS PUF may already contain the temporary urban/rural add-on; `includesTemporaryAddOns` prevents double application.

## NEMSIS intake

`POST /api/ambulance/nemsis/import` accepts an EMSDataSet XML file up to 10 MB. The importer:

- Rejects DTDs and external entities.
- Requires an EMSDataSet root.
- Detects supported NEMSIS 3.4/3.5 versions when declared.
- Calculates a SHA-256 source hash.
- Maps a conservative set of PCR, patient, response, disposition, symptom, medication, and procedure elements.
- Preserves field-level element provenance.
- Reports unmapped elements and validation warnings.

Current limitation: the application performs safe structural parsing, not NEMSIS certification-grade XSD and Schematron validation. Production data exchange must run the current national and applicable state XSD/Schematron packages in a managed ingestion job. The UI and API state this limit explicitly.

## API inventory

- `GET /api/ambulance/references`
- `POST /api/ambulance/nemsis/import`
- `POST /api/ambulance/evaluate`

All routes require the existing authenticated application session.

The evaluation endpoint returns the deterministic evaluation, payment-estimate status, Cloudflare MCD supporting evidence, evidence semantics, and the disabled autonomous-submission flag.

## D1 schema and source design

Migration `cloudflare/d1/migrations/0005_ambulance_coding_engine.sql` adds:

- Source registry and immutable source versions.
- HCPCS, modifier, POS, ZIP designation, fee-schedule rate, payment adjustment, and state-scope tables.
- Encrypted case-object references, normalized evidence, deterministic evaluations, claim previews, and audit events.
- Effective-date and lookup indexes.
- CMS/NEMSIS source metadata and the current reference vocabulary.

Rate and ZIP rows are intentionally not fabricated in the migration. Source versions with unresolved file hashes are `discovered`, not `published`, and cannot be treated as controlling rate data.

Binary/XML source files belong in R2. D1 stores immutable hashes, effective dates, validation state, and object keys.

## Primary source inventory

- [CMS Ambulance Fee Schedule and ZIP files](https://www.cms.gov/medicare/payment/fee-schedules/ambulance)
- [CMS Ambulance Fee Schedule Public Use Files](https://www.cms.gov/medicare/payment/fee-schedules/ambulance/ambulance-fee-schedule-public-use-files)
- [Medicare Benefit Policy Manual, Chapter 10](https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/bp102c10.pdf)
- [Medicare Claims Processing Manual, Chapter 15](https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/downloads/clm104c15.pdf)
- [CMS MM10549 ESRD ambulance reduction](https://www.cms.gov/sites/default/files/2021-03/MM10549.pdf)
- [NEMSIS v3 data dictionaries and XSD](https://nemsis.org/technical-resources/version-3/version-3-data-dictionaries/)
- [NEMSIS Schematron resources](https://nemsis.org/technical-resources/version-3/version-3-schematron/)

## Test inventory

`test/ambulance-coding.test.ts` covers BLS/ALS1/ALS2/SCT/air selection, mileage, modifiers, death, claim format, diagnosis safety, payment availability, rural mileage, ESRD calculation order, and the emergency/necessity separation.

`test/ambulance-nemsis.test.ts` covers evidence mapping, source hashing, and XXE rejection.

`test/ambulance-workspace-render.test.tsx` covers initial route rendering and safety boundaries.

## Security and privacy

- No patient payload is seeded into D1.
- Production case rows reference encrypted objects and their hashes.
- NEMSIS XML forbids external entities and is size limited.
- Diagnosis codes are source-entered and format-validated.
- Claim submission remains disabled.
- CMS MCD results are supporting article context; absence of a local match is not represented as noncoverage.

## Known limits before production data publication

- Import and validate the current CMS quarterly AFS rate and ZIP designation files; no dollar amount should be shown until that succeeds.
- Add current national and state NEMSIS XSD/Schematron validation packages.
- Populate and maintain every state's paramedic scope rules before releasing SCT as `pass` outside explicitly verified jurisdictions.
- Add payer-specific policy packages for Medicare Advantage, Medicaid, and commercial payers.
- Obtain coder/compliance acceptance of institutional revenue-code and claim-loop adapters before any EDI export feature is considered.
- Browser-based visual QA could not run in the current tool session because no in-app or Chrome browser connection was available; static render, type, unit, and production-build validation passed.

## Rollback

1. Change the ambulance registry entry back to `coming-soon` to remove user access without affecting PGx or Burn.
2. Remove the `/specialty/ambulance` route and stylesheet import if a client rollback is required.
3. Disable the three `/api/ambulance/*` routes if a server rollback is required.
4. D1 migration 0005 is additive. Do not drop its tables during an incident; stop writers and retain the audit trail. Remove the feature first, then archive or retire source versions through a reviewed follow-up migration.
