# Cloudflare MCD Foundation

This project keeps Supabase for authenticated app data while moving the large public CMS Medicare Coverage Database reference data to Cloudflare services.

## Resources

- Cloudflare account: `7dc964fd2f9e2385f0eca8850ddfc76e`
- D1 database: `codical_mcd`
- D1 database ID: `91b644d8-174f-485b-89ee-4a59464c2141`
- R2 raw CMS bucket: `codical-mcd-raw`
- R2 user files bucket: `codical-user-files`

## Current Role Split

- Supabase: auth, user profiles, chat, saved user reports, existing app data.
- Cloudflare D1: public CMS MCD read model, search indexes, coverage/crosswalk data.
- Cloudflare R2: raw CMS files, NCCI lookup shards, and later large user files such as PDFs/audio/avatars.
- Cloudflare Workers/Pages: future API/frontend hosting target.

## Commands

```powershell
npm run cf:verify
npm run cf:d1:migrate
npm run cf:d1:tables
npm run cf:ncci:deploy
npm run cf:mcd:deploy
npm run r2:upload-mcd:dry
npm run r2:upload-mcd
npm run r2:export-ncci:dry
npm run r2:export-ncci
npm run cf:import-mcd-current:dry
npm run cf:import-mcd-current
```

The R2 upload script defaults to the local CMS folder:

```text
C:\Users\TekSoft\Downloads\all_data
```

It writes a local manifest to `scratch/cloudflare/` for audit/retry tracking.
Object uploads are forced to remote R2 with Wrangler's `--remote` flag. Without that flag, Wrangler can write to a local development R2 store instead of the Cloudflare bucket.

## Import Strategy

Do not copy the raw CMS tables directly into D1. The D1 schema is a compact read model designed around app features:

- coverage documents
- contractors and jurisdictions
- reusable code dictionary
- document-code relationships
- coverage rules
- derived ICD-to-CPT/HCPCS crosswalk
- FTS search index

The next phase should build the local transform into D1-sized SQL batches and import them using Wrangler.

## MCD Current Import

Phase 2A imports the current public CMS MCD read model into Cloudflare:

- D1 database: `codical_mcd`
- Worker: `https://codical-mcd-api.farrukhnewton.workers.dev`
- R2 coverage prefix: `mcd/current/v1/coverage/articles/`

Imported into D1:

- current Article metadata
- current LCD metadata
- NCD tracking metadata
- CPT/HCPCS code dictionary
- document-to-CPT/HCPCS links
- code groups
- document URLs and relationships
- FTS search rows

Kept in R2 shards:

- Article HCPCS groups
- covered ICD-10-CM groups
- non-covered ICD-10-CM groups
- related LCD/NCD references

The large ICD rows are intentionally not written to D1 in this phase. This keeps D1 small and avoids free-tier write/storage pressure while preserving ICD evidence for the crosswalk phase.

Current import counts:

- Articles: 2,002
- LCDs: 940
- NCD rows: 357
- D1 documents: 3,299
- D1 CPT/HCPCS codes: 5,866
- D1 document-code rows: 20,554
- R2 article coverage shards: 2,002
- ICD rows inside R2 shards: 431,120 covered and 45,352 non-covered
- D1 size after import: about 40.5 MB

MCD Worker endpoints:

```text
/health
/api/mcd/search?q=arthroscopic+knee
/api/mcd/code?code=29877
/api/mcd/document?displayId=A52369
/api/mcd/article-coverage?articleId=52369&version=16
```

App integration:

- `/api/coverage/lcd`, `/api/coverage/ncd`, and `/api/coverage/articles` read from the MCD Worker first.
- `/api/coverage/lcd/search/smart`, `/api/unified/search`, and `/api/intel/:code` use the Cloudflare read model for coverage evidence.
- The live CMS Coverage API remains as a fallback when `CLOUDFLARE_MCD_API_URL` is missing or the Worker is unavailable.

## Phase 2 Coverage Intelligence

First slice:

- `/api/intel/:code` enriches Cloudflare MCD article matches with the article coverage shard from R2.
- Matching is based on the same article/version/group relationship between the requested CPT/HCPCS code and CMS ICD-10 groups.
- Code Intel displays covered and non-covered ICD-10 counts plus capped sample diagnosis codes for the matched group.
- `/api/coverage/pair/check?code=29877&icd=M17.0` performs an on-demand pair check and returns covered, non-covered, mixed, or not-found evidence.
- `/api/coverage/pair/batch` validates multiple ICD-to-procedure pairs for AI workflows and Coverage Hub.
- AI OP Report Coding and AI Transcription attach `coverage_validation` / `coverageValidation` payloads when suggested CPT/HCPCS and ICD-10 codes are available.
- Coverage Hub includes an interactive ICD-to-procedure evidence checker backed by the batch endpoint.
- Product language should remain "coverage-derived intelligence"; this is not an official CMS crosswalk.

## NCCI Migration

The large Supabase NCCI tables were migrated to R2 shards served by a Worker:

- Worker: `https://codical-ncci-api.farrukhnewton.workers.dev`
- R2 prefix: `ncci/v1`
- Source tables removed from Supabase: `ncci_practitioner`, `ncci_outpatient`

The application route `/api/ncci/check` calls the Worker first through `CLOUDFLARE_NCCI_API_URL`. `/api/ncci/batch` checks all unique CPT/HCPCS pairs in an AI suggestion set and is attached to AI OP Report Coding and AI Transcription when two or more procedure candidates are available. The NCCI Checker page supports both single-pair checks and batch procedure-set review. Supabase is only a temporary fallback path in code for local recovery.
