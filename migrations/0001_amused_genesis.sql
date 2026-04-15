CREATE TABLE "commercial_payers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"logo_url" text,
	"policy_portal_url" text,
	"pa_portal_url" text,
	"phone" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "commercial_payers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "payer_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"payer_id" integer NOT NULL,
	"title" text NOT NULL,
	"policy_number" text,
	"effective_date" text,
	"cpt_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirements_text" text NOT NULL,
	"is_billable" boolean DEFAULT true,
	"source_url" text,
	"created_at" timestamp DEFAULT now()
);
