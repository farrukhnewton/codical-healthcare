# CABG Assembler

## Purpose

This module produces an evidence-backed coronary artery bypass graft coding worksheet. It separates professional CPT candidates from inpatient-facility ICD-10-PCS construction and independently gates source verification, diagnosis evidence, payer policy, NCCI PTP edits, MUEs, add-on-code relationships, current code sets, and human release.

Engine: `2026.08.10.1`

Policy: `CMS-PFS-NCCI-MUE-AOC-PCS-2026Q3`

## Roadmap corrections

The original roadmap counted arterial and venous grafts without a distal-target ledger and included inactive values in both CABG code families. It also used a single professional claim output for inpatient work. The production workflow corrects those gaps:

- `33515` and `33520` are not generated. Current venous-only and combined families skip those inactive values.
- One row represents one explicitly completed distal coronary anastomosis. Conduit pieces, proximal anastomoses, planned or abandoned grafts, and replaced failed grafts do not increase the count.
- Arterial-only, venous-only, and combined arterial/venous professional families are assembled independently.
- Endoscopic saphenous harvest, endoscopic radial harvest, open radial harvest, upper-extremity vein harvest, and femoropopliteal vein harvest remain technique-specific.
- Reoperation requires explicit prior CABG or valve surgery more than one calendar month before the current service.
- Coronary endarterectomy is counted by documented vessel and held above the current practitioner MUE of three.
- Professional CPT and inpatient-facility ICD-10-PCS are separate pathways. CPT-to-PCS crosswalking is prohibited.
- Facility bypass rows are grouped only when approach, conduit device, and inflow qualifier match. Conduit harvest is constructed as a separate PCS objective.
- Valve and other concomitant procedures are never inferred. Modifiers are never automatic.
- Code selection never creates a diagnosis, medical necessity, coverage, or authorization conclusion.

## Document understanding

The authenticated upload endpoint accepts PDF, PNG, and JPEG source records. Visual OCR inspects signed operative reports, graft diagrams, harvest notes, perfusion records, and handwriting. It extracts patient identity, operative date, surgeon, finalization text, one candidate row per explicit distal target, conduit and inflow facts, harvest technique, redo facts, endarterectomy vessels, diagnoses, and same-day procedure codes. Every extracted fact retains page, confidence, and evidence and enters the workspace unverified.

## API

- `GET /api/cabg/references`
- `POST /api/cabg/documents/extract`
- `POST /api/cabg/evaluate`

All endpoints require an authenticated user. Evaluation does not submit claims.

## Data

Migration `0013_cabg_assembler.sql` creates versioned sources, policy, code/rule catalog, case, document, target, harvest, diagnosis, decision, NCCI, approval, and audit tables in Cloudflare D1. It seeds the current research provenance and non-licensed mapping controls without storing proprietary CPT descriptors.

## Release boundaries

- Current licensed CPT verification is required for professional candidates.
- Current CMS ICD-10-PCS tables and the date-effective IPPS grouper are required for inpatient-facility release.
- Current NCCI PTP, practitioner/hospital MUE, and add-on-code edit review is mandatory.
- Payer coverage, authorization, and jurisdiction policy are verified separately.
- Human coder approval is mandatory.
- Autonomous claim submission is disabled.
