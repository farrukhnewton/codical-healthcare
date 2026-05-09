# CMS MCD Phase 1 Upload Guide

Phase 1 creates Supabase staging tables for Current Article, Current LCD, and NCD, plus empty optimized application tables for documents, code relationships, coverage rules, search, and the ICD-to-CPT/HCPCS crosswalk.

## What Was Prepared

- Migration SQL: `migrations/0004_mcd_phase1_schema.sql`
- Automated importer: `scripts/import-mcd-phase1-staging.ts`
- Current Article CSVs extracted to `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv`
- NCD CSVs extracted to `C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv`
- Header-corrected upload copy created for `current_lcd/lcd_x_requestor_letters.csv` at `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv_upload_ready\lcd_x_requestor_letters.csv`.
- Staging tables use CMS CSV column names, all as `text`, plus nullable/default metadata columns.
- Clean tables are empty until the transform/import step runs after CSV upload.

## Automated Upload

The Phase 1 staging import can be run from the project root:

```bash
npm run import:mcd-phase1
```

The script reads `mcd_phase1_staging_manifest`, truncates each Phase 1 staging table, uploads each CSV into its matching table, records an import batch row, and validates the row count for every file.

Current completed import total: **612,125 staging rows**.

## Manual Upload Fallback

If manual upload is needed later, upload each CSV into its matching staging table. Do not upload into the clean `mcd_*` tables directly.

Supabase upload settings should keep the first row as headers. The added metadata columns (`id`, `import_batch_id`, `source_file`, `source_dataset`, `imported_at`, `raw_row_hash`) can be left blank because they are nullable or defaulted.

Important: use the header-corrected upload copy for `lcd_x_requestor_letters.csv`; the original current LCD CSV has no header row.

## Upload Mapping

| Dataset | CSV file | Upload to Supabase table | Expected rows | Columns |
| --- | --- | --- | ---: | ---: |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article.csv` | `stg_mcd_current_article_article` | 2,002 | 27 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_future_retire.csv` | `stg_mcd_current_article_article_future_retire` | 46 | 2 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_related_documents.csv` | `stg_mcd_current_article_article_related_documents` | 6,572 | 9 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_related_ncd_documents.csv` | `stg_mcd_current_article_article_related_ncd_documents` | 4,690 | 6 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_related_source_icd9.csv` | `stg_mcd_current_article_article_related_source_icd9` | 136 | 5 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_type_lookup.csv` | `stg_mcd_current_article_article_type_lookup` | 6 | 3 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_url_type_lookup.csv` | `stg_mcd_current_article_article_url_type_lookup` | 4 | 4 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_bill_code.csv` | `stg_mcd_current_article_article_x_bill_code` | 1,209 | 6 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_code_table.csv` | `stg_mcd_current_article_article_x_code_table` | 1,497 | 13 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_contractor.csv` | `stg_mcd_current_article_article_x_contractor` | 27,064 | 7 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_hcpc_code.csv` | `stg_mcd_current_article_article_x_hcpc_code` | 18,158 | 9 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_hcpc_code_group.csv` | `stg_mcd_current_article_article_x_hcpc_code_group` | 1,875 | 5 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_hcpc_modifier.csv` | `stg_mcd_current_article_article_x_hcpc_modifier` | 491 | 7 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_hcpc_modifier_group.csv` | `stg_mcd_current_article_article_x_hcpc_modifier_group` | 1,139 | 5 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_covered.csv` | `stg_mcd_current_article_article_x_icd10_covered` | 431,120 | 10 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_covered_group.csv` | `stg_mcd_current_article_article_x_icd10_covered_group` | 2,373 | 6 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_noncovered.csv` | `stg_mcd_current_article_article_x_icd10_noncovered` | 45,352 | 9 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_noncovered_group.csv` | `stg_mcd_current_article_article_x_icd10_noncovered_group` | 1,215 | 5 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_pcs_code.csv` | `stg_mcd_current_article_article_x_icd10_pcs_code` | 73 | 9 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_icd10_pcs_code_group.csv` | `stg_mcd_current_article_article_x_icd10_pcs_code_group` | 1,160 | 5 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_other_coding_group.csv` | `stg_mcd_current_article_article_x_other_coding_group` | 1,087 | 6 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_primary_jurisdiction.csv` | `stg_mcd_current_article_article_x_primary_jurisdiction` | 259 | 4 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_response_to_comment.csv` | `stg_mcd_current_article_article_x_response_to_comment` | 7,150 | 6 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_revenue_code.csv` | `stg_mcd_current_article_article_x_revenue_code` | 2,761 | 7 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_revision_history.csv` | `stg_mcd_current_article_article_x_revision_history` | 10,867 | 6 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_sticky_note.csv` | `stg_mcd_current_article_article_x_sticky_note` | 34 | 6 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\article_x_urls.csv` | `stg_mcd_current_article_article_x_urls` | 4,904 | 9 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\contractor.csv` | `stg_mcd_current_article_contractor` | 120 | 23 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\contractor_jurisdiction.csv` | `stg_mcd_current_article_contractor_jurisdiction` | 291 | 7 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\contractor_oversight.csv` | `stg_mcd_current_article_contractor_oversight` | 120 | 5 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\contractor_subtype_lookup.csv` | `stg_mcd_current_article_contractor_subtype_lookup` | 4 | 2 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\contractor_type_lookup.csv` | `stg_mcd_current_article_contractor_type_lookup` | 13 | 2 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\dmerc_region_lookup.csv` | `stg_mcd_current_article_dmerc_region_lookup` | 14 | 5 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\region_lookup.csv` | `stg_mcd_current_article_region_lookup` | 11 | 2 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\state_lookup.csv` | `stg_mcd_current_article_state_lookup` | 63 | 3 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\state_x_region.csv` | `stg_mcd_current_article_state_x_region` | 63 | 2 |
| Current Article | `C:\Users\TekSoft\Downloads\all_data\current_article\current_article_csv\update_period.csv` | `stg_mcd_current_article_update_period` | 1,196 | 3 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\contractor.csv` | `stg_mcd_current_lcd_contractor` | 120 | 23 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\contractor_jurisdiction.csv` | `stg_mcd_current_lcd_contractor_jurisdiction` | 291 | 7 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\contractor_oversight.csv` | `stg_mcd_current_lcd_contractor_oversight` | 120 | 5 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\contractor_subtype_lookup.csv` | `stg_mcd_current_lcd_contractor_subtype_lookup` | 4 | 2 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\contractor_type_lookup.csv` | `stg_mcd_current_lcd_contractor_type_lookup` | 13 | 2 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\dmerc_region_lookup.csv` | `stg_mcd_current_lcd_dmerc_region_lookup` | 14 | 5 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\draft_contact_lookup.csv` | `stg_mcd_current_lcd_draft_contact_lookup` | 166 | 14 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd.csv` | `stg_mcd_current_lcd_lcd` | 940 | 48 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_future_retire.csv` | `stg_mcd_current_lcd_lcd_future_retire` | 51 | 2 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_related_documents.csv` | `stg_mcd_current_lcd_lcd_related_documents` | 5,463 | 9 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_related_ncd_documents.csv` | `stg_mcd_current_lcd_lcd_related_ncd_documents` | 2,472 | 6 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_related_source_icd9.csv` | `stg_mcd_current_lcd_lcd_related_source_icd9` | 48 | 5 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_url_type_lookup.csv` | `stg_mcd_current_lcd_lcd_url_type_lookup` | 1 | 4 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_advisory_committee.csv` | `stg_mcd_current_lcd_lcd_x_advisory_committee` | 129 | 7 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_contractor.csv` | `stg_mcd_current_lcd_lcd_x_contractor` | 12,856 | 6 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_hcpc_code.csv` | `stg_mcd_current_lcd_lcd_x_hcpc_code` | 2,396 | 9 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_hcpc_code_group.csv` | `stg_mcd_current_lcd_lcd_x_hcpc_code_group` | 114 | 5 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_primary_jurisdiction.csv` | `stg_mcd_current_lcd_lcd_x_primary_jurisdiction` | 242 | 4 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_reason_change.csv` | `stg_mcd_current_lcd_lcd_x_reason_change` | 953 | 6 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv_upload_ready\lcd_x_requestor_letters.csv` *(header-corrected copy)* | `stg_mcd_current_lcd_lcd_x_requestor_letters` | 40 | 8 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_revision_history.csv` | `stg_mcd_current_lcd_lcd_x_revision_history` | 7,823 | 6 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_sticky_note.csv` | `stg_mcd_current_lcd_lcd_x_sticky_note` | 34 | 6 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_synopsis_changes_fields.csv` | `stg_mcd_current_lcd_lcd_x_synopsis_changes_fields` | 34 | 4 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\lcd_x_urls.csv` | `stg_mcd_current_lcd_lcd_x_urls` | 128 | 9 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\reason_change_lookup.csv` | `stg_mcd_current_lcd_reason_change_lookup` | 108 | 5 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\region_lookup.csv` | `stg_mcd_current_lcd_region_lookup` | 11 | 2 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\state_lookup.csv` | `stg_mcd_current_lcd_state_lookup` | 63 | 3 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\state_x_region.csv` | `stg_mcd_current_lcd_state_x_region` | 63 | 2 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\synopsis_changes_fields_lookup.csv` | `stg_mcd_current_lcd_synopsis_changes_fields_lookup` | 17 | 5 |
| Current LCD | `C:\Users\TekSoft\Downloads\all_data\current_lcd\current_lcd_csv\update_period.csv` | `stg_mcd_current_lcd_update_period` | 1,196 | 3 |
| NCD | `C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv\ncd_bnft_ctgry_ref.csv` | `stg_mcd_ncd_ncd_bnft_ctgry_ref` | 78 | 2 |
| NCD | `C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv\ncd_pblctn_ref.csv` | `stg_mcd_ncd_ncd_pblctn_ref` | 42 | 3 |
| NCD | `C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv\ncd_trkg.csv` | `stg_mcd_ncd_ncd_trkg` | 357 | 26 |
| NCD | `C:\Users\TekSoft\Downloads\all_data\ncd\ncd_csv\ncd_trkg_bnft_xref.csv` | `stg_mcd_ncd_ncd_trkg_bnft_xref` | 599 | 5 |

## Verification Queries After Upload

Run these in Supabase SQL editor after manual uploads:

```sql
select
  m.dataset_key,
  m.csv_table_name,
  m.staging_table_name,
  m.expected_rows,
  m.notes
from mcd_phase1_staging_manifest m
order by m.dataset_key, m.csv_table_name;
```

For exact row checks, use the generated table names. Example:

```sql
select count(*) from stg_mcd_current_article_article_x_icd10_covered;
select count(*) from stg_mcd_current_article_article_x_hcpc_code;
select count(*) from stg_mcd_current_lcd_lcd;
select count(*) from stg_mcd_ncd_ncd_trkg;
```

Expected key counts:

- `stg_mcd_current_article_article_x_icd10_covered`: 431,120
- `stg_mcd_current_article_article_x_hcpc_code`: 18,158
- `stg_mcd_current_article_article`: 2,002
- `stg_mcd_current_lcd_lcd`: 940
- `stg_mcd_current_lcd_lcd_x_requestor_letters`: 40
- `stg_mcd_ncd_ncd_trkg`: 357

## Next Phase After Upload

After the staging CSVs are uploaded and row counts match, the next step is to build transform SQL/scripts that populate:

- `mcd_documents`
- `mcd_contractors`
- `mcd_states`
- `mcd_document_codes`
- `mcd_code_groups`
- `mcd_document_relationships`
- `mcd_coverage_rules`
- `mcd_icd_cpt_crosswalk`
- `mcd_search_index`

The crosswalk should be generated from same article/version/group relationships first, then enriched with LCD/NCD relationships.
