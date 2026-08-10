PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS transplant_source_registry (
  source_id TEXT PRIMARY KEY,
  authority TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  refresh_cadence TEXT NOT NULL,
  contains_licensed_content INTEGER NOT NULL DEFAULT 0 CHECK (contains_licensed_content IN (0, 1))
);

CREATE TABLE IF NOT EXISTS transplant_source_versions (
  version_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  fetched_at TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  object_key TEXT,
  import_status TEXT NOT NULL CHECK (import_status IN ('discovered', 'quarantined', 'validated', 'published', 'retired')),
  validation_summary_json TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES transplant_source_registry(source_id)
);

CREATE INDEX IF NOT EXISTS idx_transplant_source_effective
  ON transplant_source_versions(source_id, effective_from, effective_to, import_status);

CREATE TABLE IF NOT EXISTS transplant_program_approvals (
  approval_id TEXT PRIMARY KEY,
  ccn TEXT NOT NULL,
  organ_type TEXT NOT NULL,
  age_category TEXT NOT NULL CHECK (age_category IN ('adult', 'pediatric', 'all')),
  record_source TEXT NOT NULL CHECK (record_source IN ('pecos', 'legacy-cms', 'payer')),
  source_record_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('approved', 'suspended', 'terminated')),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_version_id TEXT NOT NULL,
  verified_at TEXT,
  UNIQUE (ccn, organ_type, age_category, record_source, effective_from),
  FOREIGN KEY (source_version_id) REFERENCES transplant_source_versions(version_id)
);

CREATE INDEX IF NOT EXISTS idx_transplant_program_lookup
  ON transplant_program_approvals(ccn, organ_type, age_category, effective_from, effective_to, status);

CREATE TABLE IF NOT EXISTS transplant_program_prerequisites (
  organ_type TEXT NOT NULL,
  prerequisite_organ_type TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  citation_source_id TEXT NOT NULL,
  PRIMARY KEY (organ_type, prerequisite_organ_type, effective_from),
  FOREIGN KEY (citation_source_id) REFERENCES transplant_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS transplant_coverage_rules (
  rule_id TEXT PRIMARY KEY,
  organ_type TEXT NOT NULL,
  pathway TEXT NOT NULL,
  criterion_key TEXT NOT NULL,
  criterion_operator TEXT NOT NULL,
  criterion_value_json TEXT NOT NULL,
  rule_effect TEXT NOT NULL CHECK (rule_effect IN ('require', 'review', 'exclude', 'inform')),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_version_id TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'verified', 'quarantined', 'retired')),
  UNIQUE (organ_type, pathway, criterion_key, effective_from),
  FOREIGN KEY (source_version_id) REFERENCES transplant_source_versions(version_id)
);

CREATE TABLE IF NOT EXISTS transplant_licensed_code_adapters (
  adapter_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code_system TEXT NOT NULL,
  license_owner TEXT NOT NULL,
  version_label TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  encrypted_configuration_object_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transplant_icd10_versions (
  version_id TEXT PRIMARY KEY,
  code_system TEXT NOT NULL CHECK (code_system IN ('ICD-10-CM', 'ICD-10-PCS')),
  version_label TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_version_id TEXT NOT NULL,
  import_status TEXT NOT NULL CHECK (import_status IN ('discovered', 'quarantined', 'validated', 'published', 'retired')),
  FOREIGN KEY (source_version_id) REFERENCES transplant_source_versions(version_id)
);

CREATE TABLE IF NOT EXISTS transplant_grouper_versions (
  grouper_version_id TEXT PRIMARY KEY,
  fiscal_year TEXT NOT NULL,
  version_label TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  mce_version TEXT NOT NULL,
  encrypted_adapter_object_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('metadata-only', 'validated', 'published', 'retired'))
);

CREATE TABLE IF NOT EXISTS transplant_cases (
  case_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  encrypted_payload_object_key TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  service_date TEXT NOT NULL,
  organ_type TEXT NOT NULL,
  age_category TEXT NOT NULL,
  payer_mode TEXT NOT NULL,
  episode_purpose TEXT NOT NULL,
  workflow_status TEXT NOT NULL CHECK (workflow_status IN ('draft', 'review', 'approved', 'void')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transplant_cases_tenant_date
  ON transplant_cases(tenant_id, service_date, organ_type, workflow_status);

CREATE TABLE IF NOT EXISTS transplant_documents (
  document_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  encrypted_object_key TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  document_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  page_count INTEGER,
  extraction_method TEXT NOT NULL,
  requires_manual_review INTEGER NOT NULL DEFAULT 1 CHECK (requires_manual_review IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transplant_evidence_items (
  evidence_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  document_id TEXT,
  domain_key TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  normalized_value_json TEXT NOT NULL,
  source_pointer TEXT NOT NULL,
  confidence REAL,
  human_verified INTEGER NOT NULL DEFAULT 0 CHECK (human_verified IN (0, 1)),
  verified_by TEXT,
  verified_at TEXT,
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES transplant_documents(document_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transplant_evidence_case_domain
  ON transplant_evidence_items(case_id, domain_key, evidence_type, human_verified);

CREATE TABLE IF NOT EXISTS transplant_program_validations (
  validation_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  approval_id TEXT,
  organ_type TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('pass', 'review', 'hold', 'not-applicable')),
  reasons_json TEXT NOT NULL,
  blockers_json TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (approval_id) REFERENCES transplant_program_approvals(approval_id)
);

CREATE TABLE IF NOT EXISTS transplant_operative_reviews (
  review_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  final_report_verified INTEGER NOT NULL DEFAULT 0 CHECK (final_report_verified IN (0, 1)),
  organ_implanted INTEGER NOT NULL DEFAULT 0 CHECK (organ_implanted IN (0, 1)),
  backbench_documented INTEGER NOT NULL DEFAULT 0 CHECK (backbench_documented IN (0, 1)),
  reconstruction_documented INTEGER NOT NULL DEFAULT 0 CHECK (reconstruction_documented IN (0, 1)),
  source_pointer_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transplant_professional_candidates (
  candidate_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  adapter_id TEXT,
  encrypted_code_payload_object_key TEXT,
  candidate_status TEXT NOT NULL CHECK (candidate_status IN ('review', 'approved', 'rejected', 'unavailable')),
  evidence_ids_json TEXT NOT NULL,
  coder_approved INTEGER NOT NULL DEFAULT 0 CHECK (coder_approved IN (0, 1)),
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (adapter_id) REFERENCES transplant_licensed_code_adapters(adapter_id)
);

CREATE TABLE IF NOT EXISTS transplant_facility_candidates (
  candidate_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  pcs_version_id TEXT,
  pcs_code TEXT,
  grouper_version_id TEXT,
  drg_candidate TEXT,
  candidate_status TEXT NOT NULL CHECK (candidate_status IN ('review', 'approved', 'rejected', 'unavailable')),
  evidence_ids_json TEXT NOT NULL,
  coder_approved INTEGER NOT NULL DEFAULT 0 CHECK (coder_approved IN (0, 1)),
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (pcs_version_id) REFERENCES transplant_icd10_versions(version_id),
  FOREIGN KEY (grouper_version_id) REFERENCES transplant_grouper_versions(grouper_version_id)
);

CREATE TABLE IF NOT EXISTS transplant_acquisition_cases (
  acquisition_case_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  organ_type TEXT NOT NULL,
  opo_identifier TEXT,
  sac_reconciled INTEGER CHECK (sac_reconciled IN (0, 1)),
  reconciliation_status TEXT NOT NULL CHECK (reconciliation_status IN ('pending', 'review', 'reconciled')),
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transplant_acquisition_cost_items (
  cost_item_id TEXT PRIMARY KEY,
  acquisition_case_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('direct-organ', 'shared', 'non-acquisition', 'unresolved')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  source_pointer TEXT NOT NULL,
  allocation_status TEXT NOT NULL CHECK (allocation_status IN ('not-required', 'pending', 'balanced')),
  FOREIGN KEY (acquisition_case_id) REFERENCES transplant_acquisition_cases(acquisition_case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transplant_acquisition_allocations (
  allocation_id TEXT PRIMARY KEY,
  cost_item_id TEXT NOT NULL,
  organ_type TEXT NOT NULL,
  allocation_basis TEXT NOT NULL,
  allocation_percent_millis INTEGER NOT NULL CHECK (allocation_percent_millis BETWEEN 0 AND 100000),
  FOREIGN KEY (cost_item_id) REFERENCES transplant_acquisition_cost_items(cost_item_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transplant_donor_reviews (
  donor_review_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  donor_type TEXT NOT NULL,
  donor_organ TEXT NOT NULL,
  recipient_account_reference_hash TEXT,
  kidney_complication INTEGER NOT NULL DEFAULT 0 CHECK (kidney_complication IN (0, 1)),
  occurrence_code_36_verified INTEGER NOT NULL DEFAULT 0 CHECK (occurrence_code_36_verified IN (0, 1)),
  relationship_39_verified INTEGER NOT NULL DEFAULT 0 CHECK (relationship_39_verified IN (0, 1)),
  paired_exchange_reconciled INTEGER CHECK (paired_exchange_reconciled IN (0, 1)),
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transplant_drug_benefit_reviews (
  drug_review_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  benefit_pathway TEXT NOT NULL,
  kidney_transplant_verified INTEGER CHECK (kidney_transplant_verified IN (0, 1)),
  esrd_entitlement_end_verified INTEGER CHECK (esrd_entitlement_end_verified IN (0, 1)),
  no_disqualifying_coverage_verified INTEGER CHECK (no_disqualifying_coverage_verified IN (0, 1)),
  part_bid_enrollment_verified INTEGER CHECK (part_bid_enrollment_verified IN (0, 1)),
  medication_payload_object_key TEXT NOT NULL,
  days_supply INTEGER CHECK (days_supply > 0),
  supply_sequence TEXT,
  status TEXT NOT NULL CHECK (status IN ('pass', 'review', 'hold')),
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transplant_queries (
  query_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  domain_key TEXT NOT NULL,
  query_text TEXT NOT NULL,
  source_evidence_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'sent', 'answered', 'closed')),
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transplant_claim_previews (
  preview_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  lane TEXT NOT NULL CHECK (lane IN ('professional', 'institutional', 'dme', 'pharmacy')),
  encrypted_preview_object_key TEXT NOT NULL,
  preview_sha256 TEXT NOT NULL,
  readiness_status TEXT NOT NULL CHECK (readiness_status IN ('pass', 'review', 'hold', 'not-applicable')),
  coder_approved INTEGER NOT NULL DEFAULT 0 CHECK (coder_approved IN (0, 1)),
  autonomous_submission_enabled INTEGER NOT NULL DEFAULT 0 CHECK (autonomous_submission_enabled = 0),
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transplant_audit_events (
  event_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES transplant_cases(case_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transplant_audit_case_time
  ON transplant_audit_events(case_id, created_at);

INSERT OR REPLACE INTO transplant_source_registry
  (source_id, authority, title, source_url, source_type, refresh_cadence, contains_licensed_content)
VALUES
  ('cms-pecos-cr14262', 'CMS', 'CR 14262 - PECOS transplant program records', 'https://www.cms.gov/medicare/regulations-guidance/transmittals/2026-transmittals/r13757cp', 'program-record', 'weekly-discovery', 0),
  ('cms-cp-ch3', 'CMS', 'Medicare Claims Processing Manual, Chapter 3', 'https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c03.pdf', 'manual', 'weekly-discovery', 0),
  ('cms-bp-ch11', 'CMS', 'Medicare Benefit Policy Manual, Chapter 11', 'https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/bp102c11.pdf', 'manual', 'weekly-discovery', 0),
  ('cms-ncd-260-1', 'CMS', 'NCD 260.1 Adult Liver Transplantation', 'https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=70', 'ncd', 'weekly-discovery', 0),
  ('cms-ncd-260-3', 'CMS', 'NCD 260.3 Pancreas Transplants', 'https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=107', 'ncd', 'weekly-discovery', 0),
  ('cms-ncd-260-5', 'CMS', 'NCD 260.5 Intestinal and Multi-Visceral Transplantation', 'https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=280', 'ncd', 'weekly-discovery', 0),
  ('cms-ncd-260-9', 'CMS', 'NCD 260.9 Heart Transplants', 'https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=112', 'ncd', 'weekly-discovery', 0),
  ('cms-part-b-id', 'CMS', 'Part B Immunosuppressive Drug Benefit', 'https://www.cms.gov/partbid-provider', 'benefit', 'weekly-discovery', 0),
  ('cms-2552-10-d4', 'CMS', 'Form CMS-2552-10 Worksheet D-4', 'https://www.cms.gov/files/document/r26p240f.pdf', 'cost-report', 'release-watch', 0),
  ('hrsa-optn', 'HRSA', 'OPTN policies and modernization', 'https://www.hrsa.gov/optn/policies-bylaws/policies', 'allocation-policy', 'weekly-discovery', 0),
  ('licensed-cpt-adapter', 'AMA-licensee', 'Tenant licensed CPT adapter metadata', 'internal://licensed-adapter', 'licensed-adapter', 'annual-license', 1);

INSERT OR REPLACE INTO transplant_source_versions
  (version_id, source_id, version_label, effective_from, effective_to, fetched_at, sha256, object_key, import_status, validation_summary_json)
VALUES
  ('pecos-cr14262-2026-04-06', 'cms-pecos-cr14262', 'R13757CP / CR 14262', '2026-04-06', NULL, '2026-08-10T00:00:00Z', 'PENDING-AUTHORITATIVE-IMPORT', NULL, 'discovered', '{"metadataOnly":true,"recordsImported":false}'),
  ('cms-transplant-manuals-2026-08-10', 'cms-bp-ch11', 'retrieved-2026-08-10', '2026-01-01', NULL, '2026-08-10T00:00:00Z', 'PENDING-AUTHORITATIVE-IMPORT', NULL, 'discovered', '{"metadataOnly":true}'),
  ('cms-claims-ch3-2026-08-10', 'cms-cp-ch3', 'retrieved-2026-08-10', '2026-01-01', NULL, '2026-08-10T00:00:00Z', 'PENDING-AUTHORITATIVE-IMPORT', NULL, 'discovered', '{"metadataOnly":true}'),
  ('cms-ncd-260-1-2026-08-10', 'cms-ncd-260-1', 'current-2026-08-10', '2026-01-01', NULL, '2026-08-10T00:00:00Z', 'PENDING-AUTHORITATIVE-IMPORT', NULL, 'discovered', '{"metadataOnly":true}'),
  ('cms-ncd-260-3-2026-08-10', 'cms-ncd-260-3', 'current-2026-08-10', '2026-01-01', NULL, '2026-08-10T00:00:00Z', 'PENDING-AUTHORITATIVE-IMPORT', NULL, 'discovered', '{"metadataOnly":true}'),
  ('cms-ncd-260-5-2026-08-10', 'cms-ncd-260-5', 'current-2026-08-10', '2026-01-01', NULL, '2026-08-10T00:00:00Z', 'PENDING-AUTHORITATIVE-IMPORT', NULL, 'discovered', '{"metadataOnly":true}'),
  ('cms-ncd-260-9-2026-08-10', 'cms-ncd-260-9', 'current-2026-08-10', '2026-01-01', NULL, '2026-08-10T00:00:00Z', 'PENDING-AUTHORITATIVE-IMPORT', NULL, 'discovered', '{"metadataOnly":true}'),
  ('cms-part-b-id-2026-08-10', 'cms-part-b-id', 'current-2026-08-10', '2026-01-01', NULL, '2026-08-10T00:00:00Z', 'PENDING-AUTHORITATIVE-IMPORT', NULL, 'discovered', '{"metadataOnly":true,"kidneyOnly":true}'),
  ('cms-2552-10-rev25', 'cms-2552-10-d4', '02-2026 Rev 25', '2026-02-01', NULL, '2026-08-10T00:00:00Z', 'PENDING-AUTHORITATIVE-IMPORT', NULL, 'discovered', '{"metadataOnly":true,"worksheet":"D-4"}');

INSERT OR REPLACE INTO transplant_program_prerequisites
  (organ_type, prerequisite_organ_type, effective_from, effective_to, citation_source_id)
VALUES
  ('pancreas', 'kidney', '2026-04-06', NULL, 'cms-pecos-cr14262'),
  ('intestine', 'liver', '2026-04-06', NULL, 'cms-pecos-cr14262'),
  ('multivisceral', 'liver', '2026-04-06', NULL, 'cms-pecos-cr14262'),
  ('heart-lung', 'heart', '2026-04-06', NULL, 'cms-pecos-cr14262'),
  ('heart-lung', 'lung', '2026-04-06', NULL, 'cms-pecos-cr14262');
