# PGx Extraction Pipeline

## Active modes

- Native PDF text through `pdf-parse`.
- Manual entry/pasted UTF-8 text.
- PNG, JPEG, and scanned PDF intake can be OCR-scanned in the authenticated browser. Tesseract.js and PDF.js process the document locally; the recognized text is sent through the existing authenticated PGx extraction route with the original document.
- Lab and requisition PDFs/images use server-side Gemini native document vision when `GEMINI_API_KEY` is configured. The requisition pass identifies spatial signals text OCR cannot represent: circled preprinted rows, checked boxes, handwritten diagnoses or medications, and handwriting enclosed by a circle. Dense diagnosis-choice pages are also isolated in the browser at up to 4x render scale and sent as page-numbered images for a focused second visual pass; this prevents a small mark such as handwritten `F25.1` on page 11 from being lost when a long PDF is downscaled. The lab pass extracts patient name and gene results without treating educational drug lists as active medications. `PGX_OCR_GEMINI_MODEL` can override the preferred `gemini-3.6-flash` model; the service falls back to `gemini-2.5-flash` when needed.

## Intake controls

PDF, PNG, JPG/JPEG, and TXT are the only accepted extensions. The server checks extension, MIME type, file signature, 20 MB size, PDF end marker, encryption marker, and a 250-page limit. Executable/archive signatures, malformed files, binary TXT, and password-protected PDFs fail closed. SHA-256 supports duplicate detection.

The Phase 2 schema stores extraction runs and field-level lineage: raw text, normalized value, page, region, method, confidence, status, override, reviewer, and timestamp. Raw unbounded OCR payloads belong in private object storage, not primary tables.

## OCR review boundary

OCR output is never treated as authoritative. Low-confidence text, handwriting, diagnoses, medications, and provider identifiers must be compared with the original document before claim-bound use. Vision results include selection type, one-based page, confidence, and short visual evidence. Any valid diagnosis or medication the reviewer enters or corrects is carried into the analysis and worksheet; unsupported CMS relationships remain visible but are held for review. Electronic lab-report pages prefer their native text layer to avoid unnecessary OCR.

The API preserves lab-report and requisition boundaries. It compares the patient name from both documents, then looks for an exact first/last-name match in the existing patient database; DOB, MRN, and other patient demographics are intentionally excluded from the PGx extraction result. Gene and phenotype detection uses the lab report, while marked diagnosis codes and active medications use the requisition. Preprinted diagnosis lists are never accepted merely because their text was recognized. ICD-10-CM candidates must match a letter plus two-digit category before analysis; OCR variants of DOB such as `D0B` are rejected. Handwritten compact codes such as `F251` are normalized to `F25.1` only after strict syntax validation.

Gemini document data is sent inline and is not uploaded to the Gemini Files API. Production use with PHI still requires the organization's approved Google agreement and compliance configuration; use Vertex AI under the applicable BAA where that is required by policy.
