PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS hcc_source_registry (
  source_id TEXT PRIMARY KEY,
  authority TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  refresh_cadence TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hcc_source_versions (
  version_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  fetched_at TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  encrypted_object_key TEXT,
  import_status TEXT NOT NULL CHECK (import_status IN ('discovered','quarantined','validated','published','retired')),
  validation_summary_json TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES hcc_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS hcc_model_versions (
  model_version_id TEXT PRIMARY KEY,
  model_family TEXT NOT NULL,
  model_version TEXT NOT NULL,
  payment_year INTEGER NOT NULL,
  data_collection_year INTEGER NOT NULL,
  package_label TEXT NOT NULL,
  population_scope TEXT NOT NULL,
  mapping_count INTEGER NOT NULL CHECK (mapping_count > 0),
  normalization_factor REAL NOT NULL CHECK (normalization_factor > 0),
  coding_pattern_adjustment REAL NOT NULL CHECK (coding_pattern_adjustment >= 0 AND coding_pattern_adjustment < 1),
  source_hashes_json TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  UNIQUE (model_family, model_version, payment_year)
);

CREATE TABLE IF NOT EXISTS hcc_rule_catalog (
  rule_id TEXT PRIMARY KEY,
  model_version_id TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('mapping','age-sex-edit','hierarchy','condition-category','condition-count','interaction','demographic','normalization','coding-adjustment','eligibility','safety')),
  rule_key TEXT NOT NULL,
  original_summary TEXT NOT NULL,
  source_id TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending','verified','quarantined','retired')),
  UNIQUE (model_version_id, rule_type, rule_key),
  FOREIGN KEY (model_version_id) REFERENCES hcc_model_versions(model_version_id),
  FOREIGN KEY (source_id) REFERENCES hcc_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS hcc_cases (
  case_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  model_version_id TEXT NOT NULL,
  encrypted_payload_object_key TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  payment_year INTEGER NOT NULL,
  program_type TEXT NOT NULL CHECK (program_type IN ('ma','pace')),
  enrollment_type TEXT NOT NULL CHECK (enrollment_type IN ('continuing','new')),
  esrd_status TEXT NOT NULL CHECK (esrd_status IN ('none','dialysis','transplant','functioning-graft')),
  workflow_status TEXT NOT NULL CHECK (workflow_status IN ('draft','review','approved','void')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_version_id) REFERENCES hcc_model_versions(model_version_id)
);

CREATE INDEX IF NOT EXISTS idx_hcc_cases_tenant_year ON hcc_cases(tenant_id, payment_year, workflow_status);

CREATE TABLE IF NOT EXISTS hcc_documents (
  document_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  encrypted_object_key TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  page_count INTEGER,
  extraction_method TEXT NOT NULL,
  requires_manual_review INTEGER NOT NULL DEFAULT 1 CHECK (requires_manual_review = 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES hcc_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hcc_diagnosis_evidence (
  evidence_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  document_id TEXT,
  icd10_code TEXT NOT NULL,
  service_date TEXT NOT NULL,
  encounter_token TEXT NOT NULL,
  data_source TEXT NOT NULL CHECK (data_source IN ('physician','hospital-outpatient','hospital-inpatient','other')),
  documentation_status TEXT NOT NULL CHECK (documentation_status IN ('confirmed','review','unsubstantiated','deleted')),
  signature_status TEXT NOT NULL CHECK (signature_status IN ('signed','attested','missing')),
  patient_matched INTEGER CHECK (patient_matched IN (0,1)),
  acceptable_provider INTEGER CHECK (acceptable_provider IN (0,1)),
  eligible_service INTEGER CHECK (eligible_service IN (0,1)),
  clinically_addressed INTEGER CHECK (clinically_addressed IN (0,1)),
  source_excerpt_object_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES hcc_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES hcc_documents(document_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_hcc_evidence_case_code ON hcc_diagnosis_evidence(case_id, icd10_code, service_date);

CREATE TABLE IF NOT EXISTS hcc_mapping_results (
  mapping_result_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  normalized_icd10 TEXT NOT NULL,
  mapped_ccs_json TEXT NOT NULL,
  eligibility_status TEXT NOT NULL CHECK (eligibility_status IN ('eligible','held','unmapped','deleted')),
  issue_list_json TEXT NOT NULL,
  model_source_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES hcc_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES hcc_diagnosis_evidence(evidence_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hcc_hierarchy_decisions (
  decision_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  dominant_hcc INTEGER NOT NULL,
  suppressed_hcc INTEGER NOT NULL,
  rule_source_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (case_id, dominant_hcc, suppressed_hcc),
  FOREIGN KEY (case_id) REFERENCES hcc_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (rule_source_id) REFERENCES hcc_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS hcc_interaction_results (
  interaction_result_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  interaction_key TEXT NOT NULL,
  component_flags_json TEXT NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0,1)),
  coefficient REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (case_id, interaction_key),
  FOREIGN KEY (case_id) REFERENCES hcc_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hcc_score_results (
  score_result_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  coefficient_segment TEXT,
  contribution_list_json TEXT NOT NULL,
  raw_score REAL,
  normalization_factor REAL NOT NULL,
  normalized_score REAL,
  coding_pattern_adjustment REAL NOT NULL,
  coding_adjusted_score REAL,
  generic_payment_estimate_created INTEGER NOT NULL DEFAULT 0 CHECK (generic_payment_estimate_created = 0),
  status TEXT NOT NULL CHECK (status IN ('hold','review','approved','void')),
  requires_human_approval INTEGER NOT NULL DEFAULT 1 CHECK (requires_human_approval = 1),
  autonomous_submission INTEGER NOT NULL DEFAULT 0 CHECK (autonomous_submission = 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES hcc_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hcc_review_cues (
  cue_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  historical_icd10 TEXT NOT NULL,
  mapped_hccs_json TEXT NOT NULL,
  cue_text TEXT NOT NULL,
  converted_to_diagnosis INTEGER NOT NULL DEFAULT 0 CHECK (converted_to_diagnosis = 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES hcc_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hcc_approvals (
  approval_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  score_result_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve','return','void')),
  rationale_object_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES hcc_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (score_result_id) REFERENCES hcc_score_results(score_result_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hcc_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  case_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  event_payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES hcc_cases(case_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_hcc_audit_tenant_case ON hcc_audit_events(tenant_id, case_id, created_at);

INSERT OR REPLACE INTO hcc_source_registry (source_id, authority, title, source_url, source_type, refresh_cadence) VALUES
  ('cms-py2026-model', 'CMS', 'PY 2026 Final CMS-HCC V28 Model Software and ICD-10 Mappings', 'https://www.cms.gov/medicare/payment/medicare-advantage-rates-statistics/risk-adjustment/2026-model-software-icd-10-mappings', 'model-package', 'annual-and-midyear'),
  ('cms-cy2026-announcement', 'CMS', 'CY 2026 Medicare Advantage Rate Announcement', 'https://www.cms.gov/files/document/2026-announcement.pdf', 'rate-announcement', 'annual'),
  ('cms-mcm-ch7', 'CMS', 'Medicare Managed Care Manual Chapter 7 Risk Adjustment', 'https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/mc86c07.pdf', 'manual', 'on-change'),
  ('cms-radv', 'CMS', 'Medicare Advantage Risk Adjustment Data Validation Program', 'https://www.cms.gov/data-research/monitoring-programs/medicare-risk-adjustment-data-validation-program', 'program-guidance', 'on-change'),
  ('cms-icd10-fy2026', 'CMS/NCHS', 'FY 2026 ICD-10-CM Official Guidelines', 'https://www.cms.gov/files/document/fy-2026-icd-10-cm-coding-guidelines.pdf', 'coding-guidelines', 'annual'),
  ('cms-ra-eligible-services', 'CMS', 'Medicare Risk Adjustment Eligible CPT and HCPCS Codes', 'https://www.cms.gov/medicare/health-plans/medicareadvtgspecratestats/risk-adjustors-items/cpt-hcpcs', 'eligible-service-list', 'annual');

INSERT OR REPLACE INTO hcc_model_versions
  (model_version_id, model_family, model_version, payment_year, data_collection_year, package_label, population_scope, mapping_count, normalization_factor, coding_pattern_adjustment, source_hashes_json, published)
VALUES
  ('cms-hcc-v28-py2026-final', 'CMS-HCC Part C', 'V28', 2026, 2025, '2026 T package v3 final', 'Non-PACE MA; non-ESRD', 8019, 1.067, 0.059, '{"mappings":"93307f974301b2a5d406ec6b095246e08601b54e346a4ad5fa5d82db59e1522e","continued":"ed8b9fe9de9d743372821657f657da059bc91d9d42cfe1e47954680737d03049","newEnrollee":"c21b0dd1415197e4e643f2d0da23fb0c31bd377e5fd8d2d12c558ad2917031e8","categories":"fc5b1ccb905e7a0aab19f56b6f0079a8627a8b0b3aef98c1bbc6413ce272d36a","hierarchies":"e572d4de6317aee0374e618e1dd4f56cb4114a8295ee0102a48b77e2b04121a3","interactions":"9187340bdd7352bff0c3fb19839f7141e722bd084c76487cf9a0e51576820147"}', 1);

INSERT OR REPLACE INTO hcc_rule_catalog
  (rule_id, model_version_id, rule_type, rule_key, original_summary, source_id, effective_from, effective_to, review_status)
VALUES
  ('hcc-mapping-final', 'cms-hcc-v28-py2026-final', 'mapping', 'icd10-to-cc', 'Use the final PY 2026 CMS ICD-10-to-CC mapping with model age and sex edits.', 'cms-py2026-model', '2025-01-01', '2025-12-31', 'verified'),
  ('hcc-hierarchy-final', 'cms-hcc-v28-py2026-final', 'hierarchy', 'v28-hierarchies', 'Suppress lower HCCs only through the official model hierarchy.', 'cms-py2026-model', '2026-01-01', '2026-12-31', 'verified'),
  ('hcc-interactions-final', 'cms-hcc-v28-py2026-final', 'interaction', 'v28-interactions', 'Create disease and disabled interactions from post-hierarchy model flags.', 'cms-py2026-model', '2026-01-01', '2026-12-31', 'verified'),
  ('hcc-normalization-2026', 'cms-hcc-v28-py2026-final', 'normalization', 'part-c-2024-model', 'Divide the raw 2024 CMS-HCC Part C score by the CY 2026 normalization factor 1.067.', 'cms-cy2026-announcement', '2026-01-01', '2026-12-31', 'verified'),
  ('hcc-coding-adjustment-2026', 'cms-hcc-v28-py2026-final', 'coding-adjustment', 'ma-minimum', 'Keep the 5.90 percent MA coding-pattern adjustment visible as a separate score layer.', 'cms-cy2026-announcement', '2026-01-01', '2026-12-31', 'verified'),
  ('hcc-current-record-only', 'cms-hcc-v28-py2026-final', 'safety', 'historical-cue', 'Historical diagnoses create review cues only and never become current diagnoses automatically.', 'cms-radv', '2026-01-01', NULL, 'verified'),
  ('hcc-no-generic-payment', 'cms-hcc-v28-py2026-final', 'safety', 'no-base-rate-multiplier', 'Do not present RAF multiplied by a generic base rate as an actual member or plan payment.', 'cms-cy2026-announcement', '2026-01-01', NULL, 'verified'),
  ('hcc-human-approval', 'cms-hcc-v28-py2026-final', 'safety', 'autonomous-submission-disabled', 'Require human review and prevent autonomous diagnosis creation or encounter-data submission.', 'cms-radv', '2026-01-01', NULL, 'verified');
