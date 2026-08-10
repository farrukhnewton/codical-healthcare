-- Ambulance specialty reference, rules, evidence, and audit schema.
-- Reference rows are effective-dated. No patient-identifying text is stored in
-- these tables; case payloads use encrypted object references in production.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ambulance_source_registry (
  source_id TEXT PRIMARY KEY,
  authority TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  refresh_cadence TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ambulance_source_versions (
  version_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  fetched_at TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  object_key TEXT,
  import_status TEXT NOT NULL CHECK (import_status IN ('discovered', 'validated', 'published', 'rejected', 'retired')),
  validation_summary_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (source_id) REFERENCES ambulance_source_registry(source_id)
);

CREATE INDEX IF NOT EXISTS idx_ambulance_source_versions_effective
  ON ambulance_source_versions(source_id, effective_from, effective_to, import_status);

CREATE TABLE IF NOT EXISTS ambulance_hcpcs_reference (
  code TEXT NOT NULL,
  version_id TEXT NOT NULL,
  description TEXT NOT NULL,
  service_family TEXT NOT NULL,
  transport_mode TEXT NOT NULL,
  is_mileage INTEGER NOT NULL DEFAULT 0 CHECK (is_mileage IN (0, 1)),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  PRIMARY KEY (code, version_id),
  FOREIGN KEY (version_id) REFERENCES ambulance_source_versions(version_id)
);

CREATE TABLE IF NOT EXISTS ambulance_modifier_reference (
  modifier TEXT NOT NULL,
  version_id TEXT NOT NULL,
  modifier_type TEXT NOT NULL,
  description TEXT NOT NULL,
  origin_allowed INTEGER NOT NULL DEFAULT 0 CHECK (origin_allowed IN (0, 1)),
  destination_allowed INTEGER NOT NULL DEFAULT 0 CHECK (destination_allowed IN (0, 1)),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  PRIMARY KEY (modifier, version_id),
  FOREIGN KEY (version_id) REFERENCES ambulance_source_versions(version_id)
);

CREATE TABLE IF NOT EXISTS ambulance_pos_reference (
  pos_code TEXT NOT NULL,
  version_id TEXT NOT NULL,
  description TEXT NOT NULL,
  transport_mode TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  PRIMARY KEY (pos_code, version_id),
  FOREIGN KEY (version_id) REFERENCES ambulance_source_versions(version_id)
);

CREATE TABLE IF NOT EXISTS ambulance_zip_designations (
  zip_code TEXT NOT NULL,
  version_id TEXT NOT NULL,
  carrier TEXT,
  locality TEXT,
  state_code TEXT,
  designation TEXT NOT NULL CHECK (designation IN ('urban', 'rural', 'super-rural')),
  gpci REAL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  PRIMARY KEY (zip_code, version_id),
  FOREIGN KEY (version_id) REFERENCES ambulance_source_versions(version_id)
);

CREATE INDEX IF NOT EXISTS idx_ambulance_zip_effective
  ON ambulance_zip_designations(zip_code, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS ambulance_fee_schedule_rates (
  rate_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  carrier TEXT NOT NULL,
  locality TEXT NOT NULL,
  hcpcs TEXT NOT NULL,
  designation TEXT NOT NULL CHECK (designation IN ('urban', 'rural', 'super-rural')),
  base_rate_cents INTEGER NOT NULL CHECK (base_rate_cents >= 0),
  mileage_rate_mills INTEGER,
  rural_miles_1_17_rate_mills INTEGER,
  includes_temporary_addons INTEGER NOT NULL DEFAULT 1 CHECK (includes_temporary_addons IN (0, 1)),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  FOREIGN KEY (version_id) REFERENCES ambulance_source_versions(version_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ambulance_rates_lookup
  ON ambulance_fee_schedule_rates(version_id, carrier, locality, hcpcs, designation);

CREATE TABLE IF NOT EXISTS ambulance_payment_adjustments (
  adjustment_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  adjustment_type TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  factor REAL NOT NULL,
  sequence_number INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  citation TEXT NOT NULL,
  FOREIGN KEY (version_id) REFERENCES ambulance_source_versions(version_id)
);

CREATE TABLE IF NOT EXISTS ambulance_state_scope_rules (
  state_code TEXT NOT NULL,
  version_id TEXT NOT NULL,
  service_key TEXT NOT NULL,
  paramedic_permitted INTEGER CHECK (paramedic_permitted IN (0, 1)),
  rule_text TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  PRIMARY KEY (state_code, version_id, service_key),
  FOREIGN KEY (version_id) REFERENCES ambulance_source_versions(version_id)
);

CREATE TABLE IF NOT EXISTS ambulance_cases (
  case_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  encrypted_payload_object_key TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  service_date TEXT NOT NULL,
  workflow_status TEXT NOT NULL CHECK (workflow_status IN ('draft', 'review', 'approved', 'void')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ambulance_cases_tenant_date
  ON ambulance_cases(tenant_id, service_date, workflow_status);

CREATE TABLE IF NOT EXISTS ambulance_evidence_items (
  evidence_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_pointer TEXT NOT NULL,
  normalized_value_json TEXT NOT NULL,
  confidence REAL,
  human_verified INTEGER NOT NULL DEFAULT 0 CHECK (human_verified IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES ambulance_cases(case_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ambulance_evidence_case
  ON ambulance_evidence_items(case_id, evidence_type, human_verified);

CREATE TABLE IF NOT EXISTS ambulance_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  source_version_ids_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  result_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES ambulance_cases(case_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ambulance_claim_previews (
  preview_id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  claim_format TEXT NOT NULL CHECK (claim_format IN ('837P', '837I')),
  preview_json TEXT NOT NULL,
  coder_approved INTEGER NOT NULL DEFAULT 0 CHECK (coder_approved IN (0, 1)),
  autonomous_submission_enabled INTEGER NOT NULL DEFAULT 0 CHECK (autonomous_submission_enabled = 0),
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evaluation_id) REFERENCES ambulance_evaluations(evaluation_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ambulance_audit_events (
  event_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES ambulance_cases(case_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ambulance_audit_case_time
  ON ambulance_audit_events(case_id, created_at);

INSERT OR REPLACE INTO ambulance_source_registry
  (source_id, authority, title, source_url, source_type, refresh_cadence)
VALUES
  ('cms-bp-100-02-ch10', 'CMS', 'Medicare Benefit Policy Manual, Chapter 10', 'https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/bp102c10.pdf', 'manual', 'weekly-discovery'),
  ('cms-cp-100-04-ch15', 'CMS', 'Medicare Claims Processing Manual, Chapter 15', 'https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/downloads/clm104c15.pdf', 'manual', 'weekly-discovery'),
  ('cms-afs-puf', 'CMS', 'Ambulance Fee Schedule Public Use Files', 'https://www.cms.gov/medicare/payment/fee-schedules/ambulance/ambulance-fee-schedule-public-use-files', 'fee-schedule', 'quarterly'),
  ('cms-afs-zip', 'CMS', 'Ambulance ZIP Code Geographic Designation Files', 'https://www.cms.gov/medicare/payment/fee-schedules/ambulance', 'zip-designation', 'quarterly'),
  ('nemsis-standard', 'NEMSIS TAC', 'NEMSIS v3 Data Dictionaries and XSD', 'https://nemsis.org/technical-resources/version-3/version-3-data-dictionaries/', 'data-standard', 'release-watch');

INSERT OR REPLACE INTO ambulance_source_versions
  (version_id, source_id, version_label, effective_from, effective_to, fetched_at, sha256, import_status, validation_summary_json)
VALUES
  ('cms-manuals-2026-08-04', 'cms-bp-100-02-ch10', 'retrieved-2026-08-04', '2026-01-01', NULL, '2026-08-04T00:00:00Z', 'PENDING_IMPORT_SHA256', 'discovered', '{"seed":"metadata-only","published":false}'),
  ('cms-claims-2026-08-04', 'cms-cp-100-04-ch15', 'retrieved-2026-08-04', '2026-01-01', NULL, '2026-08-04T00:00:00Z', 'PENDING_IMPORT_SHA256', 'discovered', '{"seed":"metadata-only","published":false}'),
  ('cms-afs-reference-2026', 'cms-afs-puf', 'CY 2026 reference vocabulary', '2026-01-01', '2026-12-31', '2026-08-04T00:00:00Z', 'REFERENCE-VOCABULARY-NO-RATES', 'validated', '{"ratesImported":false,"descriptors":"reference vocabulary"}');

INSERT OR REPLACE INTO ambulance_hcpcs_reference
  (code, version_id, description, service_family, transport_mode, is_mileage, effective_from, effective_to)
VALUES
  ('A0425', 'cms-afs-reference-2026', 'Ground mileage, per statute mile', 'mileage', 'ground', 1, '2026-01-01', '2026-12-31'),
  ('A0426', 'cms-afs-reference-2026', 'ALS1, non-emergency', 'base', 'ground', 0, '2026-01-01', '2026-12-31'),
  ('A0427', 'cms-afs-reference-2026', 'ALS1, emergency', 'base', 'ground', 0, '2026-01-01', '2026-12-31'),
  ('A0428', 'cms-afs-reference-2026', 'BLS, non-emergency', 'base', 'ground', 0, '2026-01-01', '2026-12-31'),
  ('A0429', 'cms-afs-reference-2026', 'BLS, emergency', 'base', 'ground', 0, '2026-01-01', '2026-12-31'),
  ('A0430', 'cms-afs-reference-2026', 'Fixed-wing air base service', 'base', 'fixed-wing', 0, '2026-01-01', '2026-12-31'),
  ('A0431', 'cms-afs-reference-2026', 'Rotary-wing air base service', 'base', 'rotary-wing', 0, '2026-01-01', '2026-12-31'),
  ('A0432', 'cms-afs-reference-2026', 'Paramedic intercept', 'base', 'ground', 0, '2026-01-01', '2026-12-31'),
  ('A0433', 'cms-afs-reference-2026', 'ALS2', 'base', 'ground', 0, '2026-01-01', '2026-12-31'),
  ('A0434', 'cms-afs-reference-2026', 'Specialty care transport', 'base', 'ground', 0, '2026-01-01', '2026-12-31'),
  ('A0435', 'cms-afs-reference-2026', 'Fixed-wing air mileage', 'mileage', 'fixed-wing', 1, '2026-01-01', '2026-12-31'),
  ('A0436', 'cms-afs-reference-2026', 'Rotary-wing air mileage', 'mileage', 'rotary-wing', 1, '2026-01-01', '2026-12-31');

INSERT OR REPLACE INTO ambulance_pos_reference
  (pos_code, version_id, description, transport_mode, effective_from, effective_to)
VALUES
  ('41', 'cms-afs-reference-2026', 'Ambulance - land', 'ground', '2026-01-01', '2026-12-31'),
  ('42', 'cms-afs-reference-2026', 'Ambulance - air or water', 'air', '2026-01-01', '2026-12-31');

INSERT OR REPLACE INTO ambulance_modifier_reference
  (modifier, version_id, modifier_type, description, origin_allowed, destination_allowed, effective_from, effective_to)
VALUES
  ('D', 'cms-afs-reference-2026', 'origin-destination-character', 'Diagnostic or therapeutic site other than P or H', 1, 1, '2026-01-01', '2026-12-31'),
  ('E', 'cms-afs-reference-2026', 'origin-destination-character', 'Residential, domiciliary, custodial facility', 1, 1, '2026-01-01', '2026-12-31'),
  ('G', 'cms-afs-reference-2026', 'origin-destination-character', 'Hospital-based dialysis facility', 1, 1, '2026-01-01', '2026-12-31'),
  ('H', 'cms-afs-reference-2026', 'origin-destination-character', 'Hospital', 1, 1, '2026-01-01', '2026-12-31'),
  ('I', 'cms-afs-reference-2026', 'origin-destination-character', 'Site of transfer between modes', 1, 1, '2026-01-01', '2026-12-31'),
  ('J', 'cms-afs-reference-2026', 'origin-destination-character', 'Freestanding dialysis facility', 1, 1, '2026-01-01', '2026-12-31'),
  ('N', 'cms-afs-reference-2026', 'origin-destination-character', 'Skilled nursing facility', 1, 1, '2026-01-01', '2026-12-31'),
  ('P', 'cms-afs-reference-2026', 'origin-destination-character', 'Physician office', 1, 1, '2026-01-01', '2026-12-31'),
  ('R', 'cms-afs-reference-2026', 'origin-destination-character', 'Residence', 1, 1, '2026-01-01', '2026-12-31'),
  ('S', 'cms-afs-reference-2026', 'origin-destination-character', 'Scene of accident or acute event', 1, 1, '2026-01-01', '2026-12-31'),
  ('X', 'cms-afs-reference-2026', 'origin-destination-character', 'Intermediate stop at physician office en route to hospital', 0, 1, '2026-01-01', '2026-12-31'),
  ('GM', 'cms-afs-reference-2026', 'claim-modifier', 'Multiple patients on one ambulance trip', 0, 0, '2026-01-01', '2026-12-31'),
  ('QL', 'cms-afs-reference-2026', 'claim-modifier', 'Patient pronounced dead after ambulance called', 0, 0, '2026-01-01', '2026-12-31'),
  ('QM', 'cms-afs-reference-2026', 'claim-modifier', 'Service provided under arrangement by provider', 0, 0, '2026-01-01', '2026-12-31'),
  ('QN', 'cms-afs-reference-2026', 'claim-modifier', 'Service furnished directly by provider', 0, 0, '2026-01-01', '2026-12-31');

INSERT OR REPLACE INTO ambulance_payment_adjustments
  (adjustment_id, version_id, adjustment_type, scope_json, factor, sequence_number, effective_from, effective_to, citation)
VALUES
  ('urban-add-on-2026-2027', 'cms-afs-reference-2026', 'temporary-add-on', '{"mode":"ground","designation":"urban","components":["base","mileage"]}', 1.02, 10, '2026-01-01', '2027-12-31', 'CAA 2026 section 6203 / CMS AFS PUF'),
  ('rural-add-on-2026-2027', 'cms-afs-reference-2026', 'temporary-add-on', '{"mode":"ground","designation":["rural","super-rural"],"components":["base","mileage"]}', 1.03, 10, '2026-01-01', '2027-12-31', 'CAA 2026 section 6203 / CMS AFS PUF'),
  ('super-rural-base-2026-2027', 'cms-afs-reference-2026', 'temporary-add-on', '{"mode":"ground","designation":"super-rural","components":["base"]}', 1.226, 20, '2026-01-01', '2027-12-31', 'CAA 2026 section 6203 / CMS AFS PUF'),
  ('rural-mileage-1-17', 'cms-afs-reference-2026', 'rural-mileage', '{"mode":"ground","designation":["rural","super-rural"],"miles":[1,17]}', 1.5, 30, '2026-01-01', NULL, '42 CFR 414.610(c)(5)(i) / CMS AFS PUF'),
  ('esrd-dialysis-reduction', 'cms-afs-reference-2026', 'reduction', '{"hcpcs":"A0428","originOrDestination":["G","J"],"components":["base","mileage"]}', 0.77, 90, '2018-10-01', NULL, 'CMS CR 10549 / MM10549');
