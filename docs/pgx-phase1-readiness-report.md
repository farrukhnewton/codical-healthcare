# PGx Phase 1 Readiness Report

Date: 2026-07-28
Verdict: **ready as a local foundation; not ready for production PHI or coverage decisions**

## Implemented

- Extensible Specialty Coding module registry.
- Collapsible sidebar section placed before Reports and Settings.
- `/specialty` Specialty Hub.
- `/specialty/pgx` four-step workspace.
- Authenticated extract, analyze, claim-preview, save, list, read, update, and delete routes.
- User ownership filters for stored analyses.
- Native PDF/TXT extraction and manual text input.
- Private R2 adapter that now fails closed without explicit PGx bucket/environment/tenant configuration.
- PGx schema and forward migration.
- Starter gene and gene-drug evidence references with clear decision-support limitations.
- Automatic charge population disabled.
- Claim submission and 837 generation absent.
- Guessed CMS coverage group rows disabled.

## Local validation

- `npm run check`: passed before this preflight and must be rerun at closure.
- `npm run build`: passed before this preflight and must be rerun at closure.
- Engine safety smoke test: passed; unverified ICD results remained review-only and service-line charges were `null`.
- Migration `0005`: applied twice successfully to disposable PostgreSQL 16.
- Migration inventory: 5 tables, 12 indexes, 2 foreign keys, RLS enabled on 5 tables.
- Playwright Chromium/FFmpeg binaries: installed locally.

## Not ready

- No confirmed MAC/state jurisdiction.
- No approved PGx R2 bucket or retention setting.
- No configured PHI mode/BAA/security gate record.
- No configured CPT-license reference.
- No approved OCR provider; images are not extracted.
- No signed object download or object deletion workflow.
- No tenant model; existing ownership is user-only.
- No authoritative PGx-specific CMS import run.
- No immutable PGx audit-event table.
- No authenticated browser account supplied for full workflow QA.

## Release rule

Production and remote actions remain blocked. Only synthetic or de-identified data may be used locally.
