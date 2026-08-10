PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS nicu_source_registry (
  source_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authority TEXT NOT NULL,
  source_url TEXT NOT NULL,
  version_label TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  retrieved_at TEXT NOT NULL,
  use_scope TEXT NOT NULL,
  coverage_determination INTEGER NOT NULL DEFAULT 0 CHECK (coverage_determination IN (0,1))
);

CREATE TABLE IF NOT EXISTS nicu_policy_versions (
  policy_id TEXT PRIMARY KEY,
  engine_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  source_ids_json TEXT NOT NULL CHECK (json_valid(source_ids_json)),
  professional_scope INTEGER NOT NULL DEFAULT 1 CHECK (professional_scope IN (0,1)),
  facility_release_enabled INTEGER NOT NULL DEFAULT 0 CHECK (facility_release_enabled IN (0,1)),
  human_approval_required INTEGER NOT NULL DEFAULT 1 CHECK (human_approval_required = 1),
  autonomous_submission_allowed INTEGER NOT NULL DEFAULT 0 CHECK (autonomous_submission_allowed = 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nicu_code_catalog (
  code TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  age_or_weight_band TEXT NOT NULL,
  sequence_role TEXT NOT NULL,
  generic_label TEXT NOT NULL,
  licensed_descriptor_embedded INTEGER NOT NULL DEFAULT 0 CHECK (licensed_descriptor_embedded = 0),
  policy_id TEXT NOT NULL REFERENCES nicu_policy_versions(policy_id)
);

CREATE TABLE IF NOT EXISTS nicu_rule_catalog (
  rule_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES nicu_policy_versions(policy_id),
  domain TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  rule_summary TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES nicu_source_registry(source_id),
  release_effect TEXT NOT NULL CHECK (release_effect IN ('hold','review','allow'))
);

CREATE TABLE IF NOT EXISTS nicu_cases (
  case_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  patient_name_hash TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  admission_date TEXT NOT NULL,
  admission_origin TEXT NOT NULL,
  claim_scope TEXT NOT NULL,
  payer_type TEXT NOT NULL,
  payer_name TEXT NOT NULL,
  payer_jurisdiction TEXT,
  policy_id TEXT NOT NULL REFERENCES nicu_policy_versions(policy_id),
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nicu_documents (
  document_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES nicu_cases(case_id) ON DELETE CASCADE,
  object_key TEXT,
  file_name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  extraction_method TEXT NOT NULL,
  page_count INTEGER,
  requires_manual_review INTEGER NOT NULL DEFAULT 1 CHECK (requires_manual_review = 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nicu_daily_records (
  daily_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES nicu_cases(case_id) ON DELETE CASCADE,
  service_date TEXT NOT NULL,
  present_weight_grams REAL,
  care_level TEXT NOT NULL,
  critical_status_documented INTEGER,
  intensive_services_documented INTEGER,
  recovering_low_birth_weight_documented INTEGER,
  directing_provider_hash TEXT,
  provider_role TEXT,
  provider_directed_care INTEGER,
  bedside_exam_documented INTEGER,
  plan_of_care_directed INTEGER,
  source_document_id TEXT REFERENCES nicu_documents(document_id),
  UNIQUE(case_id, service_date)
);

CREATE TABLE IF NOT EXISTS nicu_diagnosis_evidence (
  diagnosis_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES nicu_cases(case_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  provider_documented INTEGER,
  clinically_significant INTEGER,
  present_on_admission TEXT,
  source_document_id TEXT REFERENCES nicu_documents(document_id),
  decision_status TEXT NOT NULL DEFAULT 'held'
);

CREATE TABLE IF NOT EXISTS nicu_procedure_evidence (
  procedure_id TEXT PRIMARY KEY,
  daily_id TEXT NOT NULL REFERENCES nicu_daily_records(daily_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  performed INTEGER,
  separately_identifiable INTEGER,
  source_document_id TEXT REFERENCES nicu_documents(document_id),
  decision_status TEXT NOT NULL DEFAULT 'held'
);

CREATE TABLE IF NOT EXISTS nicu_code_decisions (
  decision_id TEXT PRIMARY KEY,
  daily_id TEXT NOT NULL REFERENCES nicu_daily_records(daily_id) ON DELETE CASCADE,
  candidate_code TEXT,
  code_role TEXT NOT NULL,
  age_days INTEGER,
  age_band TEXT,
  rationale TEXT NOT NULL,
  blocker_json TEXT NOT NULL CHECK (json_valid(blocker_json)),
  warning_json TEXT NOT NULL CHECK (json_valid(warning_json)),
  decision_status TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nicu_ncci_results (
  result_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES nicu_cases(case_id) ON DELETE CASCADE,
  code_one TEXT NOT NULL,
  code_two TEXT NOT NULL,
  setting TEXT NOT NULL,
  edit_version TEXT NOT NULL,
  edit_result_json TEXT NOT NULL CHECK (json_valid(edit_result_json)),
  reviewed INTEGER NOT NULL DEFAULT 0 CHECK (reviewed IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nicu_payer_policy_checks (
  check_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES nicu_cases(case_id) ON DELETE CASCADE,
  payer_name TEXT NOT NULL,
  jurisdiction TEXT,
  policy_identifier TEXT,
  effective_from TEXT,
  effective_to TEXT,
  verified_by TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nicu_approvals (
  approval_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES nicu_cases(case_id) ON DELETE CASCADE,
  approver_user_id TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  licensed_cpt_verified INTEGER NOT NULL DEFAULT 0 CHECK (licensed_cpt_verified IN (0,1)),
  payer_policy_verified INTEGER NOT NULL DEFAULT 0 CHECK (payer_policy_verified IN (0,1)),
  ncci_verified INTEGER NOT NULL DEFAULT 0 CHECK (ncci_verified IN (0,1)),
  facility_path_verified INTEGER NOT NULL DEFAULT 0 CHECK (facility_path_verified IN (0,1)),
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS nicu_audit_events (
  event_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES nicu_cases(case_id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nicu_cases_user ON nicu_cases(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nicu_daily_case_date ON nicu_daily_records(case_id, service_date);
CREATE INDEX IF NOT EXISTS idx_nicu_diagnosis_case ON nicu_diagnosis_evidence(case_id, code);
CREATE INDEX IF NOT EXISTS idx_nicu_ncci_case ON nicu_ncci_results(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nicu_audit_case ON nicu_audit_events(case_id, created_at);

INSERT OR REPLACE INTO nicu_source_registry
(source_id,title,authority,source_url,version_label,effective_from,effective_to,retrieved_at,use_scope,coverage_determination) VALUES
('cms-ncci-2026-xi','Medicare NCCI Policy Manual Chapter XI','CMS','https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf','2026','2026-01-01','2026-12-31','2026-08-10','Practitioner included services, per-diem reporting, directing-provider and transition controls',0),
('cms-ncci-ptp-2026q3','Medicare NCCI Practitioner PTP Edits','CMS','https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits','2026 Q3','2026-07-01','2026-09-30','2026-08-10','Date-effective practitioner code-pair review',0),
('cms-medicaid-ncci-2026q3','Medicaid NCCI Edit Files','CMS','https://www.cms.gov/medicare/coding-billing/ncci-medicaid/medicaid-ncci-edit-files','2026 Q3','2026-07-01','2026-09-30','2026-08-10','State Medicaid NCCI control reference; not a coverage file',0),
('cdc-icd10-fy2026','ICD-10-CM Official Guidelines for Coding and Reporting','CDC/NCHS','https://ftp.cdc.gov/pub/health_statistics/nchs/publications/ICD10CM/2026/ICD-10-CM-October-2025-Guidelines.pdf','FY 2026','2025-10-01','2026-09-30','2026-08-10','Perinatal diagnosis documentation, significance, birth-record and sequencing guidance',0),
('aap-global-per-diem','Global Per Diem Critical Care Direct Supervision and Reporting Guidelines','AAP','https://www.aap.org/globalassets/publications/cfp22/global_per_diem_critical_care_codes.pdf','Current retrieved 2026',NULL,NULL,'2026-08-10','Directing-provider role, bedside presence, plan direction and documentation controls',0),
('ama-cpt-current','Current licensed CPT guidance','AMA','https://www.ama-assn.org/practice-management/cpt','Current licensed edition',NULL,NULL,'2026-08-10','Licensed descriptors and full neonatal/pediatric per-diem rules',0),
('payer-policy-current','Date-effective state Medicaid CHIP or commercial payer policy','Payer/State','https://www.medicaid.gov/medicaid/by-state/index.html','Case-specific',NULL,NULL,'2026-08-10','Coverage, provider eligibility, modifier, facility and payment policy',1);

INSERT OR REPLACE INTO nicu_policy_versions
(policy_id,engine_version,policy_version,effective_from,source_ids_json,professional_scope,facility_release_enabled,human_approval_required,autonomous_submission_allowed) VALUES
('nicu-cms-ncci-aap-fy2026','2026.08.10.1','CMS-NCCI-AAP-FY2026','2026-07-01','["cms-ncci-2026-xi","cms-ncci-ptp-2026q3","cms-medicaid-ncci-2026q3","cdc-icd10-fy2026","aap-global-per-diem","ama-cpt-current","payer-policy-current"]',1,0,1,0);

INSERT OR REPLACE INTO nicu_code_catalog
(code,family,age_or_weight_band,sequence_role,generic_label,licensed_descriptor_embedded,policy_id) VALUES
('99468','critical','0-28 days','initial','Neonatal critical per-diem candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99469','critical','0-28 days','subsequent','Neonatal critical per-diem candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99471','critical','29 days to under 2 years','initial','Infant critical per-diem candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99472','critical','29 days to under 2 years','subsequent','Infant critical per-diem candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99475','critical','2 through 5 years','initial','Young-child critical per-diem candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99476','critical','2 through 5 years','subsequent','Young-child critical per-diem candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99477','intensive','0-28 days','initial','Initial neonatal intensive per-diem candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99478','intensive','present weight under 1500 g','subsequent','Continuing intensive weight-tier candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99479','intensive','present weight 1500-2500 g','subsequent','Continuing intensive weight-tier candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99480','intensive','present weight 2501-5000 g','subsequent','Continuing intensive weight-tier candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99238','discharge','documented discharge time','discharge','Hospital discharge-management candidate',0,'nicu-cms-ncci-aap-fy2026'),
('99239','discharge','documented discharge time','discharge','Hospital discharge-management candidate',0,'nicu-cms-ncci-aap-fy2026');

INSERT OR REPLACE INTO nicu_rule_catalog
(rule_id,policy_id,domain,rule_key,rule_summary,source_id,release_effect) VALUES
('nicu-age-calendar','nicu-cms-ncci-aap-fy2026','eligibility','calendar-age','Calculate age from DOB and service date; do not accept a stale typed age.','ama-cpt-current','hold'),
('nicu-critical-explicit','nicu-cms-ncci-aap-fy2026','clinical-evidence','critical-not-inferred','Critical status must be explicit and is not inferred from unit, ventilation, diagnosis or procedure.','aap-global-per-diem','hold'),
('nicu-intensive-explicit','nicu-cms-ncci-aap-fy2026','clinical-evidence','intensive-not-inferred','Intensive services require explicit daily documentation.','ama-cpt-current','hold'),
('nicu-present-weight','nicu-cms-ncci-aap-fy2026','weight','present-not-birth','Use current present body weight, never birth weight, for continuing intensive tiers.','ama-cpt-current','hold'),
('nicu-weight-boundaries','nicu-cms-ncci-aap-fy2026','weight','tier-boundaries','Apply under 1500 g, 1500-2500 g, and 2501-5000 g boundaries exactly.','ama-cpt-current','hold'),
('nicu-initial-once-band','nicu-cms-ncci-aap-fy2026','sequence','initial-age-band','Track initial critical service independently in each applicable age category during the stay.','ama-cpt-current','review'),
('nicu-continuing-history','nicu-cms-ncci-aap-fy2026','sequence','continuing-requires-history','Continuing intensive service requires an earlier critical or intensive per-diem service in the admission.','ama-cpt-current','hold'),
('nicu-one-director','nicu-cms-ncci-aap-fy2026','provider','one-per-diem','Generally one directing provider reports a neonatal/pediatric global per-diem service per date.','cms-ncci-2026-xi','hold'),
('nicu-bedside-direction','nicu-cms-ncci-aap-fy2026','provider','bedside-and-plan','Reporting provider must support bedside examination and direction of the plan of care.','aap-global-per-diem','hold'),
('nicu-no-split-inference','nicu-cms-ncci-aap-fy2026','provider','npp-state-payer','Do not infer independent NPP reporting eligibility; verify state and payer rules.','aap-global-per-diem','hold'),
('nicu-included-services','nicu-cms-ncci-aap-fy2026','bundling','practitioner-inclusions','Suppress CMS-listed practitioner services included in neonatal/pediatric per-diem care.','cms-ncci-2026-xi','hold'),
('nicu-procedure-review','nicu-cms-ncci-aap-fy2026','bundling','no-universal-list','All other procedures require date-effective NCCI, MUE, global-period, licensed CPT and payer review.','cms-ncci-ptp-2026q3','review'),
('nicu-modifier25','nicu-cms-ncci-aap-fy2026','modifier','never-automatic','Never assign modifier 25 solely because a procedure and per-diem service occur on the same date.','cms-ncci-2026-xi','hold'),
('nicu-z38-birth-record','nicu-cms-ncci-aap-fy2026','diagnosis','z38-birth-only','Z38 is used on the birth record and not by a receiving transfer hospital.','cdc-icd10-fy2026','hold'),
('nicu-diagnosis-significant','nicu-cms-ncci-aap-fy2026','diagnosis','clinically-significant','Retain only provider-documented clinically significant conditions; do not derive diagnoses from measurements.','cdc-icd10-fy2026','hold'),
('nicu-facility-boundary','nicu-cms-ncci-aap-fy2026','claim-scope','facility-grouper','Facility NICU claims require inpatient grouper, POA, revenue/accommodation and contract review.','payer-policy-current','hold'),
('nicu-payer-policy','nicu-cms-ncci-aap-fy2026','coverage','payer-current','Require date-effective state or commercial payer policy; NCCI presence does not establish coverage.','cms-medicaid-ncci-2026q3','hold'),
('nicu-human-release','nicu-cms-ncci-aap-fy2026','safety','human-approval','Require human coder approval and disable autonomous claim submission.','cms-ncci-2026-xi','hold');
