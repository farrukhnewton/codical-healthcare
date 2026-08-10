# CMS July 2026 Part B drug reference package

These two unmodified Section 508 CSV files were downloaded from the CMS Medicare Part B Drug Payment Limit File page on August 10, 2026.

- `cms-july-2026-part-b-payment-limits.csv`: July 2026 Medicare Part B payment limits, effective July 1 through September 30, 2026.
- `cms-july-2026-ndc-hcpcs-crosswalk.csv`: July 2026 ASP NDC-to-HCPCS crosswalk.

The source page warns that a code or price in the file does not establish Medicare coverage. The infusion engine therefore presents the payment limit as quarter-specific reference data and keeps coverage and medical-necessity review separate.

Regenerate `server/infusion-cms-asp-data.ts` with `npm run generate:infusion-asp`. Replace both source files and update the versioned package for a later quarter rather than editing these CSVs.
