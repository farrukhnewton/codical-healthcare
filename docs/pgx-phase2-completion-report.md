# PGx Phase 2 Completion Report

Date: 2026-07-28
Status: local foundation implemented; remote/staging/production release blocked

## Completed locally

- Forward-only Phase 2 migration with 27 PGx tables and RLS on all 27.
- Tenant membership, source intake, extraction fields, review decisions, source/version lineage, all-MAC jurisdiction model, CMS import history, CPIC/FDA evidence, coverage review, claim preview, exports, and immutable audit events.
- Extension/MIME/signature intake validation and five-minute user-scoped R2 signed URLs.
- Removal of inferred diagnoses, hard-coded monetary reference values, and affirmative “covered” terminology.
- Official CMS fixture and complete local-source dry runs with zero quarantine; the May 7 source package is correctly blocked as outdated for remote import.
- Named test scripts, production build, and zero production npm vulnerabilities.
- Official per-user Node.js LTS installation to restore `npm` in new terminals.

## Not completed

- No Phase 2 migration was applied to Supabase.
- No Cloudflare bucket, lifecycle, or D1 change was made.
- No staging/preview deployment, push, or production deployment occurred.
- Field-level review UI, coverage selector/read model, persisted exports, cleanup jobs, CPIC/FDA importer, approved OCR/malware integration, and real-browser QA remain open.
- PHI mode remains disabled.

The Phase 2 checkpoint must not be labeled complete or pushed until the remaining release gates pass.
