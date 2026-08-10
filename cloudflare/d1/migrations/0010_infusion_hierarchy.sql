PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS infusion_source_registry (
  source_id TEXT PRIMARY KEY,
  authority TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  source_sha256 TEXT,
  refresh_cadence TEXT NOT NULL,
  retrieved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS infusion_policy_versions (
  policy_version_id TEXT PRIMARY KEY,
  engine_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  asp_quarter TEXT NOT NULL,
  asp_code_count INTEGER NOT NULL CHECK (asp_code_count > 0),
  drug_alias_count INTEGER NOT NULL CHECK (drug_alias_count > 0),
  licensed_cpt_validation_required INTEGER NOT NULL DEFAULT 1 CHECK (licensed_cpt_validation_required = 1),
  human_approval_required INTEGER NOT NULL DEFAULT 1 CHECK (human_approval_required = 1),
  autonomous_submission INTEGER NOT NULL DEFAULT 0 CHECK (autonomous_submission = 0),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1))
);

CREATE TABLE IF NOT EXISTS infusion_administration_code_catalog (
  code TEXT PRIMARY KEY,
  family TEXT NOT NULL CHECK (family IN ('hydration','therapeutic','chemotherapy')),
  method TEXT NOT NULL CHECK (method IN ('infusion','push','injection','pump','maintenance')),
  role TEXT NOT NULL CHECK (role IN ('initial','sequential','concurrent','additional-hour','additional-push','injection','pump','maintenance')),
  short_label TEXT NOT NULL,
  timed INTEGER NOT NULL CHECK (timed IN (0,1)),
  add_on INTEGER NOT NULL CHECK (add_on IN (0,1)),
  licensed_descriptor_required INTEGER NOT NULL DEFAULT 1 CHECK (licensed_descriptor_required = 1),
  source_id TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES infusion_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS infusion_rule_catalog (
  rule_id TEXT PRIMARY KEY,
  policy_version_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_id TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('verified','licensed-cpt-review','payer-review')),
  UNIQUE (policy_version_id, rule_key),
  FOREIGN KEY (policy_version_id) REFERENCES infusion_policy_versions(policy_version_id),
  FOREIGN KEY (source_id) REFERENCES infusion_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS infusion_cases (
  case_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  patient_token TEXT NOT NULL,
  service_date TEXT NOT NULL,
  setting TEXT NOT NULL CHECK (setting IN ('physician-office','hospital-outpatient','asc','inpatient')),
  separate_access_medically_necessary INTEGER CHECK (separate_access_medically_necessary IN (0,1)),
  policy_version_id TEXT NOT NULL,
  workflow_status TEXT NOT NULL CHECK (workflow_status IN ('draft','review','hold','approved','void')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (policy_version_id) REFERENCES infusion_policy_versions(policy_version_id)
);
CREATE INDEX IF NOT EXISTS idx_infusion_cases_tenant_date ON infusion_cases(tenant_id, service_date, workflow_status);

CREATE TABLE IF NOT EXISTS infusion_documents (
  document_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  encrypted_object_key TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  extraction_method TEXT NOT NULL,
  requires_manual_review INTEGER NOT NULL DEFAULT 1 CHECK (requires_manual_review = 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES infusion_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS infusion_administrations (
  administration_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  document_id TEXT,
  drug_name TEXT NOT NULL,
  drug_hcpcs TEXT,
  category TEXT NOT NULL CHECK (category IN ('chemotherapy','therapeutic','hydration')),
  method TEXT NOT NULL CHECK (method IN ('infusion','push','injection')),
  administered_dose REAL,
  dose_unit TEXT,
  discarded_dose REAL,
  start_time TEXT,
  stop_time TEXT,
  access_site TEXT,
  medically_necessary INTEGER CHECK (medically_necessary IN (0,1)),
  carrier_fluid_only INTEGER CHECK (carrier_fluid_only IN (0,1)),
  provider_present_for_push INTEGER CHECK (provider_present_for_push IN (0,1)),
  single_dose_container INTEGER CHECK (single_dose_container IN (0,1)),
  jw_jz_applies INTEGER CHECK (jw_jz_applies IN (0,1)),
  separately_payable INTEGER CHECK (separately_payable IN (0,1)),
  human_verified INTEGER NOT NULL DEFAULT 0 CHECK (human_verified IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES infusion_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES infusion_documents(document_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_infusion_admin_case_time ON infusion_administrations(case_id, access_site, start_time);

CREATE TABLE IF NOT EXISTS infusion_access_sites (
  access_site_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  site_label TEXT NOT NULL,
  vascular_site_token TEXT NOT NULL,
  separate_medical_necessity_supported INTEGER CHECK (separate_medical_necessity_supported IN (0,1)),
  double_lumen_same_site INTEGER NOT NULL DEFAULT 0 CHECK (double_lumen_same_site IN (0,1)),
  UNIQUE (case_id, vascular_site_token),
  FOREIGN KEY (case_id) REFERENCES infusion_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS infusion_timeline_decisions (
  decision_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  administration_id TEXT NOT NULL,
  duration_minutes INTEGER,
  timeline_role TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('coded','held','incidental')),
  issue_list_json TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES infusion_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (administration_id) REFERENCES infusion_administrations(administration_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS infusion_administration_lines (
  line_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  code TEXT NOT NULL,
  units INTEGER NOT NULL CHECK (units > 0),
  role TEXT NOT NULL,
  source_administration_ids_json TEXT NOT NULL,
  rationale TEXT NOT NULL,
  review_required INTEGER NOT NULL DEFAULT 1 CHECK (review_required = 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES infusion_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS infusion_drug_lines (
  drug_line_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  administration_id TEXT NOT NULL,
  hcpcs_code TEXT NOT NULL,
  modifier TEXT CHECK (modifier IN ('JW','JZ') OR modifier IS NULL),
  units REAL NOT NULL CHECK (units >= 0),
  dose_represented TEXT NOT NULL,
  asp_quarter TEXT NOT NULL,
  payment_limit_reference REAL,
  reference_allowance REAL,
  coverage_inferred INTEGER NOT NULL DEFAULT 0 CHECK (coverage_inferred = 0),
  review_required INTEGER NOT NULL DEFAULT 1 CHECK (review_required = 1),
  issue_list_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES infusion_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (administration_id) REFERENCES infusion_administrations(administration_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS infusion_ncci_results (
  result_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  edit_type TEXT NOT NULL CHECK (edit_type IN ('practitioner','outpatient')),
  code_one TEXT NOT NULL,
  code_two TEXT NOT NULL,
  has_edit INTEGER NOT NULL CHECK (has_edit IN (0,1)),
  modifier_indicator TEXT,
  source_version TEXT NOT NULL,
  reviewed INTEGER NOT NULL DEFAULT 0 CHECK (reviewed IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES infusion_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS infusion_approvals (
  approval_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve','return','void')),
  rationale_object_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES infusion_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS infusion_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  case_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES infusion_cases(case_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_infusion_audit_tenant_case ON infusion_audit_events(tenant_id, case_id, created_at);

INSERT OR REPLACE INTO infusion_source_registry (source_id, authority, title, source_url, source_type, effective_from, effective_to, source_sha256, refresh_cadence, retrieved_at) VALUES
  ('cms-ncci-2026-xi','CMS','2026 Medicare NCCI Policy Manual Chapter XI','https://www.cms.gov/files/document/2026-ncci-medicare-policy-manual-all-chapters.pdf','national-coding-policy','2026-01-01','2026-12-31',NULL,'annual','2026-08-10'),
  ('cms-asp-2026-q3','CMS','July 2026 Medicare Part B Payment Limit File','https://www.cms.gov/medicare/payment/part-b-drugs/asp-pricing-files','asp-payment-limit','2026-07-01','2026-09-30','c73883dbddb5e5eb8397a2e5fa008e71760e81236c9ee5b5d92f4918daeead2e','quarterly','2026-08-10'),
  ('cms-ndc-hcpcs-2026-q3','CMS','July 2026 ASP NDC-HCPCS Crosswalk','https://www.cms.gov/medicare/payment/part-b-drugs/asp-pricing-files','ndc-hcpcs-crosswalk','2026-07-01','2026-09-30','d8628c77e84d3231ee7024732caba5ca1db309059cfe4259a1dd69d30f671974','quarterly','2026-08-10'),
  ('cms-mcp-ch17','CMS','Medicare Claims Processing Manual Chapter 17 Drugs and Biologicals','https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/downloads/clm104c17.pdf','claims-manual',NULL,NULL,NULL,'on-change','2026-08-10'),
  ('cms-mcd-a53778','CMS/MAC','A53778 Infusion Injection and Hydration Services','https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=53778','billing-article',NULL,NULL,NULL,'on-change','2026-08-10'),
  ('cms-ncci-q3-edits','CMS','Medicare NCCI PTP MUE and Add-on Code Files Q3 2026','https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits','quarterly-edit-files','2026-07-01','2026-09-30',NULL,'quarterly','2026-08-10');

INSERT OR REPLACE INTO infusion_policy_versions VALUES
  ('infusion-cms-ncci-2026-q3','2026.08.10.1','CMS-NCCI-2026-Q3','2026-07-01','2026-09-30','2026Q3',890,1052,1,1,0,1);

INSERT OR REPLACE INTO infusion_administration_code_catalog (code,family,method,role,short_label,timed,add_on,source_id) VALUES
  ('96360','hydration','infusion','initial','Initial hydration time service',1,0,'cms-ncci-2026-xi'),
  ('96361','hydration','infusion','additional-hour','Additional hydration time service',1,1,'cms-ncci-2026-xi'),
  ('96365','therapeutic','infusion','initial','Initial therapeutic infusion',1,0,'cms-ncci-2026-xi'),
  ('96366','therapeutic','infusion','additional-hour','Additional therapeutic infusion time',1,1,'cms-ncci-2026-xi'),
  ('96367','therapeutic','infusion','sequential','Sequential therapeutic infusion',1,1,'cms-ncci-2026-xi'),
  ('96368','therapeutic','infusion','concurrent','Concurrent therapeutic infusion',1,1,'cms-ncci-2026-xi'),
  ('96372','therapeutic','injection','injection','Therapeutic IM or SQ administration',0,0,'cms-ncci-2026-xi'),
  ('96374','therapeutic','push','initial','Initial therapeutic IV push',1,0,'cms-ncci-2026-xi'),
  ('96375','therapeutic','push','additional-push','Additional new-substance IV push',1,1,'cms-ncci-2026-xi'),
  ('96376','therapeutic','push','additional-push','Repeat same-substance IV push interval',1,1,'cms-ncci-2026-xi'),
  ('96401','chemotherapy','injection','injection','Complex drug SQ or IM administration',0,0,'cms-ncci-2026-xi'),
  ('96409','chemotherapy','push','initial','Initial complex-drug IV push',1,0,'cms-ncci-2026-xi'),
  ('96411','chemotherapy','push','additional-push','Additional complex-drug IV push',1,1,'cms-ncci-2026-xi'),
  ('96413','chemotherapy','infusion','initial','Initial complex-drug infusion',1,0,'cms-ncci-2026-xi'),
  ('96415','chemotherapy','infusion','additional-hour','Additional complex-drug infusion time',1,1,'cms-ncci-2026-xi'),
  ('96417','chemotherapy','infusion','sequential','Sequential complex-drug infusion',1,1,'cms-ncci-2026-xi');

INSERT OR REPLACE INTO infusion_rule_catalog (rule_id,policy_version_id,rule_type,rule_key,summary,source_id,review_status) VALUES
  ('inf-one-initial','infusion-cms-ncci-2026-q3','hierarchy','one-initial-per-access','Allow one initial service per encounter unless separate IV access sites are medically reasonable and necessary; a double-lumen catheter remains one vascular site.','cms-ncci-2026-xi','verified'),
  ('inf-facility-hierarchy','infusion-cms-ncci-2026-q3','hierarchy','facility-selection','Use facility hierarchy for hospital outpatient reporting and chronological initial selection for physician-office review.','cms-mcd-a53778','licensed-cpt-review'),
  ('inf-times','infusion-cms-ncci-2026-q3','evidence','start-stop-time','Require actual start and stop time or sufficiently supported calculated stop time for timed infusion services.','cms-mcd-a53778','verified'),
  ('inf-hydration-incidental','infusion-cms-ncci-2026-q3','bundling','carrier-fluid','Do not separately report fluid used only for patency or as the vehicle for a drug.','cms-ncci-2026-xi','verified'),
  ('inf-hydration-concurrent','infusion-cms-ncci-2026-q3','bundling','concurrent-hydration','Do not separately report hydration concurrent with another drug administration service.','cms-ncci-2026-xi','verified'),
  ('inf-concurrent-once','infusion-cms-ncci-2026-q3','units','concurrent-unit','Allow no more than one concurrent non-chemotherapy infusion unit per encounter.','cms-ncci-2026-xi','verified'),
  ('inf-peripheral-access','infusion-cms-ncci-2026-q3','bundling','peripheral-access','Peripheral IV placement and routine port flushing are integral to administration.','cms-ncci-2026-xi','verified'),
  ('inf-site-context','infusion-cms-ncci-2026-q3','site-of-service','professional-facility','Professional drug-administration reporting and hospital outpatient facility reporting are separate pathways.','cms-ncci-2026-xi','verified'),
  ('inf-jw','infusion-cms-ncci-2026-q3','drug-units','jw-line','Report eligible discarded single-dose drug units on a separate JW line without duplicating rounded administered units.','cms-mcp-ch17','verified'),
  ('inf-jz','infusion-cms-ncci-2026-q3','drug-units','jz-attestation','Apply JZ only when the CMS single-dose no-discard policy applies and zero eligible drug amount was discarded.','cms-mcp-ch17','verified'),
  ('inf-asp-not-coverage','infusion-cms-ncci-2026-q3','safety','asp-not-coverage','Do not infer coverage or medical necessity from presence in the ASP payment-limit file.','cms-asp-2026-q3','verified'),
  ('inf-quarter-match','infusion-cms-ncci-2026-q3','versioning','service-date-quarter','Hold drug pricing and unit release when the reference quarter does not match the date of service.','cms-asp-2026-q3','verified'),
  ('inf-ncci','infusion-cms-ncci-2026-q3','edits','ptp-mue-aoc','Run the matching practitioner or outpatient NCCI pathway and retain edits for human review.','cms-ncci-q3-edits','verified'),
  ('inf-human-release','infusion-cms-ncci-2026-q3','safety','human-approval','Require human approval; never autonomously classify a drug, create claim facts, or submit a claim.','cms-ncci-2026-xi','verified');
