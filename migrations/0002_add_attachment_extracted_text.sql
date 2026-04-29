CREATE TABLE IF NOT EXISTS "cms_dataset_registry" (
	"uuid" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voice_transcriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"patient_name" text,
	"patient_age" text,
	"date_of_visit" text,
	"chief_complaint" text,
	"diagnosis" text,
	"medications" text,
	"dosage" text,
	"doctor_name" text,
	"doctor_notes" text,
	"followup_date" text,
	"raw_transcript" text,
	"confidence_score" text,
	"audio_file_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "extracted_text" text;
