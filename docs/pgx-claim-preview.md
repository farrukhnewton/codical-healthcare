# PGx Claim Preview

PGx produces review output only. The payload declares `previewOnly: true` and `submissionEnabled: false`. It cannot generate an 837, post to billing, or submit a claim.

All service-line `charge` and `referenceRate` values are null. Database constraints require null charge values and the `preview_only` submission state. Diagnosis pointers contain only source-supported codes; manual-review diagnoses are listed separately.

Before a future preview is considered release-ready, the user must select service date, state/territory, MAC/payer context, and approve low-confidence fields. Evidence version IDs, limitations, and manual-review warnings must accompany the output.
