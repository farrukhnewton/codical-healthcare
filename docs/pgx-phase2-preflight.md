# PGx Phase 2 Preflight

Date: 2026-07-28
Repository: `C:\Farrukh\.gemini\antigravity\scratch\codical-healthcare`
Branch: `phase1-dashboard-overview-restyle`
Baseline commit: `4c4a869b7412e38c730e2cc6d8cca34bc8f767c7` (`Unify dashboard tool page UI`)

## Current implementation status

The Phase 1 foundation exists locally and includes the Specialty Coding registry, collapsible navigation, `/specialty`, `/specialty/pgx`, PGx extraction/matching/claim-preview APIs, authenticated record ownership, a private-R2 adapter, and migration `0005_pgx_phase1_schema.sql`.

The worktree also contains an unrelated untracked `.vscode/` directory. It is outside PGx scope and must remain untouched.

Phase 2 is not approved to cross an environment boundary until the missing values below are supplied. In particular, no CMS group may be treated as a coverage result before a versioned, jurisdiction-filtered import passes its gates.

## Runtime and dependencies

- Node: `v24.14.0`
- npm: `11.9.0`
- PostgreSQL test runtime: Docker Engine `29.6.2`, disposable `postgres:16-alpine`
- Playwright: `1.61.0`
- Playwright Chromium, headless shell, and FFmpeg: installed in the user Playwright cache on 2026-07-28
- Native `psql`: not installed; Docker supplies the migration test client
- Native/local OCR: not installed and not approved
- Malware scanner: no configured implementation or contract
- PDF extraction: `pdf-parse` native text only
- Manual extraction: supported through pasted text
- Image OCR: not implemented; PNG/JPG cannot produce claim-bound fields

Installed packages used by PGx include `@aws-sdk/client-s3`, `multer`, `pdf-parse`, `pdfkit`, `pg`, `drizzle-orm`, `zod`, `@supabase/supabase-js`, and `playwright`. A private signed-URL package and an approved OCR provider are not configured.

## Environment-variable contract

Variables already represented in the local environment files:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_BUCKET_MCD_RAW`
- `R2_BUCKET_USER_FILES`
- `CLOUDFLARE_MCD_API_URL`
- `CLOUDFLARE_NCCI_API_URL`

Required PGx settings that are not configured:

- `R2_BUCKET_PGX`
- `PGX_STORAGE_ENV`
- `PGX_DEFAULT_TENANT_ID`
- `PGX_R2_RETENTION_DAYS`
- `PGX_PHI_MODE`
- `PGX_EXTRACTION_PROVIDER`
- `PGX_TARGET_MAC`
- `PGX_TARGET_STATES`
- `PGX_CPT_LICENSE_REFERENCE`

Secret values must remain in approved secret stores or ignored local environment files. Documentation and logs record only whether a value exists, never its value.

## Database environment and migration plan

The configured `DATABASE_URL` resolves to remote Supabase, not a local database. It was not used for PGx migration work.

Migration `0005_pgx_phase1_schema.sql` was validated twice against a disposable local PostgreSQL 16 container. Validation result: five PGx tables, twelve indexes, two foreign keys, and RLS enabled on all five PGx tables. The second apply passed, confirming idempotent local application.

Remote migration is blocked pending explicit target-environment confirmation, backup/snapshot evidence, migration dry-run, RLS review in Supabase, and production confirmation if applicable.

## Source contracts

Target source families:

- CMS Medicare Coverage Database current and historical Article/LCD data, including A59915 and L39995
- CMS contractor and jurisdiction relationships
- CPIC guideline and gene-drug metadata
- FDA pharmacogenomic association/label references
- Versioned ICD-10-CM source data
- CPT content restricted to the organization's configured license reference

Existing repository MCD data already models article versions, code groups, contractor links, and R2 coverage shards. PGx must reuse those authoritative structures rather than create a second guessed coverage map.

## Target MAC/state coverage

`PGX_TARGET_MAC` and `PGX_TARGET_STATES` are missing. Coverage evaluation must return `jurisdiction_not_configured` until both the user/tenant jurisdiction and applicable source jurisdiction are known.

## PHI readiness

PHI mode is not configured. The repository contains no PGx-specific BAA reference, approved extraction-provider record, retention/deletion approval, incident-response linkage, or backup approval. PGx must therefore operate in synthetic/de-identified mode only. No real PHI may be used for tests or screenshots.

## CPT licensing boundary

The prompt states organizational review occurred, but the repository has no configured `PGX_CPT_LICENSE_REFERENCE`. Until that reference is supplied, Phase 2 may store code identifiers and internal metadata already within approved scope, but must not ingest or reproduce additional proprietary CPT descriptions or guidance.

## R2 plan

The Cloudflare account and general R2 credentials exist, but no PGx bucket, environment, tenant, or retention setting is configured. The PGx adapter now fails closed unless all required PGx settings exist. Planned keys are opaque and contain no patient identifiers:

`pgx/{environment}/{tenant_id}/{user_id}/{analysis_id}/{object_id}`

Remote R2 creation/modification is blocked until bucket, environment, private access, token scope, retention, deletion, incident, backup, and PHI approvals are confirmed.

## Deployment plan

The repository is linked to the Vercel project `codical-healthcare`, but no deployment target was explicitly confirmed for this run. No push or deployment is permitted. After local gates pass, release must proceed through backup, migration, R2, secret, health-check, and rollback gates.

## Stop conditions currently active

- target MAC/state missing;
- CPT-license configuration reference missing;
- PHI approval configuration missing;
- PGx R2 bucket/environment/tenant/retention missing;
- extraction provider not configured beyond native PDF/manual mode;
- configured database is remote and target is unconfirmed;
- browser session authentication for end-to-end QA is not available yet.

These conditions block the corresponding remote or production operation. They do not block local compilation, fixture tests, disposable migration tests, or documentation.
