PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mcd_contractor_jurisdictions (
  contractor_key TEXT NOT NULL,
  jurisdiction_key TEXT NOT NULL,
  effective_date TEXT NOT NULL DEFAULT '',
  end_date TEXT,
  source_key TEXT,
  PRIMARY KEY (contractor_key, jurisdiction_key, effective_date),
  FOREIGN KEY (contractor_key) REFERENCES mcd_contractors(contractor_key) ON DELETE CASCADE,
  FOREIGN KEY (jurisdiction_key) REFERENCES mcd_jurisdictions(jurisdiction_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcd_contractor_jurisdictions_state
  ON mcd_contractor_jurisdictions(jurisdiction_key, contractor_key);
