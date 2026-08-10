# Cardiac Cath & PCI Coding Engine

## Why this module

The existing specialty suite covered molecular diagnostics, burns, transport, transplant, substance-use treatment, E/M, risk adjustment, infusion, NICU, extracorporeal support, and CABG. The largest adjacent coding gap was the catheterization laboratory: it combines anatomy-specific professional coding, same-session diagnostic bundling, facility-setting differences, device-dependent inpatient PCS, and unusually consequential NCCI/add-on edits. It also extends the CABG pathway without duplicating it.

## Researched workflow improvements

- Keep professional CPT, hospital-outpatient CPT/HCPCS, and inpatient ICD-10-PCS as three explicit claim scopes.
- Select a single inclusive diagnostic catheterization family from documented components.
- Hold same-session diagnostic catheterization unless the current CMS diagnostic/repeat-study exception is documented.
- Use one hierarchy-selected PCI family per major native coronary artery or named bypass graft.
- Apply the 2026 lesion-count distinction between the single-lesion and multiple-lesion stent families.
- Support the new 2026 multiple-lesion stent and combined antegrade/retrograde CTO families; block retired branch add-ons.
- Require source-verified LM, LD, LC, RC, or RI territory instead of auto-inventing modifiers.
- Sequence IVUS/OCT and physiology initial/additional-vessel candidates, while retaining current AOC, MUE, and PTP review.
- Treat access, catheter navigation, routine imaging, embolic protection, and closure-device work according to current integral/packaged controls.
- Build inpatient PCS Dilation candidates independently from coronary-artery count, approach, device type/count, and bifurcation qualifier.
- Never infer a diagnosis, medical necessity, coverage, payment, MS-DRG, or submission authority.

## Current source baseline

Effective baseline: July/Q3 2026 for PFS and NCCI; April 1, 2026 for ICD-10-PCS. Primary sources are exposed by the authenticated `/api/cath-pci/references` endpoint and seeded into Cloudflare D1 migration `0014_cath_pci_engine.sql`.

Core sources include CMS PFS RVU26C, PCI article A57479, cardiac catheterization article A52850, PCI LCD L34761, cath LCD L33557, the 2026 NCCI manual, Q3 2026 PTP/MUE/AOC files, the April 2026 ICD-10-PCS release, the Medicare Coverage Database, and current licensed CPT guidance.

## Safety boundary

OCR extracts candidate facts with page-level evidence and confidence but deliberately leaves every billing fact unverified. The engine creates a coder-review worksheet only. All release paths retain date-effective payer policy, licensed code-set, current edit, facility grouper/OCE where applicable, and human approval gates.
