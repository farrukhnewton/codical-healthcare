PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS em_source_registry (
  source_id TEXT PRIMARY KEY,
  authority TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  refresh_cadence TEXT NOT NULL,
  contains_licensed_content INTEGER NOT NULL DEFAULT 0 CHECK (contains_licensed_content IN (0, 1))
);

CREATE TABLE IF NOT EXISTS em_source_versions (
  version_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  fetched_at TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  encrypted_object_key TEXT,
  import_status TEXT NOT NULL CHECK (import_status IN ('discovered', 'quarantined', 'validated', 'published', 'retired')),
  validation_summary_json TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES em_source_registry(source_id)
);

CREATE INDEX IF NOT EXISTS idx_em_source_effective
  ON em_source_versions(source_id, effective_from, effective_to, import_status);

CREATE TABLE IF NOT EXISTS em_licensed_cpt_adapters (
  adapter_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  license_owner TEXT NOT NULL,
  cpt_edition TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  encrypted_configuration_object_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_em_cpt_adapter_tenant_effective
  ON em_licensed_cpt_adapters(tenant_id, effective_from, effective_to, enabled);

CREATE TABLE IF NOT EXISTS em_office_code_metadata (
  code_id TEXT PRIMARY KEY,
  patient_type TEXT NOT NULL CHECK (patient_type IN ('new', 'established')),
  mdm_level TEXT NOT NULL CHECK (mdm_level IN ('straightforward', 'low', 'moderate', 'high')),
  minimum_time_minutes INTEGER NOT NULL CHECK (minimum_time_minutes > 0),
  original_paraphrase TEXT NOT NULL,
  official_descriptor_stored INTEGER NOT NULL DEFAULT 0 CHECK (official_descriptor_stored = 0),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_id TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'verified', 'quarantined', 'retired')),
  UNIQUE (patient_type, mdm_level, effective_from),
  FOREIGN KEY (source_id) REFERENCES em_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS em_mdm_rules (
  rule_id TEXT PRIMARY KEY,
  element_key TEXT NOT NULL CHECK (element_key IN ('problems', 'data', 'risk', 'overall')),
  level_key TEXT NOT NULL CHECK (level_key IN ('straightforward', 'low', 'moderate', 'high')),
  condition_json TEXT NOT NULL,
  outcome_json TEXT NOT NULL,
  rule_semantics TEXT NOT NULL CHECK (rule_semantics IN ('original-paraphrase', 'structural-threshold')),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_id TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'verified', 'quarantined', 'retired')),
  UNIQUE (element_key, level_key, effective_from),
  FOREIGN KEY (source_id) REFERENCES em_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS em_medicare_rules (
  rule_id TEXT PRIMARY KEY,
  rule_key TEXT NOT NULL,
  condition_json TEXT NOT NULL,
  outcome_json TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_id TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'verified', 'quarantined', 'retired')),
  UNIQUE (rule_key, effective_from),
  FOREIGN KEY (source_id) REFERENCES em_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS em_cases (
  case_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  encrypted_payload_object_key TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  service_date TEXT NOT NULL,
  payer_mode TEXT NOT NULL,
  site_type TEXT NOT NULL,
  place_of_service TEXT NOT NULL,
  patient_type TEXT NOT NULL CHECK (patient_type IN ('new', 'established', 'unknown')),
  selection_basis TEXT NOT NULL CHECK (selection_basis IN ('mdm', 'time', 'both')),
  workflow_status TEXT NOT NULL CHECK (workflow_status IN ('draft', 'review', 'approved', 'void')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_em_cases_tenant_date
  ON em_cases(tenant_id, service_date, workflow_status);

CREATE TABLE IF NOT EXISTS em_documents (
  document_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  encrypted_object_key TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  document_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  page_count INTEGER,
  extraction_method TEXT NOT NULL,
  requires_manual_review INTEGER NOT NULL DEFAULT 1 CHECK (requires_manual_review = 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS em_evidence_items (
  evidence_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  document_id TEXT,
  element_key TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  normalized_value_json TEXT NOT NULL,
  source_pointer TEXT NOT NULL,
  extraction_confidence REAL,
  clinician_verified INTEGER NOT NULL DEFAULT 0 CHECK (clinician_verified IN (0, 1)),
  coder_verified INTEGER NOT NULL DEFAULT 0 CHECK (coder_verified IN (0, 1)),
  verified_by TEXT,
  verified_at TEXT,
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES em_documents(document_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_em_evidence_case_element
  ON em_evidence_items(case_id, element_key, evidence_type, clinician_verified, coder_verified);

CREATE TABLE IF NOT EXISTS em_problem_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  derived_level TEXT NOT NULL CHECK (derived_level IN ('none', 'straightforward', 'low', 'moderate', 'high')),
  problem_counts_json TEXT NOT NULL,
  clinician_characterization_verified INTEGER NOT NULL DEFAULT 0 CHECK (clinician_characterization_verified IN (0, 1)),
  reasons_json TEXT NOT NULL,
  blockers_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS em_data_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  derived_level TEXT NOT NULL CHECK (derived_level IN ('none', 'straightforward', 'low', 'moderate', 'high')),
  unique_note_sources INTEGER NOT NULL DEFAULT 0,
  unique_tests INTEGER NOT NULL DEFAULT 0,
  historian_supported INTEGER NOT NULL DEFAULT 0 CHECK (historian_supported IN (0, 1)),
  independent_interpretation_supported INTEGER NOT NULL DEFAULT 0 CHECK (independent_interpretation_supported IN (0, 1)),
  external_discussion_supported INTEGER NOT NULL DEFAULT 0 CHECK (external_discussion_supported IN (0, 1)),
  categories_met_json TEXT NOT NULL,
  reasons_json TEXT NOT NULL,
  blockers_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS em_risk_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  derived_level TEXT NOT NULL CHECK (derived_level IN ('none', 'straightforward', 'low', 'moderate', 'high')),
  management_actions_json TEXT NOT NULL,
  management_decision_verified INTEGER NOT NULL DEFAULT 0 CHECK (management_decision_verified IN (0, 1)),
  reasons_json TEXT NOT NULL,
  blockers_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS em_time_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  total_qhp_minutes INTEGER NOT NULL DEFAULT 0 CHECK (total_qhp_minutes >= 0),
  excluded_separate_service_minutes INTEGER NOT NULL DEFAULT 0 CHECK (excluded_separate_service_minutes >= 0),
  excluded_overlap_minutes INTEGER NOT NULL DEFAULT 0 CHECK (excluded_overlap_minutes >= 0),
  excluded_clinical_staff_minutes INTEGER NOT NULL DEFAULT 0 CHECK (excluded_clinical_staff_minutes >= 0),
  reportable_minutes INTEGER NOT NULL DEFAULT 0 CHECK (reportable_minutes >= 0),
  total_time_documented INTEGER NOT NULL DEFAULT 0 CHECK (total_time_documented IN (0, 1)),
  date_of_service_only INTEGER NOT NULL DEFAULT 0 CHECK (date_of_service_only IN (0, 1)),
  selected_code_id TEXT,
  prolonged_code TEXT,
  prolonged_units INTEGER NOT NULL DEFAULT 0 CHECK (prolonged_units >= 0),
  reasons_json TEXT NOT NULL,
  blockers_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (selected_code_id) REFERENCES em_office_code_metadata(code_id)
);

CREATE TABLE IF NOT EXISTS em_same_day_reviews (
  review_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  same_day_service_type TEXT NOT NULL,
  procedure_global_days TEXT NOT NULL,
  significant_separate_em_verified INTEGER CHECK (significant_separate_em_verified IN (0, 1)),
  major_surgery_decision_verified INTEGER CHECK (major_surgery_decision_verified IN (0, 1)),
  modifier_25_supported INTEGER NOT NULL DEFAULT 0 CHECK (modifier_25_supported IN (0, 1)),
  modifier_57_supported INTEGER NOT NULL DEFAULT 0 CHECK (modifier_57_supported IN (0, 1)),
  reasons_json TEXT NOT NULL,
  blockers_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS em_g2211_reviews (
  review_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  relationship_pathway TEXT NOT NULL,
  relationship_verified INTEGER NOT NULL DEFAULT 0 CHECK (relationship_verified IN (0, 1)),
  same_day_modifier_25 INTEGER NOT NULL DEFAULT 0 CHECK (same_day_modifier_25 IN (0, 1)),
  allowed_preventive_exception INTEGER NOT NULL DEFAULT 0 CHECK (allowed_preventive_exception IN (0, 1)),
  separately_payable INTEGER NOT NULL DEFAULT 0 CHECK (separately_payable IN (0, 1)),
  reasons_json TEXT NOT NULL,
  blockers_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS em_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  input_sha256 TEXT NOT NULL,
  element_levels_json TEXT NOT NULL,
  overall_mdm_level TEXT NOT NULL,
  mdm_path_json TEXT NOT NULL,
  time_path_json TEXT NOT NULL,
  selected_path_json TEXT,
  domain_results_json TEXT NOT NULL,
  query_list_json TEXT NOT NULL,
  licensed_cpt_descriptors_embedded INTEGER NOT NULL DEFAULT 0 CHECK (licensed_cpt_descriptors_embedded = 0),
  requires_human_approval INTEGER NOT NULL DEFAULT 1 CHECK (requires_human_approval = 1),
  autonomous_claim_submission INTEGER NOT NULL DEFAULT 0 CHECK (autonomous_claim_submission = 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS em_claim_previews (
  preview_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  evaluation_id TEXT NOT NULL,
  encrypted_line_payload_object_key TEXT NOT NULL,
  licensed_adapter_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('hold', 'review', 'approved', 'void')),
  approved_by TEXT,
  approved_at TEXT,
  exported_at TEXT,
  autonomous_submission INTEGER NOT NULL DEFAULT 0 CHECK (autonomous_submission = 0),
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (evaluation_id) REFERENCES em_evaluations(evaluation_id) ON DELETE CASCADE,
  FOREIGN KEY (licensed_adapter_id) REFERENCES em_licensed_cpt_adapters(adapter_id)
);

CREATE TABLE IF NOT EXISTS em_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  case_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  event_payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES em_cases(case_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_em_audit_tenant_case
  ON em_audit_events(tenant_id, case_id, created_at);

INSERT OR REPLACE INTO em_source_registry
  (source_id, authority, title, source_url, source_type, refresh_cadence, contains_licensed_content)
VALUES
  ('cms-mln006764', 'CMS', 'Evaluation and Management Services May 2026', 'https://www.cms.gov/files/document/mln006764-evaluation-management-services.pdf', 'manual', 'on-change', 0),
  ('cms-clm-ch12', 'CMS', 'Medicare Claims Processing Manual Chapter 12', 'https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/clm104c12.pdf', 'manual', 'on-change', 0),
  ('cms-mm13473', 'CMS', 'Office and Outpatient G2211 Instructions', 'https://www.cms.gov/files/document/mm13473-how-use-office-and-outpatient-evaluation-and-management-visit-complexity-add-code-g2211.pdf', 'change-request', 'on-change', 0),
  ('ama-em-guidelines', 'AMA', 'CPT E/M Guidelines and MDM Framework', 'https://www.ama-assn.org/practice-management/cpt/cpt-evaluation-and-management', 'licensed-framework', 'annual', 1),
  ('ama-em-2024-time', 'AMA', '2024 Office Outpatient Minimum-Time Revision', 'https://www.ama-assn.org/practice-management/cpt/simpler-approach-helps-physicians-properly-report-em-services', 'editorial-guidance', 'annual', 0);

INSERT OR REPLACE INTO em_office_code_metadata
  (code_id, patient_type, mdm_level, minimum_time_minutes, original_paraphrase, official_descriptor_stored, effective_from, effective_to, source_id, review_status)
VALUES
  ('99202', 'new', 'straightforward', 15, 'New office/outpatient candidate at the first physician/QHP level', 0, '2024-01-01', NULL, 'ama-em-2024-time', 'verified'),
  ('99203', 'new', 'low', 30, 'New office/outpatient candidate at the low level', 0, '2024-01-01', NULL, 'ama-em-2024-time', 'verified'),
  ('99204', 'new', 'moderate', 45, 'New office/outpatient candidate at the moderate level', 0, '2024-01-01', NULL, 'ama-em-2024-time', 'verified'),
  ('99205', 'new', 'high', 60, 'New office/outpatient candidate at the high level', 0, '2024-01-01', NULL, 'ama-em-2024-time', 'verified'),
  ('99212', 'established', 'straightforward', 10, 'Established office/outpatient candidate at the first physician/QHP level', 0, '2024-01-01', NULL, 'ama-em-2024-time', 'verified'),
  ('99213', 'established', 'low', 20, 'Established office/outpatient candidate at the low level', 0, '2024-01-01', NULL, 'ama-em-2024-time', 'verified'),
  ('99214', 'established', 'moderate', 30, 'Established office/outpatient candidate at the moderate level', 0, '2024-01-01', NULL, 'ama-em-2024-time', 'verified'),
  ('99215', 'established', 'high', 40, 'Established office/outpatient candidate at the high level', 0, '2024-01-01', NULL, 'ama-em-2024-time', 'verified');

INSERT OR REPLACE INTO em_mdm_rules
  (rule_id, element_key, level_key, condition_json, outcome_json, rule_semantics, effective_from, effective_to, source_id, review_status)
VALUES
  ('em-overall-straightforward', 'overall', 'straightforward', '{"minimumElementsAtOrAbove":2}', '{"secondHighestElement":"straightforward"}', 'structural-threshold', '2021-01-01', NULL, 'ama-em-guidelines', 'verified'),
  ('em-overall-low', 'overall', 'low', '{"minimumElementsAtOrAbove":2}', '{"secondHighestElement":"low"}', 'structural-threshold', '2021-01-01', NULL, 'ama-em-guidelines', 'verified'),
  ('em-overall-moderate', 'overall', 'moderate', '{"minimumElementsAtOrAbove":2}', '{"secondHighestElement":"moderate"}', 'structural-threshold', '2021-01-01', NULL, 'ama-em-guidelines', 'verified'),
  ('em-overall-high', 'overall', 'high', '{"minimumElementsAtOrAbove":2}', '{"secondHighestElement":"high"}', 'structural-threshold', '2021-01-01', NULL, 'ama-em-guidelines', 'verified'),
  ('em-data-low', 'data', 'low', '{"category1UniqueElements":2,"orSupportedHistorian":true}', '{"level":"low"}', 'structural-threshold', '2021-01-01', NULL, 'ama-em-guidelines', 'verified'),
  ('em-data-moderate', 'data', 'moderate', '{"anyCategory":true,"category1UniqueElements":3}', '{"level":"moderate"}', 'structural-threshold', '2021-01-01', NULL, 'ama-em-guidelines', 'verified'),
  ('em-data-high', 'data', 'high', '{"minimumCategories":2}', '{"level":"high"}', 'structural-threshold', '2021-01-01', NULL, 'ama-em-guidelines', 'verified');

INSERT OR REPLACE INTO em_medicare_rules
  (rule_id, rule_key, condition_json, outcome_json, effective_from, effective_to, source_id, review_status)
VALUES
  ('em-g2212-new-first', 'g2212-new-threshold', '{"baseCode":"99205","minimumMinutes":89}', '{"code":"G2212","units":1,"additionalUnitMinutes":15}', '2024-01-01', NULL, 'cms-clm-ch12', 'verified'),
  ('em-g2212-est-first', 'g2212-established-threshold', '{"baseCode":"99215","minimumMinutes":69}', '{"code":"G2212","units":1,"additionalUnitMinutes":15}', '2024-01-01', NULL, 'cms-clm-ch12', 'verified'),
  ('em-g2211-mod25-preventive', 'g2211-modifier25-exception', '{"modifier":"25","sameDayService":["AWV","vaccine-administration","Part-B-preventive"]}', '{"separatelyPayable":true}', '2025-01-01', NULL, 'cms-mm13473', 'verified'),
  ('em-g2211-rhc-fqhc', 'g2211-rhc-fqhc-bundled', '{"siteType":["RHC","FQHC"]}', '{"separatelyPayable":false,"bundled":true}', '2024-01-01', NULL, 'cms-mm13473', 'verified'),
  ('em-human-approval', 'autonomous-submission-disabled', '{}', '{"requiresHumanApproval":true,"autonomousSubmission":false,"licensedDescriptorsEmbedded":false}', '2026-01-01', NULL, 'cms-mln006764', 'verified');
