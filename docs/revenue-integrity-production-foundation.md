# Revenue Integrity production foundation

## Current delivery

The first production foundation is implemented for professional claims. It provides:

- organization-scoped claim, line, event, work-item, evidence and clearinghouse-connection records;
- Supabase row-level security policies tied to organization membership;
- authenticated Revenue Integrity APIs that validate the Supabase access token server-side;
- structural professional-claim validation, CMS NPI check-digit validation and claim lifecycle guards;
- a clearinghouse-neutral adapter contract with Stedi as the first connector;
- a server-side live-submission lock that the browser cannot override;
- a Revenue Integrity command center, claims lifecycle view, prioritized work queue and integration-readiness view;
- synthetic certification fixtures and automated domain tests;
- a verified canonical 837P transmission profile and field-level Stedi v3 mapper;
- test/production submission records with deterministic idempotency and payload hashes;
- API-key authenticated, acknowledge-first Stedi webhook intake backed by a durable PostgreSQL queue;
- retryable `277CA` and `835` processors with claim, service-line and remittance correlation;
- rejection and underpayment work-item generation plus a detailed claim transaction review.

The server exposes one guarded submit route for test and production modes. Test transmission remains disabled unless `REVENUE_INTEGRITY_TEST_SUBMISSION_ENABLED=true`. Production transmission additionally requires an organization-level production approval and `REVENUE_INTEGRITY_LIVE_SUBMISSION_ENABLED=true`; both controls remain false by default. Keep them false until the contract, BAA, credentials, provider enrollments, webhook controls, certification evidence and written release approval are complete.

## Why Stedi is the first connector

Stedi's current official documentation exposes the lifecycle Codical needs through modern JSON and raw X12 APIs:

- professional `837P` submission;
- `277CA` claim acknowledgements;
- `835` electronic remittance advice;
- real-time `276/277` claim status;
- `275` claim attachments;
- provider and transaction enrollment APIs;
- test and production API keys;
- idempotent claim submission;
- authenticated webhook events and retry/error-queue behavior;
- a test payer that returns a test `277CA` and `835`.

Primary documentation:

- https://www.stedi.com/docs/healthcare
- https://www.stedi.com/docs/healthcare/api-reference
- https://www.stedi.com/docs/healthcare/claims-processing-workflows-overview
- https://www.stedi.com/docs/healthcare/submit-professional-claims
- https://www.stedi.com/docs/healthcare/configure-webhooks
- https://www.stedi.com/docs/providers/providers-test-claims-workflow
- https://www.stedi.com/docs/healthcare/api-reference/post-enrollment-create-enrollment

The adapter boundary must remain vendor-neutral. Availity or another network can be added without changing the Codical claim model, work queue or evidence graph.

## Environment controls

The server recognizes these variables. Values must be stored only in the deployment secret manager and must never be committed or exposed through the client bundle.

```text
STEDI_API_KEY
STEDI_MODE=test|production
STEDI_API_BASE_URL=https://healthcare.us.stedi.com
REVENUE_INTEGRITY_LIVE_SUBMISSION_ENABLED=false
REVENUE_INTEGRITY_TEST_SUBMISSION_ENABLED=false
STEDI_WEBHOOK_SECRET
REVENUE_INTEGRITY_CRON_SECRET
```

The live flag must remain `false` until production certification and written release approval are complete. A future credential reference should identify the secret version without storing the credential itself in PostgreSQL.

## Required external onboarding

1. Create the clearinghouse production account.
2. Execute the commercial agreement and BAA.
3. Create least-privilege test and production credentials.
4. Register the Codical webhook endpoint and configure its dedicated API-key credential set.
5. Create the billing-provider record.
6. Enroll every provider/payer combination for `837P` where required.
7. Enroll every provider/payer combination for `835`; ERA enrollment is a separate transaction enrollment.
8. Run the Codical synthetic suite locally.
9. Run the clearinghouse test-payer `277CA` and `835` workflow.
10. Complete payer-specific certification cases and reconcile results to the golden expectations.
11. Approve a small controlled production cohort.
12. Enable the server live flag and organization connection only during the approved release window.

## Remaining engineering increment

The next increment should add:

1. provider enrollment and payer-network status screens;
2. complete CARC/RARC reference normalization and appeal deadline rules;
3. encrypted raw EDI/object retention plus dead-letter operator recovery;
4. scheduled webhook-queue processing in the production hosting environment;
5. controlled Stedi test-payer certification using approved credentials;
6. production acceptance evidence, controlled cohort and release controls.

## Safety boundaries

- Never transmit synthetic fixtures with `usageIndicator=P`.
- Never log raw claims, API keys, member IDs or remittance payloads.
- Store raw EDI and attachments only in an approved encrypted object store with organization-scoped access and retention rules.
- Treat webhooks as at-least-once and potentially out of order.
- Authenticate every webhook with its dedicated Stedi credential-set secret before recording the referenced transaction.
- Use idempotency keys for every claim submission and event receipt.
- Do not generate diagnoses, documentation or authorization facts that are absent from the source record.
- Preserve the exact evidence, rule version and user approval supporting each released claim.
