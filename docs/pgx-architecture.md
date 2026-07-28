# PGx Architecture

## Boundaries

The browser accesses authenticated Express routes. Express enforces user ownership and is the only component allowed to use service credentials. PostgreSQL stores workflow state, versioned evidence, jurisdiction relationships, previews, exports, and immutable audit events. Private R2 stores source documents and temporary exports using opaque keys.

CMS, CPIC, FDA, ICD-10-CM, CPT, and HCPCS evidence are versioned separately. Clinical actionability does not imply payer support. CMS support is evaluated only after service state/territory, MAC, date of service, source version, and code-group relationship are selected.

## Safety invariants

- No claim submission or 837 generation.
- No automatic charge or reimbursement value.
- No inferred diagnosis when source documentation is absent.
- No universal A59915/L39995 result.
- No anonymous PGx database or API access.
- Low-confidence content requires review before claim-bound use.
- Prior evidence versions and audit events are immutable.

Migration `0006_pgx_phase2_evidence_workflow.sql` implements the database boundary. `server/pgx-phase2.ts` implements intake and coverage-state controls. `server/pgx-cms-importer.ts` implements the source parser and jurisdiction plan.
