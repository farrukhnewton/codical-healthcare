# CMS-HCC V28 payment year 2026 source data

These six CSV files are unmodified inputs from the CMS **2026 Midyear/Final Model Software (Python)**, package `CMS_HCC_v28_2026_T_package_v3.zip`.

Source page: <https://www.cms.gov/medicare/payment/medicare-advantage-rates-statistics/risk-adjustment/2026-model-software-icd-10-mappings>

`scripts/generate-hcc-v28-data.ts` converts these authoritative inputs into the server-only TypeScript model used at runtime. The generator records SHA-256 hashes, and migration `0009_hcc_risk_adjustment.sql` publishes those hashes with the model metadata.

Do not manually alter mapping, hierarchy, interaction, or coefficient values. Replace the source package and regenerate the compiled model as a versioned update.
