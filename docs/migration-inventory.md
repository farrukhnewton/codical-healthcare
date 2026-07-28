# Migration Inventory

- `0000_previous_knowledge.sql`: baseline application schema.
- `0001_unify_app_schema.sql`: unified application structures.
- `0002_chat_realtime.sql`: chat/realtime structures.
- `0003_payer_policy_ingestion.sql`: payer policy ingestion.
- `0004_saved_ai_files.sql`: saved AI file records.
- `0005_pgx_phase1_schema.sql`: PGx current-reference and user-analysis foundation.
- `0006_pgx_phase2_evidence_workflow.sql`: tenant-scoped intake/review, versioned evidence, MAC/jurisdiction coverage, previews, exports, and audits.

`0006` was applied twice successfully to disposable PostgreSQL 16. It is forward-only and has not been applied remotely.
