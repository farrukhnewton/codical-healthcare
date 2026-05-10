# Production Operations

## Cloudflare MCD Coverage

Local Cloudflare verification:

```bash
npm run cf:verify
```

Deploy the MCD Worker after D1/R2 data is current:

```bash
npm run cf:mcd:deploy
```

The Vercel production runtime must have these server-side variables:

```text
CLOUDFLARE_MCD_API_URL=https://codical-mcd-api.<workers-subdomain>.workers.dev
CLOUDFLARE_NCCI_API_URL=https://codical-ncci-api.<workers-subdomain>.workers.dev
```

The Socket.IO client is disabled by default on Vercel production. Keep this unset or false unless the deployment target supports Socket.IO:

```text
VITE_SOCKET_IO_ENABLED=false
```

After changing Vercel environment variables, redeploy production so the runtime receives the new values.

## Production Smoke Test

The smoke script uses environment variables only. Do not commit test credentials.

Required:

```text
PROD_BASE_URL=https://codical-healthcare.vercel.app
PROD_SMOKE_EMAIL=<test account email>
PROD_SMOKE_PASSWORD=<test account password>
VITE_SUPABASE_URL=<supabase url>
VITE_SUPABASE_ANON_KEY=<supabase anon key>
```

Optional:

```text
PROD_SMOKE_REQUIRE_MCD=true
PROD_SMOKE_INCLUDE_AI=true
```

Run locally:

```bash
npm run smoke:prod
```

What it checks:

- production health endpoint
- Supabase password login
- concurrent `/api/chat/me` user sync
- Claim Validator NCCI result
- Cloudflare MCD coverage availability, warning by default and failure when `PROD_SMOKE_REQUIRE_MCD=true`
- saved claim validation create, PDF export, and cleanup
- optional Gemini-backed AI Coder analysis

## GitHub Manual Workflow

The manual workflow is `.github/workflows/production-smoke.yml`.

Add these GitHub Actions secrets before running it:

```text
PROD_SMOKE_EMAIL
PROD_SMOKE_PASSWORD
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Use the `require_mcd` input after Vercel production has `CLOUDFLARE_MCD_API_URL` configured.
