ALTER TABLE mcd_documents ADD COLUMN display_id TEXT;
ALTER TABLE mcd_documents ADD COLUMN keywords TEXT;

CREATE INDEX IF NOT EXISTS idx_mcd_documents_display_id
  ON mcd_documents(display_id);

CREATE INDEX IF NOT EXISTS idx_mcd_documents_title
  ON mcd_documents(title);
