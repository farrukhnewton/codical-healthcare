import { pgTable, text, serial, timestamp, integer, uniqueIndex, bigint, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============ EXISTING TABLES ============

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  supabaseId: text("supabase_id").unique(),
  username: text("username").notNull().unique(),
  email: text("email"),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default('coder'),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============ CLINICAL TABLES ============

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  emrId: text("emr_id").notNull(),
  emrType: text("emr_type").notNull(), // 'drchrono', 'elation', etc.
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dob: text("dob"),
  gender: text("gender"),
  email: text("email"),
  phone: text("phone"),
  mrn: text("mrn"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const encounters = pgTable("encounters", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  emrId: text("emr_id").notNull(),
  emrType: text("emr_type").notNull(),
  date: timestamp("date").notNull(),
  providerName: text("provider_name"),
  encounterType: text("encounter_type"),
  status: text("status").default('pending'), // 'pending', 'in-progress', 'coded', 'finalized'
  billingStatus: text("billing_status").default('not_billed'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clinicalNotes = pgTable("clinical_notes", {
  id: serial("id").primaryKey(),
  encounterId: integer("encounter_id").notNull(),
  content: text("content").notNull(),
  noteType: text("note_type").default('soap'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  encounterId: integer("encounter_id").notNull(),
  userId: integer("user_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  status: text("status").default('assigned'),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const commercialPayers = pgTable("commercial_payers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  shortName: text("short_name"),
  logoUrl: text("logo_url"),
  policyPortalUrl: text("policy_portal_url"),
  paPortalUrl: text("pa_portal_url"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payerPolicies = pgTable("payer_policies", {
  id: serial("id").primaryKey(),
  payerId: integer("payer_id").notNull(),
  title: text("title").notNull(),
  policyNumber: text("policy_number"),
  effectiveDate: text("effective_date"),
  cptCodes: jsonb("cpt_codes").$type<string[]>().notNull().default([]),
  requirementsText: text("requirements_text").notNull(),
  isBillable: boolean("is_billable").default(true),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at").defaultNow(),
});



export const icd10Codes = pgTable("icd10_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  type: text("type"),
});

export const cptCodes = pgTable("cpt_codes", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  category: text("category"),
  procedureDetails: text("Procedure Details"),
  type: text("type"),
});

export const hcpcsCodes = pgTable("hcpcs_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  category: text("category"),
  description1: text("description_1"),
  type: text("type"),
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  codeType: text("code_type").notNull(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const guidelines = pgTable("guidelines", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  guidelineText: text("guideline_text").notNull(),
  sourceUrl: text("source_url"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const cachedGuidelines = pgTable("cached_guidelines", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  guidelineText: text("guideline_text").notNull(),
  version: text("version").notNull(),
  date: text("date").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

export const cmsGuidelines = pgTable("cms_guidelines", {
  id: serial("id").primaryKey(),
  chapter: integer("chapter").notNull(),
  chapterTitle: text("chapter_title").notNull(),
  codeRangeStart: text("code_range_start").notNull(),
  codeRangeEnd: text("code_range_end").notNull(),
  section: text("section").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sourceUrl: text("source_url").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  sourceDocument: text("source_document"),
  fiscalYear: text("fiscal_year"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const icd10CodeNotes = pgTable("icd10_code_notes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  parentCode: text("parent_code"),
  chapterName: text("chapter_name"),
  chapterDesc: text("chapter_desc"),
  sectionId: text("section_id"),
  sectionDesc: text("section_desc"),
  includes: jsonb("includes").$type<string[]>().notNull().default([]),
  inclusionTerms: jsonb("inclusion_terms").$type<string[]>().notNull().default([]),
  excludes1: jsonb("excludes1").$type<string[]>().notNull().default([]),
  excludes2: jsonb("excludes2").$type<string[]>().notNull().default([]),
  codeFirst: jsonb("code_first").$type<string[]>().notNull().default([]),
  useAdditionalCode: jsonb("use_additional_code").$type<string[]>().notNull().default([]),
  codeAlso: jsonb("code_also").$type<string[]>().notNull().default([]),
  sevenChrNote: text("seven_chr_note"),
  sevenChrDef: jsonb("seven_chr_def").$type<Array<{ char: string; meaning: string }>>().notNull().default([]),
  fiscalYear: text("fiscal_year"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============ CHAT TABLES ============

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  name: text("name"),
  isGroup: boolean("is_group").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  userId: integer("user_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
  lastReadAt: timestamp("last_read_at").defaultNow(),
  isAdmin: boolean("is_admin").default(false),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId: integer("sender_id"),
  content: text("content"),
  messageType: text("message_type").default('text'),
  isEdited: boolean("is_edited").default(false),
  isDeleted: boolean("is_deleted").default(false),
  replyToId: integer("reply_to_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  userId: integer("user_id").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const friendRequests = pgTable("friend_requests", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  status: text("status").default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============ RELATIONS ============

export const usersRelations = relations(users, ({ many }) => ({
  participants: many(participants),
  sentMessages: many(messages),
  reactions: many(messageReactions),
  assignments: many(assignments),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  encounters: many(encounters),
}));

export const encountersRelations = relations(encounters, ({ one, many }) => ({
  patient: one(patients, { fields: [encounters.patientId], references: [patients.id] }),
  notes: many(clinicalNotes),
  assignments: many(assignments),
}));

export const clinicalNotesRelations = relations(clinicalNotes, ({ one }) => ({
  encounter: one(encounters, { fields: [clinicalNotes.encounterId], references: [encounters.id] }),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  encounter: one(encounters, { fields: [assignments.encounterId], references: [encounters.id] }),
  user: one(users, { fields: [assignments.userId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  participants: many(participants),
  messages: many(messages),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  user: one(users, { fields: [participants.userId], references: [users.id] }),
  conversation: one(conversations, { fields: [participants.conversationId], references: [conversations.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  attachments: many(attachments),
  reactions: many(messageReactions),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  message: one(messages, { fields: [attachments.messageId], references: [messages.id] }),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, { fields: [messageReactions.messageId], references: [messages.id] }),
  user: one(users, { fields: [messageReactions.userId], references: [users.id] }),
}));

export const friendRequestsRelations = relations(friendRequests, ({ one }) => ({
  sender: one(users, { fields: [friendRequests.senderId], references: [users.id] }),
  receiver: one(users, { fields: [friendRequests.receiverId], references: [users.id] }),
}));

export const payerPoliciesRelations = relations(payerPolicies, ({ one }) => ({
  payer: one(commercialPayers, { fields: [payerPolicies.payerId], references: [commercialPayers.id] }),
}));

export const commercialPayersRelations = relations(commercialPayers, ({ many }) => ({
  policies: many(payerPolicies),
}));

// ============ ZOD SCHEMAS ============

export const insertUserSchema = createInsertSchema(users);
export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });

export const insertPatientSchema = createInsertSchema(patients);
export const insertEncounterSchema = createInsertSchema(encounters);
export const insertAssignmentSchema = createInsertSchema(assignments);

// ============ TYPES ============

export type User = typeof users.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type Icd10Code = typeof icd10Codes.$inferSelect;
export type CptCode = typeof cptCodes.$inferSelect;
export type HcpcsCode = typeof hcpcsCodes.$inferSelect;
export type Guideline = typeof guidelines.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type FriendRequest = typeof friendRequests.$inferSelect;

export type Patient = typeof patients.$inferSelect;
export type Encounter = typeof encounters.$inferSelect;
export type ClinicalNote = typeof clinicalNotes.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type CommercialPayer = typeof commercialPayers.$inferSelect;
export type PayerPolicy = typeof payerPolicies.$inferSelect;

export type MedicalCode = {
  type: string;
  code: string;
  description: string;
  isFavorite?: boolean;
  version?: string;
  category?: string;
  procedureDetails?: string;
  guideline?: {
    text: string;
    version?: string;
    date?: string;
    sourceUrl?: string;
  }
};
