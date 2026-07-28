# PGx CMS Importer

## Source contract

`scripts/import-pgx-cms.ts` reads the official CMS MCD current Article/LCD CSV contract. It validates exactly one current A59915 and L39995, hashes the complete source set and header contract, loads all source MAC versions and jurisdiction rows, and then attaches only source-linked jurisdictions to the target documents.

Dry run on 2026-07-28:

- 120 MAC-version rows.
- 291 MAC-jurisdiction rows.
- 44 A59915/L39995 document-jurisdiction links.
- 10 normalized target states: CT, IL, MA, ME, MN, NH, NY, RI, VT, WI.
- 1,104 target code rows.
- 0 quarantined rows.
- Source package acquired 2026-05-07 and therefore `outdated` at the 45-day release gate.

CMS sub-state codes DN, QN, and UN retain their source code while normalizing to NY. CNMI retains its source code while normalizing to the USPS MP service-area code.

## Modes and safety

Dry-run is the default. Remote execution requires a source package acquired within 45 days and a dedicated `PGX_CMS_DATABASE_URL`; generic `DATABASE_URL` is never a fallback. Staging/production target and approval flags are required. Production additionally requires a CLI confirmation and production confirmation environment gate. Existing identical runs are duplicate no-ops. Writes are transactional; prior versions are preserved.

Official source: https://www.cms.gov/medicare-coverage-database/downloads/downloads.aspx
