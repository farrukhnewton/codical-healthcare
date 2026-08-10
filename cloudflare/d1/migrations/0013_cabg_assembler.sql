PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cabg_source_registry (
  source_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authority TEXT NOT NULL,
  url TEXT NOT NULL,
  effective_date TEXT,
  retrieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0,1))
);

CREATE TABLE IF NOT EXISTS cabg_policy_versions (
  policy_id TEXT PRIMARY KEY,
  engine_version TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cabg_code_catalog (
  code TEXT NOT NULL,
  system TEXT NOT NULL CHECK (system IN ('CPT','ICD-10-PCS')),
  family TEXT NOT NULL,
  role TEXT NOT NULL,
  target_count_min INTEGER,
  target_count_max INTEGER,
  conduit_kind TEXT,
  approach TEXT,
  device_character TEXT,
  qualifier_character TEXT,
  mue_value INTEGER,
  source_id TEXT NOT NULL REFERENCES cabg_source_registry(source_id),
  effective_date TEXT NOT NULL,
  PRIMARY KEY (code, system)
);

CREATE TABLE IF NOT EXISTS cabg_rule_catalog (
  rule_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES cabg_policy_versions(policy_id),
  domain TEXT NOT NULL,
  condition_key TEXT NOT NULL,
  rule_summary TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES cabg_source_registry(source_id),
  disposition TEXT NOT NULL CHECK (disposition IN ('hold','review','allow'))
);

CREATE TABLE IF NOT EXISTS cabg_cases (
  case_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  patient_reference TEXT,
  service_date TEXT,
  claim_scope TEXT NOT NULL,
  payer_type TEXT,
  payer_name TEXT,
  payer_jurisdiction TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  engine_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS cabg_cases_user_idx ON cabg_cases(user_id, created_at);

CREATE TABLE IF NOT EXISTS cabg_documents (
  document_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cabg_cases(case_id) ON DELETE CASCADE,
  object_key TEXT,
  file_name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  page_count INTEGER,
  extraction_method TEXT,
  requires_manual_review INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cabg_targets (
  target_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cabg_cases(case_id) ON DELETE CASCADE,
  target_vessel TEXT,
  conduit_kind TEXT,
  conduit_source TEXT,
  inflow_source TEXT,
  approach TEXT,
  completed_state TEXT NOT NULL DEFAULT 'unknown',
  source_verified_state TEXT NOT NULL DEFAULT 'unknown',
  source_document_id TEXT REFERENCES cabg_documents(document_id)
);

CREATE TABLE IF NOT EXISTS cabg_harvests (
  harvest_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cabg_cases(case_id) ON DELETE CASCADE,
  source TEXT,
  method TEXT,
  performed_state TEXT NOT NULL DEFAULT 'unknown',
  source_verified_state TEXT NOT NULL DEFAULT 'unknown',
  source_document_id TEXT REFERENCES cabg_documents(document_id)
);

CREATE TABLE IF NOT EXISTS cabg_diagnosis_evidence (
  evidence_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cabg_cases(case_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  provider_documented_state TEXT NOT NULL DEFAULT 'unknown',
  clinically_supported_state TEXT NOT NULL DEFAULT 'unknown',
  source_document_id TEXT REFERENCES cabg_documents(document_id)
);

CREATE TABLE IF NOT EXISTS cabg_code_decisions (
  decision_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cabg_cases(case_id) ON DELETE CASCADE,
  code TEXT,
  system TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  rationale TEXT NOT NULL,
  blockers_json TEXT NOT NULL DEFAULT '[]',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  units INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cabg_ncci_results (
  result_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cabg_cases(case_id) ON DELETE CASCADE,
  edit_version TEXT NOT NULL,
  code_pair TEXT NOT NULL,
  result_json TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cabg_approvals (
  approval_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cabg_cases(case_id) ON DELETE CASCADE,
  approver_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  attestation TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cabg_audit_events (
  event_id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cabg_cases(case_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO cabg_source_registry (source_id,title,authority,url,effective_date,is_primary) VALUES
('cms-pfs-rvu26c','July 2026 Medicare Physician Fee Schedule Relative Value File','CMS','https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files/rvu26c','2026-07-01',1),
('cms-ncci-2026-v','2026 Medicare NCCI Policy Manual Chapter V','CMS','https://www.cms.gov/files/document/05-chapter5-ncci-medicare-policy-manual-2026-final.pdf','2026-01-01',1),
('cms-ncci-ptp-2026q3','Medicare NCCI Practitioner PTP Edits v32.2','CMS','https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits','2026-07-01',1),
('cms-ncci-mue-2026q3','Medicare Practitioner MUE Table','CMS','https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits-mues','2026-07-01',1),
('cms-ncci-aoc-2026q3','Medicare Add-on Code Edits','CMS','https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-add-code-edits','2026-07-01',1),
('cms-icd10-pcs-2026','April 2026 ICD-10-PCS Files and Guidelines','CMS','https://www.cms.gov/medicare/coding-billing/icd-10-codes','2026-04-01',1),
('cms-pcs-job-aid','CMS ICD-10-PCS Convert Job Aid, Coronary Bypass Example','CMS','https://www.cms.gov/Outreach-and-Education/MLN/WBT/MLN4151758-ICD-10-PCS/ICD10PCS/jobaids/jobaid.html','2026-04-01',1),
('cms-ipps-fy2026','FY 2026 IPPS Final Rule and Grouper Files','CMS','https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/fy-2026-ipps-final-rule-home-page','2025-10-01',1),
('cms-mcd-current','Medicare Coverage Database','CMS','https://www.cms.gov/medicare-coverage-database/search.aspx','2026-08-10',1),
('sts-acsd-4.20.2','STS Adult Cardiac Surgery Data Specifications 4.20.2','STS','https://www.sts.org/sites/default/files/Database%20Manuals/Training%20Manual%20V4_20_2%20May%202026%20Volume%201.pdf','2026-05-01',1),
('ama-cpt-current','Current Licensed CPT Guidance','AMA','https://www.ama-assn.org/practice-management/cpt','2026-01-01',1);

INSERT OR REPLACE INTO cabg_policy_versions (policy_id,engine_version,effective_date,description) VALUES
('cabg-cms-2026q3','2026.08.10.1','2026-07-01','CABG target, conduit, harvest, reoperation, endarterectomy, PCS, MUE, AOC, and NCCI review policy.');

INSERT OR REPLACE INTO cabg_code_catalog (code,system,family,role,target_count_min,target_count_max,conduit_kind,approach,device_character,qualifier_character,mue_value,source_id,effective_date) VALUES
('33508','CPT','harvest','endoscopic-vein',NULL,NULL,'venous','endoscopic',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33509','CPT','harvest','endoscopic-upper-artery',NULL,NULL,'arterial','endoscopic',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33510','CPT','cabg','venous-only',1,1,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33511','CPT','cabg','venous-only',2,2,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33512','CPT','cabg','venous-only',3,3,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33513','CPT','cabg','venous-only',4,4,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33514','CPT','cabg','venous-only',5,5,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33516','CPT','cabg','venous-only',6,NULL,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33517','CPT','cabg','combined-venous-add-on',1,1,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33518','CPT','cabg','combined-venous-add-on',2,2,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33519','CPT','cabg','combined-venous-add-on',3,3,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33521','CPT','cabg','combined-venous-add-on',4,4,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33522','CPT','cabg','combined-venous-add-on',5,5,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33523','CPT','cabg','combined-venous-add-on',6,NULL,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33530','CPT','redo','reoperation',NULL,NULL,NULL,'open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33533','CPT','cabg','arterial-primary',1,1,'arterial','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33534','CPT','cabg','arterial-primary',2,2,'arterial','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33535','CPT','cabg','arterial-primary',3,3,'arterial','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33536','CPT','cabg','arterial-primary',4,NULL,'arterial','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('33572','CPT','endarterectomy','coronary-add-on',1,3,NULL,'open',NULL,NULL,3,'cms-ncci-mue-2026q3','2026-07-01'),
('35500','CPT','harvest','open-upper-vein',NULL,NULL,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('35572','CPT','harvest','open-femoropopliteal-vein',NULL,NULL,'venous','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('35600','CPT','harvest','open-upper-artery',NULL,NULL,'arterial','open',NULL,NULL,1,'cms-pfs-rvu26c','2026-07-01'),
('0210000','ICD-10-PCS','cabg-pattern','coronary-bypass-template',1,4,NULL,'open',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('06BP0ZZ','ICD-10-PCS','harvest','right-saphenous-open',NULL,NULL,'venous','open',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('06BP3ZZ','ICD-10-PCS','harvest','right-saphenous-percutaneous',NULL,NULL,'venous','percutaneous',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('06BP4ZZ','ICD-10-PCS','harvest','right-saphenous-endoscopic',NULL,NULL,'venous','percutaneous-endoscopic',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('06BQ0ZZ','ICD-10-PCS','harvest','left-saphenous-open',NULL,NULL,'venous','open',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('06BQ3ZZ','ICD-10-PCS','harvest','left-saphenous-percutaneous',NULL,NULL,'venous','percutaneous',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('06BQ4ZZ','ICD-10-PCS','harvest','left-saphenous-endoscopic',NULL,NULL,'venous','percutaneous-endoscopic',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('03BB0ZZ','ICD-10-PCS','harvest','right-radial-open',NULL,NULL,'arterial','open',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('03BB3ZZ','ICD-10-PCS','harvest','right-radial-percutaneous',NULL,NULL,'arterial','percutaneous',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('03BB4ZZ','ICD-10-PCS','harvest','right-radial-endoscopic',NULL,NULL,'arterial','percutaneous-endoscopic',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('03BC0ZZ','ICD-10-PCS','harvest','left-radial-open',NULL,NULL,'arterial','open',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('03BC3ZZ','ICD-10-PCS','harvest','left-radial-percutaneous',NULL,NULL,'arterial','percutaneous',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01'),
('03BC4ZZ','ICD-10-PCS','harvest','left-radial-endoscopic',NULL,NULL,'arterial','percutaneous-endoscopic',NULL,NULL,NULL,'cms-icd10-pcs-2026','2026-04-01');

INSERT OR REPLACE INTO cabg_rule_catalog (rule_id,policy_id,domain,condition_key,rule_summary,source_id,disposition) VALUES
('cabg-distal-targets','cabg-cms-2026q3','graft-count','distal-anastomoses','Count documented completed distal coronary targets, not conduit pieces or proximal anastomoses.','sts-acsd-4.20.2','hold'),
('cabg-venous-only-one-family','cabg-cms-2026q3','professional','venous-only','Report one venous-only CABG family code when no arterial graft is completed.','cms-ncci-2026-v','hold'),
('cabg-combined-two-families','cabg-cms-2026q3','professional','combined','Combined arterial and venous CABG uses one arterial primary family code and one venous add-on family code.','cms-ncci-2026-v','hold'),
('cabg-arterial-only-one-family','cabg-cms-2026q3','professional','arterial-only','Report one arterial CABG family code when no venous graft is completed.','cms-ncci-2026-v','hold'),
('cabg-no-33515','cabg-cms-2026q3','code-status','33515','33515 is not an active July 2026 PFS code and must not be generated.','cms-pfs-rvu26c','hold'),
('cabg-no-33520','cabg-cms-2026q3','code-status','33520','33520 is not an active July 2026 PFS code and must not be generated.','cms-pfs-rvu26c','hold'),
('cabg-vein-procurement','cabg-cms-2026q3','bundling','venous-procurement','Routine venous graft procurement is integral; only a specifically supported harvest code may be considered.','cms-ncci-2026-v','hold'),
('cabg-harvest-aoc','cabg-cms-2026q3','add-on','harvest-primary','Validate each harvest add-on against the current CMS AOC primary-code file.','cms-ncci-aoc-2026q3','review'),
('cabg-cpb-bundled','cabg-cms-2026q3','bundling','cardiopulmonary-bypass','Cannulation and routine cardiopulmonary bypass work are integral.','cms-ncci-2026-v','hold'),
('cabg-sternotomy-closure','cabg-cms-2026q3','bundling','sternotomy','Approach, sternotomy closure, and routine wire removal are not separately reported.','cms-ncci-2026-v','hold'),
('cabg-ultrasound-limited','cabg-cms-2026q3','correct-coding','epiaortic-ultrasound','Epi-aortic ultrasound requires exact circumstances and current edit/modifier review; graft-procurement guidance is not separately reported.','cms-ncci-2026-v','review'),
('cabg-redo-month','cabg-cms-2026q3','add-on','reoperation-month','Reoperation add-on review requires explicit prior CABG/valve evidence and more than one calendar month.','cms-ncci-aoc-2026q3','hold'),
('cabg-endarterectomy-mue','cabg-cms-2026q3','mue','33572-units','The published July 2026 practitioner MUE for 33572 is 3 units.','cms-ncci-mue-2026q3','hold'),
('cabg-mue-one','cabg-cms-2026q3','mue','cabg-unit','Published CABG family, harvest, and redo candidates have an MUE of one unit.','cms-ncci-mue-2026q3','hold'),
('cabg-valve-no-inference','cabg-cms-2026q3','concomitant','valve-specificity','Never infer a valve CPT/PCS code from a generic valve checkbox; retain source-verified exact procedures for independent review.','cms-ncci-2026-v','hold'),
('cabg-ncci-current','cabg-cms-2026q3','correct-coding','ptp-current','Check current practitioner NCCI PTP edits for every same-day professional combination.','cms-ncci-ptp-2026q3','review'),
('cabg-modifier-never-auto','cabg-cms-2026q3','correct-coding','modifier','Never assign 51, 59, XS, 62, 66, 80, 82, or another modifier automatically.','cms-ncci-2026-v','hold'),
('cabg-global','cabg-cms-2026q3','global-surgery','090','CABG primary families have a 090-day global indicator in the July 2026 PFS file.','cms-pfs-rvu26c','review'),
('cabg-pcs-separate','cabg-cms-2026q3','facility','no-cpt-crosswalk','Construct inpatient PCS independently; never crosswalk professional CPT into PCS.','cms-icd10-pcs-2026','hold'),
('cabg-pcs-group','cabg-cms-2026q3','facility','device-qualifier-group','Use separate PCS bypass codes when device/conduit or inflow qualifier differs.','cms-pcs-job-aid','hold'),
('cabg-pcs-seven','cabg-cms-2026q3','facility','seven-characters','Every PCS character must be supported by the signed operative record and date-effective table.','cms-icd10-pcs-2026','hold'),
('cabg-harvest-pcs','cabg-cms-2026q3','facility','harvest-objective','Code a documented inpatient conduit-harvest objective separately when current PCS guidance supports it.','cms-icd10-pcs-2026','review'),
('cabg-diagnosis-no-inference','cabg-cms-2026q3','diagnosis','provider-documented','Do not infer coronary disease, angina, infarction, graft disease, or complications from CABG performance.','cms-icd10-pcs-2026','hold'),
('cabg-coverage-separate','cabg-cms-2026q3','coverage','payer-policy','Code selection does not establish coverage; verify date-effective payer policy and authorization.','cms-mcd-current','review'),
('cabg-no-msdrg','cabg-cms-2026q3','facility','ms-drg','Do not determine an MS-DRG until the complete discharge diagnosis/procedure record is available to the current grouper.','cms-ipps-fy2026','hold'),
('cabg-human-release','cabg-cms-2026q3','safety','human-approval','Require human coder approval and disable autonomous claim submission.','cms-ncci-2026-v','hold');
