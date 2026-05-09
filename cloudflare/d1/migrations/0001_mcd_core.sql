PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mcd_import_runs (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  source_root TEXT,
  source_manifest_json TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  file_count INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS mcd_sources (
  source_key TEXT PRIMARY KEY,
  dataset_key TEXT NOT NULL,
  dataset_scope TEXT NOT NULL,
  dataset_kind TEXT NOT NULL,
  local_root TEXT,
  file_count INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS mcd_contractors (
  contractor_key TEXT PRIMARY KEY,
  contractor_number TEXT,
  contractor_name TEXT,
  contractor_type TEXT,
  contractor_subtype TEXT,
  oversight_region TEXT,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_mcd_contractors_number
  ON mcd_contractors(contractor_number);

CREATE TABLE IF NOT EXISTS mcd_jurisdictions (
  jurisdiction_key TEXT PRIMARY KEY,
  jurisdiction_code TEXT,
  jurisdiction_name TEXT,
  state_code TEXT,
  region_code TEXT,
  dmerc_region_code TEXT,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_mcd_jurisdictions_state
  ON mcd_jurisdictions(state_code);

CREATE TABLE IF NOT EXISTS mcd_documents (
  document_uid TEXT PRIMARY KEY,
  document_kind TEXT NOT NULL CHECK (document_kind IN ('article', 'lcd', 'ncd')),
  cms_document_id TEXT NOT NULL,
  cms_version_id TEXT,
  source_key TEXT,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  title TEXT,
  status TEXT,
  document_type TEXT,
  contractor_number TEXT,
  effective_date TEXT,
  end_date TEXT,
  retirement_date TEXT,
  last_updated_date TEXT,
  publication_date TEXT,
  benefit_category TEXT,
  summary TEXT,
  body_text TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_key) REFERENCES mcd_sources(source_key) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcd_documents_identity
  ON mcd_documents(document_kind, cms_document_id, cms_version_id, source_key);

CREATE INDEX IF NOT EXISTS idx_mcd_documents_kind_id
  ON mcd_documents(document_kind, cms_document_id);

CREATE INDEX IF NOT EXISTS idx_mcd_documents_current
  ON mcd_documents(is_current, document_kind);

CREATE INDEX IF NOT EXISTS idx_mcd_documents_effective
  ON mcd_documents(effective_date, retirement_date);

CREATE TABLE IF NOT EXISTS mcd_document_contractors (
  document_uid TEXT NOT NULL,
  contractor_key TEXT NOT NULL,
  source_key TEXT,
  PRIMARY KEY (document_uid, contractor_key),
  FOREIGN KEY (document_uid) REFERENCES mcd_documents(document_uid) ON DELETE CASCADE,
  FOREIGN KEY (contractor_key) REFERENCES mcd_contractors(contractor_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcd_document_contractors_contractor
  ON mcd_document_contractors(contractor_key);

CREATE TABLE IF NOT EXISTS mcd_document_jurisdictions (
  document_uid TEXT NOT NULL,
  jurisdiction_key TEXT NOT NULL,
  source_key TEXT,
  PRIMARY KEY (document_uid, jurisdiction_key),
  FOREIGN KEY (document_uid) REFERENCES mcd_documents(document_uid) ON DELETE CASCADE,
  FOREIGN KEY (jurisdiction_key) REFERENCES mcd_jurisdictions(jurisdiction_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcd_document_jurisdictions_jurisdiction
  ON mcd_document_jurisdictions(jurisdiction_key);

CREATE TABLE IF NOT EXISTS mcd_codes (
  code_uid TEXT PRIMARY KEY,
  code_type TEXT NOT NULL CHECK (
    code_type IN ('HCPCS', 'CPT', 'ICD10CM', 'ICD10PCS', 'MODIFIER', 'BILL_TYPE', 'REVENUE', 'NCD', 'OTHER')
  ),
  code TEXT NOT NULL,
  normalized_code TEXT NOT NULL,
  short_description TEXT,
  long_description TEXT,
  valid_from TEXT,
  valid_to TEXT,
  raw_json TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcd_codes_type_code
  ON mcd_codes(code_type, normalized_code);

CREATE INDEX IF NOT EXISTS idx_mcd_codes_code
  ON mcd_codes(normalized_code);

CREATE TABLE IF NOT EXISTS mcd_code_groups (
  group_uid TEXT PRIMARY KEY,
  document_uid TEXT NOT NULL,
  group_kind TEXT NOT NULL,
  group_number TEXT,
  coverage_status TEXT,
  paragraph_text TEXT,
  raw_json TEXT,
  FOREIGN KEY (document_uid) REFERENCES mcd_documents(document_uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcd_code_groups_document
  ON mcd_code_groups(document_uid, group_kind, group_number);

CREATE TABLE IF NOT EXISTS mcd_document_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_uid TEXT NOT NULL,
  code_uid TEXT NOT NULL,
  group_uid TEXT,
  relationship_type TEXT NOT NULL,
  coverage_status TEXT,
  group_number TEXT,
  source_key TEXT,
  raw_json TEXT,
  FOREIGN KEY (document_uid) REFERENCES mcd_documents(document_uid) ON DELETE CASCADE,
  FOREIGN KEY (code_uid) REFERENCES mcd_codes(code_uid) ON DELETE CASCADE,
  FOREIGN KEY (group_uid) REFERENCES mcd_code_groups(group_uid) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcd_document_codes_unique
  ON mcd_document_codes(document_uid, code_uid, relationship_type, coverage_status, group_number);

CREATE INDEX IF NOT EXISTS idx_mcd_document_codes_code
  ON mcd_document_codes(code_uid, relationship_type, coverage_status);

CREATE INDEX IF NOT EXISTS idx_mcd_document_codes_document
  ON mcd_document_codes(document_uid, relationship_type, coverage_status);

CREATE TABLE IF NOT EXISTS mcd_coverage_rules (
  rule_uid TEXT PRIMARY KEY,
  document_uid TEXT NOT NULL,
  hcpcs_code_uid TEXT NOT NULL,
  icd_code_uid TEXT,
  modifier_code_uid TEXT,
  revenue_code_uid TEXT,
  bill_type_code_uid TEXT,
  group_uid TEXT,
  coverage_status TEXT NOT NULL CHECK (coverage_status IN ('covered', 'noncovered', 'unknown')),
  rule_source TEXT NOT NULL,
  confidence_score REAL NOT NULL DEFAULT 0,
  effective_date TEXT,
  end_date TEXT,
  evidence_text TEXT,
  source_key TEXT,
  raw_json TEXT,
  FOREIGN KEY (document_uid) REFERENCES mcd_documents(document_uid) ON DELETE CASCADE,
  FOREIGN KEY (hcpcs_code_uid) REFERENCES mcd_codes(code_uid) ON DELETE CASCADE,
  FOREIGN KEY (icd_code_uid) REFERENCES mcd_codes(code_uid) ON DELETE CASCADE,
  FOREIGN KEY (modifier_code_uid) REFERENCES mcd_codes(code_uid) ON DELETE SET NULL,
  FOREIGN KEY (revenue_code_uid) REFERENCES mcd_codes(code_uid) ON DELETE SET NULL,
  FOREIGN KEY (bill_type_code_uid) REFERENCES mcd_codes(code_uid) ON DELETE SET NULL,
  FOREIGN KEY (group_uid) REFERENCES mcd_code_groups(group_uid) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mcd_coverage_rules_hcpcs_icd
  ON mcd_coverage_rules(hcpcs_code_uid, icd_code_uid, coverage_status);

CREATE INDEX IF NOT EXISTS idx_mcd_coverage_rules_icd_hcpcs
  ON mcd_coverage_rules(icd_code_uid, hcpcs_code_uid, coverage_status);

CREATE INDEX IF NOT EXISTS idx_mcd_coverage_rules_document
  ON mcd_coverage_rules(document_uid, coverage_status);

CREATE TABLE IF NOT EXISTS mcd_icd_cpt_crosswalk (
  pair_uid TEXT PRIMARY KEY,
  icd_code_uid TEXT NOT NULL,
  hcpcs_code_uid TEXT NOT NULL,
  coverage_status TEXT NOT NULL CHECK (coverage_status IN ('covered', 'noncovered', 'mixed', 'unknown')),
  confidence_score REAL NOT NULL DEFAULT 0,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  current_evidence_count INTEGER NOT NULL DEFAULT 0,
  article_count INTEGER NOT NULL DEFAULT 0,
  lcd_count INTEGER NOT NULL DEFAULT 0,
  ncd_count INTEGER NOT NULL DEFAULT 0,
  first_effective_date TEXT,
  last_seen_date TEXT,
  top_document_uid TEXT,
  jurisdictions_json TEXT,
  contractors_json TEXT,
  evidence_summary TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (icd_code_uid) REFERENCES mcd_codes(code_uid) ON DELETE CASCADE,
  FOREIGN KEY (hcpcs_code_uid) REFERENCES mcd_codes(code_uid) ON DELETE CASCADE,
  FOREIGN KEY (top_document_uid) REFERENCES mcd_documents(document_uid) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mcd_crosswalk_icd
  ON mcd_icd_cpt_crosswalk(icd_code_uid, coverage_status, confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_mcd_crosswalk_hcpcs
  ON mcd_icd_cpt_crosswalk(hcpcs_code_uid, coverage_status, confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_mcd_crosswalk_score
  ON mcd_icd_cpt_crosswalk(confidence_score DESC, evidence_count DESC);

CREATE TABLE IF NOT EXISTS mcd_document_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_document_uid TEXT NOT NULL,
  related_document_kind TEXT,
  related_cms_document_id TEXT,
  related_document_uid TEXT,
  relationship_type TEXT,
  source_key TEXT,
  raw_json TEXT,
  FOREIGN KEY (source_document_uid) REFERENCES mcd_documents(document_uid) ON DELETE CASCADE,
  FOREIGN KEY (related_document_uid) REFERENCES mcd_documents(document_uid) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mcd_document_relationships_source
  ON mcd_document_relationships(source_document_uid, relationship_type);

CREATE INDEX IF NOT EXISTS idx_mcd_document_relationships_related
  ON mcd_document_relationships(related_document_kind, related_cms_document_id);

CREATE TABLE IF NOT EXISTS mcd_document_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_uid TEXT NOT NULL,
  url_type TEXT,
  url TEXT NOT NULL,
  label TEXT,
  source_key TEXT,
  raw_json TEXT,
  FOREIGN KEY (document_uid) REFERENCES mcd_documents(document_uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcd_document_urls_document
  ON mcd_document_urls(document_uid, url_type);

CREATE TABLE IF NOT EXISTS mcd_revision_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_uid TEXT NOT NULL,
  revision_number TEXT,
  revision_date TEXT,
  revision_text TEXT,
  reason_change TEXT,
  source_key TEXT,
  raw_json TEXT,
  FOREIGN KEY (document_uid) REFERENCES mcd_documents(document_uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcd_revision_history_document
  ON mcd_revision_history(document_uid, revision_date DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS mcd_search_fts USING fts5(
  document_uid UNINDEXED,
  document_kind UNINDEXED,
  cms_document_id UNINDEXED,
  title,
  summary,
  body_text,
  codes,
  contractors,
  tokenize = 'porter unicode61'
);

CREATE TABLE IF NOT EXISTS mcd_search_index_meta (
  document_uid TEXT PRIMARY KEY,
  indexed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  code_count INTEGER NOT NULL DEFAULT 0,
  search_rank_boost REAL NOT NULL DEFAULT 1,
  FOREIGN KEY (document_uid) REFERENCES mcd_documents(document_uid) ON DELETE CASCADE
);
