# Codical Healthcare

Codical Healthcare is an authenticated medical-coding workspace built with React, Express, PostgreSQL/Supabase, Cloudflare services, and Vercel.

## Local development

Install Node.js LTS, copy `.env.example` to an ignored `.env`, configure the required values, then run:

```powershell
npm install
npm run dev
```

The development server prints its local URL. PGx remains synthetic/de-identified unless every gate in `docs/pgx-phi-security.md` is independently satisfied.

## PGx commands

```powershell
npm run check
npm test
npm run test:migrations
npm run pgx:import-cms:dry
npm run build
```

`npm run pgx:import-cms` is fail-closed. It requires a dedicated `PGX_CMS_DATABASE_URL`, target environment, approval flag, and an additional production confirmation flag for production.

See `docs/pgx-architecture.md` and `docs/pgx-phase2-completion-report.md` for current scope and blocked release gates.
