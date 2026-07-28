# PGx PHI and Security Policy

User approval alone is not evidence that HIPAA contractual and operational controls are active. `PGX_PHI_MODE` remains disabled until all of these are recorded:

- BAAs for every PHI-processing vendor.
- Approved extraction provider and data-use configuration.
- Encryption and least-privilege access verification.
- Immutable audit and ownership test results.
- Retention, deletion, backup, and restoration approval.
- Incident-response owner and process.
- Log, analytics, telemetry, screenshot, and URL PHI review.
- Malware scanning and quarantine behavior.

Until then, only synthetic or de-identified reports may be used. Service credentials stay server-side. Source filenames and PHI never appear in R2 keys. Exports expire and are audited. Formula-like CSV values are prefixed to prevent spreadsheet execution.

The migration enables RLS on all 27 PGx tables. Global evidence tables have no direct authenticated policy; server access is required. User-scoped tables use membership and Supabase-user ownership checks.
