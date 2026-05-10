import { isSupabaseAdminConfigured, supabaseAdmin } from "./supabase-admin";
import { api } from "../shared";
import type { Express, Request } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { z } from "zod";
import { users, conversations, messages, participants, attachments, friendRequests, messageReactions, savedAiFiles } from "@shared/schema";
import { voiceTranscriptions } from "@shared/schema";
import { eq, and, desc, asc, inArray, ne, or, ilike, sql } from "drizzle-orm";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import pdfParse from "pdf-parse";
import PDFDocument from "pdfkit";
import {
  enrichCodeFromNlm, searchNlmCodes
} from "./cms-service";
import { validateClaimCodeSet } from "./claim-validation-service";
import { getIcd10CodeNotes } from "./icd10-notes-service";
import { checkNcciBatchEdits, checkNcciEdit } from "./ncci-service";
import {
  getMcdBatchPairEvidence,
  getMcdCodeCoverageRows,
  getMcdCodeCoverageIntelligence,
  getMcdCoverageDocument,
  getMcdIcdProcedurePairEvidence,
  searchMcdCoverageRows,
} from "./mcd-service";
import { discoverPayerPolicies } from "./services/payer-policy-ingestion";
import { DrChronoService } from "./services/emr/drchrono";
import { patients, encounters, assignments, clinicalNotes, auditLogs, commercialPayers, payerPolicies } from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
} as any);
const CODICAL_AI_USERNAME = "codical.ai";
const CODICAL_AI_NAME = "Codical AI";
const PRESENCE_ONLINE_WINDOW_MS = 75_000;
const SAVED_AI_FILE_RETENTION_DAYS = 30;
const SAVED_AI_FILE_MODULE_LABELS: Record<string, string> = {
  transcription: "AI Transcription",
  op_report_coding: "AI OP Report Coding",
  claim_validation: "Claim Validation",
};
const SAVED_AI_FILE_MODULES = new Set(Object.keys(SAVED_AI_FILE_MODULE_LABELS));
const isVercel = process.env.VERCEL === "1";
const uploadsRoot = isVercel
  ? path.resolve("/tmp", "uploads")
  : path.resolve(process.cwd(), "uploads");

function getLocalUploadDir(...segments: string[]) {
  return path.join(uploadsRoot, ...segments);
}

async function ensurePublicStorageBucket(bucketName: string) {
  if (!isSupabaseAdminConfigured) return false;

  try {
    const { data, error } = await supabaseAdmin.storage.getBucket(bucketName);
    if (data && !error) return true;

    const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: true,
    });

    if (createError && !/already exists/i.test(createError.message || "")) {
      console.warn(`Could not create Supabase storage bucket ${bucketName}:`, createError.message);
      return false;
    }

    return true;
  } catch (error: any) {
    console.warn(`Could not ensure Supabase storage bucket ${bucketName}:`, error?.message || error);
    return false;
  }
}

async function uploadPublicStorageFile(
  bucketName: string,
  storagePath: string,
  buffer: Buffer,
  contentType: string,
) {
  if (!(await ensurePublicStorageBucket(bucketName))) return "";

  try {
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn(`Supabase ${bucketName} upload failed:`, uploadError.message);
      return "";
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (error: any) {
    console.warn(`Supabase ${bucketName} upload threw:`, error?.message || error);
    return "";
  }
}

type PresenceUser = {
  isOnline?: boolean | null;
  lastSeen?: Date | string | null;
};

function withEffectivePresence<T extends PresenceUser>(user: T): T & { isOnline: boolean } {
  const lastSeenMs = user.lastSeen ? new Date(user.lastSeen).getTime() : 0;
  const isRecentlySeen = Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs <= PRESENCE_ONLINE_WINDOW_MS;

  return {
    ...user,
    isOnline: Boolean(user.isOnline && isRecentlySeen),
  };
}

async function updateChatPresence(userId: number, isOnline: boolean) {
  const [updatedUser] = await db.update(users)
    .set({ isOnline, lastSeen: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if ((global as any).io && updatedUser) {
    (global as any).io.emit("user:status", {
      userId,
      isOnline: withEffectivePresence(updatedUser).isOnline,
      lastSeen: updatedUser.lastSeen,
    });
  }

  return updatedUser;
}

type ChatUserProfile = {
  supabaseId?: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string | null;
};

type SupabaseAuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function buildChatProfileFromSupabaseUser(user: SupabaseAuthUserLike): ChatUserProfile {
  const metadata = user.user_metadata || {};
  const fullName =
    getMetadataString(metadata, ["full_name", "name", "display_name"]) ||
    user.email?.split("@")[0] ||
    "Codical User";

  const avatarUrl = getMetadataString(metadata, ["avatar_url", "picture"]);

  return {
    supabaseId: user.id,
    email: user.email || undefined,
    fullName,
    avatarUrl: avatarUrl || null,
  };
}

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sendRouteError(res: any, error: any, fallbackMessage: string) {
  if (error instanceof RouteError) {
    return res.status(error.status).json({ message: error.message });
  }

  return res.status(500).json({ message: error?.message || fallbackMessage });
}

function getBearerToken(req: Request) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

async function getAuthenticatedChatUser(req: Request) {
  if (!isSupabaseAdminConfigured) {
    throw new RouteError(503, "Authentication service is not configured.");
  }

  const token = getBearerToken(req);
  if (!token) {
    throw new RouteError(401, "Authentication required.");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new RouteError(401, "Invalid or expired session.");
  }

  const appUser = await ensureChatUser(buildChatProfileFromSupabaseUser(data.user));
  if (!appUser) {
    throw new RouteError(401, "Unable to resolve authenticated user.");
  }

  return appUser;
}

function normalizeSavedAiFileModule(value: unknown) {
  const module = String(value || "").trim();
  if (!SAVED_AI_FILE_MODULES.has(module)) {
    throw new RouteError(400, "module must be transcription, op_report_coding, or claim_validation");
  }

  return module;
}

function sanitizeSavedFileName(value: unknown, fallback: string) {
  const name = String(value || "")
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return name || fallback;
}

function getSavedFileFallbackName(module: string) {
  if (module === "transcription") return "Medical transcription";
  if (module === "claim_validation") return "Claim validation";
  return "OP report coding";
}

function getSavedFileExpirationDate() {
  return new Date(Date.now() + SAVED_AI_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function serializeSavedAiFile(file: typeof savedAiFiles.$inferSelect) {
  const expiresAt = file.expiresAt ? new Date(file.expiresAt) : getSavedFileExpirationDate();
  const createdAt = file.createdAt ? new Date(file.createdAt) : null;
  const updatedAt = file.updatedAt ? new Date(file.updatedAt) : null;
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  return {
    ...file,
    createdAt: createdAt?.toISOString() || null,
    updatedAt: updatedAt?.toISOString() || null,
    expiresAt: expiresAt.toISOString(),
    expirationDate: expiresAt.toISOString(),
    daysRemaining,
  };
}

async function cleanupExpiredSavedAiFiles() {
  const deletedRows = await db.delete(savedAiFiles)
    .where(sql`${savedAiFiles.expiresAt} <= now()`)
    .returning({ id: savedAiFiles.id });

  return deletedRows.length;
}

function getPdfSafeFileName(fileName: string) {
  const base = sanitizeSavedFileName(fileName, "codical-report")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 120) || "codical-report";

  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

function generateSavedAiFilePdf(file: typeof savedAiFiles.$inferSelect) {
  return new Promise<Buffer>((resolve, reject) => {
    const title = file.fileName || getSavedFileFallbackName(file.module);
    const moduleLabel = SAVED_AI_FILE_MODULE_LABELS[file.module] || "Codical Report";
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 54,
      info: {
        Title: title,
        Subject: moduleLabel,
        Author: "Codical Health",
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(18).text(title, { align: "left" });
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(10).fillColor("#475569").text(moduleLabel);
    if (file.patientName) doc.text(`Patient: ${file.patientName}`);
    if (file.createdAt) doc.text(`Saved: ${new Date(file.createdAt).toLocaleString("en-US")}`);
    doc.text(`Expires from app library: ${new Date(file.expiresAt).toLocaleDateString("en-US")}`);
    doc.moveDown();
    doc.strokeColor("#CBD5E1").moveTo(54, doc.y).lineTo(558, doc.y).stroke();
    doc.moveDown();
    doc.fillColor("#111827").font("Helvetica").fontSize(10).text(file.content || "", {
      align: "left",
      lineGap: 3,
    });
    doc.moveDown();
    doc.fontSize(8).fillColor("#64748B").text(
      "Downloaded PDFs are intended for permanent local storage. Reports saved inside Codical Health auto-delete after 30 days.",
    );
    doc.end();
  });
}

function normalizeUsername(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 42);

  return normalized || "codical.user";
}

async function getUniqueUsername(base: string) {
  const usernameBase = normalizeUsername(base);

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? usernameBase : `${usernameBase}.${attempt + 1}`;
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1);

    if (!existing[0]) {
      return candidate;
    }
  }

  return `${usernameBase}.${Date.now()}`;
}

function isUniqueConstraintError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  return candidate?.code === "23505" || /duplicate key value violates unique constraint/i.test(candidate?.message || "");
}

async function ensureChatUser(profile: ChatUserProfile) {
  const supabaseId = String(profile.supabaseId || "").trim();
  const email = String(profile.email || "").trim().toLowerCase();
  const fullName = String(profile.fullName || "").trim();
  const avatarUrl = profile.avatarUrl || null;

  if (!supabaseId && !email) {
    throw new Error("Supabase ID or email is required");
  }

  const existingBySupabaseId = supabaseId
    ? await db.select().from(users).where(eq(users.supabaseId, supabaseId)).limit(1)
    : [];
  const existingByEmail = !existingBySupabaseId[0] && email
    ? await db.select().from(users).where(eq(users.email, email)).limit(1)
    : [];
  const existing = existingBySupabaseId[0] || existingByEmail[0];

  if (existing) {
    const [updated] = await db.update(users)
      .set({
        supabaseId: existing.supabaseId || supabaseId || null,
        email: existing.email || email || null,
        fullName: existing.fullName || fullName,
        avatarUrl: existing.avatarUrl,
        isOnline: true,
        lastSeen: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();

    return updated;
  }

  const baseUsername = email ? email.split("@")[0] : fullName || supabaseId.slice(0, 8);
  const username = await getUniqueUsername(baseUsername);
  const insertValues = {
    supabaseId: supabaseId || null,
    username,
    email: email || null,
    fullName: fullName || username,
    avatarUrl,
    role: "coder",
    isOnline: true,
    lastSeen: new Date(),
  };

  try {
    const [created] = await db.insert(users).values(insertValues).returning();
    return created;
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const [conflictedUser] = await db.select()
      .from(users)
      .where(sql`
        (${supabaseId} <> '' and ${users.supabaseId} = ${supabaseId})
        or (${email} <> '' and ${users.email} = ${email})
      `)
      .limit(1);

    if (conflictedUser) {
      const [updated] = await db.update(users)
        .set({
          supabaseId: conflictedUser.supabaseId || supabaseId || null,
          email: conflictedUser.email || email || null,
          fullName: conflictedUser.fullName || fullName || username,
          avatarUrl: conflictedUser.avatarUrl,
          isOnline: true,
          lastSeen: new Date(),
        })
        .where(eq(users.id, conflictedUser.id))
        .returning();

      return updated;
    }

    const fallbackUsername = await getUniqueUsername(`${baseUsername}.${Date.now()}`);
    const [createdWithFallback] = await db.insert(users)
      .values({ ...insertValues, username: fallbackUsername })
      .returning();

    return createdWithFallback;
  }
}

async function ensureChatUserFromSupabaseId(supabaseId: string) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(supabaseId);

    if (error || !data.user) {
      console.warn("Unable to resolve Supabase chat user:", error?.message || "User not found");
      return null;
    }

    return await ensureChatUser(buildChatProfileFromSupabaseUser(data.user));
  } catch (error) {
    console.warn(
      "Supabase chat user lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return null;
  }
}

async function resolveChatUserId(value: unknown) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  const [found] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseId, raw)).limit(1);
  if (found?.id) {
    return found.id;
  }

  if (raw.includes("@")) {
    const [foundByEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, raw.toLowerCase()))
      .limit(1);

    if (foundByEmail?.id) {
      return foundByEmail.id;
    }
  }

  const syncedUser = await ensureChatUserFromSupabaseId(raw);
  return syncedUser?.id || null;
}

async function ensureCodicalAiUser() {
  const existing = await db.select().from(users).where(eq(users.username, CODICAL_AI_USERNAME)).limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db.insert(users).values({
    username: CODICAL_AI_USERNAME,
    fullName: CODICAL_AI_NAME,
    email: "ai@codical.local",
    role: "assistant",
    avatarUrl: null,
    isOnline: true,
  }).returning();

  return inserted[0];
}

async function ensureCodicalAiConversation(userId: number) {
  const aiUser = await ensureCodicalAiUser();

  const userParticipations = await db.select({
    conversationId: participants.conversationId
  }).from(participants).where(eq(participants.userId, userId));

  const conversationIds = userParticipations.map(p => p.conversationId);

  if (conversationIds.length > 0) {
    const possibleConversations = await db.query.conversations.findMany({
      where: inArray(conversations.id, conversationIds),
      with: {
        participants: true,
      }
    });

    const existing = possibleConversations.find(convo => {
      const ids = convo.participants.map(p => p.userId).sort((a, b) => a - b);
      return ids.length === 2 && ids.includes(userId) && ids.includes(aiUser.id);
    });

    if (existing) {
      return { conversation: existing, aiUser };
    }
  }

  const inserted = await db.insert(conversations).values({
    name: CODICAL_AI_NAME,
    isGroup: false,
  }).returning();

  const conversation = inserted[0];

  await db.insert(participants).values([
    { conversationId: conversation.id, userId, isAdmin: false },
    { conversationId: conversation.id, userId: aiUser.id, isAdmin: false },
  ]);

  return { conversation, aiUser };
}

async function areUsersFriends(userAId: number, userBId: number) {
  if (userAId === userBId) return true;

  const aiUser = await ensureCodicalAiUser();
  if (userAId === aiUser.id || userBId === aiUser.id) return true;

  const [accepted] = await db.select({ id: friendRequests.id })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "accepted"),
        or(
          and(eq(friendRequests.senderId, userAId), eq(friendRequests.receiverId, userBId)),
          and(eq(friendRequests.senderId, userBId), eq(friendRequests.receiverId, userAId)),
        ),
      ),
    )
    .limit(1);

  return Boolean(accepted);
}

async function getDirectConversation(userAId: number, userBId: number) {
  const userParticipations = await db.select({
    conversationId: participants.conversationId,
  }).from(participants).where(eq(participants.userId, userAId));

  const conversationIds = userParticipations.map((participant) => participant.conversationId);
  if (conversationIds.length === 0) return null;

  const possibleConversations = await db.query.conversations.findMany({
    where: inArray(conversations.id, conversationIds),
    with: {
      participants: true,
    },
  });

  return possibleConversations.find((conversation) => {
    const ids = conversation.participants.map((participant) => participant.userId).sort((a, b) => a - b);
    return ids.length === 2 && ids[0] === Math.min(userAId, userBId) && ids[1] === Math.max(userAId, userBId);
  }) || null;
}

async function getAcceptedFriends(userId: number) {
  const rows = await db.query.friendRequests.findMany({
    where: and(
      eq(friendRequests.status, "accepted"),
      or(eq(friendRequests.senderId, userId), eq(friendRequests.receiverId, userId)),
    ),
    with: {
      sender: {
        columns: { id: true, fullName: true, username: true, email: true, avatarUrl: true, isOnline: true, lastSeen: true },
      },
      receiver: {
        columns: { id: true, fullName: true, username: true, email: true, avatarUrl: true, isOnline: true, lastSeen: true },
      },
    },
  });

  return rows
    .map((request) => request.senderId === userId ? request.receiver : request.sender)
    .filter(Boolean)
    .map((user) => withEffectivePresence(user));
}

async function getUnreadCount(conversationId: number, userId: number, lastReadAt: Date | null) {
  const [row] = await db.select({
    count: sql<number>`count(*)::int`,
  })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, userId),
        lastReadAt ? sql`${messages.createdAt} > ${lastReadAt}` : sql`true`,
      ),
    );

  return Number(row?.count || 0);
}

let lcdToken: string | null = null;
let lcdTokenExpiry: number = 0;

async function getLcdToken(): Promise<string> {
  if (lcdToken && lcdTokenExpiry > Date.now()) return lcdToken;
  const res = await fetch("https://api.coverage.cms.gov/v1/metadata/license-agreement?agree=true", {
    headers: {
      "Accept": "application/json",
      "User-Agent": "CodicalHealth/1.0",
    },
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.toLowerCase().includes("application/json")) {
    throw new Error(`CMS coverage license API unavailable (${res.status}): ${apiPreview(text)}`);
  }
  const data = JSON.parse(text);
  lcdToken = data.data[0].Token;
  lcdTokenExpiry = Date.now() + 55 * 60 * 1000;
  return lcdToken!;
}

function sqlText(value: string) {
  return String(value || "").replace(/'/g, "''");
}

function limitList<T>(items: T[], limit: number) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 50;
  return items.slice(0, safeLimit);
}

function readCoverageCodeList(...values: unknown[]) {
  const codes: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const candidates = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[\s,]+/)
        : [];

    for (const candidate of candidates) {
      const code = String(candidate || "").trim().toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
    }
  }

  return codes;
}

function apiPreview(text: string) {
  return String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

async function fetchCoverageJson(url: string, useLicenseToken = true) {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "CodicalHealth/1.0",
  };

  if (useLicenseToken) {
    headers.Authorization = "Bearer " + await getLcdToken();
  }

  const response = await fetch(url, { headers });
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok || !contentType.toLowerCase().includes("application/json")) {
    throw new Error(`CMS coverage API unavailable (${response.status}): ${apiPreview(text)}`);
  }

  return JSON.parse(text);
}

function getCoverageRows(data: any): any[] {
  return Array.isArray(data?.data) ? data.data : [];
}

async function tryMcdCoverageRows(
  kind: "article" | "lcd" | "ncd",
  input: { search?: string; cpt?: string; limit?: number },
) {
  try {
    const rows = input.cpt
      ? await getMcdCodeCoverageRows(input.cpt, { kind, limit: input.limit })
      : await searchMcdCoverageRows({ query: input.search, kind, limit: input.limit });

    return rows;
  } catch (error: any) {
    console.warn("Cloudflare MCD lookup failed; falling back to CMS Coverage API:", error?.message || error);
    return null;
  }
}

async function tryMcdCoverageDocument(candidates: string[]) {
  try {
    return await getMcdCoverageDocument(candidates);
  } catch (error: any) {
    console.warn("Cloudflare MCD document lookup failed; falling back to CMS Coverage API:", error?.message || error);
    return null;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============ VOICE TRANSCRIPTION ROUTES ============

  app.post("/api/voice/transcribe",
    upload.single("audio"),
    async (req, res) => {
      try {
        const file = req.file;

        if (!file) {
          return res.status(400).json({
            message: "Audio file is required"
          });
        }

        const allowedTypes = [
          "audio/wav", "audio/mpeg", "audio/mp3",
          "audio/flac", "audio/x-flac", "audio/m4a",
          "audio/mp4", "audio/ogg", "audio/x-m4a",
          "audio/aac", "audio/aiff", "audio/x-aiff",
          "audio/x-wav", "audio/wave", "audio/vnd.wave",
          "application/octet-stream"
        ];
        const allowedExtensions = [
          ".wav", ".mp3", ".flac", ".m4a", ".aac", ".aif", ".aiff", ".ogg"
        ];
        const fileExt = path.extname(
          file.originalname
        ).toLowerCase();

        const hasAllowedExtension = allowedExtensions.includes(fileExt);
        const hasAllowedMimeType = !file.mimetype || allowedTypes.includes(file.mimetype);

        if (!hasAllowedExtension && !hasAllowedMimeType) {
          return res.status(400).json({
            message: "Invalid file type. Please upload .wav, .mp3, .flac, .m4a, .aac, .aiff, or .ogg"
          });
        }

        if (file.size > 25 * 1024 * 1024) {
          return res.status(400).json({
            message: "File too large. Maximum size is 25MB"
          });
        }

        const { transcribeAudio } =
          await import("./services/transcription");

        const result = await transcribeAudio(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        if (!result.rawTranscript || result.rawTranscript.trim().length < 5) {
          return res.status(422).json({
            message: "Could not transcribe audio. Audio may be too short, silent, or unclear."
          });
        }

        const diagnosisCodes = readCoverageCodeList(
          Array.isArray(result.codingSuggestions?.icd10_codes)
            ? result.codingSuggestions.icd10_codes.map((code: any) => code?.code)
            : [],
        );
        const procedureCodes = readCoverageCodeList(
          Array.isArray(result.codingSuggestions?.cpt_codes)
            ? result.codingSuggestions.cpt_codes.map((code: any) => code?.code)
            : [],
          Array.isArray(result.codingSuggestions?.hcpcs_codes)
            ? result.codingSuggestions.hcpcs_codes.map((code: any) => code?.code)
            : [],
        );
        const claimValidation = diagnosisCodes.length > 0 || procedureCodes.length > 0
          ? await validateClaimCodeSet({
              diagnosisCodes,
              procedureCodes,
              ncciType: "practitioner",
              coverageLimit: 8,
            })
          : null;

        const [saved] = await db
          .insert(voiceTranscriptions)
          .values({
            audioFileName: file.originalname,
            rawTranscript: result.rawTranscript,
            patientName: result.structured.patientName,
            patientAge: result.structured.patientAge,
            dateOfVisit: result.structured.dateOfVisit,
            chiefComplaint: result.structured.chiefComplaint,
            diagnosis: result.structured.diagnosis,
            medications: result.structured.medications,
            dosage: result.structured.dosage,
            doctorName: result.structured.doctorName,
            doctorNotes: result.structured.doctorNotes,
            followupDate: result.structured.followupDate,
          })
          .returning();

        res.status(200).json({
          success: true,
          id: saved.id,
          rawTranscript: result.rawTranscript,
          structured: {
            patientName: result.structured.patientName,
            patientAge: result.structured.patientAge,
            dateOfVisit: result.structured.dateOfVisit,
            chiefComplaint: result.structured.chiefComplaint,
            diagnosis: result.structured.diagnosis,
            medications: result.structured.medications,
            dosage: result.structured.dosage,
            doctorName: result.structured.doctorName,
            doctorNotes: result.structured.doctorNotes,
            followupDate: result.structured.followupDate,
          },
          codingSuggestions: result.codingSuggestions,
          coverageValidation: claimValidation?.coverageValidation || null,
          ncciValidation: claimValidation?.ncciValidation || null,
          claimValidation,
          createdAt: saved.createdAt,
        });

      } catch (error: any) {
        console.error("Voice transcription error:", error);
        res.status(500).json({
          message: error.message || "Transcription failed"
        });
      }
    }
  );

  app.get("/api/voice/transcriptions", async (req, res) => {
    try {
      const results = await db
        .select()
        .from(voiceTranscriptions)
        .orderBy(desc(voiceTranscriptions.createdAt))
        .limit(50);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // â”€â”€â”€ Codes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Shared saved-file library for AI Transcription and AI OP Report Coding.
  app.get("/api/saved-ai-files", async (req, res) => {
    try {
      const appUser = await getAuthenticatedChatUser(req);
      const module = normalizeSavedAiFileModule(req.query.module);

      await cleanupExpiredSavedAiFiles();

      const rows = await db.select()
        .from(savedAiFiles)
        .where(
          and(
            eq(savedAiFiles.userId, appUser.id),
            eq(savedAiFiles.module, module),
            sql`${savedAiFiles.expiresAt} > now()`,
          ),
        )
        .orderBy(desc(savedAiFiles.createdAt));

      res.json(rows.map(serializeSavedAiFile));
    } catch (error: any) {
      sendRouteError(res, error, "Failed to load saved files");
    }
  });

  app.post("/api/saved-ai-files", async (req, res) => {
    try {
      const appUser = await getAuthenticatedChatUser(req);
      const module = normalizeSavedAiFileModule(req.body.module);
      const content = String(req.body.content || "").trim();

      if (!content) {
        return res.status(400).json({ message: "Report content is required." });
      }

      if (content.length > 500_000) {
        return res.status(413).json({ message: "Report content is too large to save." });
      }

      const fileName = sanitizeSavedFileName(req.body.fileName, getSavedFileFallbackName(module));
      const patientName = String(req.body.patientName || "").trim().slice(0, 160) || null;
      const sourceText = String(req.body.sourceText || "").trim() || null;
      const structuredData = req.body.structuredData && typeof req.body.structuredData === "object"
        ? req.body.structuredData
        : {};

      const [created] = await db.insert(savedAiFiles)
        .values({
          userId: appUser.id,
          module,
          fileName,
          patientName,
          content,
          sourceText,
          structuredData,
          expiresAt: getSavedFileExpirationDate(),
        })
        .returning();

      res.status(201).json(serializeSavedAiFile(created));
    } catch (error: any) {
      sendRouteError(res, error, "Failed to save file");
    }
  });

  app.get("/api/saved-ai-files/:id", async (req, res) => {
    try {
      const appUser = await getAuthenticatedChatUser(req);
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid saved file ID." });

      await cleanupExpiredSavedAiFiles();

      const [file] = await db.select()
        .from(savedAiFiles)
        .where(and(eq(savedAiFiles.id, id), eq(savedAiFiles.userId, appUser.id), sql`${savedAiFiles.expiresAt} > now()`))
        .limit(1);

      if (!file) return res.status(404).json({ message: "Saved file not found." });
      res.json(serializeSavedAiFile(file));
    } catch (error: any) {
      sendRouteError(res, error, "Failed to load saved file");
    }
  });

  app.patch("/api/saved-ai-files/:id", async (req, res) => {
    try {
      const appUser = await getAuthenticatedChatUser(req);
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid saved file ID." });

      const updateValues: Partial<typeof savedAiFiles.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (Object.prototype.hasOwnProperty.call(req.body, "fileName")) {
        updateValues.fileName = sanitizeSavedFileName(req.body.fileName, "Saved report");
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "patientName")) {
        updateValues.patientName = String(req.body.patientName || "").trim().slice(0, 160) || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "content")) {
        const content = String(req.body.content || "").trim();
        if (!content) return res.status(400).json({ message: "Report content is required." });
        if (content.length > 500_000) return res.status(413).json({ message: "Report content is too large to save." });
        updateValues.content = content;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "sourceText")) {
        updateValues.sourceText = String(req.body.sourceText || "").trim() || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "structuredData")) {
        updateValues.structuredData = req.body.structuredData && typeof req.body.structuredData === "object"
          ? req.body.structuredData
          : {};
      }

      const [updated] = await db.update(savedAiFiles)
        .set(updateValues)
        .where(and(eq(savedAiFiles.id, id), eq(savedAiFiles.userId, appUser.id), sql`${savedAiFiles.expiresAt} > now()`))
        .returning();

      if (!updated) return res.status(404).json({ message: "Saved file not found." });
      res.json(serializeSavedAiFile(updated));
    } catch (error: any) {
      sendRouteError(res, error, "Failed to update saved file");
    }
  });

  app.delete("/api/saved-ai-files/:id", async (req, res) => {
    try {
      const appUser = await getAuthenticatedChatUser(req);
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid saved file ID." });

      const deleted = await db.delete(savedAiFiles)
        .where(and(eq(savedAiFiles.id, id), eq(savedAiFiles.userId, appUser.id)))
        .returning({ id: savedAiFiles.id });

      if (!deleted[0]) return res.status(404).json({ message: "Saved file not found." });
      res.status(204).end();
    } catch (error: any) {
      sendRouteError(res, error, "Failed to delete saved file");
    }
  });

  app.get("/api/saved-ai-files/:id/pdf", async (req, res) => {
    try {
      const appUser = await getAuthenticatedChatUser(req);
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid saved file ID." });

      await cleanupExpiredSavedAiFiles();

      const [file] = await db.select()
        .from(savedAiFiles)
        .where(and(eq(savedAiFiles.id, id), eq(savedAiFiles.userId, appUser.id), sql`${savedAiFiles.expiresAt} > now()`))
        .limit(1);

      if (!file) return res.status(404).json({ message: "Saved file not found." });

      const pdf = await generateSavedAiFilePdf(file);
      res
        .status(200)
        .set({
          "Content-Type": "application/pdf",
          "Content-Length": String(pdf.length),
          "Content-Disposition": `attachment; filename="${getPdfSafeFileName(file.fileName)}"`,
          "Cache-Control": "private, no-store",
        })
        .send(pdf);
    } catch (error: any) {
      sendRouteError(res, error, "Failed to generate PDF");
    }
  });

  app.get("/api/cron/cleanup-saved-ai-files", async (req, res) => {
    try {
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const deletedCount = await cleanupExpiredSavedAiFiles();
      res.json({ success: true, deletedCount });
    } catch (error: any) {
      console.error("Saved AI files cleanup failed:", error);
      res.status(500).json({ message: error.message || "Cleanup failed" });
    }
  });

  app.get(api.codes.search.path, async (req, res) => {
    try {
      const query = req.query.query as string || "";
      const type = req.query.type as string || undefined;
      const results = await storage.searchCodes(query, type);
      res.json(results);
    } catch (error: any) {
      console.error("Search error:", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  app.get(api.codes.get.path, async (req, res) => {
    const type = String(req.params.type);
    const code = String(req.params.code);
    const result = await storage.getCode(type, code);
    if (!result) return res.status(404).json({ message: "Code not found" });
    res.json(result);
  });

  // â”€â”€â”€ Favorites â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get(api.favorites.list.path, async (_req, res) => {
    const favs = await storage.getFavorites(1);
    res.json(favs);
  });

  app.post(api.favorites.create.path, async (req, res) => {
    try {
      const input = api.favorites.create.input.parse(req.body);
      const fav = await storage.createFavorite(input);
      res.status(201).json(fav);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete(api.favorites.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const existing = await storage.getFavorite(id);
    if (!existing) return res.status(404).json({ message: "Favorite not found" });
    await storage.deleteFavorite(id);
    res.status(204).end();
  });

  // ──────────────────────────────────────────────────────────────────────────────────────────────────
  app.get("/api/guidelines/nlm/search", async (req, res) => {
    try {
      const q = (req.query.q as string) || "";
      const type = ((req.query.type as string) || "icd10cm") as "icd10cm" | "cpt";
      if (!q.trim()) return res.json([]);
      const results = await searchNlmCodes(q, type);
      res.json(results);
    } catch (e: any) {
      res.status(502).json({ message: e.message });
    }
  });

  app.get("/api/guidelines/debug-version", (_req, res) => {
    res.json({ source: "server/routes.ts", cmsDbService: "active", version: "guidelines-code-match-v2" });
  });

  app.get("/api/icd10-notes/:code", async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const data = await getIcd10CodeNotes(code);
      if (!data) return res.status(404).json({ message: "ICD-10 notes not found" });
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // â”€â”€â”€ NCCI Edit Checker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/ncci/check", async (req, res) => {
    try {
      return res.json(await checkNcciEdit(req.query.col1, req.query.col2, req.query.type));
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({ message: error.message });
    }
  });

  app.post("/api/ncci/batch", async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const codes = readCoverageCodeList(body.codes, body.procedureCodes, body.cptCodes, body.hcpcsCodes);
      return res.json(await checkNcciBatchEdits(codes, body.type));
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({ message: error.message });
    }
  });

  // â”€â”€â”€ CMS Coverage â€” NCD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Claim code set validation
  app.post("/api/claim/validate", async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const diagnosisCodes = readCoverageCodeList(body.diagnosisCodes, body.icdCodes, body.icd10Codes);
      const procedureCodes = readCoverageCodeList(body.procedureCodes, body.cptCodes, body.hcpcsCodes);

      return res.json(await validateClaimCodeSet({
        diagnosisCodes,
        procedureCodes,
        ncciType: body.ncciType || body.type,
        coverageLimit: body.coverageLimit || body.limit,
      }));
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({ message: error.message });
    }
  });

  app.get("/api/coverage/ncd", async (req, res) => {
    try {
      const search = (req.query.search as string) || "";
      const limit = Number(req.query.limit || 50);
      const mcdRows = await tryMcdCoverageRows("ncd", { search, limit });
      if (mcdRows) return res.json(limitList(mcdRows, limit));

      const url = `https://api.coverage.cms.gov/v1/reports/national-coverage-ncd`;
      const data = await fetchCoverageJson(url);
      let results = getCoverageRows(data);
      if (search) {
        results = results.filter((item: any) =>
          item.title?.toLowerCase().includes(search.toLowerCase()) ||
          item.document_display_id?.toLowerCase().includes(search.toLowerCase())
        );
      }
      res.json(limitList(results, limit));
    } catch (error: any) {
      res.status(502).json({ message: error.message });
    }
  });

  app.get("/api/coverage/ncd/:id/:version", async (req, res) => {
    try {
      const { id, version } = req.params;
      const mcdDocument = await tryMcdCoverageDocument([id, `NCD ${id}`, `NCD ${id.replace(/^NCD\s*/i, "")}`]);
      if (mcdDocument) return res.json(mcdDocument);

      const url = `https://api.coverage.cms.gov/v1/data/ncd?ncdid=${id}&ncdver=${version}`;
      const data = await fetchCoverageJson(url);
      res.json(data.data?.[0] || null);
    } catch (error: any) {
      res.status(502).json({ message: error.message });
    }
  });

  // â”€â”€â”€ CMS Coverage â€” LCD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/coverage/lcd", async (req, res) => {
    try {
      const search = (req.query.search as string) || "";
      const cpt = (req.query.cpt as string) || "";
      const limit = Number(req.query.limit || 50);
      const mcdRows = await tryMcdCoverageRows("lcd", { search, cpt, limit });
      if (mcdRows) return res.json(limitList(mcdRows, limit));

      let url = `https://api.coverage.cms.gov/v1/reports/local-coverage-final-lcds`;
      if (cpt) url += `?cpt=${cpt}`;
      const data = await fetchCoverageJson(url);
      let results = getCoverageRows(data);
      if (search && !cpt) {
        results = results.filter((item: any) =>
          item.title?.toLowerCase().includes(search.toLowerCase()) ||
          item.document_display_id?.toLowerCase().includes(search.toLowerCase()) ||
          item.contractor_name_type?.toLowerCase().includes(search.toLowerCase())
        );
      }
      res.json(limitList(results, limit));
    } catch (error: any) {
      res.status(502).json({ message: error.message });
    }
  });

  app.get("/api/coverage/articles", async (req, res) => {
    try {
      const search = (req.query.search as string) || "";
      const cpt = (req.query.cpt as string) || "";
      const limit = Number(req.query.limit || 50);
      const mcdRows = await tryMcdCoverageRows("article", { search, cpt, limit });
      if (mcdRows) return res.json(limitList(mcdRows, limit));

      let url = `https://api.coverage.cms.gov/v1/reports/local-coverage-articles`;
      if (cpt) url += `?cpt=${encodeURIComponent(cpt)}`;
      const data = await fetchCoverageJson(url);
      let results = getCoverageRows(data);
      if (search && !cpt) {
        const normalized = search.toLowerCase();
        results = results.filter((item: any) =>
          item.title?.toLowerCase().includes(normalized) ||
          item.document_title?.toLowerCase().includes(normalized) ||
          item.article_title?.toLowerCase().includes(normalized) ||
          item.document_display_id?.toLowerCase().includes(normalized) ||
          item.article_id?.toLowerCase().includes(normalized) ||
          item.contractor_name_type?.toLowerCase().includes(normalized)
        );
      }
      res.json(limitList(results, limit));
    } catch (error: any) {
      res.status(502).json({ message: error.message });
    }
  });

  // â”€â”€â”€ Smart LCD Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/coverage/pair/check", async (req, res) => {
    try {
      const icdCode = String(req.query.icd || req.query.icdCode || "").trim().toUpperCase();
      const procedureCode = String(req.query.code || req.query.cpt || req.query.hcpcs || "").trim().toUpperCase();
      const limit = Number(req.query.limit || 12);

      if (!icdCode || !procedureCode) {
        return res.status(400).json({ message: "Both icd and code are required" });
      }

      const result = await getMcdIcdProcedurePairEvidence({ icdCode, procedureCode, limit });
      if (!result) {
        return res.status(503).json({ message: "Cloudflare MCD coverage intelligence is not configured" });
      }

      return res.json(result);
    } catch (error: any) {
      res.status(502).json({ message: error.message });
    }
  });

  app.post("/api/coverage/pair/batch", async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const diagnosisCodes = readCoverageCodeList(body.diagnosisCodes, body.icdCodes, body.icd10Codes);
      const procedureCodes = readCoverageCodeList(body.procedureCodes, body.cptCodes, body.hcpcsCodes);
      const limit = Number(body.limit || 8);

      if (diagnosisCodes.length === 0 || procedureCodes.length === 0) {
        return res.status(400).json({ message: "At least one diagnosis code and one procedure code are required" });
      }

      const result = await getMcdBatchPairEvidence({ diagnosisCodes, procedureCodes, limit });
      if (!result) {
        return res.status(503).json({ message: "Cloudflare MCD coverage intelligence is not configured" });
      }

      return res.json(result);
    } catch (error: any) {
      res.status(502).json({ message: error.message });
    }
  });

  app.get("/api/coverage/lcd/search/smart", async (req, res) => {
    try {
      const query = (req.query.q as string)?.trim() || "";
      if (!query) return res.json({ searchTerms: [], isCptCode: false, results: [] });
      let searchTerms: string[] = [];
      const isCptCode = /^\d{4,5}[A-Z]?$/.test(query.toUpperCase());
      if (isCptCode) {
        const cptResult = await db.execute(
          `SELECT description, category FROM cpt_codes WHERE code = '${sqlText(query.toUpperCase())}' LIMIT 1`
        );
        if (cptResult.rows.length > 0) {
          const desc = String(cptResult.rows[0].description).replace(/^"|"$/g, '').toLowerCase();
          const category = String(cptResult.rows[0].category || '').toLowerCase();
          const words = [...desc.split(/\s+/), ...category.split(/\s+/)]
            .filter(w => w.length > 4)
            .filter(w => !['with', 'without', 'other', 'using', 'procedure', 'service', 'patient', 'provides', 'performs', 'provider'].includes(w))
            .slice(0, 3);
          searchTerms = words;
        } else {
          searchTerms = [query];
        }
      } else {
        searchTerms = [query];
      }

      const mcdRows = isCptCode
        ? await tryMcdCoverageRows("lcd", { cpt: query, limit: 50 })
        : await tryMcdCoverageRows("lcd", { search: searchTerms.join(" "), limit: 50 });

      if (mcdRows && (mcdRows.length > 0 || !isCptCode)) {
        return res.json({ searchTerms, isCptCode, results: mcdRows.slice(0, 50) });
      }

      const url = `https://api.coverage.cms.gov/v1/reports/local-coverage-final-lcds`;
      const data = await fetchCoverageJson(url);
      const allLcds = getCoverageRows(data);
      const results = allLcds.filter((lcd: any) => {
        const title = lcd.title?.toLowerCase() || "";
        const displayId = lcd.document_display_id?.toLowerCase() || "";
        const contractor = lcd.contractor_name_type?.toLowerCase() || "";
        return searchTerms.some(term => {
          const normalized = term.toLowerCase();
          return title.includes(normalized) || displayId.includes(normalized) || contractor.includes(normalized);
        });
      });
      res.json({ searchTerms, isCptCode, results: results.slice(0, 50) });
    } catch (error: any) {
      res.status(502).json({ message: error.message });
    }
  });

  app.get("/api/coverage/lcd/:id/:version", async (req, res) => {
    try {
      const { id, version } = req.params;
      const normalizedId = id.replace(/^L/i, "");
      const mcdDocument = await tryMcdCoverageDocument([id, `L${normalizedId}`]);
      if (mcdDocument) return res.json(mcdDocument);

      const url = `https://api.coverage.cms.gov/v1/data/lcd?lcdid=${id}&ver=${version}`;
      const data = await fetchCoverageJson(url);
      res.json(data.data?.[0] || null);
    } catch (error: any) {
      res.status(502).json({ message: error.message });
    }
  });

  // â”€â”€â”€ CPT RVU Calculator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/rvu/:code", async (req, res) => {
    try {
      const code = req.params.code.toUpperCase().trim();
      const result = await db.execute(
        `SELECT * FROM rvu_2026 WHERE TRIM(hcpc) = '${code}' AND (modifier IS NULL OR TRIM(modifier) = '') LIMIT 1`
      );
      if (result.rows.length === 0) return res.json(null);
      const row = result.rows[0] as any;
      const cf = Number(row.conv_fact) || 33.4009;
      const totalNonFac = Number(row.full_nfac_total) || 0;
      const totalFac = Number(row.full_fac_total) || 0;
      res.json({
        code,
        description: String(row.sdesc || '').trim(),
        year: 2026,
        conversionFactor: cf,
        workRvu: Number(row.rvu_work) || 0,
        nonFacilityPeRvu: Number(row.full_nfac_pe) || 0,
        facilityPeRvu: Number(row.full_fac_pe) || 0,
        malpracticeRvu: Number(row.rvu_mp) || 0,
        totalNonFacilityRvu: totalNonFac,
        totalFacilityRvu: totalFac,
        nonFacilityPayment: parseFloat((totalNonFac * cf).toFixed(2)),
        facilityPayment: parseFloat((totalFac * cf).toFixed(2)),
        globalPeriod: String(row.global || '').trim(),
        procStatus: String(row.proc_stat || '').trim(),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // â”€â”€â”€ Anesthesia Calculator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/anesthesia/localities", async (req, res) => {
    try {
      const result = await db.execute(
        `SELECT * FROM anesthesia_cf_2026 ORDER BY "Locality Name" ASC`
      );
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/anesthesia/calculate", async (req, res) => {
    try {
      const locality = (req.query.locality as string) || "";
      const baseUnits = Number(req.query.baseUnits) || 0;
      const timeUnits = Number(req.query.timeUnits) || 0;
      const modifierUnits = Number(req.query.modifierUnits) || 0;
      const useQualifying = req.query.qualifying === "true";
      const result = await db.execute(
        `SELECT * FROM anesthesia_cf_2026 WHERE TRIM("Locality") = '${locality.trim()}' LIMIT 1`
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Locality not found" });
      }
      const row = result.rows[0] as any;
      const cf = useQualifying
        ? Number(row.qualifying_cf)
        : Number(row.non_qualifying_cf);
      const totalUnits = baseUnits + timeUnits + modifierUnits;
      const payment = parseFloat((totalUnits * cf).toFixed(2));
      res.json({
        locality: String(row["Locality"]).trim(),
        localityName: String(row["Locality Name"]).trim(),
        contractor: String(row["Contractor"]).trim(),
        workGpci: Number(row["2026 Work GPCI"]),
        peGpci: Number(row["2026 PE GPCI"]),
        mpGpci: Number(row["2026 MP GPCI"]),
        nonQualifyingCf: Number(row.non_qualifying_cf),
        qualifyingCf: Number(row.qualifying_cf),
        usedCf: cf,
        baseUnits,
        timeUnits,
        modifierUnits,
        totalUnits,
        payment
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // â”€â”€â”€ NPI Checker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/npi/search", async (req, res) => {
    try {
      const number = (req.query.number as string) || "";
      const firstName = (req.query.firstName as string) || "";
      const lastName = (req.query.lastName as string) || "";
      const organizationName = (req.query.organizationName as string) || "";
      const state = (req.query.state as string) || "";
      const specialty = (req.query.specialty as string) || "";
      const limit = Math.min(20, Number(req.query.limit) || 10);

      let url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&limit=${limit}`;
      if (number) url += `&number=${number}`;
      if (firstName) url += `&first_name=${encodeURIComponent(firstName)}`;
      if (lastName) url += `&last_name=${encodeURIComponent(lastName)}`;
      if (organizationName) url += `&organization_name=${encodeURIComponent(organizationName)}`;
      if (state) url += `&state=${state}`;
      if (specialty) url += `&taxonomy_description=${encodeURIComponent(specialty)}`;

      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // â”€â”€â”€ Place of Service Codes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/pos", (req, res) => {
    const search = (req.query.search as string || "").toLowerCase();
    const posCodes = [
      { code: "01", name: "Pharmacy", description: "A facility or location where drugs and other medically related items and services are sold, dispensed, or otherwise provided directly to patients." },
      { code: "02", name: "Telehealth - Provided Other than in Patient's Home", description: "The location where health services and health related services are provided or received, through telecommunication technology." },
      { code: "03", name: "School", description: "A facility whose primary purpose is education." },
      { code: "04", name: "Homeless Shelter", description: "A facility or location whose primary purpose is to provide temporary housing to homeless individuals." },
      { code: "05", name: "Indian Health Service Free-standing Facility", description: "A facility or location, owned and operated by the Indian Health Service, which provides diagnostic, therapeutic, surgical, rehabilitative, or palliative services." },
      { code: "06", name: "Indian Health Service Provider-based Facility", description: "A facility or location, owned and operated by the Indian Health Service, which provides diagnostic, therapeutic, surgical, rehabilitative, or palliative services." },
      { code: "07", name: "Tribal 638 Free-Standing Facility", description: "A facility or location owned and operated by a federally recognized American Indian or Alaska Native tribe or tribal organization." },
      { code: "08", name: "Tribal 638 Provider-Based Facility", description: "A facility or location owned and operated by a federally recognized American Indian or Alaska Native tribe or tribal organization." },
      { code: "09", name: "Prison/Correctional Facility", description: "A prison, jail, reformatory, work farm, detention center, or any other similar facility maintained by either Federal, State or local authorities." },
      { code: "10", name: "Telehealth - Provided in Patient's Home", description: "The location where health services and health related services are provided or received through telecommunication technology in the patient's home." },
      { code: "11", name: "Office", description: "Location, other than a hospital, skilled nursing facility, military treatment facility, community health center, State or local public health clinic, or intermediate care facility, where the health professional routinely provides health examinations, diagnosis, and treatment of illness or injury on an ambulatory basis." },
      { code: "12", name: "Home", description: "Location, other than a hospital or other facility, where the patient receives care in a private residence." },
      { code: "13", name: "Assisted Living Facility", description: "Congregate residential facility with self-contained living units providing assessment of each resident's needs and on-site support 24 hours a day, 7 days a week." },
      { code: "14", name: "Group Home", description: "A residence, with shared living areas, where clients receive supervision and other services." },
      { code: "15", name: "Mobile Unit", description: "A facility/unit that moves from place-to-place equipped to provide preventive, screening, diagnostic, and/or treatment services." },
      { code: "16", name: "Temporary Lodging", description: "A short term accommodation such as a hotel, camp ground, hostel, cruise ship or resort where the patient receives care." },
      { code: "17", name: "Walk-in Retail Health Clinic", description: "A walk-in health clinic, other than an office, urgent care facility, pharmacy or independent clinic and not described by any other Place of Service code." },
      { code: "18", name: "Place of Employment/Worksite", description: "A location, not described by any other POS code, owned or operated by a public or private entity where the patient is employed." },
      { code: "19", name: "Off Campus-Outpatient Hospital", description: "A portion of an off-campus hospital provider based department which provides diagnostic, therapeutic, surgical, rehabilitation, or palliative services to sick or injured persons." },
      { code: "20", name: "Urgent Care Facility", description: "Location, distinct from a hospital emergency room, an office, or a clinic, whose purpose is to diagnose and treat illness or injury for unscheduled, ambulatory patients seeking immediate medical attention." },
      { code: "21", name: "Inpatient Hospital", description: "A facility, other than psychiatric, which primarily provides diagnostic, therapeutic (both surgical and nonsurgical), and rehabilitation services by, or under, the supervision of physicians to patients admitted for a variety of medical conditions." },
      { code: "22", name: "On Campus-Outpatient Hospital", description: "A portion of a hospital's main campus which provides diagnostic, therapeutic, surgical, rehabilitation, or palliative services to sick or injured persons." },
      { code: "23", name: "Emergency Room - Hospital", description: "A portion of a hospital where emergency diagnosis and treatment of illness or injury is provided." },
      { code: "24", name: "Ambulatory Surgical Center", description: "A freestanding facility, other than a physician's office, where surgical and diagnostic services are provided on an ambulatory basis." },
      { code: "25", name: "Birthing Center", description: "A facility, other than a hospital's maternity facilities or a physician's office, which provides a setting for labor, delivery, and immediate post-partum care." },
      { code: "26", name: "Military Treatment Facility", description: "A medical facility operated by one or more of the Uniformed Services. Military Treatment Facility (MTF) also refers to certain former U.S. Public Health Service (USPHS) facilities now designated as Uniformed Service Treatment Facilities (USTF)." },
      { code: "27", name: "Outreach Site/Street", description: "A non-permanent location on the street or found environment, not described by any other POS code, where health professionals provide preventive, screening, diagnostic, and/or treatment services." },
      { code: "31", name: "Skilled Nursing Facility", description: "A facility which primarily provides inpatient skilled nursing care and related services to patients who require medical, nursing, or rehabilitative services but does not provide the level of care or treatment available in a hospital." },
      { code: "32", name: "Nursing Facility", description: "A facility which primarily provides to residents skilled nursing care and related services for the rehabilitation of injured, disabled, or sick persons, or, on a regular basis, health-related care services above the level of custodial care to other than mentally retarded individuals." },
      { code: "33", name: "Custodial Care Facility", description: "A facility which provides room, board and other personal assistance services, generally on a long-term basis, and which does not include a medical component." },
      { code: "34", name: "Hospice", description: "A facility, other than a patient's home, in which palliative and supportive care for terminally ill patients and their families are provided." },
      { code: "41", name: "Ambulance - Land", description: "A land vehicle specifically designed, equipped and staffed for lifesaving and transporting the sick or injured." },
      { code: "42", name: "Ambulance - Air or Water", description: "An air or water vehicle specifically designed, equipped and staffed for lifesaving and transporting the sick or injured." },
      { code: "49", name: "Independent Clinic", description: "A location, not part of a hospital and not described by any other Place of Service code, that is organized and operated to provide preventive, diagnostic, therapeutic, rehabilitative, or palliative services to outpatients only." },
      { code: "50", name: "Federally Qualified Health Center", description: "A facility located in a medically underserved area that provides Medicare beneficiaries preventive primary medical care under the general direction of a physician." },
      { code: "51", name: "Inpatient Psychiatric Facility", description: "A facility that provides inpatient psychiatric services for the diagnosis and treatment of mental illness on a 24-hour basis, by or under the supervision of a physician." },
      { code: "52", name: "Psychiatric Facility-Partial Hospitalization", description: "A facility for the diagnosis and treatment of mental illness that provides a planned therapeutic program for patients who do not require full-time hospitalization." },
      { code: "53", name: "Community Mental Health Center", description: "A facility that provides the following services: outpatient services, including specialized outpatient services for children, the elderly, individuals who are chronically ill, and residents of the CMHC's mental health services area." },
      { code: "54", name: "Intermediate Care Facility/Individuals with Intellectual Disabilities", description: "A facility which primarily provides health-related care and services above the level of custodial care to intellectually disabled individuals." },
      { code: "55", name: "Residential Substance Abuse Treatment Facility", description: "A facility which provides treatment for substance (alcohol and drug) abuse to live-in residents who do not require acute medical care." },
      { code: "56", name: "Psychiatric Residential Treatment Center", description: "A facility or distinct part of a facility for psychiatric care which provides a total 24-hour therapeutically planned and professionally staffed group living and learning environment." },
      { code: "57", name: "Non-residential Substance Abuse Treatment Facility", description: "A location which provides treatment for substance (alcohol and drug) abuse on an ambulatory basis." },
      { code: "58", name: "Non-residential Opioid Treatment Program", description: "A location that provides treatment for opioid use disorder on an ambulatory basis." },
      { code: "60", name: "Mass Immunization Center", description: "A location where providers administer pneumococcal pneumonia and influenza virus vaccinations and submit these claims as electronic media claims, paper claims, or using the roster billing method." },
      { code: "61", name: "Comprehensive Inpatient Rehabilitation Facility", description: "A facility that provides comprehensive rehabilitation services under the supervision of a physician to inpatients with physical disabilities." },
      { code: "62", name: "Comprehensive Outpatient Rehabilitation Facility", description: "A facility that provides comprehensive rehabilitation services under the supervision of a physician to outpatients with physical disabilities." },
      { code: "65", name: "End-Stage Renal Disease Treatment Facility", description: "A facility other than a hospital, which provides dialysis treatment, maintenance, and/or training to patients or caregivers on an ambulatory or home-care basis." },
      { code: "71", name: "State or Local Public Health Clinic", description: "A facility maintained by either State or local health departments that provides ambulatory primary medical care under the general direction of a physician." },
      { code: "72", name: "Rural Health Clinic", description: "A certified facility which is located in a rural medically underserved area that provides ambulatory primary medical care under the general direction of a physician." },
      { code: "81", name: "Independent Laboratory", description: "A laboratory certified to perform diagnostic and/or clinical tests independent of an institution or a physician's office." },
      { code: "99", name: "Other Place of Service", description: "Other place of service not identified above." }
    ];

    const filtered = search
      ? posCodes.filter(p =>
          p.code.includes(search) ||
          p.name.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search)
        )
      : posCodes;

    res.json(filtered);
  });

  // â”€â”€â”€ Modifier Codes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/modifiers", (req, res) => {
    const search = (req.query.search as string || "").toLowerCase();
    const modifiers = [
      { code: "22", name: "Increased Procedural Services", category: "General", description: "When the work required to provide a service is substantially greater than typically required, it may be identified by adding modifier 22." },
      { code: "23", name: "Unusual Anesthesia", category: "Anesthesia", description: "Occasionally, a procedure which usually requires either no anesthesia or local anesthesia, because of unusual circumstances must be done under general anesthesia." },
      { code: "24", name: "Unrelated E/M During Postoperative Period", category: "E/M", description: "The physician may need to indicate that an evaluation and management service was performed during a postoperative period for a reason unrelated to the original procedure." },
      { code: "25", name: "Significant, Separately Identifiable E/M Same Day", category: "E/M", description: "It may be necessary to indicate that on the day a procedure or service identified by a CPT code was performed, the patient's condition required a significant, separately identifiable E/M service." },
      { code: "26", name: "Professional Component", category: "General", description: "Certain procedures are a combination of a physician or other qualified health care professional component and a technical component." },
      { code: "27", name: "Multiple Outpatient Hospital E/M Encounters Same Date", category: "E/M", description: "For hospital outpatient reporting purposes, utilization of hospital resources related to separate and distinct E/M encounters performed in multiple outpatient hospital settings." },
      { code: "32", name: "Mandated Services", category: "General", description: "Services related to mandated consultation and/or related services (e.g., PRO, third-party payer, governmental, legislative, or regulatory requirement)." },
      { code: "33", name: "Preventive Services", category: "General", description: "When the primary purpose of the service is the delivery of an evidence based service in accordance with a US Preventive Services Task Force A or B rating in effect." },
      { code: "47", name: "Anesthesia by Surgeon", category: "Anesthesia", description: "Regional or general anesthesia provided by the surgeon may be reported by adding modifier 47 to the basic service." },
      { code: "50", name: "Bilateral Procedure", category: "Surgery", description: "Unless otherwise identified in the listings, bilateral procedures that are performed at the same session should be identified by adding modifier 50 to the appropriate 5-digit code." },
      { code: "51", name: "Multiple Procedures", category: "Surgery", description: "When multiple procedures, other than E/M services, Physical Medicine and Rehabilitation services or provision of supplies, are performed at the same session by the same individual." },
      { code: "52", name: "Reduced Services", category: "General", description: "Under certain circumstances a service or procedure is partially reduced or eliminated at the discretion of the physician or other qualified health care professional." },
      { code: "53", name: "Discontinued Procedure", category: "General", description: "Under certain circumstances, the physician or other qualified health care professional may elect to terminate a surgical or diagnostic procedure." },
      { code: "54", name: "Surgical Care Only", category: "Surgery", description: "When one physician or other qualified health care professional performs a surgical procedure and another provides preoperative and/or postoperative management." },
      { code: "55", name: "Postoperative Management Only", category: "Surgery", description: "When one physician or other qualified health care professional performed the postoperative management and another performed the surgical procedure." },
      { code: "56", name: "Preoperative Management Only", category: "Surgery", description: "When one physician or other qualified health care professional performed the preoperative care and evaluation and another performed the surgical procedure." },
      { code: "57", name: "Decision for Surgery", category: "Surgery", description: "An evaluation and management service that resulted in the initial decision to perform the surgery may be identified by adding modifier 57." },
      { code: "58", name: "Staged or Related Procedure During Postoperative Period", category: "Surgery", description: "It may be necessary to indicate that the performance of a procedure or service during the postoperative period was planned prospectively." },
      { code: "59", name: "Distinct Procedural Service", category: "General", description: "Under certain circumstances, it may be necessary to indicate that a procedure or service was distinct or independent from other non-E/M services performed on the same day." },
      { code: "62", name: "Two Surgeons", category: "Surgery", description: "When 2 surgeons work together as primary surgeons performing distinct part(s) of a procedure, each surgeon should report his/her distinct operative work by adding modifier 62." },
      { code: "63", name: "Procedure Performed on Infants less than 4 kg", category: "Surgery", description: "Procedures performed on neonates and infants up to a present body weight of 4 kg may involve significantly increased complexity and physician or other qualified health care professional work." },
      { code: "66", name: "Surgical Team", category: "Surgery", description: "Under some circumstances, highly complex procedures (requiring the concomitant services of several physicians or other qualified health care professionals) may be performed." },
      { code: "73", name: "Discontinued Out-Patient Hospital/ASC Procedure Prior to Anesthesia", category: "Surgery", description: "Due to extenuating circumstances or those that threaten the well-being of the patient, the physician may cancel a surgical or diagnostic procedure subsequent to the patient's surgical prep." },
      { code: "74", name: "Discontinued Out-Patient Hospital/ASC Procedure After Anesthesia", category: "Surgery", description: "Due to extenuating circumstances or those that threaten the well-being of the patient, the physician may terminate a surgical or diagnostic procedure after the administration of anesthesia." },
      { code: "76", name: "Repeat Procedure by Same Physician", category: "General", description: "It may be necessary to indicate that a procedure or service was repeated by the same physician or other qualified health care professional subsequent to the original procedure or service." },
      { code: "77", name: "Repeat Procedure by Another Physician", category: "General", description: "The physician may need to indicate that a basic procedure or service performed by another physician had to be repeated." },
      { code: "78", name: "Unplanned Return to Operating Room During Postoperative Period", category: "Surgery", description: "It may be necessary to indicate that another procedure was performed during the postoperative period of the initial procedure." },
      { code: "79", name: "Unrelated Procedure During Postoperative Period", category: "Surgery", description: "The individual may need to indicate that the performance of a procedure or service during the postoperative period was unrelated to the original procedure." },
      { code: "80", name: "Assistant Surgeon", category: "Surgery", description: "Surgical assistant services may be identified by adding modifier 80 to the usual procedure number(s)." },
      { code: "81", name: "Minimum Assistant Surgeon", category: "Surgery", description: "Minimum surgical assistant services are identified by adding modifier 81 to the usual procedure number(s)." },
      { code: "82", name: "Assistant Surgeon (Resident Unavailable)", category: "Surgery", description: "The unavailability of a qualified resident surgeon is a prerequisite for use of modifier 82 appended to the usual procedure code number(s)." },
      { code: "90", name: "Reference (Outside) Laboratory", category: "Laboratory", description: "When laboratory procedures are performed by a party other than the treating or reporting physician or other qualified health care professional, the procedure may be identified by adding modifier 90." },
      { code: "91", name: "Repeat Clinical Diagnostic Laboratory Test", category: "Laboratory", description: "In the course of treatment of the patient, it may be necessary to repeat the same laboratory test on the same day to obtain subsequent (multiple) test results." },
      { code: "92", name: "Alternative Laboratory Platform Testing", category: "Laboratory", description: "When laboratory testing is being performed using a kit or transportable instrument that wholly or in part consists of a single use, disposable analytical chamber." },
      { code: "95", name: "Synchronous Telemedicine Service via Real-Time Interactive AV", category: "Telehealth", description: "Synchronous telemedicine service is defined as a real-time interaction between a physician or other qualified health care professional and a patient." },
      { code: "96", name: "Habilitative Services", category: "General", description: "When a service or procedure that may be either habilitative or rehabilitative in nature is provided for habilitative purposes." },
      { code: "97", name: "Rehabilitative Services", category: "General", description: "When a service or procedure that may be either habilitative or rehabilitative in nature is provided for rehabilitative purposes." },
      { code: "99", name: "Multiple Modifiers", category: "General", description: "Under certain circumstances two or more modifiers may be necessary to completely delineate a service." },
      { code: "GA", name: "Waiver of Liability Statement Issued as Required by Payer Policy", category: "HCPCS", description: "Use when you expect that Medicare will deny a service as not reasonable and necessary and you have obtained a signed ABN." },
      { code: "GC", name: "Service Performed in Part by Resident Under Teaching Physician", category: "HCPCS", description: "This modifier is used when a service was performed in part by a resident under the direction of a teaching physician." },
      { code: "GE", name: "Service Performed by Resident Without Presence of Teaching Physician", category: "HCPCS", description: "Used when service was performed by a resident without the presence of a teaching physician under the primary care exception." },
      { code: "GP", name: "Services Delivered Under Outpatient Physical Therapy Plan", category: "HCPCS", description: "Indicates the services were provided under an outpatient physical therapy plan of care." },
      { code: "GO", name: "Services Delivered Under Outpatient Occupational Therapy Plan", category: "HCPCS", description: "Indicates the services were provided under an outpatient occupational therapy plan of care." },
      { code: "GN", name: "Services Delivered Under Outpatient Speech-Language Pathology Plan", category: "HCPCS", description: "Indicates the services were provided under an outpatient speech-language pathology plan of care." },
      { code: "GT", name: "Via Interactive Audio and Video Telecommunication Systems", category: "Telehealth", description: "Used to indicate that services were provided via interactive audio and video telecommunication systems." },
      { code: "GX", name: "Notice of Liability Issued, Voluntary Under Payer Policy", category: "HCPCS", description: "Used when you voluntarily issue a notice of liability to the patient." },
      { code: "GY", name: "Item or Service Statutorily Excluded", category: "HCPCS", description: "Used to indicate that the item or service is statutorily excluded or does not meet the definition of any Medicare benefit." },
      { code: "GZ", name: "Item or Service Expected to be Denied as Not Reasonable/Necessary", category: "HCPCS", description: "Used when you expect Medicare to deny an item or service as not reasonable and necessary and you have not issued an ABN." },
      { code: "LT", name: "Left Side", category: "Anatomical", description: "Used to identify procedures performed on the left side of the body." },
      { code: "RT", name: "Right Side", category: "Anatomical", description: "Used to identify procedures performed on the right side of the body." },
      { code: "E1", name: "Upper Left Eyelid", category: "Anatomical", description: "Used to identify procedures performed on the upper left eyelid." },
      { code: "E2", name: "Lower Left Eyelid", category: "Anatomical", description: "Used to identify procedures performed on the lower left eyelid." },
      { code: "E3", name: "Upper Right Eyelid", category: "Anatomical", description: "Used to identify procedures performed on the upper right eyelid." },
      { code: "E4", name: "Lower Right Eyelid", category: "Anatomical", description: "Used to identify procedures performed on the lower right eyelid." },
      { code: "FA", name: "Left Hand, Thumb", category: "Anatomical", description: "Used to identify procedures performed on the left hand, thumb." },
      { code: "F1", name: "Left Hand, Second Digit", category: "Anatomical", description: "Used to identify procedures performed on the left hand, second digit." },
      { code: "F2", name: "Left Hand, Third Digit", category: "Anatomical", description: "Used to identify procedures performed on the left hand, third digit." },
      { code: "F3", name: "Left Hand, Fourth Digit", category: "Anatomical", description: "Used to identify procedures performed on the left hand, fourth digit." },
      { code: "F4", name: "Left Hand, Fifth Digit", category: "Anatomical", description: "Used to identify procedures performed on the left hand, fifth digit." },
      { code: "F5", name: "Right Hand, Thumb", category: "Anatomical", description: "Used to identify procedures performed on the right hand, thumb." },
      { code: "F6", name: "Right Hand, Second Digit", category: "Anatomical", description: "Used to identify procedures performed on the right hand, second digit." },
      { code: "F7", name: "Right Hand, Third Digit", category: "Anatomical", description: "Used to identify procedures performed on the right hand, third digit." },
      { code: "F8", name: "Right Hand, Fourth Digit", category: "Anatomical", description: "Used to identify procedures performed on the right hand, fourth digit." },
      { code: "F9", name: "Right Hand, Fifth Digit", category: "Anatomical", description: "Used to identify procedures performed on the right hand, fifth digit." },
      { code: "TA", name: "Left Foot, Great Toe", category: "Anatomical", description: "Used to identify procedures performed on the left foot, great toe." },
      { code: "T1", name: "Left Foot, Second Digit", category: "Anatomical", description: "Used to identify procedures performed on the left foot, second digit." },
      { code: "T2", name: "Left Foot, Third Digit", category: "Anatomical", description: "Used to identify procedures performed on the left foot, third digit." },
      { code: "T3", name: "Left Foot, Fourth Digit", category: "Anatomical", description: "Used to identify procedures performed on the left foot, fourth digit." },
      { code: "T4", name: "Left Foot, Fifth Digit", category: "Anatomical", description: "Used to identify procedures performed on the left foot, fifth digit." },
      { code: "T5", name: "Right Foot, Great Toe", category: "Anatomical", description: "Used to identify procedures performed on the right foot, great toe." },
      { code: "T6", name: "Right Foot, Second Digit", category: "Anatomical", description: "Used to identify procedures performed on the right foot, second digit." },
      { code: "T7", name: "Right Foot, Third Digit", category: "Anatomical", description: "Used to identify procedures performed on the right foot, third digit." },
      { code: "T8", name: "Right Foot, Fourth Digit", category: "Anatomical", description: "Used to identify procedures performed on the right foot, fourth digit." },
      { code: "T9", name: "Right Foot, Fifth Digit", category: "Anatomical", description: "Used to identify procedures performed on the right foot, fifth digit." },
      { code: "TC", name: "Technical Component", category: "General", description: "Under certain circumstances, a charge may be made for the technical component alone." },
      { code: "QW", name: "CLIA Waived Test", category: "Laboratory", description: "Used to identify a Clinical Laboratory Improvement Amendment (CLIA) waived test." },
      { code: "XE", name: "Separate Encounter", category: "General", description: "A service that is distinct because it occurred during a separate encounter." },
      { code: "XP", name: "Separate Practitioner", category: "General", description: "A service that is distinct because it was performed by a different practitioner." },
      { code: "XS", name: "Separate Structure", category: "General", description: "A service that is distinct because it was performed on a separate organ/structure." },
      { code: "XU", name: "Unusual Non-Overlapping Service", category: "General", description: "The use of a service that is distinct because it does not overlap usual components of the main service." },
    ];

    const filtered = search
      ? modifiers.filter(m =>
          m.code.toLowerCase().includes(search) ||
          m.name.toLowerCase().includes(search) ||
          m.category.toLowerCase().includes(search) ||
          m.description.toLowerCase().includes(search)
        )
      : modifiers;

    res.json(filtered);
  });

  // â”€â”€â”€ Drug/NDC Lookup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.get("/api/drug/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      const searchType = (req.query.type as string) || "brand_name";
      if (!query.trim()) return res.json({ results: [], total: 0 });
      const url = `https://api.fda.gov/drug/ndc.json?search=${searchType}:${encodeURIComponent(query)}*&limit=20`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.error) return res.json({ results: [], total: 0 });
      res.json({
        total: data.meta?.results?.total || 0,
        results: data.results || []
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drug/ndc/:ndc", async (req, res) => {
    try {
      const ndc = req.params.ndc;
      const url = `https://api.fda.gov/drug/ndc.json?search=product_ndc:${encodeURIComponent(ndc)}&limit=1`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.error || !data.results?.length) return res.json(null);
      res.json(data.results[0]);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  


  app.get("/api/unified/search", async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").trim();
      if (!q) return res.json({ results: [], intent: "empty" });
      const upper = q.toUpperCase();
      const isCpt = /^\d{4,5}[A-Z]?$/.test(upper);
      const isIcd = /^[A-Z]\d{2}/.test(upper);
      const isNpi = /^\d{10}$/.test(q);
      const looksLikeNdc = /^[0-9-]{4,}$/.test(q);
      let intent = "general";
      if (isNpi) intent = "npi";
      else if (isCpt) intent = "cpt";
      else if (isIcd) intent = "icd";

      const results: any[] = [];
      const seen = new Set<string>();
      const addResult = (item: any) => {
        const key = `${item.category}:${item.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push(item);
      };

      const codeSearch = async () => {
        if (q.length < 2 && !isIcd) return [];
        const codes = await storage.searchCodes(q, undefined);
        return codes.slice(0, 8).map((code: any) => ({
          id: `${code.type}-${code.code}`,
          type: code.type,
          category: "code",
          title: code.code,
          subtitle: String(code.description || "").replace(/^"|"$/g, ""),
          action: "code",
          data: code,
        }));
      };

      const rvuSearch = async () => {
        if (!isCpt && !/^\d{4,5}$/.test(q)) return [];
        const r = await db.execute(`SELECT * FROM rvu_2026 WHERE TRIM(hcpc) = '${sqlText(upper)}' AND (modifier IS NULL OR TRIM(modifier) = '') LIMIT 1`);
        if (r.rows.length === 0) return [];
        const row = r.rows[0] as any;
        const cf = Number(row.conv_fact) || 33.4009;
        const nf = (Number(row.full_nfac_total) || 0) * cf;
        const f = (Number(row.full_fac_total) || 0) * cf;
        return [{
          id: "rvu-" + upper,
          type: "RVU",
          category: "rvu",
          title: upper,
          subtitle: "Non-facility: $" + nf.toFixed(2) + " | Facility: $" + f.toFixed(2),
          action: "rvu",
          data: { code: upper, nonFacilityPayment: nf.toFixed(2), facilityPayment: f.toFixed(2) },
        }];
      };

      const npiSearch = async () => {
        if (!isNpi && !(q.length > 2 && /^[a-zA-Z\s'.-]+$/.test(q))) return [];
        const urls: string[] = [];
        if (isNpi) {
          urls.push("https://npiregistry.cms.hhs.gov/api/?version=2.1&limit=4&number=" + encodeURIComponent(q));
        } else {
          const parts = q.split(/\s+/).filter(Boolean);
          if (parts.length >= 2) {
            urls.push("https://npiregistry.cms.hhs.gov/api/?version=2.1&limit=3&first_name=" + encodeURIComponent(parts[0]) + "&last_name=" + encodeURIComponent(parts.slice(1).join(" ")));
          }
          urls.push("https://npiregistry.cms.hhs.gov/api/?version=2.1&limit=3&organization_name=" + encodeURIComponent(q));
          urls.push("https://npiregistry.cms.hhs.gov/api/?version=2.1&limit=3&last_name=" + encodeURIComponent(q));
        }

        const responses = await Promise.allSettled(urls.map(async (url) => {
          const nr = await fetch(url);
          if (!nr.ok) return [];
          const nd = await nr.json();
          return Array.isArray(nd.results) ? nd.results : [];
        }));

        return responses
          .flatMap((item) => item.status === "fulfilled" ? item.value : [])
          .slice(0, 4)
          .map((p: any) => {
            const name = p.basic?.organization_name || [p.basic?.first_name, p.basic?.last_name].filter(Boolean).join(" ");
            const spec = p.taxonomies?.find((t: any) => t.primary)?.desc || p.taxonomies?.[0]?.desc || "";
            return {
              id: "npi-" + p.number,
              type: "NPI",
              category: "npi",
              title: name || "Provider",
              subtitle: [spec, "NPI: " + p.number].filter(Boolean).join(" | "),
              action: "npi",
              data: p,
            };
          });
      };

      const drugSearch = async () => {
        if (q.length < 3 || isNpi || isIcd) return [];
        const urls: string[] = [];
        if (looksLikeNdc) {
          urls.push("https://api.fda.gov/drug/ndc.json?search=product_ndc:" + encodeURIComponent(q) + "*&limit=4");
        }
        if (!isCpt || /[a-zA-Z]/.test(q)) {
          urls.push("https://api.fda.gov/drug/ndc.json?search=brand_name:" + encodeURIComponent(q) + "*&limit=3");
          urls.push("https://api.fda.gov/drug/ndc.json?search=generic_name:" + encodeURIComponent(q) + "*&limit=3");
        }

        const responses = await Promise.allSettled(urls.map(async (url) => {
          const dr = await fetch(url);
          if (!dr.ok) return [];
          const dd = await dr.json();
          return Array.isArray(dd.results) ? dd.results : [];
        }));

        return responses
          .flatMap((item) => item.status === "fulfilled" ? item.value : [])
          .slice(0, 5)
          .map((d: any) => ({
            id: "drug-" + d.product_ndc,
            type: "NDC",
            category: "drug",
            title: d.brand_name || d.generic_name || q,
            subtitle: [d.generic_name, "NDC: " + d.product_ndc, d.labeler_name].filter(Boolean).join(" | "),
            action: "drug",
            data: d,
          }));
      };

      const coverageSearch = async () => {
        if (q.length < 3 || isNpi || looksLikeNdc) return [];
        try {
          const [mcdLcdRows, mcdNcdRows] = await Promise.all([
            searchMcdCoverageRows({ query: q, kind: "lcd", limit: 2 }),
            searchMcdCoverageRows({ query: q, kind: "ncd", limit: 2 }),
          ]);

          if (mcdLcdRows && mcdNcdRows) {
            return [...mcdLcdRows, ...mcdNcdRows].map((item: any) => ({
              id: "coverage-" + (item.id || item.document_display_id || item.title),
              type: item.coverageType || "Coverage",
              category: "coverage",
              title: item.document_display_id || item.title,
              subtitle: [item.title, item.contractor_name_type].filter(Boolean).join(" | "),
              action: "coverage",
              data: { ...item, search: q },
            }));
          }

          const [lcdData, ncdData] = await Promise.all([
            fetchCoverageJson("https://api.coverage.cms.gov/v1/reports/local-coverage-final-lcds"),
            fetchCoverageJson("https://api.coverage.cms.gov/v1/reports/national-coverage-ncd"),
          ]);
          const needle = q.toLowerCase();
          const lcdResults = getCoverageRows(lcdData)
            .filter((item: any) =>
              item.title?.toLowerCase().includes(needle) ||
              item.document_display_id?.toLowerCase().includes(needle) ||
              item.contractor_name_type?.toLowerCase().includes(needle)
            )
            .slice(0, 2)
            .map((item: any) => ({
              id: "lcd-" + (item.document_display_id || item.lcd_id || item.id),
              type: "LCD",
              category: "coverage",
              title: item.document_display_id || item.lcd_id || "LCD",
              subtitle: [item.title, item.contractor_name_type].filter(Boolean).join(" | "),
              action: "coverage",
              data: { ...item, coverageType: "LCD", search: q },
            }));
          const ncdResults = getCoverageRows(ncdData)
            .filter((item: any) =>
              item.title?.toLowerCase().includes(needle) ||
              item.document_display_id?.toLowerCase().includes(needle)
            )
            .slice(0, 2)
            .map((item: any) => ({
              id: "ncd-" + (item.document_display_id || item.ncd_id || item.id),
              type: "NCD",
              category: "coverage",
              title: item.document_display_id || item.ncd_id || "NCD",
              subtitle: item.title || "National Coverage Determination",
              action: "coverage",
              data: { ...item, coverageType: "NCD", search: q },
            }));
          return [...lcdResults, ...ncdResults];
        } catch {
          return [];
        }
      };

      const settled = await Promise.allSettled([
        codeSearch(),
        rvuSearch(),
        npiSearch(),
        drugSearch(),
        coverageSearch(),
      ]);

      settled.forEach((group) => {
        if (group.status === "fulfilled") {
          group.value.forEach(addResult);
        }
      });

      res.json({ results: results.slice(0,12), intent, query: q });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  // Code Intelligence Hub - single endpoint for all code data
  app.get("/api/intel/:code", async (req, res) => {
    try {
      const code = (req.params.code || "").toUpperCase().trim();
      if (!code) return res.status(400).json({ message: "Code required" });
      const results: any = { code, timestamp: new Date().toISOString() };

      // Query DB directly for code info
      const codeSearchResults = await storage.searchCodes(code, undefined);
      if (Array.isArray(codeSearchResults)) {
        const exact = codeSearchResults.find((c: any) => c.code.toUpperCase() === code) || codeSearchResults[0];
        results.codeInfo = exact || null;
        results.relatedCodes = codeSearchResults.filter((c: any) => c.code.toUpperCase() !== code).slice(0, 5);
      }

      // Query RVU directly from DB
      const rvuResult = await db.execute(`SELECT * FROM rvu_2026 WHERE TRIM(hcpc) = '${code}' AND (modifier IS NULL OR TRIM(modifier) = '') LIMIT 1`);
      if (rvuResult.rows.length > 0) {
        const row = rvuResult.rows[0] as any;
        const cf = Number(row.conv_fact) || 33.4009;
        results.rvu = {
          code,
          workRvu: Number(row.rvu_work) || 0,
          nonFacilityPayment: parseFloat(((Number(row.full_nfac_total)||0)*cf).toFixed(2)),
          facilityPayment: parseFloat(((Number(row.full_fac_total)||0)*cf).toFixed(2)),
          globalPeriod: String(row.global || '').trim(),
        };
      } else { results.rvu = null; }

      let loadedCoverageFromMcd = false;
      try {
        const mcdRows = await getMcdCodeCoverageRows(code, { limit: 25 });
        if (mcdRows) {
          const coverageMatches = mcdRows.slice(0, 8);
          results.coverageDocuments = coverageMatches;
          results.lcds = coverageMatches;
          results.coverageCount = coverageMatches.length;
          results.lcdCount = coverageMatches.length;
          results.articleCount = coverageMatches.filter((item: any) => item.document_kind === "article").length;
          results.ncdCount = coverageMatches.filter((item: any) => item.document_kind === "ncd").length;
          loadedCoverageFromMcd = true;
        }
      } catch (error: any) {
        console.warn("Cloudflare MCD code lookup failed; falling back to CMS Coverage API:", error?.message || error);
      }

      if (loadedCoverageFromMcd) {
        try {
          results.coverageIntelligence = await getMcdCodeCoverageIntelligence(code, { limit: 8 });
        } catch (error: any) {
          console.warn("Cloudflare MCD coverage intelligence lookup failed:", error?.message || error);
        }
      }

      if (!loadedCoverageFromMcd) {
        try {
          const lcdData = await fetchCoverageJson(`https://api.coverage.cms.gov/v1/reports/local-coverage-final-lcds?cpt=${encodeURIComponent(code)}`);
          const allLcds = getCoverageRows(lcdData);
          const lcdMatches = allLcds.slice(0, 5);
          results.lcds = lcdMatches;
          results.lcdCount = lcdMatches.length;
        } catch { results.lcds = []; results.lcdCount = 0; }
      }

      // Modifiers applicable to this code type
      const codeType = results.codeInfo?.type || "";
      if (codeType === "CPT") {
        results.commonModifiers = [
          { code: "25", desc: "Significant, Separately Identifiable E/M Service" },
          { code: "59", desc: "Distinct Procedural Service" },
          { code: "76", desc: "Repeat Procedure by Same Physician" },
          { code: "77", desc: "Repeat Procedure by Another Physician" },
          { code: "51", desc: "Multiple Procedures" },
          { code: "50", desc: "Bilateral Procedure" },
          { code: "52", desc: "Reduced Services" },
          { code: "53", desc: "Discontinued Procedure" },
        ];
        results.commonPOS = [
          { code: "11", desc: "Office" },
          { code: "22", desc: "On Campus Outpatient Hospital" },
          { code: "19", desc: "Off Campus Outpatient Hospital" },
          { code: "12", desc: "Home" },
          { code: "02", desc: "Telehealth - Other" },
          { code: "10", desc: "Telehealth - Patient Home" },
        ];
      } else if (codeType === "ICD-10-CM") {
        results.commonModifiers = [];
        results.commonPOS = [];
      }

      results.intent = codeType === "CPT" ? "cpt" : codeType === "ICD-10-CM" ? "icd" : codeType === "HCPCS" ? "hcpcs" : "unknown";

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

    // Chat Ask AI
    app.post("/api/chat/conversations/:conversationId/ask-ai", async (req, res) => {
      try {
        const conversationId = parseInt(req.params.conversationId);
        const { userId, action = "suggest_reply" } = req.body;
  
        if (isNaN(conversationId)) {
          return res.status(400).json({ message: "Invalid conversation ID" });
        }
  
        const numericUserId = await resolveChatUserId(userId);

        if (!numericUserId) {
          return res.status(400).json({ message: "Valid userId is required" });
        }
  
        const [participant] = await db.select().from(participants).where(
          and(
            eq(participants.conversationId, conversationId),
            eq(participants.userId, numericUserId)
          )
        );
  
        if (!participant) {
          return res.status(403).json({ message: "User is not a participant of this conversation" });
        }
  
        const convo = await db.query.conversations.findFirst({
          where: eq(conversations.id, conversationId),
          with: {
            participants: {
              with: {
                user: {
                  columns: { id: true, fullName: true, username: true }
                }
              }
            }
          }
        });
  
        const recentMessages = await db.query.messages.findMany({
          where: eq(messages.conversationId, conversationId),
          with: {
            sender: {
              columns: { id: true, fullName: true, username: true }
            },
            attachments: true // Include attachments
          },
          orderBy: [desc(messages.createdAt)],
          limit: 30
        });
  
        const orderedMessages = [...recentMessages].reverse();
        const participantNames = (convo?.participants || [])
          .map((p: any) => p.user?.fullName || p.user?.username || `User ${p.user?.id}`)
          .filter(Boolean)
          .join(", ");
  
        const transcript = orderedMessages
          .map((m: any) => {
            const sender = m.sender?.fullName || m.sender?.username || "Unknown";
            let content = m.content || "";
            if (m.attachments && m.attachments.length > 0) {
              const fileContext = m.attachments
                .map((a: any) => `[FILE: ${a.fileName}${a.extractedText ? `\nCONTENT:\n${a.extractedText}` : ""}]`)
                .join("\n");
              content = `${content}\n${fileContext}`;
            }
            return `${sender}: ${content}`;
          })
          .join("\n");
  
        if (!transcript.trim()) {
          return res.status(400).json({ message: "No conversation messages found to analyze" });
        }
  
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ message: "AI service not configured. Please add GEMINI_API_KEY to your .env file." });
        }
  
        const actionInstructions = action === "summarize"
          ? "Summarize the conversation clearly and list next actions."
          : action === "next_steps"
          ? "Analyze the conversation and list clear next steps."
          : "Suggest a concise, professional reply the current user can send next.";
  
        const prompt = `You are an AI assistant inside Codical Chat, a professional healthcare team chat. 
  GUARDRAIL: You are designed to assist with medical coding, healthcare billing, and clinical documentation. 
  If any provided document or conversation is entirely unrelated to these fields, politely state: "I am designed to assist with medical coding and healthcare billing. I cannot process this specific request as it appears to be unrelated to these professional fields."
  
  TASK: ${actionInstructions}
  
  Conversation participants: ${participantNames}
  Current user ID: ${numericUserId}
  Conversation transcript (including file contents):
  ${transcript.slice(0, 16000)}
  
  Respond ONLY with valid JSON and no markdown in this exact format:
  {"summary":"brief summary","suggestedReply":"a professional suggested reply or the polite refusal if irrelevant","nextActions":["action 1","action 2","action 3"]}`;
  
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1200, temperature: 0.2 }
          })
        });
  
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          return res.status(500).json({ message: "AI error: " + (err.error?.message || "Unknown") });
        }
  
        const aiResponse = await response.json();
        const rawText = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";
        let result;
        try {
          const match = rawText.match(/\{[\s\S]*\}/);
          result = match ? JSON.parse(match[0]) : null;
        } catch {
          result = null;
        }
  
        if (!result) {
          return res.status(500).json({ message: "Failed to parse AI response." });
        }
  
        return res.json({ success: true, result });
      } catch (error: any) {
        console.error("Error in chat Ask AI:", error);
        return res.status(500).json({ message: error.message || "Failed to process AI request" });
      }
    });
    
    app.post("/api/workspace/extract-text", upload.single("file"), async (req, res) => {
      try {
        const file = req.file;
  
        if (!file) {
          return res.status(400).json({ message: "No file uploaded." });
        }
  
        const fileName = file.originalname || "document";
        const mimeType = file.mimetype || "";
        const lowerName = fileName.toLowerCase();
  
        let extractedText = "";
  
        if (mimeType === "text/plain" || lowerName.endsWith(".txt")) {
          extractedText = file.buffer.toString("utf-8");
        } else if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
          const parsed = await pdfParse(file.buffer);
          extractedText = parsed.text || "";
        } else {
          return res.status(400).json({
            message: "Unsupported file type. Please upload TXT or PDF."
          });
        }
  
        extractedText = extractedText.replace(/\u0000/g, "").trim();
  
        if (!extractedText || extractedText.length < 20) {
          return res.status(400).json({
            message: "Could not extract enough readable text from the file."
          });
        }
  
        return res.json({
          success: true,
          fileName,
          text: extractedText
        });
      } catch (error: any) {
        console.error("Workspace extract-text error:", error);
        return res.status(500).json({
          message: error.message || "Failed to extract text from file."
        });
      }
    });

  app.post("/api/workspace/analyze", async (req, res) => {
    try {
      const { text, payerId } = req.body;
      if (!text || text.trim().length < 20) return res.status(400).json({ message: "Please provide a valid clinical document." });
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ message: "AI service not configured. Please add GEMINI_API_KEY to your .env file." });

      let payerContext = "";
      if (payerId) {
        const payer = await db.query.commercialPayers.findFirst({
          where: eq(commercialPayers.id, Number(payerId)),
          with: {
            policies: true
          }
        });
        if (payer) {
          payerContext = `\n\nPAYER CONTEXT: This claim is for ${payer.name} (${payer.shortName}).\n`;
          if (payer.policies && payer.policies.length > 0) {
            payerContext += "Relevant Payer Policies:\n" + payer.policies.map(p => `- ${p.title}: ${p.requirementsText}`).join("\n");
          }
        }
      }

      const prompt = `You are an expert medical coder specializing in USA Commercial Payer rules. Analyze this clinical document and provide accurate medical codes. ${payerContext}

DOCUMENT:
${text.slice(0, 6000)}

Respond ONLY with valid JSON (no markdown) in this exact format:
{"summary":"brief summary","cpt_codes":[{"code":"XXXXX","description":"desc","units":1,"modifiers":[],"rationale":"why"}],"icd10_codes":[{"code":"X00.0","description":"desc","type":"primary","rationale":"why"}],"hcpcs_codes":[],"pos_code":{"code":"11","description":"Office"},"revenue_codes":[],"billing_notes":"notes","confidence":"high","disclaimer":"AI-generated. Always verify with certified coder."}`;
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4000, temperature: 0.1 } }) });
      if (!response.ok) { const err = await response.json(); return res.status(500).json({ message: "AI error: " + (err.error?.message || "Unknown") }); }
      const aiResponse = await response.json();
      const rawText = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";
      let result: any;
      try { const m = rawText.match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : null; } catch { result = null; }
      if (!result) return res.status(500).json({ message: "Failed to parse AI response." });
      const diagnosisCodes = readCoverageCodeList(
        Array.isArray(result.icd10_codes) ? result.icd10_codes.map((code: any) => code?.code) : [],
      );
      const procedureCodes = readCoverageCodeList(
        Array.isArray(result.cpt_codes) ? result.cpt_codes.map((code: any) => code?.code) : [],
        Array.isArray(result.hcpcs_codes) ? result.hcpcs_codes.map((code: any) => code?.code) : [],
      );
      if (diagnosisCodes.length > 0 || procedureCodes.length > 0) {
        const claimValidation = await validateClaimCodeSet({
          diagnosisCodes,
          procedureCodes,
          ncciType: "practitioner",
          coverageLimit: 8,
        });
        if (claimValidation.coverageValidation) result.coverage_validation = claimValidation.coverageValidation;
        if (claimValidation.ncciValidation) result.ncci_validation = claimValidation.ncciValidation;
        result.claim_validation = claimValidation;
      }
      res.json({ success: true, result });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  // Anesthesia base units lookup
  app.get("/api/anesthesia/baseunits/:code", async (req, res) => {
    try {
      const code = req.params.code.replace(/^0+/, '').trim();
      const result = await db.execute(
        `SELECT * FROM anesthesia_base_units WHERE TRIM("CPT") = '${code}' OR TRIM("CPT") = '${code.padStart(5,'0')}' LIMIT 1`
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Code not found" });
      const row = result.rows[0] as any;
      res.json({
        cpt: String(row["CPT"]).trim(),
        description: String(row["SHORT DESCRIPTION"] || "").trim(),
        baseUnits: Number(row["UNIT"]),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Anesthesia modifiers
  app.get("/api/anesthesia/modifiers", async (req, res) => {
    try {
      const result = await db.execute('SELECT * FROM anesthesia_modifiers ORDER BY id');
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });


  app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  // â”€â”€â”€ CHAT API ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Get all users (for creating conversations)
  app.post("/api/chat/me", async (req, res) => {
    try {
      const requestedProfile = {
        supabaseId: req.body.supabaseId,
        email: req.body.email,
        fullName: req.body.fullName,
        avatarUrl: req.body.avatarUrl,
      };

      const user = requestedProfile.supabaseId && !requestedProfile.email
        ? await ensureChatUserFromSupabaseId(requestedProfile.supabaseId)
        : await ensureChatUser(requestedProfile);

      if (!user) {
        return res.status(401).json({ message: "Unable to resolve authenticated chat user" });
      }

      const presentUser = withEffectivePresence(user);

      res.json({
        id: user.id,
        supabaseId: user.supabaseId,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isOnline: presentUser.isOnline,
        lastSeen: presentUser.lastSeen,
      });
    } catch (error: any) {
      console.error("Error resolving current chat user:", error);
      res.status(500).json({ message: error.message || "Failed to resolve current user" });
    }
  });

  app.get("/api/chat/users", async (_req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        isOnline: users.isOnline,
        lastSeen: users.lastSeen,
      }).from(users).where(ne(users.username, CODICAL_AI_USERNAME));
      res.json(allUsers.map((user) => withEffectivePresence(user)));
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: error.message || "Failed to fetch users" });
    }
  });

  app.post("/api/chat/users/:userId/presence", async (req, res) => {
    try {
      const userId = await resolveChatUserId(req.params.userId);
      if (!userId) return res.status(400).json({ message: "Valid userId is required" });

      const isOnline = req.body?.isOnline !== false;
      const updatedUser = await updateChatPresence(userId, isOnline);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(withEffectivePresence(updatedUser));
    } catch (error: any) {
      console.error("Error updating chat presence:", error);
      res.status(500).json({ message: error.message || "Failed to update presence" });
    }
  });

  app.patch("/api/chat/users/:userId", async (req, res) => {
    try {
      const userId = await resolveChatUserId(req.params.userId);
      if (!userId) return res.status(400).json({ message: "Valid userId is required" });

      const fullName = String(req.body.fullName || "").trim();
      const username = String(req.body.username || "").trim().toLowerCase();
      const avatarUrl = String(req.body.avatarUrl || "").trim();

      if (!fullName) {
        return res.status(400).json({ message: "Display name is required" });
      }

      if (username && !/^[a-z0-9._-]{3,32}$/.test(username)) {
        return res.status(400).json({ message: "Username must be 3-32 characters and use letters, numbers, dots, underscores, or hyphens." });
      }

      if (username) {
        const [existingUsername] = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (existingUsername && existingUsername.id !== userId) {
          return res.status(409).json({ message: "Username is already taken" });
        }
      }

      const [updatedUser] = await db.update(users)
        .set({
          fullName,
          ...(username ? { username } : {}),
          avatarUrl: avatarUrl || null,
          isOnline: true,
          lastSeen: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if ((global as any).io) {
        (global as any).io.emit("user:profile_updated", updatedUser);
      }

      res.json(withEffectivePresence(updatedUser));
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: error.message || "Failed to update profile" });
    }
  });

  app.post("/api/chat/users/:userId/avatar", upload.single("avatar"), async (req, res) => {
    try {
      const userId = await resolveChatUserId(req.params.userId);
      const file = req.file;

      if (!userId) return res.status(400).json({ message: "Valid userId is required" });
      if (!file) return res.status(400).json({ message: "Avatar image is required" });
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Avatar image must be under 5MB" });
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ message: "Please upload a JPG, PNG, WEBP, or GIF image" });
      }

      const extension = path.extname(file.originalname).toLowerCase() || ".png";
      const safeFileName = `${userId}-${Date.now()}${extension}`;
      const storagePath = `avatars/${safeFileName}`;
      let avatarUrl = "";

      avatarUrl = await uploadPublicStorageFile(
        "profile-avatars",
        storagePath,
        file.buffer,
        file.mimetype,
      );

      if (!avatarUrl) {
        const localDir = getLocalUploadDir("avatars");
        await fs.mkdir(localDir, { recursive: true });
        await fs.writeFile(path.join(localDir, safeFileName), file.buffer);
        avatarUrl = `/uploads/avatars/${safeFileName}`;
      }

      const [updatedUser] = await db.update(users)
        .set({ avatarUrl, isOnline: true, lastSeen: new Date() })
        .where(eq(users.id, userId))
        .returning();

      if ((global as any).io) {
        (global as any).io.emit("user:profile_updated", updatedUser);
      }

      res.json(withEffectivePresence(updatedUser));
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      res.status(500).json({ message: error.message || "Failed to upload avatar" });
    }
  });

  app.delete("/api/chat/users/:userId/avatar", async (req, res) => {
    try {
      const userId = await resolveChatUserId(req.params.userId);
      if (!userId) return res.status(400).json({ message: "Valid userId is required" });

      const [updatedUser] = await db.update(users)
        .set({ avatarUrl: null, isOnline: true, lastSeen: new Date() })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if ((global as any).io) {
        (global as any).io.emit("user:profile_updated", updatedUser);
      }

      res.json(withEffectivePresence(updatedUser));
    } catch (error: any) {
      console.error("Error removing avatar:", error);
      res.status(500).json({ message: error.message || "Failed to remove avatar" });
    }
  });

  // Toggle user role (for testing/demo purposes)
  app.patch("/api/user/role", async (req, res) => {
    try {
      const { userId, role } = req.body;
      if (!userId || !role) return res.status(400).json({ message: "userId and role are required" });
      
      const [updatedUser] = await db.update(users)
        .set({ role })
        .where(eq(users.id, parseInt(userId)))
        .returning();
        
      if (!updatedUser) return res.status(404).json({ message: "User not found" });
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Search users for friend discovery
  app.get("/api/chat/users/search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim().toLowerCase();
      if (!q) return res.json([]);
      const currentUserId = req.query.currentUserId ? await resolveChatUserId(req.query.currentUserId) : null;

      const searchResults = await db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        isOnline: users.isOnline,
        lastSeen: users.lastSeen,
      })
      .from(users)
      .where(
        or(
          ilike(users.username, `%${q}%`),
          ilike(users.fullName, `%${q}%`),
          ilike(users.email, `%${q}%`)
        )
      )
      .limit(10);

      if (!currentUserId) {
        return res.json(searchResults.map((user) => withEffectivePresence(user)));
      }

      const resultsWithStatus = await Promise.all(searchResults.map(async (candidate) => ({
        ...withEffectivePresence(candidate),
        relationshipStatus: candidate.id === currentUserId
          ? "self"
          : (await areUsersFriends(currentUserId, candidate.id)) ? "accepted" : "none",
      })));

      res.json(resultsWithStatus);
    } catch (error: any) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  app.get("/api/chat/friends/:userId", async (req, res) => {
    try {
      const userId = await resolveChatUserId(req.params.userId);
      if (!userId) return res.status(400).json({ message: "Valid userId is required" });

      res.json(await getAcceptedFriends(userId));
    } catch (error: any) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: error.message || "Failed to fetch friends" });
    }
  });
  
  app.post("/api/chat/ai/conversation", async (req, res) => {
    try {
      const userId = await resolveChatUserId(req.body.userId);
      if (!userId) {
        return res.status(400).json({ message: "Valid userId is required" });
      }

      const { conversation, aiUser } = await ensureCodicalAiConversation(userId);

      return res.json({
        id: conversation.id,
        name: CODICAL_AI_NAME,
        isGroup: false,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        aiUser: {
          id: aiUser.id,
          username: aiUser.username,
          fullName: aiUser.fullName,
          avatarUrl: aiUser.avatarUrl,
        }
      });
    } catch (error: any) {
      console.error("Error ensuring AI conversation:", error);
      return res.status(500).json({ message: error.message || "Failed to ensure AI conversation" });
    }
  });
 
  app.post("/api/chat/ai/message", async (req, res) => {
    try {
      const userId = await resolveChatUserId(req.body.userId);
      const content = String(req.body.content || "").trim();

      if (!userId) {
        return res.status(400).json({ message: "Valid userId is required" });
      }

      if (!content) {
        return res.status(400).json({ message: "Message content is required" });
      }

      const { conversation, aiUser } = await ensureCodicalAiConversation(userId);

      const [userMessage] = await db.insert(messages).values({
        conversationId: conversation.id,
        senderId: userId,
        content,
        messageType: "text",
      }).returning();

      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id));

      const recentMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversation.id),
        with: {
          sender: {
            columns: { id: true, fullName: true, username: true }
          },
          attachments: true
        },
        orderBy: [desc(messages.createdAt)],
        limit: 20
      });

      const transcript = [...recentMessages]
        .reverse()
        .map((m: any) => {
          const sender = m.sender?.fullName || m.sender?.username || "Unknown";
          let content = m.content || "";
          if (m.attachments && m.attachments.length > 0) {
            const fileContext = m.attachments
              .map((a: any) => `[FILE: ${a.fileName}${a.extractedText ? `\nCONTENT:\n${a.extractedText}` : ""}]`)
              .join("\n");
            content = `${content}\n${fileContext}`;
          }
          return `${sender}: ${content}`;
        })
        .join("\n");

      const apiKey = process.env.GEMINI_API_KEY;
      let aiText = "I'm Codical AI. How can I help you today?";

      if (apiKey) {
        const prompt = `You are Codical AI, an AI assistant inside Codical Chat.
Respond conversationally, helpfully, and professionally.
Keep responses concise unless the user asks for more detail.

GUARDRAIL: You are specialized in medical coding and healthcare billing.
If the conversation or any shared files are entirely unrelated to healthcare, clinical documentation, or medical billing, politely state:
"I am focused on assisting with medical coding and healthcare billing. I'm unable to process this request as it appears to be unrelated to these specialized fields."

Conversation transcript (with file contents):
${transcript.slice(0, 16000)}

Reply as Codical AI to the latest user message only. No markdown fencing.`;

        const aiResponse = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 1200, temperature: 0.4 }
            })
          }
        );

        if (aiResponse.ok) {
          const aiJson = await aiResponse.json();
          aiText = aiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || aiText;
        }
      }

      const [aiMessage] = await db.insert(messages).values({
        conversationId: conversation.id,
        senderId: aiUser.id,
        content: aiText,
        messageType: "text",
      }).returning();

      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id));

      if ((global as any).io) {
        const fullUserMessage = await db.query.messages.findFirst({
          where: eq(messages.id, userMessage.id),
          with: {
            sender: {
              columns: { id: true, fullName: true, username: true, avatarUrl: true }
            },
            attachments: true,
          }
        });
        const fullAiMessage = await db.query.messages.findFirst({
          where: eq(messages.id, aiMessage.id),
          with: {
            sender: {
              columns: { id: true, fullName: true, username: true, avatarUrl: true }
            },
            attachments: true,
          }
        });

        (global as any).io.to(`conversation:${conversation.id}`).emit("new_message", fullUserMessage);
        (global as any).io.to(`conversation:${conversation.id}`).emit("new_message", fullAiMessage);
      }

      return res.json({
        conversationId: conversation.id,
        userMessage,
        aiMessage,
      });
    } catch (error: any) {
      console.error("Error sending AI message:", error);
      return res.status(500).json({ message: error.message || "Failed to send AI message" });
    }
  });

  // Get conversations for a user
  app.get("/api/chat/conversations/user/:userId", async (req, res) => {
    try {
      const userId = await resolveChatUserId(req.params.userId);
      if (!userId) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get all conversation IDs where user is a participant
      const userParticipations = await db.select({
        conversationId: participants.conversationId,
        lastReadAt: participants.lastReadAt,
      }).from(participants).where(eq(participants.userId, userId));

      const conversationIds = userParticipations.map(p => p.conversationId);
      const participationByConversationId = new Map(
        userParticipations.map((participant) => [participant.conversationId, participant]),
      );

      if (conversationIds.length === 0) {
        return res.json([]);
      }

      // Get conversations with participants and last message
      const conversationsData = await db.query.conversations.findMany({
        where: inArray(conversations.id, conversationIds),
        with: {
          participants: {
            with: {
              user: {
                columns: { id: true, fullName: true, username: true, avatarUrl: true, isOnline: true, lastSeen: true }
              }
            }
          },
          messages: {
            orderBy: [desc(messages.createdAt)],
            limit: 1,
            with: {
              sender: {
                columns: { id: true, fullName: true }
              }
            }
          }
        },
        orderBy: [desc(conversations.updatedAt)]
      });

      const unreadCounts = new Map<number, number>();
      await Promise.all(conversationIds.map(async (conversationId) => {
        const participant = participationByConversationId.get(conversationId);
        unreadCounts.set(
          conversationId,
          await getUnreadCount(conversationId, userId, participant?.lastReadAt || null),
        );
      }));

      // Format response
      const formattedConversations = conversationsData.map(convo => {
        let conversationName = convo.name;
        if (!conversationName) {
          const otherParticipants = convo.participants.filter(p => p.user?.id !== userId);
          conversationName = otherParticipants.length > 0
            ? otherParticipants.map(p => p.user?.fullName || p.user?.username || 'Unknown').join(', ')
            : 'Conversation';
        }

        return {
          id: convo.id,
          name: conversationName,
          isGroup: convo.isGroup,
          createdAt: convo.createdAt,
          updatedAt: convo.updatedAt,
          participants: convo.participants.map(p => p.user ? withEffectivePresence(p.user) : p.user),
          lastMessage: convo.messages[0] || null,
          unread: unreadCounts.get(convo.id) || 0,
        };
      });

      res.json(formattedConversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: error.message || "Failed to fetch conversations" });
    }
  });

  // Get messages for a conversation
  app.get("/api/chat/messages/:conversationId", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      if (isNaN(conversationId)) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }

      const messagesData = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        with: {
          sender: {
            columns: { id: true, fullName: true, username: true, avatarUrl: true }
          },
          attachments: true,
          reactions: {
            with: {
              user: {
                columns: { id: true, fullName: true }
              }
            }
          }
        },
        orderBy: [asc(messages.createdAt)]
      });

      res.json(messagesData);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: error.message || "Failed to fetch messages" });
    }
  });

  app.post("/api/chat/conversations/:conversationId/read", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      const userId = await resolveChatUserId(req.body.userId);

      if (isNaN(conversationId) || !userId) {
        return res.status(400).json({ message: "conversationId and userId are required" });
      }

      const [participant] = await db.select().from(participants).where(
        and(
          eq(participants.conversationId, conversationId),
          eq(participants.userId, userId),
        ),
      );

      if (!participant) {
        return res.status(403).json({ message: "User is not a participant of this conversation" });
      }

      const [updatedParticipant] = await db.update(participants)
        .set({ lastReadAt: new Date() })
        .where(eq(participants.id, participant.id))
        .returning();

      res.json(updatedParticipant);
    } catch (error: any) {
      console.error("Error marking conversation read:", error);
      res.status(500).json({ message: error.message || "Failed to mark conversation read" });
    }
  });

  // Create a new conversation
  app.post("/api/chat/conversations", async (req, res) => {
    try {
      const { userIds, name, isGroup, creatorId } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "At least one user ID is required" });
      }

      // Resolve userIds â€” convert Supabase UUIDs to internal integer IDs
      const resolvedUserIds: number[] = [];
      for (const uid of userIds) {
        const resolvedId = await resolveChatUserId(uid);
        if (!resolvedId) {
          return res.status(404).json({ message: `User not found: ${String(uid)}` });
        }

        if (!resolvedUserIds.includes(resolvedId)) {
          resolvedUserIds.push(resolvedId);
        }
      }

      const resolvedCreatorId = await resolveChatUserId(creatorId ?? resolvedUserIds[0]);
      if (!resolvedCreatorId || !resolvedUserIds.includes(resolvedCreatorId)) {
        return res.status(400).json({ message: "A valid creatorId is required" });
      }

      const blockedUserIds: number[] = [];
      for (const participantUserId of resolvedUserIds) {
        if (participantUserId !== resolvedCreatorId && !(await areUsersFriends(resolvedCreatorId, participantUserId))) {
          blockedUserIds.push(participantUserId);
        }
      }

      if (blockedUserIds.length > 0) {
        return res.status(403).json({
          message: "You can only start conversations with accepted friends. Send a friend request first.",
          blockedUserIds,
        });
      }

      if (resolvedUserIds.length === 2) {
        const existingDirectConversation = await getDirectConversation(resolvedUserIds[0], resolvedUserIds[1]);
        if (existingDirectConversation) {
          return res.status(200).json(existingDirectConversation);
        }
      }

      // Create conversation
      const [newConversation] = await db.insert(conversations).values({
        name: name || null,
        isGroup: isGroup || resolvedUserIds.length > 2,
      }).returning();

      // Add participants using resolved integer IDs
      const participantValues = resolvedUserIds.map((userId) => ({
        conversationId: newConversation.id,
        userId,
        isAdmin: false,
      }));

      await db.insert(participants).values(participantValues);

      if ((global as any).io) {
        resolvedUserIds.forEach((userId) => {
          (global as any).io.to(`user:${userId}`).emit("conversation:new", newConversation);
        });
      }

      res.status(201).json(newConversation);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: error.message || "Failed to create conversation" });
    }
  });

  // Send a message
  app.post("/api/chat/messages", async (req, res) => {
    try {
      const { conversationId, senderId, content, messageType = 'text' } = req.body;

      if (!conversationId || !senderId || !content) {
        return res.status(400).json({ message: "conversationId, senderId, and content are required" });
      }

      // Resolve senderId if it is a Supabase UUID
      let resolvedSenderId = senderId;
      if (typeof senderId === "string" && senderId.includes("-")) {
        const [found] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseId, senderId)).limit(1);
        if (!found) return res.status(404).json({ message: "Sender not found" });
        resolvedSenderId = found.id;
      } else {
        resolvedSenderId = Number(senderId);
      }

      // Verify sender is a participant
      const [participant] = await db.select().from(participants).where(
        and(
          eq(participants.conversationId, conversationId),
          eq(participants.userId, resolvedSenderId)
        )
      );

      if (!participant) {
        return res.status(403).json({ message: "User is not a participant of this conversation" });
      }

      // Create message
      const [newMessage] = await db.insert(messages).values({
        conversationId,
        senderId: resolvedSenderId,
        content,
        messageType,
      }).returning();

      // Update conversation timestamp
      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      await db.update(participants)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(participants.conversationId, conversationId),
            eq(participants.userId, resolvedSenderId),
          ),
        );
      
        const aiUser = await ensureCodicalAiUser();

        const conversationParticipants = await db.select()
          .from(participants)
          .where(eq(participants.conversationId, conversationId));
  
        const isAiConversation = conversationParticipants.some(p => p.userId === aiUser.id);
  
        if (isAiConversation && resolvedSenderId !== aiUser.id) {
          try {
            const recentMessages = await db.query.messages.findMany({
            where: eq(messages.conversationId, conversationId),
            with: {
              sender: {
                columns: { id: true, fullName: true, username: true }
              },
              attachments: true // Include attachments
            },
            orderBy: [desc(messages.createdAt)],
            limit: 20
          });
  
          const transcript = [...recentMessages]
            .reverse()
            .map((m: any) => {
              const sender = m.sender?.fullName || m.sender?.username || "Unknown";
              let content = m.content || "";
              if (m.attachments && m.attachments.length > 0) {
                const fileContext = m.attachments
                  .map((a: any) => `[FILE: ${a.fileName}${a.extractedText ? `\nCONTENT:\n${a.extractedText}` : ""}]`)
                  .join("\n");
                content = `${content}\n${fileContext}`;
              }
              return `${sender}: ${content}`;
            })
            .join("\n");
  
          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey) {
            const prompt = `You are Codical AI, an AI assistant inside Codical Chat.
  Respond conversationally, helpfully, and professionally.
  Keep responses concise unless the user asks for more detail.
  
  GUARDRAIL: You are specialized in medical coding and healthcare billing.
  If the conversation or any shared files are entirely unrelated to healthcare, clinical documentation, or medical billing, politely state:
  "I am focused on assisting with medical coding and healthcare billing. I'm unable to process this request as it appears to be unrelated to these specialized fields."

  Conversation transcript (with file contents):
  ${transcript.slice(0, 16000)}
  
  Reply as Codical AI to the latest user message only. No markdown fencing.`;
  
            const aiResponse = await fetch(
              "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { maxOutputTokens: 1200, temperature: 0.4 }
                })
              }
            );
  
            if (aiResponse.ok) {
              const aiJson = await aiResponse.json();
              const aiText = aiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  
              if (aiText) {
                const [aiMessage] = await db.insert(messages).values({
                  conversationId,
                  senderId: aiUser.id,
                  content: aiText,
                  messageType: "text",
                }).returning();
  
                await db.update(conversations)
                  .set({ updatedAt: new Date() })
                  .where(eq(conversations.id, conversationId));

                const fullAiMessage = await db.query.messages.findFirst({
                  where: eq(messages.id, aiMessage.id),
                  with: {
                    sender: {
                      columns: { id: true, fullName: true, username: true, avatarUrl: true }
                    },
                    attachments: true,
                  }
                });

                if ((global as any).io) {
                  (global as any).io.to(`conversation:${conversationId}`).emit("new_message", fullAiMessage);
                }
              }
            }
          }
          } catch (aiError) {
            console.error("Codical AI chat response failed:", aiError);
          }
        }
      // Get full message with sender info
      const fullMessage = await db.query.messages.findFirst({
        where: eq(messages.id, newMessage.id),
        with: {
          sender: {
            columns: { id: true, fullName: true, username: true, avatarUrl: true }
          },
          attachments: true,
        }
      });

      // Emit via Socket.io if available
      if ((global as any).io) {
        (global as any).io.to(`conversation:${conversationId}`).emit('new_message', fullMessage);
      }

      res.status(201).json(fullMessage);
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: error.message || "Failed to send message" });
    }
  });

    // Upload attachment as a chat message
    app.post("/api/chat/messages/upload", upload.single("file"), async (req, res) => {
      try {
        const file = req.file;
        const conversationId = parseInt(String(req.body.conversationId));
        const senderId = await resolveChatUserId(req.body.senderId);
  
        if (!file) {
          return res.status(400).json({ message: "File is required" });
        }
  
        if (isNaN(conversationId) || !senderId) {
          return res.status(400).json({ message: "conversationId and senderId are required" });
        }
  
        const [participant] = await db.select().from(participants).where(
          and(
            eq(participants.conversationId, conversationId),
            eq(participants.userId, senderId)
          )
        );
  
        if (!participant) {
          return res.status(403).json({ message: "User is not a participant of this conversation" });
        }
  
        const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const storagePath = `chat/${conversationId}/${safeFileName}`;
        let fileUrl = "";

        fileUrl = await uploadPublicStorageFile(
          "chat-attachments",
          storagePath,
          file.buffer,
          file.mimetype || "application/octet-stream",
        );

        if (!fileUrl) {
          const localDir = getLocalUploadDir("chat", String(conversationId));
          await fs.mkdir(localDir, { recursive: true });
          await fs.writeFile(path.join(localDir, safeFileName), file.buffer);
          fileUrl = `/uploads/chat/${conversationId}/${safeFileName}`;
        }

        // --- NEW: Extract text for AI reading ---
        let extractedText = null;
        const lowerName = file.originalname.toLowerCase();
        if (file.mimetype === "text/plain" || lowerName.endsWith(".txt")) {
          extractedText = file.buffer.toString("utf-8");
        } else if (file.mimetype === "application/pdf" || lowerName.endsWith(".pdf")) {
          try {
            const parsed = await pdfParse(file.buffer);
            extractedText = parsed.text || "";
          } catch (e) {
            console.error("Failed to parse PDF for chat:", e);
          }
        }
        if (extractedText) extractedText = extractedText.replace(/\u0000/g, "").trim();
        // ----------------------------------------
  
        const [newMessage] = await db.insert(messages).values({
          conversationId,
          senderId,
          content: file.originalname,
          messageType: "file",
        }).returning();
  
        await db.insert(attachments).values({
          messageId: newMessage.id,
          fileName: file.originalname,
          fileType: file.mimetype || "application/octet-stream",
          fileSize: file.size,
          fileUrl,
          thumbnailUrl: null,
          extractedText, // Save the extracted text here
        });
  
        await db.update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));

        await db.update(participants)
          .set({ lastReadAt: new Date() })
          .where(
            and(
              eq(participants.conversationId, conversationId),
              eq(participants.userId, senderId),
            ),
          );
  
        const fullMessage = await db.query.messages.findFirst({
          where: eq(messages.id, newMessage.id),
          with: {
            sender: {
              columns: { id: true, fullName: true, username: true, avatarUrl: true }
            },
            attachments: true,
          }
        });
  
        if ((global as any).io) {
          (global as any).io.to(`conversation:${conversationId}`).emit("new_message", fullMessage);
        }
  
        res.status(201).json(fullMessage);
      } catch (error: any) {
        console.error("Error uploading attachment:", error);
        res.status(500).json({ message: error.message || "Failed to upload attachment" });
      }
    });

  // Edit a message
  app.patch("/api/chat/messages/:messageId", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const { content, senderId } = req.body;

      // Verify ownership
      const [existingMessage] = await db.select().from(messages).where(eq(messages.id, messageId));
      if (!existingMessage) {
        return res.status(404).json({ message: "Message not found" });
      }
      if (existingMessage.senderId !== senderId) {
        return res.status(403).json({ message: "You can only edit your own messages" });
      }

      const [updatedMessage] = await db.update(messages)
        .set({ content, isEdited: true, updatedAt: new Date() })
        .where(eq(messages.id, messageId))
        .returning();

      // Emit via Socket.io
      if ((global as any).io) {
        (global as any).io.to(`conversation:${existingMessage.conversationId}`).emit('message_edited', updatedMessage);
      }

      res.json(updatedMessage);
    } catch (error: any) {
      console.error("Error editing message:", error);
      res.status(500).json({ message: error.message || "Failed to edit message" });
    }
  });

  // Delete a message
  app.delete("/api/chat/messages/:messageId", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const senderId = parseInt(req.query.senderId as string);

      const [existingMessage] = await db.select().from(messages).where(eq(messages.id, messageId));
      if (!existingMessage) {
        return res.status(404).json({ message: "Message not found" });
      }
      if (existingMessage.senderId !== senderId) {
        return res.status(403).json({ message: "You can only delete your own messages" });
      }

      // Soft delete
      await db.update(messages)
        .set({ isDeleted: true, content: "This message was deleted", updatedAt: new Date() })
        .where(eq(messages.id, messageId));

      // Emit via Socket.io
      if ((global as any).io) {
        (global as any).io.to(`conversation:${existingMessage.conversationId}`).emit('message_deleted', { messageId });
      }

      res.status(204).end();
    } catch (error: any) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: error.message || "Failed to delete message" });
    }
  });

  // Add reaction to message
  app.post("/api/chat/messages/:messageId/reactions", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const { userId, emoji } = req.body;

      const [reaction] = await db.insert(messageReactions).values({
        messageId,
        userId,
        emoji,
      }).onConflictDoNothing().returning();

      res.status(201).json(reaction);
    } catch (error: any) {
      console.error("Error adding reaction:", error);
      res.status(500).json({ message: error.message || "Failed to add reaction" });
    }
  });

  // Remove reaction from message
  app.delete("/api/chat/messages/:messageId/reactions", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const userId = parseInt(req.query.userId as string);
      const emoji = req.query.emoji as string;

      await db.delete(messageReactions).where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, userId),
          eq(messageReactions.emoji, emoji)
        )
      );

      res.status(204).end();
    } catch (error: any) {
      console.error("Error removing reaction:", error);
      res.status(500).json({ message: error.message || "Failed to remove reaction" });
    }
  });

  // Friend requests
  app.get("/api/chat/friend-requests/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const requests = await db.query.friendRequests.findMany({
        where: and(
          eq(friendRequests.receiverId, userId),
          eq(friendRequests.status, 'pending')
        ),
        with: {
          sender: {
            columns: { id: true, fullName: true, username: true, avatarUrl: true, isOnline: true, lastSeen: true }
          }
        }
      });

      res.json(requests.map((request) => ({
        ...request,
        sender: request.sender ? withEffectivePresence(request.sender) : request.sender,
      })));
    } catch (error: any) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: error.message || "Failed to fetch friend requests" });
    }
  });

  app.post("/api/chat/friend-requests", async (req, res) => {
    try {
      const senderId = await resolveChatUserId(req.body.senderId);
      const receiverId = await resolveChatUserId(req.body.receiverId);

      if (!senderId || !receiverId) {
        return res.status(400).json({ message: "senderId and receiverId are required" });
      }

      if (senderId === receiverId) {
        return res.status(400).json({ message: "You cannot send a friend request to yourself" });
      }

      if (await areUsersFriends(senderId, receiverId)) {
        return res.status(409).json({ message: "You are already friends" });
      }

      const [existingRequest] = await db.select()
        .from(friendRequests)
        .where(
          and(
            or(
              and(eq(friendRequests.senderId, senderId), eq(friendRequests.receiverId, receiverId)),
              and(eq(friendRequests.senderId, receiverId), eq(friendRequests.receiverId, senderId)),
            ),
            eq(friendRequests.status, "pending"),
          ),
        )
        .limit(1);

      if (existingRequest) {
        return res.status(200).json(existingRequest);
      }

      const [request] = await db.insert(friendRequests).values({
        senderId,
        receiverId,
        status: 'pending',
      }).returning();

      if ((global as any).io) {
        (global as any).io.to(`user:${receiverId}`).emit("friend_request:new", request);
      }

      res.status(201).json(request);
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      res.status(500).json({ message: error.message || "Failed to send friend request" });
    }
  });

  app.patch("/api/chat/friend-requests/:requestId", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const { status } = req.body; // 'accepted' or 'rejected'

      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).json({ message: "status must be accepted or rejected" });
      }

      const [updatedRequest] = await db.update(friendRequests)
        .set({ status, updatedAt: new Date() })
        .where(eq(friendRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        return res.status(404).json({ message: "Friend request not found" });
      }

      // If accepted, create a conversation between the two users
      if (status === 'accepted') {
        let newConvo: any = await getDirectConversation(updatedRequest.senderId, updatedRequest.receiverId);

        if (!newConvo) {
          const [insertedConvo] = await db.insert(conversations).values({
            isGroup: false,
          }).returning();

          newConvo = insertedConvo;

          await db.insert(participants).values([
            { conversationId: newConvo.id, userId: updatedRequest.senderId },
            { conversationId: newConvo.id, userId: updatedRequest.receiverId },
          ]);
        }

        if ((global as any).io) {
          [updatedRequest.senderId, updatedRequest.receiverId].forEach((userId) => {
            (global as any).io.to(`user:${userId}`).emit("friend_request:updated", updatedRequest);
            (global as any).io.to(`user:${userId}`).emit("conversation:new", newConvo);
          });
        }
      } else if ((global as any).io) {
        (global as any).io.to(`user:${updatedRequest.senderId}`).emit("friend_request:updated", updatedRequest);
        (global as any).io.to(`user:${updatedRequest.receiverId}`).emit("friend_request:updated", updatedRequest);
      }

      res.json(updatedRequest);
    } catch (error: any) {
      console.error("Error updating friend request:", error);
      res.status(500).json({ message: error.message || "Failed to update friend request" });
    }
  });

  // ============ EMR & WORKBENCH ROUTES ============

  const drChrono = new DrChronoService(
    process.env.DRCHRONO_CLIENT_ID || "",
    process.env.DRCHRONO_CLIENT_SECRET || "",
    process.env.DRCHRONO_REDIRECT_URI || "http://localhost:5000/api/emr/drchrono/callback"
  );

  const resolveUserId = async (supabaseUid: string) => {
    const [found] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseId, supabaseUid)).limit(1);
    return found?.id;
  };

  app.get("/api/emr/drchrono/auth-url", async (req, res) => {
    const url = await drChrono.getAuthUrl();
    res.json({ url });
  });

  app.get("/api/emr/drchrono/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("Missing code");
    
    // In a real app, 'state' would contain the user's Supabase UID or a session token
    // For testing, we'll assume a default user or require it in a cookie/header
    const supabaseUid = req.headers["x-supabase-uid"] as string;
    const internalUserId = await resolveUserId(supabaseUid);
    
    if (!internalUserId) return res.status(401).send("Unauthorized: User not found");

    try {
      const tokens = await drChrono.exchangeCodeForToken(code as string);
      await drChrono.syncToDatabase(tokens.access_token, internalUserId);
      res.redirect("/workbench?sync=success");
    } catch (error: any) {
      console.error("EMR Sync Error:", error);
      res.status(500).send(`Sync Failed: ${error.message}`);
    }
  });

  app.get("/api/workbench/encounters", async (req, res) => {
    const supabaseUid = req.headers["x-supabase-uid"] as string;
    const internalUserId = await resolveUserId(supabaseUid);
    if (!internalUserId) return res.status(401).json({ message: "Unauthorized" });

    const results = await db.select({
      id: encounters.id,
      patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`.as("patientName"),
      date: encounters.date,
      status: encounters.status,
      encounterType: encounters.encounterType,
      mrn: patients.mrn,
    })
    .from(encounters)
    .innerJoin(patients, eq(encounters.patientId, patients.id))
    .innerJoin(assignments, eq(assignments.encounterId, encounters.id))
    .where(eq(assignments.userId, internalUserId))
    .orderBy(desc(encounters.date));

    // Fix: Join manually due to concat complexity in select raw
    const userEncounters = await db.query.assignments.findMany({
      where: eq(assignments.userId, internalUserId),
      with: {
        encounter: {
          with: {
            patient: true
          }
        }
      }
    });

    res.json(userEncounters.map(a => ({
      id: a.encounter.id,
      patientName: `${a.encounter.patient.firstName} ${a.encounter.patient.lastName}`,
      date: a.encounter.date,
      status: a.encounter.status,
      type: a.encounter.encounterType,
      mrn: a.encounter.patient.mrn,
    })));
  });

  app.get("/api/workbench/encounters/:id", async (req, res) => {
    const encounterId = parseInt(req.params.id);
    const encounter = await db.query.encounters.findFirst({
      where: eq(encounters.id, encounterId),
      with: {
        patient: true,
        notes: true,
      }
    });

    if (!encounter) return res.status(404).json({ message: "Encounter not found" });
    res.json(encounter);
  });

  app.post("/api/workbench/encounters/:id/finalize", async (req, res) => {
    const encounterId = parseInt(req.params.id);
    const { codes, billableAmount } = req.body;
    
    await db.update(encounters)
      .set({ status: 'coded', updatedAt: new Date() })
      .where(eq(encounters.id, encounterId));

    await db.insert(auditLogs).values({
      action: "FINALIZE_CODING",
      entityType: "encounter",
      entityId: encounterId.toString(),
      details: { codes, billableAmount }
    });

    res.json({ success: true });
  });

  // ============ COMPLIANCE & PAYER ROUTES ============

  app.get("/api/admin/audit-logs", async (req, res) => {
    const supabaseUid = req.headers["x-supabase-uid"] as string;
    const internalUser = await db.query.users.findFirst({
      where: eq(users.supabaseId, supabaseUid)
    });

    if (!internalUser || internalUser.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden: Admin access only" });
    }

    const logs = await db.query.auditLogs.findMany({
      orderBy: desc(auditLogs.timestamp),
      limit: 100,
      with: {
        user: true
      }
    });

    res.json(logs);
  });

  app.get("/api/payers", async (_req, res) => {
    const [allPayers, policyCounts] = await Promise.all([
      db.query.commercialPayers.findMany({ orderBy: asc(commercialPayers.name) }),
      db
        .select({
          payerId: payerPolicies.payerId,
          policyCount: sql<number>`count(*)::int`,
          lastFetchedAt: sql<Date | null>`max(${payerPolicies.lastFetchedAt})`,
        })
        .from(payerPolicies)
        .groupBy(payerPolicies.payerId),
    ]);

    const countsByPayer = new Map(policyCounts.map((row) => [row.payerId, row]));
    res.json(allPayers.map((payer) => {
      const stats = countsByPayer.get(payer.id);
      return {
        ...payer,
        policyCount: Number(stats?.policyCount || 0),
        lastPolicyFetch: stats?.lastFetchedAt || null,
      };
    }));
  });

  app.get("/api/payer-policies", async (req, res) => {
    const q = String(req.query.q || "").trim();
    const code = String(req.query.code || "").trim().toUpperCase();
    const payerId = Number(req.query.payerId || 0);
    const limit = Math.min(Math.max(Number(req.query.limit || 60), 1), 150);
    const conditions: any[] = [];

    if (payerId) {
      conditions.push(eq(payerPolicies.payerId, payerId));
    }

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(
        ilike(payerPolicies.title, pattern),
        ilike(payerPolicies.policyNumber, pattern),
        ilike(payerPolicies.requirementsText, pattern),
        ilike(commercialPayers.name, pattern),
        ilike(commercialPayers.shortName, pattern)
      ));
    }

    if (code) {
      const jsonCode = JSON.stringify([code]);
      conditions.push(or(
        sql`${payerPolicies.cptCodes} @> ${jsonCode}::jsonb`,
        sql`${payerPolicies.hcpcsCodes} @> ${jsonCode}::jsonb`,
        sql`${payerPolicies.drugCodes} @> ${jsonCode}::jsonb`
      ));
    }

    const columns = {
      id: payerPolicies.id,
      payerId: payerPolicies.payerId,
      payerName: commercialPayers.name,
      payerShortName: commercialPayers.shortName,
      title: payerPolicies.title,
      policyNumber: payerPolicies.policyNumber,
      documentType: payerPolicies.documentType,
      status: payerPolicies.status,
      effectiveDate: payerPolicies.effectiveDate,
      lastPublishedAt: payerPolicies.lastPublishedAt,
      cptCodes: payerPolicies.cptCodes,
      hcpcsCodes: payerPolicies.hcpcsCodes,
      drugCodes: payerPolicies.drugCodes,
      requirementsText: payerPolicies.requirementsText,
      sourceUrl: payerPolicies.sourceUrl,
      sourceHost: payerPolicies.sourceHost,
      lastFetchedAt: payerPolicies.lastFetchedAt,
      createdAt: payerPolicies.createdAt,
    };

    const baseQuery = db
      .select(columns)
      .from(payerPolicies)
      .leftJoin(commercialPayers, eq(commercialPayers.id, payerPolicies.payerId));

    const rows = conditions.length > 0
      ? await baseQuery
          .where(and(...conditions))
          .orderBy(desc(payerPolicies.lastFetchedAt), asc(commercialPayers.name), asc(payerPolicies.title))
          .limit(limit)
      : await baseQuery
          .orderBy(desc(payerPolicies.lastFetchedAt), asc(commercialPayers.name), asc(payerPolicies.title))
          .limit(limit);

    res.json({ total: rows.length, policies: rows });
  });

  app.get("/api/payers/:id/policies", async (req, res) => {
    const payerId = parseInt(req.params.id);
    const policies = await db.query.payerPolicies.findMany({
      where: eq(payerPolicies.payerId, payerId),
      orderBy: desc(payerPolicies.lastFetchedAt)
    });
    res.json(policies);
  });

  app.post("/api/payers/:id/sync-policies", async (req, res) => {
    try {
      const supabaseUid = req.headers["x-supabase-uid"] as string;
      const internalUser = supabaseUid
        ? await db.query.users.findFirst({
            where: eq(users.supabaseId, supabaseUid)
          })
        : null;

      if (!internalUser || internalUser.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Admin access only" });
      }

      const payerId = parseInt(req.params.id);
      const limit = Math.min(Math.max(Number(req.body?.limit || 20), 1), 50);
      const payer = await db.query.commercialPayers.findFirst({
        where: eq(commercialPayers.id, payerId),
      });

      if (!payer) {
        return res.status(404).json({ message: "Commercial carrier not found" });
      }

      const documents = await discoverPayerPolicies(payer, limit);
      let created = 0;
      let updated = 0;
      const fetchedAt = new Date();

      for (const doc of documents) {
        const existing = await db.query.payerPolicies.findFirst({
          where: and(
            eq(payerPolicies.payerId, payer.id),
            eq(payerPolicies.sourceUrl, doc.sourceUrl)
          ),
        });

        const values = {
          payerId: payer.id,
          title: doc.title,
          policyNumber: doc.policyNumber,
          documentType: doc.documentType,
          status: "indexed",
          effectiveDate: doc.effectiveDate,
          lastPublishedAt: doc.lastPublishedAt,
          cptCodes: doc.cptCodes,
          hcpcsCodes: doc.hcpcsCodes,
          drugCodes: doc.drugCodes,
          requirementsText: doc.requirementsText,
          isBillable: true,
          sourceUrl: doc.sourceUrl,
          sourceHost: doc.sourceHost,
          lastFetchedAt: fetchedAt,
          updatedAt: fetchedAt,
        };

        if (existing) {
          await db.update(payerPolicies).set(values).where(eq(payerPolicies.id, existing.id));
          updated += 1;
        } else {
          await db.insert(payerPolicies).values(values);
          created += 1;
        }
      }

      res.json({
        payer: { id: payer.id, name: payer.name, shortName: payer.shortName },
        indexed: documents.length,
        created,
        updated,
        fetchedAt,
      });
    } catch (error: any) {
      console.error("Payer policy sync error:", error.message);
      res.status(502).json({ message: error.message || "Unable to sync payer policies" });
    }
  });


  // ============ GUIDELINES ROUTES ============

  app.get("/api/guidelines", async (req, res) => {
    try {
      const { searchGuidelines: search } = await import("./cms-service");
      const keyword = String(req.query.q || "").trim();
      const page = Math.max(parseInt(String(req.query.page || "1")), 1);
      const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || "50")), 1), 100);
      const result = search(keyword, page, pageSize);
      res.json(result);
    } catch (error: any) {
      console.error("Guidelines search error:", error.message);
      res.status(500).json({ message: "Failed to fetch guidelines" });
    }
  });

  app.get("/api/guidelines/stats", async (req, res) => {
    try {
      const { getGuidelinesStats } = await import("./cms-service");
      res.json(getGuidelinesStats());
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/guidelines/type/:type", async (req, res) => {
    try {
      const { getGuidelinesByType } = await import("./cms-service");
      const type = req.params.type as any;
      const page = Math.max(parseInt(String(req.query.page || "1")), 1);
      const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || "50")), 1), 100);
      res.json(getGuidelinesByType(type, page, pageSize));
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch guidelines by type" });
    }
  });

  app.get("/api/guidelines/chapter/:chapter", async (req, res) => {
    try {
      const { getGuidelinesByChapter } = await import("./cms-service");
      const chapter = parseInt(req.params.chapter);
      const page = Math.max(parseInt(String(req.query.page || "1")), 1);
      const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || "50")), 1), 100);
      res.json(getGuidelinesByChapter(chapter, page, pageSize));
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch guidelines by chapter" });
    }
  });

  app.get("/api/guidelines/code/:code", async (req, res) => {
    try {
      const { getGuidelinesForCode } = await import("./cms-service");
      const code = req.params.code.toUpperCase();
      const guidelines = getGuidelinesForCode(code);
      const nlmInfo = await enrichCodeFromNlm(code);
      res.json({ guidelines, nlmInfo });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch guidelines for code" });
    }
  });

  return httpServer;
}



