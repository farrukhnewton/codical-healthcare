# PGx Extraction Pipeline

## Active modes

- Native PDF text through `pdf-parse`.
- Manual entry/pasted UTF-8 text.
- PNG and JPEG secure intake is accepted, but image content is not extracted because no approved OCR provider is configured.

## Intake controls

PDF, PNG, JPG/JPEG, and TXT are the only accepted extensions. The server checks extension, MIME type, file signature, 20 MB size, PDF end marker, encryption marker, and a 250-page limit. Executable/archive signatures, malformed files, binary TXT, and password-protected PDFs fail closed. SHA-256 supports duplicate detection.

The Phase 2 schema stores extraction runs and field-level lineage: raw text, normalized value, page, region, method, confidence, status, override, reviewer, and timestamp. Raw unbounded OCR payloads belong in private object storage, not primary tables.

## Remaining gate

The UI still uses the Phase 1 aggregate extraction response. Field-level review persistence and an approved image OCR/malware service must be connected before Phase 2 completion.
