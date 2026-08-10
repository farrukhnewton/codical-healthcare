PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vad_ecmo_source_registry (
  source_id TEXT PRIMARY KEY, title TEXT NOT NULL, source_url TEXT NOT NULL,
  publisher TEXT NOT NULL, version_label TEXT NOT NULL, effective_from TEXT,
  effective_to TEXT, retrieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vad_ecmo_policy_versions (
  policy_id TEXT PRIMARY KEY, engine_version TEXT NOT NULL, policy_version TEXT NOT NULL,
  effective_from TEXT NOT NULL, professional_scope TEXT NOT NULL, facility_scope TEXT NOT NULL,
  release_status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vad_ecmo_code_catalog (
  code TEXT NOT NULL, code_system TEXT NOT NULL, family TEXT NOT NULL, role TEXT NOT NULL,
  mode TEXT, access_type TEXT, age_band TEXT, configuration TEXT, approach TEXT,
  source_id TEXT NOT NULL, effective_from TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (code, code_system, effective_from),
  FOREIGN KEY (source_id) REFERENCES vad_ecmo_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS vad_ecmo_rule_catalog (
  rule_id TEXT PRIMARY KEY, policy_id TEXT NOT NULL, domain TEXT NOT NULL, condition_key TEXT NOT NULL,
  rule_summary TEXT NOT NULL, source_id TEXT NOT NULL, disposition TEXT NOT NULL,
  FOREIGN KEY (policy_id) REFERENCES vad_ecmo_policy_versions(policy_id),
  FOREIGN KEY (source_id) REFERENCES vad_ecmo_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS vad_ecmo_cases (
  case_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, patient_reference TEXT, date_of_birth TEXT,
  claim_scope TEXT NOT NULL, payer_type TEXT, payer_name TEXT, payer_jurisdiction TEXT,
  engine_version TEXT NOT NULL, policy_version TEXT NOT NULL, status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vad_ecmo_documents (
  document_id TEXT PRIMARY KEY, case_id TEXT NOT NULL, object_key TEXT, file_name TEXT NOT NULL,
  sha256 TEXT, page_count INTEGER, extraction_method TEXT, requires_manual_review INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES vad_ecmo_cases(case_id)
);

CREATE TABLE IF NOT EXISTS vad_ecmo_services (
  service_id TEXT PRIMARY KEY, case_id TEXT NOT NULL, service_date TEXT NOT NULL, support_kind TEXT NOT NULL,
  phase TEXT NOT NULL, ecmo_mode TEXT, access_type TEXT, configuration TEXT, intraoperative_state TEXT,
  bypass_state TEXT, reporting_clinician TEXT, source_verified_state TEXT, source_document_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES vad_ecmo_cases(case_id),
  FOREIGN KEY (source_document_id) REFERENCES vad_ecmo_documents(document_id)
);

CREATE TABLE IF NOT EXISTS vad_ecmo_diagnosis_evidence (
  diagnosis_id TEXT PRIMARY KEY, case_id TEXT NOT NULL, code TEXT NOT NULL, description TEXT,
  provider_documented_state TEXT NOT NULL, clinically_supported_state TEXT NOT NULL,
  source_document_id TEXT, disposition TEXT NOT NULL, rationale TEXT,
  FOREIGN KEY (case_id) REFERENCES vad_ecmo_cases(case_id),
  FOREIGN KEY (source_document_id) REFERENCES vad_ecmo_documents(document_id)
);

CREATE TABLE IF NOT EXISTS vad_ecmo_coverage_evidence (
  evidence_id TEXT PRIMARY KEY, case_id TEXT NOT NULL, evidence_key TEXT NOT NULL, evidence_value TEXT,
  review_state TEXT NOT NULL, source_document_id TEXT, source_excerpt TEXT, disposition TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES vad_ecmo_cases(case_id),
  FOREIGN KEY (source_document_id) REFERENCES vad_ecmo_documents(document_id)
);

CREATE TABLE IF NOT EXISTS vad_ecmo_code_decisions (
  decision_id TEXT PRIMARY KEY, case_id TEXT NOT NULL, service_id TEXT NOT NULL, code TEXT,
  code_system TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, rationale TEXT NOT NULL,
  blockers_json TEXT NOT NULL DEFAULT '[]', warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES vad_ecmo_cases(case_id),
  FOREIGN KEY (service_id) REFERENCES vad_ecmo_services(service_id)
);

CREATE TABLE IF NOT EXISTS vad_ecmo_ncci_results (
  result_id TEXT PRIMARY KEY, case_id TEXT NOT NULL, service_date TEXT NOT NULL, column_one TEXT NOT NULL,
  column_two TEXT NOT NULL, edit_version TEXT NOT NULL, modifier_indicator TEXT, disposition TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES vad_ecmo_cases(case_id)
);

CREATE TABLE IF NOT EXISTS vad_ecmo_approvals (
  approval_id TEXT PRIMARY KEY, case_id TEXT NOT NULL, reviewer_user_id TEXT NOT NULL,
  approval_type TEXT NOT NULL, decision TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES vad_ecmo_cases(case_id)
);

CREATE TABLE IF NOT EXISTS vad_ecmo_audit_events (
  event_id TEXT PRIMARY KEY, case_id TEXT, user_id TEXT, event_type TEXT NOT NULL,
  event_payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vad_ecmo_cases_user ON vad_ecmo_cases(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vad_ecmo_services_case_date ON vad_ecmo_services(case_id, service_date);
CREATE INDEX IF NOT EXISTS idx_vad_ecmo_codes_family ON vad_ecmo_code_catalog(family, active);
CREATE INDEX IF NOT EXISTS idx_vad_ecmo_rules_domain ON vad_ecmo_rule_catalog(domain);

INSERT OR REPLACE INTO vad_ecmo_source_registry (source_id,title,source_url,publisher,version_label,effective_from) VALUES
('cms-ncd-20.9.1','Ventricular Assist Devices NCD 20.9.1','https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=360&ncdver=2','CMS','Version 2','2020-12-01'),
('cms-pfs-rvu26c','Physician Fee Schedule Relative Value File','https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files/rvu26c','CMS','July 2026','2026-07-01'),
('cms-ncci-2026-v','Medicare NCCI Policy Manual Chapter V','https://www.cms.gov/files/document/2026-ncci-medicare-policy-manual-all-chapters.pdf','CMS','2026','2026-01-01'),
('cms-ncci-ptp-2026q3','Medicare NCCI Practitioner and Hospital PTP Edits','https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits','CMS','v322r0','2026-07-01'),
('cms-icd10-pcs-2026','ICD-10-PCS Order File and Official Guidelines','https://www.cms.gov/medicare/coding-billing/icd-10-codes','CMS','April 2026','2026-04-01'),
('cms-ipps-fy2026','FY 2026 IPPS Final Rule and MS-DRG Files','https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/fy-2026-ipps-final-rule-home-page','CMS','FY 2026','2025-10-01'),
('ama-cpt-current','Current licensed CPT guidance','https://www.ama-assn.org/practice-management/cpt','AMA','2026','2026-01-01');

INSERT OR REPLACE INTO vad_ecmo_policy_versions (policy_id,engine_version,policy_version,effective_from,professional_scope,facility_scope) VALUES
('vad-ecmo-cms-2026q3','2026.08.10.1','CMS-NCD20.9.1-NCCI-PFS-PCS-2026Q3','2026-07-01','Professional CPT candidate review using documented device, mode, phase, age, access, configuration, and current edits.','Inpatient ICD-10-PCS candidate review using complete operative/support facts and date-effective IPPS grouper files.');

INSERT OR REPLACE INTO vad_ecmo_code_catalog (code,code_system,family,role,mode,access_type,age_band,configuration,approach,source_id,effective_from) VALUES
('33946','CPT','ECMO','initiation','VV',NULL,NULL,NULL,NULL,'cms-pfs-rvu26c','2026-07-01'),
('33947','CPT','ECMO','initiation','VA',NULL,NULL,NULL,NULL,'cms-pfs-rvu26c','2026-07-01'),
('33948','CPT','ECMO','daily-management','VV',NULL,NULL,NULL,NULL,'cms-pfs-rvu26c','2026-07-01'),
('33949','CPT','ECMO','daily-management','VA',NULL,NULL,NULL,NULL,'cms-pfs-rvu26c','2026-07-01'),
('33951','CPT','ECMO','insertion',NULL,'peripheral','birth-5',NULL,'percutaneous','cms-pfs-rvu26c','2026-07-01'),
('33952','CPT','ECMO','insertion',NULL,'peripheral','6-plus',NULL,'percutaneous','cms-pfs-rvu26c','2026-07-01'),
('33953','CPT','ECMO','insertion',NULL,'peripheral','birth-5',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33954','CPT','ECMO','insertion',NULL,'peripheral','6-plus',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33955','CPT','ECMO','insertion',NULL,'central','birth-5',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33956','CPT','ECMO','insertion',NULL,'central','6-plus',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33957','CPT','ECMO','reposition',NULL,'peripheral','birth-5',NULL,'percutaneous','cms-pfs-rvu26c','2026-07-01'),
('33958','CPT','ECMO','reposition',NULL,'peripheral','6-plus',NULL,'percutaneous','cms-pfs-rvu26c','2026-07-01'),
('33959','CPT','ECMO','reposition',NULL,'peripheral','birth-5',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33962','CPT','ECMO','reposition',NULL,'peripheral','6-plus',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33963','CPT','ECMO','reposition',NULL,'central','birth-5',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33964','CPT','ECMO','reposition',NULL,'central','6-plus',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33965','CPT','ECMO','removal',NULL,'peripheral','birth-5',NULL,'percutaneous','cms-pfs-rvu26c','2026-07-01'),
('33966','CPT','ECMO','removal',NULL,'peripheral','6-plus',NULL,'percutaneous','cms-pfs-rvu26c','2026-07-01'),
('33969','CPT','ECMO','removal',NULL,'peripheral','birth-5',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33984','CPT','ECMO','removal',NULL,'peripheral','6-plus',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33985','CPT','ECMO','removal',NULL,'central','birth-5',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33986','CPT','ECMO','removal',NULL,'central','6-plus',NULL,'open','cms-pfs-rvu26c','2026-07-01'),
('33975','CPT','VAD','insertion',NULL,NULL,NULL,'single-ventricle','extracorporeal','cms-pfs-rvu26c','2026-07-01'),
('33976','CPT','VAD','insertion',NULL,NULL,NULL,'biventricular','extracorporeal','cms-pfs-rvu26c','2026-07-01'),
('33977','CPT','VAD','removal',NULL,NULL,NULL,'single-ventricle','extracorporeal','cms-pfs-rvu26c','2026-07-01'),
('33978','CPT','VAD','removal',NULL,NULL,NULL,'biventricular','extracorporeal','cms-pfs-rvu26c','2026-07-01'),
('33979','CPT','VAD','insertion',NULL,NULL,NULL,'single-ventricle','implantable','cms-pfs-rvu26c','2026-07-01'),
('33980','CPT','VAD','removal',NULL,NULL,NULL,'single-ventricle','implantable','cms-pfs-rvu26c','2026-07-01'),
('33981','CPT','VAD','replacement',NULL,NULL,NULL,NULL,'extracorporeal','cms-pfs-rvu26c','2026-07-01'),
('33982','CPT','VAD','replacement-without-cpb',NULL,NULL,NULL,NULL,'implantable','cms-pfs-rvu26c','2026-07-01'),
('33983','CPT','VAD','replacement-with-cpb',NULL,NULL,NULL,NULL,'implantable','cms-pfs-rvu26c','2026-07-01'),
('33990','CPT','pVAD','insertion',NULL,NULL,NULL,'arterial-only','percutaneous','cms-pfs-rvu26c','2026-07-01'),
('33991','CPT','pVAD','insertion',NULL,NULL,NULL,'arterial-and-venous','percutaneous','cms-pfs-rvu26c','2026-07-01'),
('33992','CPT','pVAD','removal',NULL,NULL,NULL,NULL,'percutaneous','cms-pfs-rvu26c','2026-07-01'),
('33993','CPT','pVAD','reposition',NULL,NULL,NULL,NULL,'percutaneous','cms-pfs-rvu26c','2026-07-01'),
('93750','CPT','VAD','interrogation',NULL,NULL,NULL,NULL,'in-person','cms-pfs-rvu26c','2026-07-01'),
('5A1522F','ICD-10-PCS','ECMO','support','ECMO','central',NULL,NULL,'non-intraoperative','cms-icd10-pcs-2026','2026-04-01'),
('5A1522G','ICD-10-PCS','ECMO','support','VA','peripheral',NULL,NULL,'non-intraoperative','cms-icd10-pcs-2026','2026-04-01'),
('5A1522H','ICD-10-PCS','ECMO','support','VV','peripheral',NULL,NULL,'non-intraoperative','cms-icd10-pcs-2026','2026-04-01'),
('5A15A2F','ICD-10-PCS','ECMO','support','ECMO','central',NULL,NULL,'intraoperative','cms-icd10-pcs-2026','2026-04-01'),
('5A15A2G','ICD-10-PCS','ECMO','support','VA','peripheral',NULL,NULL,'intraoperative','cms-icd10-pcs-2026','2026-04-01'),
('5A15A2H','ICD-10-PCS','ECMO','support','VV','peripheral',NULL,NULL,'intraoperative','cms-icd10-pcs-2026','2026-04-01'),
('02HA0QZ','ICD-10-PCS','VAD','insertion',NULL,NULL,NULL,'implantable','open','cms-icd10-pcs-2026','2026-04-01'),
('02HA3QZ','ICD-10-PCS','VAD','insertion',NULL,NULL,NULL,'implantable','percutaneous','cms-icd10-pcs-2026','2026-04-01'),
('02PA0QZ','ICD-10-PCS','VAD','removal',NULL,NULL,NULL,'implantable','open','cms-icd10-pcs-2026','2026-04-01'),
('02WA0QZ','ICD-10-PCS','VAD','revision',NULL,NULL,NULL,'implantable','open','cms-icd10-pcs-2026','2026-04-01');

INSERT OR REPLACE INTO vad_ecmo_rule_catalog (rule_id,policy_id,domain,condition_key,rule_summary,source_id,disposition) VALUES
('ve-mode-required','vad-ecmo-cms-2026q3','ECMO','vv-va-explicit','VV versus VA must be explicit for initiation and daily management.','cms-pfs-rvu26c','hold'),
('ve-age-access-required','vad-ecmo-cms-2026q3','ECMO','age-access','Cannulation, reposition, and removal require age and exact access/approach.','cms-pfs-rvu26c','hold'),
('ve-management-required','vad-ecmo-cms-2026q3','ECMO','management-documented','Initiation or daily management work must be documented; support presence alone is insufficient.','cms-pfs-rvu26c','hold'),
('ve-no-weaning-code','vad-ecmo-cms-2026q3','ECMO','weaning-not-33949','Do not mislabel VA daily management as a weaning code.','cms-pfs-rvu26c','hold'),
('ve-vad-configuration','vad-ecmo-cms-2026q3','VAD','configuration','Extracorporeal VAD insertion/removal requires single-ventricle versus biventricular configuration.','cms-pfs-rvu26c','hold'),
('ve-vad-cpb','vad-ecmo-cms-2026q3','VAD','replacement-cpb','Implantable VAD replacement requires bypass-use evidence.','cms-pfs-rvu26c','hold'),
('ve-pvad-path','vad-ecmo-cms-2026q3','pVAD','arterial-path','Percutaneous insertion requires arterial-only versus arterial-and-venous configuration.','cms-pfs-rvu26c','hold'),
('ve-interrogation-evidence','vad-ecmo-cms-2026q3','VAD','interrogation-report','In-person interrogation and analysis/report must both be documented.','cms-pfs-rvu26c','hold'),
('ve-interrogation-frequency','vad-ecmo-cms-2026q3','VAD','not-automatic-daily','VAD interrogation is encounter-based and never auto-generated daily.','cms-pfs-rvu26c','review'),
('ve-ncd-fda','vad-ecmo-cms-2026q3','coverage','fda-label','Medicare VAD coverage requires applicable FDA approval and on-label use.','cms-ncd-20.9.1','hold'),
('ve-ncd-hf','vad-ecmo-cms-2026q3','coverage','heart-failure-criteria','Apply the NYHA IV, LVEF, hemodynamic, and treatment-duration paths in NCD 20.9.1.','cms-ncd-20.9.1','hold'),
('ve-ncd-team','vad-ecmo-cms-2026q3','coverage','multidisciplinary-team','Confirm the explicitly identified qualified multidisciplinary VAD team.','cms-ncd-20.9.1','hold'),
('ve-ncd-facility','vad-ecmo-cms-2026q3','coverage','credentialed-facility','Confirm required CMS-recognized facility credentialing.','cms-ncd-20.9.1','hold'),
('ve-scope-separation','vad-ecmo-cms-2026q3','claim-scope','professional-vs-facility','Never mix professional CPT selection with inpatient ICD-10-PCS construction.','cms-icd10-pcs-2026','hold'),
('ve-pcs-complete','vad-ecmo-cms-2026q3','facility','seven-characters','All seven PCS characters require documented facts; incomplete documentation requires query.','cms-icd10-pcs-2026','hold'),
('ve-pcs-no-crosswalk','vad-ecmo-cms-2026q3','facility','no-cpt-crosswalk','Do not derive inpatient PCS codes from CPT codes.','cms-icd10-pcs-2026','hold'),
('ve-pcs-replacement','vad-ecmo-cms-2026q3','facility','replacement-objectives','Replacement may require distinct removal and insertion PCS objectives.','cms-icd10-pcs-2026','hold'),
('ve-ncci-current','vad-ecmo-cms-2026q3','correct-coding','ptp-mue','Check current practitioner or hospital NCCI PTP and MUE files for same-day combinations.','cms-ncci-ptp-2026q3','review'),
('ve-modifier-never-auto','vad-ecmo-cms-2026q3','correct-coding','modifier','Never assign a modifier automatically to bypass an edit or global package.','cms-ncci-2026-v','hold'),
('ve-diagnosis-no-inference','vad-ecmo-cms-2026q3','diagnosis','provider-documented','Do not infer shock, failure, complications, or status diagnoses from device use.','cms-ncci-2026-v','hold'),
('ve-human-release','vad-ecmo-cms-2026q3','safety','human-approval','Require human coder approval and disable autonomous claim submission.','cms-ncci-2026-v','hold');
