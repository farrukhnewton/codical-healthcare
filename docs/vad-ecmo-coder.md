# VAD / ECMO Coder

## Purpose

This module creates an evidence-backed coding worksheet for mechanical circulatory and extracorporeal support episodes. It separates professional CPT candidates from inpatient-facility ICD-10-PCS candidates and independently evaluates coverage, diagnosis evidence, source completeness, current NCCI edits, and human release controls.

Engine: `2026.08.10.1`

Policy: `CMS-NCD20.9.1-NCCI-PFS-PCS-2026Q3`

## Roadmap corrections

The original roadmap used device type and a broad phase as sufficient inputs. It also mislabeled the ECMO code family, treated VAD interrogation as automatically billable daily, and proposed a CMS-1500 output for facility services. The production workflow corrects those gaps:

- ECMO initiation and daily management distinguish veno-venous from veno-arterial support.
- Cannulation, repositioning, and removal require the exact peripheral/central access, percutaneous/open approach, and birth-through-5 versus age-6-plus band.
- ECMO daily VA management is not represented as a generic weaning code.
- Extracorporeal VAD insertion/removal requires single-ventricle versus biventricular configuration.
- Implantable VAD replacement requires cardiopulmonary-bypass evidence.
- Percutaneous VAD insertion distinguishes arterial-only from arterial-and-venous support.
- VAD interrogation requires in-person service and analysis/report evidence and is never generated merely because a device is present on a date.
- Same-day services use current practitioner or hospital NCCI PTP/MUE and global-surgery review; modifiers are never automatic.
- Medicare durable-LVAD coverage is evaluated separately under NCD 20.9.1.
- Professional CPT and inpatient ICD-10-PCS are separate pathways. CPT-to-PCS crosswalking is prohibited.
- Device use never creates a diagnosis automatically.

## Coverage controls

When Medicare NCD 20.9.1 applies to durable LVAD insertion or replacement, the engine checks the documented indication, FDA approval/on-label use, NYHA class, LVEF, hemodynamic path, medical-management or temporary-support duration, multidisciplinary team, facility credentialing, and informed decision support. A missing criterion creates a hold rather than a coverage conclusion.

## Facility coding

The inpatient pathway uses the date-effective CMS ICD-10-PCS order file and tables. It can identify complete support candidates such as central or peripheral VV/VA ECMO when all required facts are present. Cannula vessel procedures and device replacement objectives remain held unless the full operative note supports each required PCS character and distinct root operation.

## Document understanding

The authenticated upload endpoint accepts PDF, PNG, and JPEG files. Visual OCR reviews operative reports, perfusion records, daily ECMO/VAD notes, cath-lab records, interrogation reports, decannulation notes, and handwriting. Every extracted item retains page, confidence, and evidence and enters the workspace as unverified.

## API

- `GET /api/vad-ecmo/references`
- `POST /api/vad-ecmo/documents/extract`
- `POST /api/vad-ecmo/evaluate`

All endpoints require an authenticated user. Evaluation does not submit claims.

## Data

Migration `0012_vad_ecmo_coder.sql` creates versioned sources, policy, code/rule catalog, case, document, service, diagnosis, coverage, decision, NCCI, approval, and audit tables in Cloudflare D1.

## Release boundaries

- Current licensed CPT verification is required for professional candidates.
- Current PCS tables and date-effective IPPS grouper files are required for inpatient facility release.
- Payer policy and current NCCI review are mandatory.
- Coverage and diagnosis are never inferred.
- Human coder approval is mandatory.
- Autonomous claim submission is disabled.
