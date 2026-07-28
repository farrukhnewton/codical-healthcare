# Manual Action Log

## Completed

- Installed official Node.js LTS 24.18.0 per-user with WinGet. Close and reopen PowerShell/Antigravity terminals before testing `node -v`, `npm -v`, and `npm run dev`.

## Required from the account owner

- Authenticate Wrangler with `wrangler login`, or add a least-privilege `CLOUDFLARE_API_TOKEN` outside Git.
- Provide or approve the exact staging Supabase branch connection as `PGX_CMS_DATABASE_URL`.
- Confirm PGx tenant ID, private bucket/prefix, retention days, and deletion/incident/backup owners.
- Configure `PGX_CPT_LICENSE_REFERENCE` to the organization’s real license record.
- Provide an approved QA account email/password through the secret environment variables, or create a test account and supply it securely.
- Supply contractual/security evidence before enabling `PGX_PHI_MODE`.
- Give final in-session production confirmation only after staging and all release gates pass.
