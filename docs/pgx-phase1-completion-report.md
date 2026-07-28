# PGx Phase 1 Completion Report

Date: 2026-07-28
Status: **foundation complete; operational closure partially blocked**

## Dependency closure

All Phase 1 compile/runtime packages are installed. Playwright Chromium, headless shell, and FFmpeg were installed locally for QA. Native OCR, a malware scanner, and an external extraction provider were deliberately not installed because no approved provider/configuration exists.

## Migration closure

`migrations/0005_pgx_phase1_schema.sql` is forward-only and non-destructive. It creates PGx reference and analysis tables, indexes, ownership foreign keys, comments, and fail-closed RLS. It passed two consecutive applications against disposable PostgreSQL 16.

No remote database was modified. The configured database is remote Supabase and its target environment was not explicitly confirmed.

Rollback for local testing is container disposal. A production rollback must use a pre-migration snapshot plus a forward repair migration; the existing migration must never be rewritten after release.

## Security closure

- API authentication is required for PGx processing and persistence.
- Analysis reads, updates, and deletes include the authenticated user ID.
- PGx R2 uploads fail closed unless bucket, environment, tenant, endpoint, and credentials are configured.
- Object keys use opaque IDs and no longer include uploaded filenames or patient identifiers.
- No automatic charges, claim submission, or guessed CMS group matches are enabled.

## Remaining closure gates

- Authenticated browser workflow and accessibility QA.
- Unsupported/malformed/oversized/MIME-spoof fixture coverage.
- Idempotent save and duplicate-upload protection.
- Signed URL expiration and R2 isolation tests.
- Tenant-level authorization and immutable audits.
- Confirmed local-to-remote migration target, backup, and RLS verification.

## Checkpoint scope

The Phase 1 checkpoint includes only PGx/Specialty files and PGx readiness documentation. The unrelated `.vscode/` directory is excluded.
