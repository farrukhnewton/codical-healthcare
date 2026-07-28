# PGx R2 Storage

## Contract

Objects use opaque keys:

```text
pgx/{environment}/{tenant_id}/{user_id}/{analysis_id}/{object_id}
```

No patient name, DOB, MRN, filename, or accession belongs in a key. Buckets remain private. Downloads use a user-prefix ownership check and a five-minute signed GET URL. Deletion also checks the owning prefix.

The existing credentials can read `codical-mcd-raw` and `codical-user-files`. They cannot list all account buckets, and Wrangler lacks a Cloudflare management API token. `codical-user-files` was not silently activated for PGx.

## Activation requirements

- Exact bucket or approved private prefix.
- `PGX_STORAGE_ENV` and `PGX_DEFAULT_TENANT_ID`.
- Retention days and lifecycle rule.
- Malware-scan/failed-upload cleanup hook.
- Verified public-access disabled state.
- Cloudflare token with least privilege for configuration inspection.
- PHI/BAA and incident/backup gates where real PHI is intended.
