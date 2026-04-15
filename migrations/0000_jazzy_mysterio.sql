CREATE TABLE "assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"encounter_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'assigned'
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_url" text NOT NULL,
	"thumbnail_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" jsonb,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cached_guidelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"guideline_text" text NOT NULL,
	"version" text NOT NULL,
	"date" text NOT NULL,
	"fetched_at" timestamp DEFAULT now(),
	CONSTRAINT "cached_guidelines_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "clinical_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"encounter_id" integer NOT NULL,
	"content" text NOT NULL,
	"note_type" text DEFAULT 'soap',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cms_guidelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter" integer NOT NULL,
	"chapter_title" text NOT NULL,
	"code_range_start" text NOT NULL,
	"code_range_end" text NOT NULL,
	"section" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source_url" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_document" text,
	"fiscal_year" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"is_group" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cpt_codes" (
	"id" bigint PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"Procedure Details" text,
	"type" text,
	CONSTRAINT "cpt_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "encounters" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"emr_id" text NOT NULL,
	"emr_type" text NOT NULL,
	"date" timestamp NOT NULL,
	"provider_name" text,
	"encounter_type" text,
	"status" text DEFAULT 'pending',
	"billing_status" text DEFAULT 'not_billed',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_type" text NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "guidelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"guideline_text" text NOT NULL,
	"source_url" text,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hcpcs_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"description_1" text,
	"type" text,
	CONSTRAINT "hcpcs_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "icd10_code_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"parent_code" text,
	"chapter_name" text,
	"chapter_desc" text,
	"section_id" text,
	"section_desc" text,
	"includes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inclusion_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excludes1" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excludes2" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"code_first" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"use_additional_code" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"code_also" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seven_chr_note" text,
	"seven_chr_def" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fiscal_year" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "icd10_code_notes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "icd10_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"type" text,
	CONSTRAINT "icd10_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_id" integer,
	"content" text,
	"message_type" text DEFAULT 'text',
	"is_edited" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"reply_to_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"last_read_at" timestamp DEFAULT now(),
	"is_admin" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"emr_id" text NOT NULL,
	"emr_type" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"dob" text,
	"gender" text,
	"email" text,
	"phone" text,
	"mrn" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"supabase_id" text,
	"username" text NOT NULL,
	"email" text,
	"full_name" text,
	"avatar_url" text,
	"role" text DEFAULT 'coder' NOT NULL,
	"is_online" boolean DEFAULT false,
	"last_seen" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_supabase_id_unique" UNIQUE("supabase_id"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
