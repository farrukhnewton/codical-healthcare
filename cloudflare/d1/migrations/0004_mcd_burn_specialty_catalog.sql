-- Curated code-family routing for the Burn & Skin Graft specialty.
-- CMS documents and their code groups remain normalized in the MCD core tables;
-- this catalog creates an automatically refreshed specialty view without copying
-- or freezing article content.

CREATE TABLE IF NOT EXISTS mcd_specialty_code_ranges (
  specialty_key TEXT NOT NULL,
  family_key TEXT NOT NULL,
  family_label TEXT NOT NULL,
  code_type TEXT NOT NULL,
  code_start INTEGER NOT NULL,
  code_end INTEGER NOT NULL,
  coding_note TEXT,
  source_authority TEXT NOT NULL DEFAULT 'CMS MCD / Medicare NCCI',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (specialty_key, family_key, code_type, code_start, code_end)
);

INSERT OR REPLACE INTO mcd_specialty_code_ranges
  (specialty_key, family_key, family_label, code_type, code_start, code_end, coding_note)
VALUES
  ('burn_skin_graft', 'burn_local_treatment', 'Local treatment of burns', 'CPT', 16000, 16036, 'Use only for a documented performed burn-treatment service; exact selection depends on anesthesia and treated extent.'),
  ('burn_skin_graft', 'recipient_site_preparation', 'Surgical preparation of recipient site', 'CPT', 15002, 15005, 'Routine debridement is bundled; separate preparation requires distinct excisional documentation under current NCCI policy.'),
  ('burn_skin_graft', 'split_thickness_autograft', 'Split-thickness autograft', 'CPT', 15100, 15121, 'Select by recipient-site anatomic group and total treated area.'),
  ('burn_skin_graft', 'full_thickness_autograft', 'Full-thickness autograft', 'CPT', 15200, 15261, 'Select by recipient-site anatomic group and total treated area.'),
  ('burn_skin_graft', 'ctp_application', 'Cellular/tissue-based product application', 'CPT', 15271, 15278, 'Application and product evidence must be reconciled to the current MAC article and date of service.'),
  ('burn_skin_graft', 'deep_debridement', 'Deep wound debridement', 'CPT', 11042, 11047, 'General debridement families are not selected for burned surfaces without a separate qualifying wound.'),
  ('burn_skin_graft', 'selective_debridement', 'Selective wound debridement', 'CPT', 97597, 97598, 'Select only from documented deepest tissue and aggregate surface area.'),
  ('burn_skin_graft', 'negative_pressure', 'Negative-pressure wound therapy', 'CPT', 97605, 97608, 'Exact code depends on equipment type and total treated surface area.');

DROP VIEW IF EXISTS mcd_burn_specialty_documents;
CREATE VIEW mcd_burn_specialty_documents AS
SELECT DISTINCT
  r.specialty_key,
  r.family_key,
  r.family_label,
  r.coding_note,
  d.document_uid,
  d.document_kind,
  d.cms_document_id,
  d.cms_version_id,
  d.display_id,
  d.title,
  d.status,
  d.effective_date,
  d.end_date,
  c.code_type,
  c.code,
  dc.group_number,
  dc.relationship_type,
  dc.coverage_status
FROM mcd_specialty_code_ranges r
JOIN mcd_codes c
  ON c.code_type = r.code_type
 AND length(c.normalized_code) = 5
 AND CAST(c.normalized_code AS INTEGER) BETWEEN r.code_start AND r.code_end
JOIN mcd_document_codes dc ON dc.code_uid = c.code_uid
JOIN mcd_documents d ON d.document_uid = dc.document_uid
WHERE r.specialty_key = 'burn_skin_graft'
  AND d.is_current = 1;

CREATE INDEX IF NOT EXISTS idx_mcd_specialty_code_ranges_key
  ON mcd_specialty_code_ranges(specialty_key, family_key);
