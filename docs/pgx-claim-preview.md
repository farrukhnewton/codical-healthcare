# PGx Billing Worksheet

PGx produces one coder review worksheet rather than a CMS-1500 or UB-04 replica. The worksheet separates billable laboratory service lines from gene-medication evidence. CPT codes, units, supported diagnosis pointers, and required drugs appear only on service lines; gene results appear in a second table and are explicitly not additional claim lines.

A service line remains `review` unless the performed test is identifiable, the active state/MAC article supports the CPT/ICD relationship, and an actionable medication/gene relationship is present in the same applicable article. The engine never invents a diagnosis, medication, charge, demographic, or unsupported CPT relationship. A qualifying 81418 panel produces exactly one service line with one unit. Individual gene CPTs are references unless the source record confirms that the tests were separately ordered and performed.

All source-documented diagnoses remain visible. Only diagnoses supported for the selected service by current jurisdiction-qualified CMS data become service-line diagnosis pointers; a diagnosis is never copied to every gene.

The payload declares `previewOnly: true` and `submissionEnabled: false`. It cannot generate an 837, post to billing, or submit a claim. The current CMS article/LCD identifiers and evidence limitations accompany the worksheet for certified-coder review.
