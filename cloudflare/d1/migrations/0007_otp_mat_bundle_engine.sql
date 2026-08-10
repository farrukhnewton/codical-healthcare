PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS otp_source_registry (
  source_id TEXT PRIMARY KEY,
  authority TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  refresh_cadence TEXT NOT NULL,
  contains_licensed_content INTEGER NOT NULL DEFAULT 0 CHECK (contains_licensed_content IN (0, 1))
);

CREATE TABLE IF NOT EXISTS otp_source_versions (
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
  FOREIGN KEY (source_id) REFERENCES otp_source_registry(source_id)
);

CREATE INDEX IF NOT EXISTS idx_otp_source_effective
  ON otp_source_versions(source_id, effective_from, effective_to, import_status);

CREATE TABLE IF NOT EXISTS otp_payment_rates (
  rate_id TEXT PRIMARY KEY,
  hcpcs_code TEXT NOT NULL,
  description TEXT NOT NULL,
  total_cents INTEGER,
  drug_component_cents INTEGER NOT NULL DEFAULT 0,
  non_drug_component_cents INTEGER,
  contractor_priced INTEGER NOT NULL DEFAULT 0 CHECK (contractor_priced IN (0, 1)),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_id TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'verified', 'quarantined', 'retired')),
  UNIQUE (hcpcs_code, effective_from),
  FOREIGN KEY (source_id) REFERENCES otp_source_registry(source_id)
);

CREATE INDEX IF NOT EXISTS idx_otp_rate_lookup
  ON otp_payment_rates(hcpcs_code, effective_from, effective_to, review_status);

CREATE TABLE IF NOT EXISTS otp_billing_rules (
  rule_id TEXT PRIMARY KEY,
  domain_key TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  rule_effect TEXT NOT NULL CHECK (rule_effect IN ('require', 'allow', 'deny', 'review', 'inform')),
  condition_json TEXT NOT NULL,
  outcome_json TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_id TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'verified', 'quarantined', 'retired')),
  UNIQUE (rule_key, effective_from),
  FOREIGN KEY (source_id) REFERENCES otp_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS otp_program_records (
  program_record_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_npi_hash TEXT NOT NULL,
  samhsa_certification_status TEXT NOT NULL CHECK (samhsa_certification_status IN ('unknown', 'active', 'suspended', 'expired')),
  accreditation_status TEXT NOT NULL CHECK (accreditation_status IN ('unknown', 'active', 'suspended', 'expired')),
  medicare_enrollment_status TEXT NOT NULL CHECK (medicare_enrollment_status IN ('unknown', 'active', 'inactive')),
  state_authority_status TEXT NOT NULL CHECK (state_authority_status IN ('unknown', 'active', 'restricted', 'inactive')),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  verified_at TEXT,
  source_pointer_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_program_tenant_effective
  ON otp_program_records(tenant_id, organization_npi_hash, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS otp_cases (
  case_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  encrypted_payload_object_key TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  service_date TEXT NOT NULL,
  payer_mode TEXT NOT NULL,
  claim_entity TEXT NOT NULL CHECK (claim_entity IN ('professional', 'institutional')),
  site_type TEXT NOT NULL,
  workflow_status TEXT NOT NULL CHECK (workflow_status IN ('draft', 'review', 'approved', 'void')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_cases_tenant_date
  ON otp_cases(tenant_id, service_date, workflow_status);

CREATE TABLE IF NOT EXISTS otp_documents (
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
  FOREIGN KEY (case_id) REFERENCES otp_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_evidence_items (
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
  FOREIGN KEY (case_id) REFERENCES otp_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES otp_documents(document_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_evidence_case_domain
  ON otp_evidence_items(case_id, domain_key, evidence_type, human_verified);

CREATE TABLE IF NOT EXISTS otp_medication_episodes (
  medication_episode_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  medication_pathway TEXT NOT NULL,
  episode_start_date TEXT NOT NULL,
  episode_end_date TEXT,
  days_furnished INTEGER,
  drug_component_furnished INTEGER CHECK (drug_component_furnished IN (0, 1)),
  non_drug_component_furnished INTEGER CHECK (non_drug_component_furnished IN (0, 1)),
  selected_for_primary_bundle INTEGER NOT NULL DEFAULT 0 CHECK (selected_for_primary_bundle IN (0, 1)),
  source_evidence_ids_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES otp_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_take_home_ledger (
  ledger_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  medication_episode_id TEXT NOT NULL,
  supply_start_date TEXT NOT NULL,
  supply_end_date TEXT NOT NULL,
  additional_days INTEGER NOT NULL CHECK (additional_days BETWEEN 1 AND 21),
  billing_units INTEGER NOT NULL CHECK (billing_units BETWEEN 1 AND 3),
  overlap_status TEXT NOT NULL CHECK (overlap_status IN ('unresolved', 'clear', 'overlap')),
  practitioner_authorization_verified INTEGER NOT NULL DEFAULT 0 CHECK (practitioner_authorization_verified IN (0, 1)),
  clinical_authorization_computed INTEGER NOT NULL DEFAULT 0 CHECK (clinical_authorization_computed = 0),
  source_evidence_ids_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES otp_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (medication_episode_id) REFERENCES otp_medication_episodes(medication_episode_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_service_events (
  service_event_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  service_date TEXT NOT NULL,
  service_category TEXT NOT NULL,
  documented_minutes INTEGER,
  provider_npi_hash TEXT,
  source_evidence_ids_json TEXT NOT NULL,
  human_verified INTEGER NOT NULL DEFAULT 0 CHECK (human_verified IN (0, 1)),
  FOREIGN KEY (case_id) REFERENCES otp_cases(case_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_otp_service_case_date
  ON otp_service_events(case_id, service_date, service_category);

CREATE TABLE IF NOT EXISTS otp_service_count_allocations (
  allocation_id TEXT PRIMARY KEY,
  service_event_id TEXT NOT NULL,
  target_code TEXT NOT NULL,
  allocation_purpose TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (service_event_id, target_code, allocation_purpose),
  FOREIGN KEY (service_event_id) REFERENCES otp_service_events(service_event_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_telecom_reviews (
  telecom_review_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  service_code TEXT NOT NULL,
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('audio-video', 'audio-only')),
  modifier TEXT NOT NULL CHECK (modifier IN ('93', '95')),
  place_of_service TEXT NOT NULL CHECK (place_of_service = '58'),
  av_unavailable_verified INTEGER CHECK (av_unavailable_verified IN (0, 1)),
  dea_practitioner_present_verified INTEGER CHECK (dea_practitioner_present_verified IN (0, 1)),
  federal_state_requirements_verified INTEGER NOT NULL DEFAULT 0 CHECK (federal_state_requirements_verified IN (0, 1)),
  source_evidence_ids_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES otp_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_duplicate_bundle_reviews (
  duplicate_review_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  overlapping_claim_reference_hash TEXT NOT NULL,
  exception_reason TEXT NOT NULL,
  records_exchanged INTEGER NOT NULL DEFAULT 0 CHECK (records_exchanged IN (0, 1)),
  modifier_59_supported INTEGER NOT NULL DEFAULT 0 CHECK (modifier_59_supported IN (0, 1)),
  review_status TEXT NOT NULL CHECK (review_status IN ('hold', 'supported', 'rejected')),
  source_evidence_ids_json TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES otp_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  input_sha256 TEXT NOT NULL,
  domain_results_json TEXT NOT NULL,
  query_list_json TEXT NOT NULL,
  requires_human_approval INTEGER NOT NULL DEFAULT 1 CHECK (requires_human_approval = 1),
  autonomous_claim_submission INTEGER NOT NULL DEFAULT 0 CHECK (autonomous_claim_submission = 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES otp_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_claim_previews (
  preview_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  evaluation_id TEXT NOT NULL,
  claim_format TEXT NOT NULL CHECK (claim_format IN ('837P', '837I')),
  claim_context_json TEXT NOT NULL,
  encrypted_line_payload_object_key TEXT NOT NULL,
  payment_summary_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('hold', 'review', 'approved', 'void')),
  approved_by TEXT,
  approved_at TEXT,
  exported_at TEXT,
  autonomous_submission INTEGER NOT NULL DEFAULT 0 CHECK (autonomous_submission = 0),
  FOREIGN KEY (case_id) REFERENCES otp_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (evaluation_id) REFERENCES otp_evaluations(evaluation_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  case_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  event_payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES otp_cases(case_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_audit_tenant_case
  ON otp_audit_events(tenant_id, case_id, created_at);

INSERT OR REPLACE INTO otp_source_registry
  (source_id, authority, title, source_url, source_type, refresh_cadence, contains_licensed_content)
VALUES
  ('cms-clm-ch39', 'CMS', 'Medicare Claims Processing Manual Chapter 39', 'https://www.cms.gov/files/document/chapter-39-opioid-treatment-programs-otps.pdf', 'manual', 'on-change', 0),
  ('cms-otp-cy2026-rates', 'CMS', 'CY 2026 OTP payment rates', 'https://www.cms.gov/medicare/payment/opioid-treatment-programs-otp/billing-payment/otp-payment-rates', 'fee-schedule', 'annual', 0),
  ('cms-cr14347', 'CMS', 'CR 14347 OTP policy updates', 'https://www.cms.gov/medicare/regulations-guidance/transmittals/2026-transmittals/r13572bp', 'change-request', 'on-change', 0),
  ('cms-otp-enrollment', 'CMS', 'OTP enrollment requirements', 'https://www.cms.gov/medicare/payment/opioid-treatment-program/enrollment', 'program-requirement', 'quarterly', 0),
  ('samhsa-42-cfr-part-8', 'SAMHSA', '42 CFR Part 8 OTP requirements', 'https://www.samhsa.gov/substance-use/treatment/opioid-treatment-program/42-cfr-part-8', 'regulatory-guidance', 'on-change', 0),
  ('samhsa-federal-guidelines-2024', 'SAMHSA', 'Federal Guidelines for OTPs Fall 2024', 'https://store.samhsa.gov/sites/default/files/federal-guidelines-opioid-treatment-pep24-02-011.pdf', 'clinical-program-guidance', 'on-change', 0);

INSERT OR REPLACE INTO otp_payment_rates
  (rate_id, hcpcs_code, description, total_cents, drug_component_cents, non_drug_component_cents, contractor_priced, effective_from, effective_to, source_id, review_status)
VALUES
  ('2026-G2067', 'G2067', 'Weekly methadone treatment bundle', 27729, 4441, 23288, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2068', 'G2068', 'Weekly oral buprenorphine treatment bundle', 29657, 6369, 23288, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2069', 'G2069', 'Monthly injectable buprenorphine treatment bundle', 206377, 182320, 24058, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2073', 'G2073', 'Weekly naltrexone treatment bundle', 176073, 152016, 24058, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2074', 'G2074', 'Weekly treatment bundle without a drug', 22034, 0, 22034, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2075', 'G2075', 'Medication treatment bundle not otherwise specified', NULL, 0, NULL, 1, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G0533', 'G0533', 'Weekly injectable buprenorphine treatment bundle', 63740, 39683, 24058, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2076', 'G2076', 'Intake activities add-on', 23459, 0, 23459, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2077', 'G2077', 'Periodic assessment add-on', 15193, 0, 15193, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2078', 'G2078', 'Methadone take-home supply up to seven additional days', 4441, 4441, 0, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2079', 'G2079', 'Oral buprenorphine take-home supply up to seven additional days', 6369, 6369, 0, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2080', 'G2080', 'Each additional 30 minutes of counseling', 3697, 0, 3697, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2215', 'G2215', 'Take-home nasal naloxone', 3374, 3374, 0, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G2216', 'G2216', 'Take-home injectable naloxone', NULL, 0, NULL, 1, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G1028', 'G1028', 'Two-pack 8 mg nasal naloxone', 12798, 12798, 0, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G0137', 'G0137', 'Intensive outpatient services bundle', 82632, 0, 82632, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G0532', 'G0532', 'Take-home nasal nalmefene', 9120, 9120, 0, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G0534', 'G0534', 'Each additional 30 minutes of coordinated care', 4282, 0, 4282, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G0535', 'G0535', 'Each additional 30 minutes of patient navigation', 4282, 0, 4282, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified'),
  ('2026-G0536', 'G0536', 'Each additional 30 minutes of peer recovery support', 4282, 0, 4282, 0, '2026-01-01', '2026-12-31', 'cms-otp-cy2026-rates', 'verified');

INSERT OR REPLACE INTO otp_billing_rules
  (rule_id, domain_key, rule_key, rule_effect, condition_json, outcome_json, effective_from, effective_to, source_id, review_status)
VALUES
  ('otp-pos58-professional', 'claim', 'professional-pos-58', 'require', '{"claimEntity":"professional"}', '{"placeOfService":"58","includingTelecom":true}', '2025-01-01', NULL, 'cms-clm-ch39', 'verified'),
  ('otp-one-primary-bundle', 'bundle', 'one-primary-per-week', 'require', '{"episodeDays":7}', '{"maximumPrimaryBundles":1,"useDrugMostDaysIfSwitch":true}', '2025-01-01', NULL, 'cms-clm-ch39', 'verified'),
  ('otp-takehome-max3', 'take-home', 'take-home-units', 'require', '{"codes":["G2078","G2079"]}', '{"daysPerUnit":7,"maximumUnits":3,"overlapAllowed":false}', '2025-01-01', NULL, 'cms-clm-ch39', 'verified'),
  ('otp-iop-nine', 'iop', 'iop-minimum-services', 'require', '{"code":"G0137"}', '{"minimumServices":9,"contiguousDays":7,"doubleCountingAllowed":false,"certificationRequired":true}', '2025-01-01', NULL, 'cms-clm-ch39', 'verified'),
  ('otp-takehome-clinical-separation', 'take-home', 'billing-does-not-authorize-clinical-supply', 'inform', '{}', '{"clinicalAuthorizationComputed":false,"practitionerDecisionRequired":true}', '2024-10-02', NULL, 'samhsa-42-cfr-part-8', 'verified'),
  ('otp-human-approval', 'claim', 'autonomous-submission-disabled', 'require', '{}', '{"requiresHumanApproval":true,"autonomousSubmission":false}', '2026-01-01', NULL, 'cms-clm-ch39', 'verified');
