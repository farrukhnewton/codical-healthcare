# Claim.MD test connector

The Revenue Integrity module includes a server-side Claim.MD connector for synthetic certification only. It reuses Codical's canonical claim, transmission, timeline, work-item, submission, and remittance tables.

## Safety boundary

- Only Claim.MD test-account credentials may be configured.
- Certification requests must carry `dataClassification: synthetic`.
- Production mode and live submission are hard-locked in the adapter, even if an environment variable is changed accidentally.
- The account key is never sent to the browser or returned by readiness routes.
- No real patient, provider, policy, or claim data may be used in a Claim.MD test account.

## Environment variables

```dotenv
CLAIMMD_ACCOUNT_KEY=
CLAIMMD_MODE=test
CLAIMMD_API_BASE_URL=https://svc.claim.md
CLAIMMD_TEST_SUBMISSION_ENABLED=false
CLAIMMD_LIVE_SUBMISSION_ENABLED=false
```

Set the account key after Claim.MD provisions the requested test account. Keep `CLAIMMD_LIVE_SUBMISSION_ENABLED=false`. Change `CLAIMMD_TEST_SUBMISSION_ENABLED` to `true` only when the synthetic certification cases are ready to run.

## Implemented test workflow

1. `Test Claim.MD connection` checks the payer-list endpoint without exposing credentials.
2. Accepted, rejected, and denied fixtures generate fictional 837P JSON using Claim.MD's documented field names.
3. `remote_claimid` and the 12-character-or-shorter `remote_chgid` values provide deterministic claim and service-line correlation.
4. Upload responses are recorded in `revenue_claim_submissions` and the claim timeline.
5. `Sync responses & ERA` advances durable `ResponseID` and `ERAID` cursors, normalizes delayed acknowledgments and remittances, and updates claims, service-line payments, and work items without duplicating external events.
6. ERA detail retrieval is capped at 40 records per sync. This keeps each user-triggered poll safely below Claim.MD's documented 100-request-per-minute limit without skipping the remaining ERA cursor range.
7. Transport and upload failures are persisted as failed submissions, timeline events, and actionable work items before the API returns the sanitized error.

The `REJECT` and `DENY` policy/member triggers are reserved for Claim.MD's test environment. A denial may first be accepted at upload and appear only after response/ERA polling.

## Production activation is intentionally out of scope

Production requires a signed agreement/BAA, restricted production credentials, provider and payer enrollment, certification evidence, monitoring, reconciliation, and a separately approved live-release change. The test connector does not provide a path around those controls.
