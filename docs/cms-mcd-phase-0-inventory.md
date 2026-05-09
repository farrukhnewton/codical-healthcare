# CMS MCD Phase 0 Inventory

Source path inspected: `C:\Users\TekSoft\Downloads\all_data`

Phase 0 status: completed inventory and import planning only. No Supabase tables, migrations, app code, or production data were changed.

## Source Structure

The local CMS MCD download contains five dataset groups:

| Dataset | Local source | CSV availability | Notes |
| --- | --- | --- | --- |
| Current Article | `current_article/current_article_csv.zip` | Zip only | Extract before manual Supabase upload. |
| All Article | `all_article/all_article_csv/` | Extracted CSV folder | Historical article versions included. |
| Current LCD | `current_lcd/current_lcd_csv/` | Extracted CSV folder | Current operational LCD records. |
| All LCD | `all_lcd/all_lcd_csv/` | Extracted CSV folder | Historical LCD versions included. |
| NCD | `ncd/ncd_csv.zip` | Zip only | Extract before manual Supabase upload. |

The `.mdb` files are present but should be treated as fallback only. The CSVs are the best source for import.

One source file needs upload preparation: `current_lcd/current_lcd_csv/lcd_x_requestor_letters.csv` is missing its header row. Phase 1 creates a header-corrected upload copy before Supabase import.

## Corrected CSV Counts

These counts are quote-aware CSV record counts. Several CMS files contain multi-line HTML fields, so physical line counts are misleading.

| Dataset | CSV tables | Rows | Size |
| --- | ---: | ---: | ---: |
| Current Article | 37 | 575,139 | 110.70 MB |
| All Article | 37 | 638,408 | 122.92 MB |
| Current LCD | 30 | 35,910 | 50.45 MB |
| All LCD | 30 | 38,329 | 55.24 MB |
| NCD | 4 | 1,076 | 1.92 MB |

## Key Current Article Tables

| CSV table | Rows | Purpose |
| --- | ---: | --- |
| `article` | 2,002 | Article metadata, title, dates, policy text, display ID. |
| `article_x_hcpc_code` | 18,158 | CPT/HCPCS codes attached to articles and code groups. |
| `article_x_hcpc_code_group` | 1,875 | HCPCS/CPT group paragraphs. |
| `article_x_icd10_covered` | 431,120 | Covered ICD-10 diagnosis rows by article/version/group. |
| `article_x_icd10_covered_group` | 2,373 | Covered ICD-10 group paragraphs. |
| `article_x_icd10_noncovered` | 45,352 | Non-covered ICD-10 diagnosis rows by article/version/group. |
| `article_x_icd10_noncovered_group` | 1,215 | Non-covered ICD-10 group paragraphs. |
| `article_x_contractor` | 27,064 | Article to MAC/contractor linkage. |
| `article_related_documents` | 6,572 | Article to LCD/article relationships. |
| `article_related_ncd_documents` | 4,690 | Article to NCD relationships. |
| `article_x_revision_history` | 10,867 | Revision history. |

Primary join shape:

```text
article.article_id + article.article_version
  -> article_x_hcpc_code.article_id + article_version + hcpc_code_group
  -> article_x_icd10_covered.article_id + article_version + icd10_covered_group
  -> article_x_icd10_noncovered.article_id + article_version + icd10_noncovered_group
```

This is the foundation for the coverage-derived ICD-to-CPT/HCPCS crosswalk.

## Key Current LCD Tables

| CSV table | Rows | Purpose |
| --- | ---: | --- |
| `lcd` | 940 | LCD metadata, title, status, full policy text, evidence, dates, display ID. |
| `lcd_x_hcpc_code` | 2,396 | CPT/HCPCS codes attached to LCDs and groups. |
| `lcd_x_hcpc_code_group` | 114 | LCD HCPCS/CPT group paragraphs. |
| `lcd_x_contractor` | 12,856 | LCD to MAC/contractor linkage. |
| `lcd_related_documents` | 5,463 | LCD to article/LCD relationships. |
| `lcd_related_ncd_documents` | 2,472 | LCD to NCD relationships. |
| `lcd_x_revision_history` | 7,823 | Revision history. |

LCD data strengthens code intelligence, coverage pages, jurisdiction filtering, and evidence display. It does not directly contain ICD-10 rows in the same structured way as Article data.

## NCD Tables

| CSV table | Rows | Purpose |
| --- | ---: | --- |
| `ncd_trkg` | 357 | NCD tracking metadata, manual section, title, dates, indication/limitation text, revision history. |
| `ncd_trkg_bnft_xref` | 599 | NCD to benefit category cross-reference. |
| `ncd_bnft_ctgry_ref` | 78 | Benefit category lookup. |
| `ncd_pblctn_ref` | 42 | Publication lookup. |

NCD should be used first for document/reference intelligence and relationships. The supplied NCD package is not a CPT/ICD crosswalk source by itself.

## Crosswalk Feasibility Finding

Current Article alone provides enough structured data for a distinct app feature:

| Metric | Value |
| --- | ---: |
| Current articles | 2,002 |
| Article versions with both HCPCS/CPT and covered ICD data | 901 |
| Unique CPT/HCPCS codes in current articles | 4,124 |
| Covered ICD-10 rows | 431,120 |
| Unique covered ICD-10 codes | 56,661 |
| Estimated same-group covered ICD-to-CPT/HCPCS pairs | 5,648,714 |
| Estimated same-group non-covered pairs | 1,241,904 |

Product language should be: **CMS coverage-derived ICD-to-CPT/HCPCS intelligence**. It should not be described as an official CMS crosswalk.

## Recommended Import Architecture

Use two layers.

### 1. Raw/Staging Layer

Purpose: preserve CMS files exactly and make uploads auditable.

Recommended naming pattern:

```text
stg_mcd_current_article_<csv_table_name>
stg_mcd_all_article_<csv_table_name>
stg_mcd_current_lcd_<csv_table_name>
stg_mcd_all_lcd_<csv_table_name>
stg_mcd_ncd_<csv_table_name>
```

Column strategy:

- Every CMS CSV column should be imported as `text` in staging.
- Add optional metadata columns with defaults only:
  - `id uuid primary key default gen_random_uuid()`
  - `import_batch_id uuid`
  - `source_file text`
  - `source_dataset text`
  - `imported_at timestamptz default now()`
  - `raw_row_hash text`

For manual Supabase CSV upload, the CMS columns must match the CSV headers exactly. Metadata columns must be nullable or defaulted so the upload does not fail.

### 2. Clean Application Layer

Purpose: fast app queries, crosswalk, validation, AI context, and search.

Recommended clean tables:

| Table | Purpose |
| --- | --- |
| `mcd_import_batches` | Track import source, date, status, row counts, checksum. |
| `mcd_contractors` | Normalized contractor/MAC records. |
| `mcd_states` | State and region lookup. |
| `mcd_contractor_jurisdictions` | Contractor to state/jurisdiction mapping. |
| `mcd_documents` | Unified LCD, Article, and NCD document table. |
| `mcd_document_contractors` | Document to contractor/MAC mapping. |
| `mcd_document_jurisdictions` | Document to state/jurisdiction mapping. |
| `mcd_document_urls` | CMS and related URLs. |
| `mcd_document_relationships` | Article/LCD/NCD related-document links. |
| `mcd_document_revisions` | Revision history across document types. |
| `mcd_code_groups` | Article/LCD group paragraphs. |
| `mcd_document_codes` | CPT, HCPCS, ICD-10, modifier, revenue, bill code rows. |
| `mcd_coverage_rules` | Materialized article coverage rules by code, group, contractor, jurisdiction. |
| `mcd_icd_cpt_crosswalk` | Materialized ICD-to-CPT/HCPCS intelligence with evidence/confidence. |
| `mcd_search_index` | Precomputed search rows for app search and coverage hub. |

## Existing App Integration Points

Later phases should modify these existing systems:

| Area | Current file/API | Upgrade |
| --- | --- | --- |
| Coverage hub | `client/src/pages/IntelligenceHub.tsx`, `/api/coverage/*` | Use local MCD database first, live CMS API as fallback. |
| Code Intelligence | `client/src/pages/CodeIntel.tsx`, `/api/intel/:code` | Add LCD/article/NCD coverage evidence, related ICDs, contraindications. |
| Unified Search | `client/src/components/layout/UnifiedSearch.tsx`, `/api/unified/search` | Search local LCD/article/NCD and crosswalk results. |
| AI OP Report Coding | `client/src/pages/Workspace.tsx`, `/api/workspace/analyze` | Validate suggested CPT/HCPCS against diagnoses and coverage evidence. |
| AI Transcription | `client/src/pages/VoiceTranscription.tsx` | Offer coverage-aware coding suggestions from transcript diagnoses/procedures. |

## Phase 1 Recommendation

Do not import all historical data first.

Start with **Current Article + Current LCD + NCD**:

1. Create staging tables for current article, current LCD, and NCD CSVs.
2. Import those CSVs.
3. Build clean `mcd_documents`, `mcd_document_codes`, relationships, contractors, and jurisdictions.
4. Build `mcd_icd_cpt_crosswalk` from current article structured groups.
5. Wire read-only APIs and UI into existing app.

After the current-data workflow is verified, import **All Article + All LCD** for historical date-of-service validation and policy timelines.

## Manual Upload Preparation

Before Phase 1 table creation, extract:

```text
C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv.zip
C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv.zip
```

The extracted folders should become:

```text
C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\
C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv\
```

Then the CSV folders are ready for table-by-table upload after Supabase staging SQL is generated.
