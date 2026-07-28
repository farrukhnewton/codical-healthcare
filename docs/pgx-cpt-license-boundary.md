# PGx CPT License Boundary

The live Supabase database contains 9,657 rows in `cpt_codes` with RLS enabled. The organization states its CPT use is approved, but the repository still lacks a concrete `PGX_CPT_LICENSE_REFERENCE`.

Until that reference is configured, PGx may use code identifiers and content already inside the approved database boundary. It must not ingest additional proprietary long descriptions or guidance. CPT descriptions and effective year must come from the licensed/versioned database at runtime, not be expanded from CMS download text. Public HCPCS and proprietary CPT content remain distinguishable.

ICD-10-CM candidates require an authoritative fiscal-year source and source-backed relationship. Keyword-based diagnosis guessing has been removed.
