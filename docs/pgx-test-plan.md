# PGx Test Plan

## Automated local gates

- `npm run check`, `npm run typecheck`, and `npm run lint` compile the project.
- `npm test` covers intake signatures, malformed/encrypted PDFs, coverage states, no guessed diagnoses/charges, CSV neutralization, audit hashing, and fixture CMS import.
- `npm run test:e2e` statically verifies authenticated API ownership and R2/preview invariants.
- `npm run test:a11y` statically verifies routes, workflow landmark, labels, buttons, and alert semantics.
- `npm run test:migrations` applies Phase 1 + Phase 2 twice on disposable PostgreSQL 16 and checks tables, RLS, and immutable triggers.
- `npm run pgx:import-cms:dry` parses the complete official local CMS source set.
- `npm run build` creates the production bundle.

## Not yet satisfied

- Authenticated real-browser E2E, screenshot, keyboard, screen-reader, mobile, and axe validation.
- Cross-user/cross-tenant live API and R2 signed-URL expiry tests.
- Malware scanner, cleanup job, OCR provider, and PHI leakage tests.
- Staging migration, bounded remote CMS verification, backup/restore, and rollback drill.

Static contract tests do not substitute for browser or authorization integration tests.
