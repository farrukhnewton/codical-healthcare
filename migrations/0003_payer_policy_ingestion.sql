ALTER TABLE "payer_policies" ADD COLUMN IF NOT EXISTS "document_type" text DEFAULT 'medical_policy' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payer_policies" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'indexed' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payer_policies" ADD COLUMN IF NOT EXISTS "last_published_at" text;
--> statement-breakpoint
ALTER TABLE "payer_policies" ADD COLUMN IF NOT EXISTS "hcpcs_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "payer_policies" ADD COLUMN IF NOT EXISTS "drug_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "payer_policies" ADD COLUMN IF NOT EXISTS "source_host" text;
--> statement-breakpoint
ALTER TABLE "payer_policies" ADD COLUMN IF NOT EXISTS "last_fetched_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payer_policies" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payer_policies_payer_id_idx" ON "payer_policies" ("payer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payer_policies_created_at_idx" ON "payer_policies" ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payer_policies_payer_source_url_idx" ON "payer_policies" ("payer_id", "source_url") WHERE "source_url" IS NOT NULL;
--> statement-breakpoint
UPDATE "commercial_payers" SET "policy_portal_url" = 'https://www.uhcprovider.com/en/policies-protocols/commercial-policies/commercial-medical-drug-policies.html' WHERE "short_name" = 'UHC';
--> statement-breakpoint
UPDATE "commercial_payers" SET "policy_portal_url" = 'https://www.aetna.com/cpb/medical/data/cpb_num.html' WHERE "short_name" = 'Aetna';
--> statement-breakpoint
UPDATE "commercial_payers" SET "policy_portal_url" = 'https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/index.html' WHERE "short_name" = 'Cigna';
--> statement-breakpoint
UPDATE "commercial_payers" SET "policy_portal_url" = 'https://mcp.humana.com/tad/tad_new/home.aspx?type=provider', "pa_portal_url" = 'https://provider.humana.com/coverage-claims/prior-authorizations' WHERE "short_name" = 'Humana';
--> statement-breakpoint
DROP TABLE IF EXISTS "cms_dataset_registry";
