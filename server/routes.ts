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
import { randomUUID } from "node:crypto";
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
import { getMcdCrosswalk } from "./mcd-crosswalk-service";
import { discoverPayerPolicies } from "./services/payer-policy-ingestion";
import { DrChronoService } from "./services/emr/drchrono";
import { patients, encounters, assignments, clinicalNotes, auditLogs, commercialPayers, payerPolicies, pgxAnalyses, pgxCmsGroups, pgxGenes, pgxGeneDrugPairs } from "@shared/schema";
import {
  PGX_CMS_GROUPS,
  PGX_GENE_DRUG_PAIRS,
  PGX_GENES,
  PGX_TIER_1_MAP,
  analyzePgxCoding,
  buildPgxClaimPreview,
  extractPgxDataFromText,
  type PgxCmsGroup,
  type PgxCmsDrugEvidence,
  type PgxAnalysisResult,
} from "./pgx-engine";
import { createPgxObjectKey, createSpecialtyObjectKey, isPgxR2Configured, uploadPgxObject, uploadSpecialtyObject } from "./pgx-r2";
import { PgxIntakeError, validatePgxIntakeFile } from "./pgx-phase2";
import { understandPgxDocument } from "./services/pgx-document-understanding";
import { analyzeBurnCase, type BurnCaseInput, type BurnRegionInput, type BurnServiceInput } from "../shared/burn-coding";
import { understandBurnDocument, type BurnDocumentUnderstandingResult } from "./services/burn-document-understanding";
import {
  ALS2_PROCEDURE_LABELS,
  AMBULANCE_HCPCS,
  AMBULANCE_POLICY_VERSION,
  ORIGIN_DESTINATION_LABELS,
  estimateAmbulancePayment,
  evaluateAmbulanceCase,
  type AmbulanceCaseInput,
  type AmbulanceRateInput,
} from "../shared/ambulance-coding";
import { parseNemsisXml } from "./services/ambulance-nemsis";
import {
  TRANSPLANT_ENGINE_VERSION,
  TRANSPLANT_POLICY_VERSION,
  evaluateTransplantCase,
  type TransplantCaseInput,
} from "../shared/transplant-coding";
import {
  OTP_2026_NATIONAL_RATES,
  OTP_ENGINE_VERSION,
  OTP_POLICY_VERSION,
  evaluateOtpCase,
  type OtpCaseInput,
} from "../shared/otp-mat-coding";
import {
  EM_MDM_ENGINE_VERSION,
  EM_MDM_POLICY_VERSION,
  evaluateEmMdmCase,
  type EmMdmCaseInput,
} from "../shared/em-mdm-coding";
import {
  HCC_DATA_COLLECTION_YEAR,
  HCC_ENGINE_VERSION,
  HCC_MA_CODING_PATTERN_ADJUSTMENT,
  HCC_NORMALIZATION_FACTOR,
  HCC_PAYMENT_YEAR,
  HCC_POLICY_VERSION,
  evaluateHccCase,
  type HccCaseInput,
} from "../shared/hcc-coding";
import { CMS_HCC_V28_2026 } from "./hcc-cms-v28-data";
import {
  INFUSION_ENGINE_VERSION,
  INFUSION_POLICY_VERSION,
  evaluateInfusionCase,
  lookupInfusionDrugs,
  type InfusionCaseInput,
} from "../shared/infusion-coding";
import { CMS_INFUSION_ASP_2026_Q3 } from "./infusion-cms-asp-data";
import { understandInfusionDocument } from "./services/infusion-document-understanding";
import {
  NICU_ENGINE_VERSION,
  NICU_POLICY_VERSION,
  evaluateNicuCase,
  type NicuCaseInput,
} from "../shared/nicu-coding";
import { understandNicuDocument } from "./services/nicu-document-understanding";

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

type UploadedPgxFile = {
  originalname?: string;
  mimetype?: string;
  buffer: Buffer;
  size?: number;
};

function sanitizePgxFileName(value: string) {
  return value
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "pgx-document";
}

async function extractTextFromPgxFile(file: UploadedPgxFile) {
  const fileName = sanitizePgxFileName(file.originalname || "pgx-document");
  let validation;
  try {
    validation = validatePgxIntakeFile({
      name: fileName,
      mimeType: file.mimetype || "application/octet-stream",
      buffer: file.buffer,
    });
  } catch (error) {
    if (error instanceof PgxIntakeError) throw new RouteError(400, error.message);
    throw error;
  }

  if (validation.kind === "txt") {
    return {
      fileName,
      mimeType: validation.canonicalMimeType,
      text: file.buffer.toString("utf-8").replace(/\u0000/g, "").trim(),
      warning: "",
      validation,
    };
  }

  if (validation.kind === "pdf") {
    const parsed = await pdfParse(file.buffer);
    return {
      fileName,
      mimeType: validation.canonicalMimeType,
      text: (parsed.text || "").replace(/\u0000/g, "").trim(),
      warning: "",
      validation,
    };
  }

  return {
    fileName,
    mimeType: validation.canonicalMimeType,
    text: "",
    warning: validation.warnings.join(" "),
    validation,
  };
}

function parseManualDrugNames(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
  }

  return String(value || "")
    .split(/[,;\n]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function comparablePatientName(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
}

async function matchPgxPatient(labName?: string, requisitionName?: string) {
  const labKey = comparablePatientName(labName);
  const reqKey = comparablePatientName(requisitionName);
  const documentsMatch = Boolean(labKey && reqKey && labKey === reqKey);
  if (labKey && reqKey && !documentsMatch) return { labName, requisitionName, documentsMatch: false, databaseStatus: "document_mismatch" as const };
  const sourceName = labName || requisitionName;
  if (!sourceName) return { labName, requisitionName, documentsMatch: false, databaseStatus: "not_checked" as const };
  const tokens = String(sourceName).replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return { labName, requisitionName, documentsMatch, databaseStatus: "not_found" as const };
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const matches = await db.select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName }).from(patients)
    .where(or(and(ilike(patients.firstName, first), ilike(patients.lastName, last)), and(ilike(patients.firstName, last), ilike(patients.lastName, first))))
    .limit(2);
  if (matches.length === 1) return { labName, requisitionName, documentsMatch, databaseStatus: "matched" as const, databasePatient: { id: matches[0].id, name: `${matches[0].firstName} ${matches[0].lastName}` } };
  return { labName, requisitionName, documentsMatch, databaseStatus: matches.length > 1 ? "ambiguous" as const : "not_found" as const };
}

function generateLegacyPgxPdfBuffer(analysis: PgxAnalysisResult, claimJson: Record<string, any>) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 28 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const worksheetWidth = doc.page.width - 56;
    const worksheetX = 28;
    const worksheetWidths = [90, 66, 112, 82, 65, worksheetWidth - 415];
    const worksheetHeadings = ["TESTED GENE", "CPT", "ACTIVE MEDICATION", "ICD-10-CM", "STATUS", "CMS / EVIDENCE REVIEW"];
    doc.roundedRect(worksheetX, 28, worksheetWidth, 62, 8).fill("#eefcfb");
    doc.fillColor("#0f766e").font("Helvetica-Bold").fontSize(18).text("PGx BILLING WORKSHEET", worksheetX + 14, 40);
    doc.fillColor("#4b5563").font("Helvetica").fontSize(8).text(`Patient: ${claimJson.patient?.name || "REVIEW REQUIRED"}  |  CMS: ${claimJson.articleId || "MCD REVIEW"}  |  Service state: ${claimJson.serviceState || "REQUIRED"}`, worksheetX + 14, 66);
    doc.fillColor("#991b1b").font("Helvetica-Bold").fontSize(8).text("CODER REVIEW REQUIRED", worksheetX + worksheetWidth - 180, 50, { width: 165, align: "right" });
    let rowY = 104;
    let rowX = worksheetX;
    worksheetHeadings.forEach((heading, index) => {
      doc.rect(rowX, rowY, worksheetWidths[index], 24).fillAndStroke("#0f766e", "#0f766e");
      doc.fillColor("#fff").font("Helvetica-Bold").fontSize(6.5).text(heading, rowX + 4, rowY + 8, { width: worksheetWidths[index] - 8 });
      rowX += worksheetWidths[index];
    });
    rowY += 24;
    for (const row of claimJson.rows || []) {
      if (rowY > doc.page.height - 85) { doc.addPage(); rowY = 36; }
      const evidence = row.issues?.length
        ? row.issues.join(" ")
        : `${row.evidence || ""}${row.cmsGroupNumber ? `; ${row.cmsArticleId || "CMS"} group ${row.cmsGroupNumber}` : ""}${row.cptCode === "81418" && !row.billOnce ? "; traceability only - do not bill another unit" : ""}`;
      const cells = [row.gene, row.cptCode || "REVIEW", row.medication || "REVIEW", row.diagnosisCode || "REVIEW", String(row.status).toUpperCase(), evidence];
      rowX = worksheetX;
      cells.forEach((cell, index) => {
        doc.rect(rowX, rowY, worksheetWidths[index], 42).fillAndStroke("#fff", "#cbd5e1");
        doc.fillColor(index === 4 && row.status !== "ready" ? "#9a3412" : "#111827").font(index < 2 ? "Helvetica-Bold" : "Helvetica").fontSize(7).text(String(cell), rowX + 4, rowY + 7, { width: worksheetWidths[index] - 8, height: 30, ellipsis: true });
        rowX += worksheetWidths[index];
      });
      rowY += 42;
    }
    doc.fillColor("#4b5563").font("Helvetica").fontSize(7).text((claimJson.notes || []).join("  "), worksheetX, Math.min(rowY + 12, doc.page.height - 62), { width: worksheetWidth });
    doc.fillColor("#7c2d12").font("Helvetica").fontSize(6.5).text(analysis.disclaimer, worksheetX, doc.page.height - 38, { width: worksheetWidth, align: "center" });
    doc.end();
    return;

    const pageWidth = doc.page.width - 56;
    const startX = 28;
    const color = claimJson.claimType === "UB-04" ? "#854d0e" : "#9f1239";
    const pale = claimJson.claimType === "UB-04" ? "#fffbeb" : "#fff1f2";
    const value = (input: unknown, fallback = "REVIEW REQUIRED") => input === null || input === undefined || input === "" ? fallback : String(input);
    const field = (x: number, y: number, width: number, height: number, label: string, content: unknown) => {
      doc.save().lineWidth(0.6).strokeColor("#b6bbc6").rect(x, y, width, height).fillAndStroke("#ffffff", "#b6bbc6").restore();
      doc.fillColor("#6b7280").fontSize(6).font("Helvetica-Bold").text(label.toUpperCase(), x + 5, y + 4, { width: width - 10, lineBreak: false });
      doc.fillColor("#111827").fontSize(8).font("Helvetica").text(value(content), x + 5, y + 16, { width: width - 10, height: height - 18, ellipsis: true });
    };

    doc.save().roundedRect(startX, 28, pageWidth, 55, 7).fill(pale).restore();
    doc.fillColor(color).font("Helvetica-Bold").fontSize(18).text(
      claimJson.claimType === "UB-04" ? "CMS-1450 / UB-04 INSTITUTIONAL CLAIM REVIEW" : "CMS-1500 (02/12) PROFESSIONAL CLAIM REVIEW",
      startX + 14,
      40,
    );
    doc.fillColor("#4b5563").font("Helvetica").fontSize(8).text("Codical Health PGx Coding Engine · Structured review worksheet", startX + 14, 64);
    doc.fillColor("#991b1b").font("Helvetica-Bold").fontSize(8).text("PREVIEW ONLY · NOT FOR CLAIM SUBMISSION", startX + pageWidth - 210, 49, { width: 195, align: "right" });

    let y = 93;
    const third = pageWidth / 3;
    if (claimJson.claimType === "CMS-1500") {
      field(startX, y, third, 40, "1a Insured ID", claimJson.patient?.memberId);
      field(startX + third, y, third, 40, "2 Patient name", claimJson.patient?.name);
      field(startX + third * 2, y, third, 40, "3 Date of birth", claimJson.patient?.dob);
      y += 40;
      field(startX, y, third, 40, "17 Ordering/referring provider", claimJson.provider?.name);
      field(startX + third, y, third, 40, "17b NPI", claimJson.provider?.npi);
      field(startX + third * 2, y, third, 40, "23 Prior authorization", claimJson.formFields?.priorAuthorization);
    } else {
      field(startX, y, third, 40, "FL 1 Billing provider", claimJson.provider?.billingName);
      field(startX + third, y, third, 40, "FL 3a Patient control number", claimJson.formFields?.patientControlNumber);
      field(startX + third * 2, y, third, 40, "FL 4 Type of bill", claimJson.formFields?.typeOfBill);
      y += 40;
      field(startX, y, third, 40, "FL 8 Patient name", claimJson.patient?.name);
      field(startX + third, y, third, 40, "FL 10 Date of birth", claimJson.patient?.dob);
      field(startX + third * 2, y, third, 40, "FL 56 Billing provider NPI", claimJson.provider?.billingNpi);
    }
    y += 48;
    field(startX, y, pageWidth, 38, claimJson.claimType === "CMS-1500" ? "21 ICD-10-CM diagnoses" : "FL 66 / 67 ICD-10-CM diagnoses", (claimJson.diagnosisCodes || []).join(" · ") || "NO SOURCE-SUPPORTED DIAGNOSIS DETECTED");
    y += 48;

    const widths = claimJson.claimType === "CMS-1500"
      ? [78, 55, 190, 48, 78, 55]
      : [78, 190, 85, 78, 55, 78];
    const headings = claimJson.claimType === "CMS-1500"
      ? ["24A DATE", "24B POS", "24D CPT / HCPCS", "24E DX", "24F CHARGE", "24G UNITS"]
      : ["FL 42 REVENUE", "FL 43 DESCRIPTION", "FL 44 HCPCS", "FL 45 DATE", "FL 46 UNITS", "FL 47 CHARGE"];
    const totalDefined = widths.reduce((total, width) => total + width, 0);
    widths[2] += pageWidth - totalDefined;
    let x = startX;
    headings.forEach((heading, index) => {
      doc.save().rect(x, y, widths[index], 22).fillAndStroke(color, color).restore();
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(6).text(heading, x + 4, y + 8, { width: widths[index] - 8 });
      x += widths[index];
    });
    y += 22;
    for (const line of claimJson.serviceLines || []) {
      const cells = claimJson.claimType === "CMS-1500"
        ? [value(claimJson.formFields?.serviceDate, "—"), value(claimJson.formFields?.placeOfService, "—"), `${value(line.cpt)} · ${value(line.description, "")}`, value(line.diagnosisPointer, "—"), line.charge === null ? "NOT SET" : line.charge, line.units]
        : [value(line.revenueCode, "REVIEW"), value(line.description), value(line.hcpcs), value(claimJson.formFields?.serviceDate, "—"), line.units, line.charge === null ? "NOT SET" : line.charge];
      x = startX;
      cells.forEach((cell, index) => {
        doc.save().rect(x, y, widths[index], 34).fillAndStroke("#ffffff", "#b6bbc6").restore();
        doc.fillColor("#111827").font("Helvetica").fontSize(7).text(String(cell), x + 4, y + 8, { width: widths[index] - 8, height: 22, ellipsis: true });
        x += widths[index];
      });
      y += 34;
    }
    if ((claimJson.serviceLines || []).length === 0) {
      field(startX, y, pageWidth, 34, "Service lines", "NO CODE SUGGESTION");
      y += 34;
    }

    y += 10;
    const half = pageWidth / 2;
    if (claimJson.claimType === "CMS-1500") {
      field(startX, y, half, 38, "31 Provider signature", "SIGNATURE ON FILE — CONFIRM");
      field(startX + half, y, half, 38, "33 / 33a Billing provider and NPI", `${value(claimJson.provider?.billingName)} · ${value(claimJson.provider?.billingNpi)}`);
    } else {
      field(startX, y, half, 38, "FL 50 / 60 Payer and insured ID", `${value(claimJson.formFields?.payerName)} · ${value(claimJson.patient?.memberId)}`);
      field(startX + half, y, half, 38, "FL 76 Attending provider", `${value(claimJson.provider?.name)} · ${value(claimJson.provider?.npi)}`);
    }
    y += 49;
    doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8).text("CODING RATIONALE", startX, y);
    doc.fillColor("#4b5563").font("Helvetica").fontSize(7.5).text(analysis.medicalNecessity.reason, startX, y + 12, { width: pageWidth, height: 30, ellipsis: true });
    doc.fillColor("#7c2d12").font("Helvetica").fontSize(6.5).text(analysis.disclaimer, startX, doc.page.height - 43, { width: pageWidth, align: "center" });
    doc.end();
  });
}

function generatePgxPdfBuffer(analysis: PgxAnalysisResult, claimJson: Record<string, any>) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 28 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageX = 28;
    const pageWidth = doc.page.width - 56;
    const bottom = doc.page.height - 52;
    const value = (input: unknown, fallback = "REVIEW") => input === null || input === undefined || input === "" ? fallback : String(input);
    const drawTitle = () => {
      doc.roundedRect(pageX, 28, pageWidth, 62, 8).fill("#eefcfb");
      doc.fillColor("#0f766e").font("Helvetica-Bold").fontSize(18).text("PGx BILLING WORKSHEET", pageX + 14, 40);
      doc.fillColor("#4b5563").font("Helvetica").fontSize(8).text(`Patient: ${claimJson.patient?.name || "REVIEW REQUIRED"}  |  CMS: ${claimJson.articleId || "MCD REVIEW"}  |  Service state: ${claimJson.serviceState || "REQUIRED"}`, pageX + 14, 66);
      doc.fillColor("#991b1b").font("Helvetica-Bold").fontSize(8).text("CODER REVIEW REQUIRED", pageX + pageWidth - 180, 50, { width: 165, align: "right" });
    };
    const drawHeadings = (y: number, headings: string[], widths: number[]) => {
      let x = pageX;
      headings.forEach((heading, index) => {
        doc.rect(x, y, widths[index], 22).fillAndStroke("#0f766e", "#0f766e");
        doc.fillColor("#fff").font("Helvetica-Bold").fontSize(6.2).text(heading, x + 4, y + 7, { width: widths[index] - 8 });
        x += widths[index];
      });
      return y + 22;
    };
    const drawCells = (y: number, cells: unknown[], widths: number[], height: number, statusIndex?: number) => {
      let x = pageX;
      cells.forEach((cell, index) => {
        doc.rect(x, y, widths[index], height).fillAndStroke("#fff", "#cbd5e1");
        const review = statusIndex === index && String(cell).toUpperCase() !== "READY" && String(cell).toUpperCase() !== "SUPPORTED";
        doc.fillColor(review ? "#9a3412" : "#111827").font(index < 2 ? "Helvetica-Bold" : "Helvetica").fontSize(6.8).text(value(cell), x + 4, y + 6, { width: widths[index] - 8, height: height - 12, ellipsis: true });
        x += widths[index];
      });
      return y + height;
    };

    drawTitle();
    let y = 104;
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9).text("BILLABLE LABORATORY SERVICE LINES", pageX, y);
    y += 14;
    const serviceWidths = [30, 58, 34, 136, 104, 92, pageWidth - 454];
    const serviceHeadings = ["LINE", "CPT", "UOS", "TESTED CONTENT", "REQUIRED DRUGS", "SUPPORTED DX", "STATUS / REVIEW"];
    y = drawHeadings(y, serviceHeadings, serviceWidths);
    for (const line of claimJson.serviceLines || []) {
      if (y + 54 > bottom) { doc.addPage(); drawTitle(); y = drawHeadings(104, serviceHeadings, serviceWidths); }
      const review = line.issues?.length ? line.issues.join(" ") : (line.cmsMatches || []).map((match: any) => `${match.articleId} group ${match.groupNumber}`).join("; ");
      y = drawCells(y, [line.lineNumber, line.cptCode, line.units, (line.genes || []).join(", "), (line.medications || []).join(", ") || "NONE LINKED", (line.diagnosisCodes || []).join(", ") || "NONE SUPPORTED", `${String(line.status).toUpperCase()} — ${review}`], serviceWidths, 54, 6);
    }
    if (!(claimJson.serviceLines || []).length) y = drawCells(y, ["-", "HOLD", "-", "No performed service determined", "-", "-", "REVIEW"], serviceWidths, 42, 6);

    y += 10;
    doc.fillColor("#475569").font("Helvetica").fontSize(7).text(`Source-documented diagnoses: ${(claimJson.documentedDiagnosisCodes || []).join(", ") || "NONE"}. Only supported diagnoses appear on service lines.`, pageX, y, { width: pageWidth });
    y += 24;
    if (y + 80 > bottom) { doc.addPage(); drawTitle(); y = 104; }
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9).text("GENE-MEDICATION EVIDENCE — NOT ADDITIONAL CLAIM LINES", pageX, y);
    y += 14;
    const evidenceWidths = [62, 122, 110, 94, 72, pageWidth - 460];
    const evidenceHeadings = ["GENE", "RESULT", "ACTIONABLE DRUG", "EVIDENCE", "SEPARATE CPT REF", "STATUS / REVIEW"];
    y = drawHeadings(y, evidenceHeadings, evidenceWidths);
    for (const row of claimJson.evidenceRows || []) {
      if (y + 46 > bottom) { doc.addPage(); drawTitle(); y = drawHeadings(104, evidenceHeadings, evidenceWidths); }
      const review = row.issues?.length ? row.issues.join(" ") : (row.cmsArticleIds || []).join(", ");
      y = drawCells(y, [row.gene, [row.genotype, row.phenotype].filter(Boolean).join(" / "), (row.medications || []).join(", ") || "NO MATCH", (row.evidence || []).join(", ") || "REVIEW", row.separateTestCptReference ? `${row.separateTestCptReference}*` : "NONE", `${String(row.status).toUpperCase()} — ${review}`], evidenceWidths, 46, 5);
    }

    const noteY = Math.min(y + 10, bottom - 25);
    doc.fillColor("#475569").font("Helvetica").fontSize(6.6).text((claimJson.notes || []).join("  "), pageX, noteY, { width: pageWidth, height: 22, ellipsis: true });
    doc.fillColor("#7c2d12").font("Helvetica").fontSize(6.2).text(analysis.disclaimer, pageX, doc.page.height - 38, { width: pageWidth, align: "center" });
    doc.end();
  });
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
    console.warn("Coverage cache lookup failed; falling back to CMS Coverage API:", error?.message || error);
    return null;
  }
}

async function tryMcdCoverageDocument(candidates: string[]) {
  try {
    return await getMcdCoverageDocument(candidates);
  } catch (error: any) {
    console.warn("Coverage cache document lookup failed; falling back to CMS Coverage API:", error?.message || error);
    return null;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============ NICU DAILY CODER ROUTES ============

  app.get("/api/nicu/references", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      res.json({
        engineVersion: NICU_ENGINE_VERSION,
        policyVersion: NICU_POLICY_VERSION,
        scope: "Professional directing-provider daily review with an explicit facility-pathway boundary",
        sources: [
          { id: "cms-ncci-2026-xi", title: "2026 Medicare NCCI Policy Manual, Chapter XI", url: "https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf" },
          { id: "cms-ncci-ptp-2026-q3", title: "Medicare NCCI PTP Edits, 2026 Q3", url: "https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits" },
          { id: "cms-medicaid-ncci-2026-q3", title: "Medicaid NCCI Edit Files, 2026 Q3", url: "https://www.cms.gov/medicare/coding-billing/ncci-medicaid/medicaid-ncci-edit-files" },
          { id: "cdc-icd10-fy2026", title: "FY 2026 ICD-10-CM Official Guidelines", url: "https://ftp.cdc.gov/pub/health_statistics/nchs/publications/ICD10CM/2026/ICD-10-CM-October-2025-Guidelines.pdf" },
          { id: "aap-global-per-diem", title: "AAP Global Per Diem Critical Care: Direct Supervision and Reporting", url: "https://www.aap.org/globalassets/publications/cfp22/global_per_diem_critical_care_codes.pdf" },
          { id: "ama-cpt-current", title: "Current licensed CPT guidance", url: "https://www.ama-assn.org/practice-management/cpt" },
          { id: "payer-policy", title: "Date-effective state Medicaid, CHIP, or commercial payer policy", url: "https://www.medicaid.gov/medicaid/by-state/index.html" },
        ],
        safeguards: {
          criticalStatusNeverInferred: true,
          presentWeightRequiredForContinuingIntensiveTier: true,
          oneDirectingProviderPerDiemPerDate: true,
          facilityBillingHeldForGrouperAndContractReview: true,
          payerCoverageNotInferred: true,
          licensedCptVerificationRequired: true,
          humanApprovalRequired: true,
          autonomousSubmissionAllowed: false,
        },
      });
    } catch (error: any) { return sendRouteError(res, error, "Failed to load NICU references"); }
  });

  app.post("/api/nicu/documents/extract", upload.fields([{ name: "documents", maxCount: 12 }]), async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const files = (((req.files || {}) as Record<string, UploadedPgxFile[]>).documents || []);
      if (!files.length) throw new RouteError(400, "Upload at least one NICU progress note, flowsheet, transfer record, or discharge document.");
      const documents: Array<Record<string, unknown>> = [];
      for (const file of files) {
        const [extracted, vision] = await Promise.all([extractTextFromPgxFile(file), understandNicuDocument(file)]);
        let stored: Awaited<ReturnType<typeof uploadSpecialtyObject>> = null;
        try { stored = await uploadSpecialtyObject("nicu", createSpecialtyObjectKey("nicu", user.id), file.buffer, extracted.mimeType); } catch { /* OCR can continue when storage is temporarily unavailable. */ }
        const text = extracted.text.replace(/\s+/g, " ").trim();
        documents.push({
          fileName: extracted.fileName,
          byteSize: file.buffer.length,
          sha256: extracted.validation.sha256,
          pageCount: extracted.validation.pageCount,
          extractionMethod: vision.used ? "visual-ocr-plus-native-text" : extracted.validation.extractionMethod,
          patientName: vision.patientName || null,
          dateOfBirth: vision.dateOfBirth || null,
          admissionDate: vision.admissionDate || null,
          birthWeightGrams: vision.birthWeightGrams || null,
          days: vision.days,
          diagnoses: vision.diagnoses,
          textPreview: text.slice(0, 700),
          objectKey: stored?.key || null,
          requiresManualReview: true,
          warnings: [...new Set([
            extracted.warning,
            ...vision.warnings,
            !text && !vision.used ? "No native text was found; advanced visual OCR was unavailable." : "",
            "Every extracted date, weight, status, provider, diagnosis, procedure, and attestation must be verified against the source.",
          ].filter(Boolean))],
        });
      }
      res.json({ success: true, documents, requiresHumanReview: true, autonomousCodeSelection: false });
    } catch (error: any) { return sendRouteError(res, error, "Failed to process NICU documents"); }
  });

  app.post("/api/nicu/evaluate", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const candidate = req.body?.caseInput as NicuCaseInput | undefined;
      if (!candidate?.dateOfBirth || !candidate?.admissionDate || !Array.isArray(candidate?.days) || !Array.isArray(candidate?.diagnoses)) throw new RouteError(400, "Date of birth, admission date, diagnoses array, and daily evidence are required.");
      const caseInput: NicuCaseInput = {
        ...candidate,
        diagnoses: candidate.diagnoses.slice(0, 100),
        days: candidate.days.slice(0, 120).map((day) => ({ ...day, procedures: Array.isArray(day.procedures) ? day.procedures.slice(0, 40) : [] })),
      };
      const evaluation = evaluateNicuCase(caseInput);
      let ncci: unknown = null;
      if (caseInput.claimScope === "practitioner" && evaluation.ncciCodes.length > 1) {
        try { ncci = await checkNcciBatchEdits(evaluation.ncciCodes.slice(0, 12), "practitioner"); }
        catch (error: any) { ncci = { unavailable: true, message: error?.message || "NCCI lookup unavailable; do not release procedure combinations without current edit review." }; }
      }
      res.json({
        success: true,
        evaluation,
        ncci,
        evidenceSemantics: "This is a coder-review worksheet. It does not diagnose critical illness, establish coverage, replace a licensed CPT source, determine a facility DRG/revenue path, authorize a modifier, or submit a claim.",
      });
    } catch (error: any) { return sendRouteError(res, error, "Failed to build the NICU daily coding worksheet"); }
  });

  // ============ INFUSION HIERARCHY AND DRUG-UNIT ROUTES ============

  app.get("/api/infusion/references", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      res.json({
        engineVersion: INFUSION_ENGINE_VERSION,
        policyVersion: INFUSION_POLICY_VERSION,
        pricingQuarter: CMS_INFUSION_ASP_2026_Q3.quarter,
        effectiveFrom: CMS_INFUSION_ASP_2026_Q3.effectiveFrom,
        effectiveTo: CMS_INFUSION_ASP_2026_Q3.effectiveTo,
        drugCodeCount: Object.keys(CMS_INFUSION_ASP_2026_Q3.entries).length,
        drugAliasCount: Object.keys(CMS_INFUSION_ASP_2026_Q3.aliases).length,
        sources: [
          { id: "cms-ncci-2026-xi", title: "2026 Medicare NCCI Policy Manual, Chapter XI", url: "https://www.cms.gov/files/document/2026-ncci-medicare-policy-manual-all-chapters.pdf" },
          { id: "cms-asp-2026-q3", title: "July 2026 Medicare Part B Drug Payment Limit Files", url: "https://www.cms.gov/medicare/payment/part-b-drugs/asp-pricing-files" },
          { id: "cms-mcp-ch17", title: "Medicare Claims Processing Manual, Chapter 17", url: "https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/downloads/clm104c17.pdf" },
          { id: "cms-mcd-a53778", title: "A53778 Infusion, Injection and Hydration Services", url: "https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=53778" },
          { id: "cms-ncci-ptp", title: "Medicare NCCI Procedure-to-Procedure Edits", url: "https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits" },
          { id: "cms-ncci-mue", title: "Medicare NCCI Medically Unlikely Edits", url: "https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits-mues" },
        ],
        safeguards: { sourceTimesRequired: true, doseUnitConversionAudited: true, coverageNotInferredFromAsp: true, humanApprovalRequired: true, autonomousSubmissionAllowed: false },
      });
    } catch (error: any) { return sendRouteError(res, error, "Failed to load infusion references"); }
  });

  app.get("/api/infusion/drugs", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const query = String(req.query.q || "").trim();
      if (query.length < 2) throw new RouteError(400, "Enter at least two characters or a complete HCPCS code.");
      res.json({ query, quarter: CMS_INFUSION_ASP_2026_Q3.quarter, results: lookupInfusionDrugs(query, CMS_INFUSION_ASP_2026_Q3), coverageNotice: "Presence in an ASP file does not establish Medicare coverage or medical necessity." });
    } catch (error: any) { return sendRouteError(res, error, "Failed to search infusion drugs"); }
  });

  app.post("/api/infusion/documents/extract", upload.fields([{ name: "documents", maxCount: 12 }]), async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const files = (((req.files || {}) as Record<string, UploadedPgxFile[]>).documents || []);
      if (!files.length) throw new RouteError(400, "Upload at least one medication administration record, flowsheet, or order document.");
      const documents: Array<Record<string, unknown>> = [];
      for (const file of files) {
        const [extracted, vision] = await Promise.all([extractTextFromPgxFile(file), understandInfusionDocument(file)]);
        let stored: Awaited<ReturnType<typeof uploadSpecialtyObject>> = null;
        try { stored = await uploadSpecialtyObject("infusion", createSpecialtyObjectKey("infusion", user.id), file.buffer, extracted.mimeType); } catch { /* Review can continue if object storage is temporarily unavailable. */ }
        const text = extracted.text.replace(/\s+/g, " ").trim();
        documents.push({
          fileName: extracted.fileName, byteSize: file.buffer.length, sha256: extracted.validation.sha256, pageCount: extracted.validation.pageCount,
          extractionMethod: vision.used ? "visual-ocr-plus-native-text" : extracted.validation.extractionMethod,
          patientName: vision.patientName || null, serviceDate: vision.serviceDate || null, administrations: vision.administrations,
          textPreview: text.slice(0, 700), objectKey: stored?.key || null, requiresManualReview: true,
          warnings: [...new Set([extracted.warning, ...vision.warnings, !text && !vision.used ? "No native text was found; advanced visual OCR was unavailable." : "", "Every extracted dose, route, start/stop time, access site, and waste amount must be verified against the source."] .filter(Boolean))],
        });
      }
      res.json({ success: true, documents, requiresHumanReview: true, autonomousCodeSelection: false });
    } catch (error: any) { return sendRouteError(res, error, "Failed to process infusion documents"); }
  });

  app.post("/api/infusion/evaluate", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const candidate = req.body?.caseInput as InfusionCaseInput | undefined;
      if (!candidate?.serviceDate || !candidate?.setting || !Array.isArray(candidate?.administrations)) throw new RouteError(400, "Date of service, setting, and administration evidence are required.");
      const caseInput: InfusionCaseInput = { ...candidate, administrations: candidate.administrations.slice(0, 100) };
      const evaluation = evaluateInfusionCase(caseInput, CMS_INFUSION_ASP_2026_Q3);
      const administrationCodes = [...new Set(evaluation.administrationLines.map((line) => line.code))];
      let ncci: unknown = null;
      if (administrationCodes.length > 1) {
        try { ncci = await checkNcciBatchEdits(administrationCodes.slice(0, 8), candidate.setting === "hospital-outpatient" ? "outpatient" : "practitioner"); }
        catch (error: any) { ncci = { unavailable: true, message: error?.message || "NCCI lookup unavailable; do not release without edit review." }; }
      }
      res.json({
        success: true, evaluation, ncci,
        dataProvenance: { quarter: CMS_INFUSION_ASP_2026_Q3.quarter, sourceHashes: CMS_INFUSION_ASP_2026_Q3.sourceHashes },
        evidenceSemantics: "This is a coder-review worksheet. It does not establish coverage, medical necessity, drug classification, payer payment, or permission to submit a claim.",
      });
    } catch (error: any) { return sendRouteError(res, error, "Failed to build the infusion coding worksheet"); }
  });

  // ============ CMS-HCC V28 RISK ADJUSTMENT ROUTES ============

  app.get("/api/hcc/references", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      res.json({
        engineVersion: HCC_ENGINE_VERSION,
        policyVersion: HCC_POLICY_VERSION,
        modelVersion: CMS_HCC_V28_2026.modelVersion,
        paymentYear: HCC_PAYMENT_YEAR,
        dataCollectionYear: HCC_DATA_COLLECTION_YEAR,
        diagnosisMappingCount: Object.keys(CMS_HCC_V28_2026.mappings).length,
        normalizationFactor: HCC_NORMALIZATION_FACTOR,
        maCodingPatternAdjustment: HCC_MA_CODING_PATTERN_ADJUSTMENT,
        scope: "Non-PACE Medicare Advantage Part C, PY 2026, 2024 CMS-HCC V28 final model",
        heldPathways: ["PACE blended model", "ESRD dialysis", "ESRD transplant", "ESRD functioning graft", "Part D RxHCC"],
        sources: [
          { id: "cms-py2026-model", title: "CMS 2026 Model Software/ICD-10 Mappings", url: "https://www.cms.gov/medicare/payment/medicare-advantage-rates-statistics/risk-adjustment/2026-model-software-icd-10-mappings" },
          { id: "cms-cy2026-announcement", title: "CMS CY 2026 Rate Announcement", url: "https://www.cms.gov/files/document/2026-announcement.pdf" },
          { id: "cms-mcm-ch7", title: "Medicare Managed Care Manual, Chapter 7", url: "https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/mc86c07.pdf" },
          { id: "cms-radv", title: "CMS Medicare Advantage RADV Program", url: "https://www.cms.gov/data-research/monitoring-programs/medicare-risk-adjustment-data-validation-program" },
          { id: "cms-icd10-fy2026", title: "FY 2026 ICD-10-CM Official Guidelines", url: "https://www.cms.gov/files/document/fy-2026-icd-10-cm-coding-guidelines.pdf" },
          { id: "cms-ra-eligible-services", title: "Medicare Risk Adjustment Eligible CPT/HCPCS Codes", url: "https://www.cms.gov/medicare/health-plans/medicareadvtgspecratestats/risk-adjustors-items/cpt-hcpcs" },
        ],
        safeguards: {
          historicalDiagnosesNeverAutoRecaptured: true,
          unsupportedDiagnosesNeverSuggested: true,
          genericDollarPaymentEstimateDisabled: true,
          humanApprovalRequired: true,
          autonomousSubmissionAllowed: false,
        },
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to load HCC references");
    }
  });

  app.post("/api/hcc/map-codes", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const codes = Array.isArray(req.body?.codes) ? req.body.codes.map((value: unknown) => String(value).toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean).slice(0, 250) : [];
      if (!codes.length) throw new RouteError(400, "Provide at least one ICD-10-CM code.");
      res.json({
        success: true,
        paymentYear: HCC_PAYMENT_YEAR,
        modelVersion: CMS_HCC_V28_2026.modelVersion,
        mappings: [...new Set<string>(codes)].map((code) => ({ code, rules: CMS_HCC_V28_2026.mappings[code] || [], mapped: Boolean(CMS_HCC_V28_2026.mappings[code]?.length) })),
        notice: "A model mapping is not proof that a diagnosis is reportable. Current medical-record support, acceptable provider/source, eligible encounter, ICD-10-CM rules, and human review remain required.",
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to map HCC diagnosis codes");
    }
  });

  app.post("/api/hcc/documents/extract", upload.fields([{ name: "documents", maxCount: 12 }]), async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const files = (((req.files || {}) as Record<string, UploadedPgxFile[]>).documents || []);
      if (!files.length) throw new RouteError(400, "Upload at least one encounter or medical-record document.");
      const documents: Array<Record<string, unknown>> = [];
      for (const file of files) {
        const extracted = await extractTextFromPgxFile(file);
        const normalized = extracted.text.replace(/\s+/g, " ").trim();
        const candidateCodes = [...new Set((normalized.toUpperCase().match(/\b[A-TV-Z][0-9][0-9A-Z](?:\.?[0-9A-Z]{1,4})?\b/g) || []).map((code) => code.replace(".", "")))].filter((code) => CMS_HCC_V28_2026.mappings[code]).slice(0, 100);
        const lower = normalized.toLowerCase();
        const candidateFlags = {
          signatureLanguagePresent: /electronically signed|signed by|signature|authenticated by/.test(lower),
          assessmentPlanLanguagePresent: /assessment|impression|plan|diagnosis/.test(lower),
          uncertainLanguagePresent: /probable|suspected|questionable|rule out|working diagnosis/.test(lower),
          serviceDateLanguagePresent: /date of service|encounter date|visit date/.test(lower),
        };
        let stored: Awaited<ReturnType<typeof uploadSpecialtyObject>> = null;
        try {
          stored = await uploadSpecialtyObject("hcc", createSpecialtyObjectKey("hcc", user.id), file.buffer, extracted.mimeType);
        } catch {
          // The review can continue when encrypted object storage is temporarily unavailable.
        }
        documents.push({
          fileName: extracted.fileName,
          byteSize: file.buffer.length,
          sha256: extracted.validation.sha256,
          pageCount: extracted.validation.pageCount,
          extractionMethod: extracted.validation.extractionMethod,
          textPreview: normalized.slice(0, 700),
          candidateCodes,
          candidateFlags,
          objectKey: stored?.key || null,
          requiresManualReview: true,
          warnings: [
            extracted.warning,
            !normalized ? "No native text was found. Route scanned or handwritten records through an approved OCR/vision service." : null,
            "Detected codes and phrases are review candidates only. Extraction never confirms, recaptures, or submits a diagnosis.",
          ].filter(Boolean),
        });
      }
      res.json({ success: true, documents, requiresHumanReview: true, autonomousDiagnosisSuggestion: false });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to process HCC documents");
    }
  });

  app.post("/api/hcc/evaluate", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const candidate = req.body?.caseInput as HccCaseInput | undefined;
      if (!candidate?.dateOfBirth || !candidate?.sex || !candidate?.programType || !candidate?.enrollmentType || !candidate?.medicaidStatus || !Array.isArray(candidate?.diagnoses)) {
        throw new RouteError(400, "Payment year, beneficiary demographics, program/enrollment context, and diagnosis evidence are required.");
      }
      const caseInput: HccCaseInput = {
        ...candidate,
        paymentYear: 2026,
        diagnoses: candidate.diagnoses.slice(0, 500),
        priorYearDiagnoses: Array.isArray(candidate.priorYearDiagnoses) ? candidate.priorYearDiagnoses.slice(0, 500) : [],
      };
      const evaluation = evaluateHccCase(caseInput, CMS_HCC_V28_2026);
      res.json({
        success: true,
        evaluation,
        modelProvenance: { version: CMS_HCC_V28_2026.modelVersion, sourceHashes: CMS_HCC_V28_2026.sourceHashes },
        evidenceSemantics: "The result is a deterministic model worksheet, not a diagnosis, encounter-data submission, CMS payment determination, or guarantee of RADV support.",
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to build the HCC risk-adjustment worksheet");
    }
  });

  // ============ OFFICE / OUTPATIENT E/M MDM ROUTES ============

  app.get("/api/em-mdm/references", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      res.json({
        engineVersion: EM_MDM_ENGINE_VERSION,
        policyVersion: EM_MDM_POLICY_VERSION,
        scope: "Office and other outpatient E/M services only",
        codeFamilies: { newPatient: ["99202", "99203", "99204", "99205"], establishedPatient: ["99212", "99213", "99214", "99215"], staffServiceReview: ["99211"], medicareAddOns: ["G2211", "G2212"] },
        currentTimeThresholdMinutes: { newPatient: { "99202": 15, "99203": 30, "99204": 45, "99205": 60 }, establishedPatient: { "99212": 10, "99213": 20, "99214": 30, "99215": 40 } },
        medicareProlongedThresholdMinutes: { "99205+G2212x1": 89, "99215+G2212x1": 69, additionalUnitMinutes: 15 },
        sources: [
          { id: "cms-mln006764", title: "CMS Evaluation and Management Services, May 2026", url: "https://www.cms.gov/files/document/mln006764-evaluation-management-services.pdf" },
          { id: "cms-clm-ch12", title: "Medicare Claims Processing Manual, Chapter 12", url: "https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/clm104c12.pdf" },
          { id: "cms-mm13473", title: "CMS MM13473 - Office/Outpatient G2211", url: "https://www.cms.gov/files/document/mm13473-how-use-office-and-outpatient-evaluation-and-management-visit-complexity-add-code-g2211.pdf" },
          { id: "ama-em-guidelines", title: "AMA CPT E/M guidance and MDM framework", url: "https://www.ama-assn.org/practice-management/cpt/cpt-evaluation-and-management" },
          { id: "ama-em-2024-time", title: "AMA 2024 E/M minimum-time revision", url: "https://www.ama-assn.org/practice-management/cpt/simpler-approach-helps-physicians-properly-report-em-services" },
        ],
        licensing: "CPT descriptors and the complete official MDM table require a current AMA license. This endpoint returns code identifiers, original paraphrases, CMS policy metadata, and adapter boundaries only.",
        autonomousClaimSubmission: false,
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to load E/M references");
    }
  });

  app.post("/api/em-mdm/documents/extract", upload.fields([{ name: "documents", maxCount: 8 }]), async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const files = (((req.files || {}) as Record<string, UploadedPgxFile[]>).documents || []);
      if (!files.length) throw new RouteError(400, "Upload at least one office/outpatient encounter document.");
      const documents = [] as Array<Record<string, unknown>>;
      for (const file of files) {
        const extracted = await extractTextFromPgxFile(file);
        const normalized = extracted.text.replace(/\s+/g, " ").trim();
        const lower = normalized.toLowerCase();
        const documentType = /assessment|plan|medical decision/.test(lower) ? "encounter-note"
          : /medication|prescription|dose/.test(lower) ? "medication-record"
          : /lab|imaging|radiology|test result/.test(lower) ? "test-record"
          : /referral|consult|external note/.test(lower) ? "external-record"
          : /procedure|surgery|operative/.test(lower) ? "same-day-procedure"
          : "unclassified";
        const candidateFlags = {
          prescriptionManagementLanguage: /start(?:ed|ing)?|stop(?:ped|ping)?|continue(?:d)?|adjust(?:ed)?|prescri(?:be|bed|ption)/.test(lower),
          hospitalizationLanguage: /admit(?:ted)?|hospitali[sz]|emergency department|higher level of care/.test(lower),
          independentHistorianLanguage: /independent historian|history (?:provided|obtained) (?:from|by)/.test(lower),
          externalDiscussionLanguage: /discussed with|consulted with|spoke with/.test(lower),
          totalTimeLanguage: /total time|minutes? (?:spent|on the date)/.test(lower),
        };
        let stored: Awaited<ReturnType<typeof uploadSpecialtyObject>> = null;
        try {
          stored = await uploadSpecialtyObject("em-mdm", createSpecialtyObjectKey("em-mdm", user.id), file.buffer, extracted.mimeType);
        } catch {
          // Evidence remains reviewable when encrypted object storage is temporarily unavailable.
        }
        documents.push({
          fileName: extracted.fileName,
          documentType,
          byteSize: file.buffer.length,
          sha256: extracted.validation.sha256,
          pageCount: extracted.validation.pageCount,
          extractionMethod: extracted.validation.extractionMethod,
          requiresManualReview: true,
          textPreview: normalized.slice(0, 600),
          objectKey: stored?.key || null,
          candidateFlags,
          warnings: [extracted.warning, !normalized ? "No native text was found. Route scanned or handwritten pages through an approved OCR/vision service." : "MDM candidates are search flags only; the physician/QHP and coder must verify the exact source language and encounter context."].filter(Boolean),
        });
      }
      res.json({ success: true, documents, notice: "Extraction never auto-classifies problem severity, management risk, patient status, diagnosis, or billable time. Verify every selected element against the source note.", requiresHumanReview: true });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to process E/M encounter documents");
    }
  });

  app.post("/api/em-mdm/evaluate", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const candidate = req.body?.caseInput as EmMdmCaseInput | undefined;
      if (!candidate?.serviceDate || !candidate.payerMode || !candidate.siteType || !candidate.placeOfService || !candidate.selectionBasis || !candidate.problems || !candidate.data || !candidate.risk || !candidate.time || !candidate.sameDay || !candidate.g2211) {
        throw new RouteError(400, "Service date, payer, site, POS, selection basis, and all E/M evidence domains are required.");
      }
      const caseInput: EmMdmCaseInput = {
        ...candidate,
        diagnosisCodes: Array.isArray(candidate.diagnosisCodes) ? candidate.diagnosisCodes : [],
        data: { ...candidate.data, externalNoteSourceIds: Array.isArray(candidate.data.externalNoteSourceIds) ? candidate.data.externalNoteSourceIds : [], tests: Array.isArray(candidate.data.tests) ? candidate.data.tests : [] },
      };
      const evaluation = evaluateEmMdmCase(caseInput);
      const stateCode = String(req.body?.stateCode || "").trim().toUpperCase();
      if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) throw new RouteError(400, "Use a two-letter service state for CMS evidence.");
      const cmsEvidence = evaluation.diagnosisCodes.length && evaluation.claimLines.length
        ? await getMcdBatchPairEvidence({ diagnosisCodes: evaluation.diagnosisCodes, procedureCodes: evaluation.claimLines.map((line) => line.code), stateCode: stateCode || undefined, limit: 30 })
        : { source: "cloudflare-mcd", pairs: [] };
      res.json({
        success: true,
        evaluation,
        cmsEvidence,
        evidenceSemantics: "MCD matches are supporting coverage context. They do not establish the E/M level, medical necessity, CPT eligibility, or payer payment.",
        autonomousClaimSubmission: false,
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to build the E/M MDM worksheet");
    }
  });

  // ============ OTP / MOUD BUNDLE ROUTES ============

  app.get("/api/otp-mat/references", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      res.json({
        engineVersion: OTP_ENGINE_VERSION,
        policyVersion: OTP_POLICY_VERSION,
        rates: OTP_2026_NATIONAL_RATES,
        professionalClaim: { format: "837P", placeOfService: "58", telecomPlaceOfService: "58" },
        institutionalClaims: [
          { site: "freestanding", format: "837I", typeOfBill: "087x", revenueCodes: "090x-091x or 0949" },
          { site: "provider-based", format: "837I", typeOfBill: "087x", conditionCode: "89", revenueCodes: "090x-091x or 0949" },
          { site: "hospital-based", format: "837I", typeOfBill: "013x", revenueCodes: "090x-091x or 0949" },
          { site: "CAH-based", format: "837I", typeOfBill: "085x", revenueCodes: "090x-091x or 0949" },
        ],
        sources: [
          { id: "cms-clm-ch39", title: "Medicare Claims Processing Manual, Chapter 39 - OTPs", url: "https://www.cms.gov/files/document/chapter-39-opioid-treatment-programs-otps.pdf" },
          { id: "cms-otp-cy2026-rates", title: "CMS CY 2026 OTP payment rates", url: "https://www.cms.gov/medicare/payment/opioid-treatment-programs-otp/billing-payment/otp-payment-rates" },
          { id: "cms-cr14347", title: "CMS CR 14347 / R13572BP", url: "https://www.cms.gov/medicare/regulations-guidance/transmittals/2026-transmittals/r13572bp" },
          { id: "cms-otp-enrollment", title: "CMS OTP enrollment", url: "https://www.cms.gov/medicare/payment/opioid-treatment-program/enrollment" },
          { id: "samhsa-42-cfr-part-8", title: "SAMHSA 42 CFR Part 8", url: "https://www.samhsa.gov/substance-use/treatment/opioid-treatment-program/42-cfr-part-8" },
          { id: "samhsa-federal-guidelines-2024", title: "Federal Guidelines for OTPs, Fall 2024", url: "https://store.samhsa.gov/sites/default/files/federal-guidelines-opioid-treatment-pep24-02-011.pdf" },
        ],
        safeguards: {
          diagnosisInference: false,
          takeHomeClinicalAuthorization: false,
          autonomousClaimSubmission: false,
          licensedCodeSetRequiredWhereApplicable: true,
        },
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to load OTP/MOUD references");
    }
  });

  app.post("/api/otp-mat/documents/extract", upload.fields([{ name: "documents", maxCount: 10 }]), async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const files = (((req.files || {}) as Record<string, UploadedPgxFile[]>).documents || []);
      if (!files.length) throw new RouteError(400, "Upload at least one OTP treatment document.");
      const documents = [] as Array<Record<string, unknown>>;
      for (const file of files) {
        const extracted = await extractTextFromPgxFile(file);
        const normalized = extracted.text.replace(/\s+/g, " ").trim();
        const lower = normalized.toLowerCase();
        const documentType = /admission|intake|initial assessment/.test(lower) ? "intake-assessment"
          : /dose|dosing|medication administration|take.home/.test(lower) ? "medication-record"
          : /counsel|therapy|peer support|navigation/.test(lower) ? "service-note"
          : /treatment plan|plan of care/.test(lower) ? "treatment-plan"
          : /toxicology|drug screen|urine/.test(lower) ? "toxicology"
          : /certif|accredit|enrollment/.test(lower) ? "program-credential"
          : "unclassified";
        let stored: Awaited<ReturnType<typeof uploadSpecialtyObject>> = null;
        try {
          stored = await uploadSpecialtyObject("otp-mat", createSpecialtyObjectKey("otp-mat", user.id), file.buffer, extracted.mimeType);
        } catch {
          // The evidence can still be reviewed when encrypted object storage is temporarily unavailable.
        }
        documents.push({
          fileName: extracted.fileName,
          documentType,
          byteSize: file.buffer.length,
          sha256: extracted.validation.sha256,
          pageCount: extracted.validation.pageCount,
          extractionMethod: extracted.validation.extractionMethod,
          requiresManualReview: extracted.validation.requiresManualReview || !normalized,
          textPreview: normalized.slice(0, 600),
          objectKey: stored?.key || null,
          warnings: [
            extracted.warning,
            !normalized ? "No native text was found. Route scanned or handwritten pages through an approved OCR/vision service and verify every claim-bound field against the source page." : "",
          ].filter(Boolean),
        });
      }
      res.json({
        success: true,
        documents,
        notice: "Document classification and extracted text are preliminary evidence only. The engine will not infer an OUD diagnosis, medication, dose, service time, or take-home authorization.",
        requiresHumanReview: true,
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to process OTP treatment documents");
    }
  });

  app.post("/api/otp-mat/evaluate", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const candidate = req.body?.caseInput as OtpCaseInput | undefined;
      if (!candidate?.serviceDate || !candidate.payerMode || !candidate.claimEntity || !candidate.siteType || !candidate.medication || !candidate.program) {
        throw new RouteError(400, "Service date, payer, claim entity, site, medication pathway, and program evidence are required.");
      }
      const caseInput: OtpCaseInput = {
        ...candidate,
        diagnosisCodes: Array.isArray(candidate.diagnosisCodes) ? candidate.diagnosisCodes : [],
        additionalCounselingMinutes: Number(candidate.additionalCounselingMinutes || 0),
        coordinatedCareMinutes: Number(candidate.coordinatedCareMinutes || 0),
        navigationMinutes: Number(candidate.navigationMinutes || 0),
        peerRecoveryMinutes: Number(candidate.peerRecoveryMinutes || 0),
        intensiveOutpatient: candidate.intensiveOutpatient ? {
          ...candidate.intensiveOutpatient,
          services: Array.isArray(candidate.intensiveOutpatient.services) ? candidate.intensiveOutpatient.services : [],
        } : undefined,
      };
      const evaluation = evaluateOtpCase(caseInput);
      const stateCode = String(req.body?.stateCode || "").trim().toUpperCase();
      if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) throw new RouteError(400, "Use a two-letter service state for CMS evidence.");
      const cmsEvidence = evaluation.diagnosisCodes.length && evaluation.lines.length
        ? await getMcdBatchPairEvidence({ diagnosisCodes: evaluation.diagnosisCodes, procedureCodes: evaluation.lines.map((line) => line.hcpcs), stateCode: stateCode || undefined, limit: 30 })
        : { source: "cloudflare-mcd", pairs: [] };
      res.json({
        success: true,
        evaluation,
        cmsEvidence,
        evidenceSemantics: "MCD pair evidence is supporting context, not a substitute for the national OTP manual, current payment file, service-state rules, or payer policy. No local match does not mean noncoverage.",
        autonomousClaimSubmission: false,
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to build the OTP/MOUD billing worksheet");
    }
  });

  // ============ ORGAN TRANSPLANT LIFECYCLE ROUTES ============

  app.get("/api/transplant/references", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      res.json({
        engineVersion: TRANSPLANT_ENGINE_VERSION,
        policyVersion: TRANSPLANT_POLICY_VERSION,
        programRecordCutover: "2026-04-06",
        organs: ["kidney", "liver", "heart", "lung", "heart-lung", "pancreas", "intestine", "multivisceral", "combined"],
        sources: [
          { id: "cms-pecos-cr14262", title: "CMS CR 14262 / Transplant Program PECOS records", url: "https://www.cms.gov/medicare/regulations-guidance/transmittals/2026-transmittals/r13757cp" },
          { id: "cms-cp-ch3", title: "Medicare Claims Processing Manual, Chapter 3", url: "https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c03.pdf" },
          { id: "cms-bp-ch11", title: "Medicare Benefit Policy Manual, Chapter 11", url: "https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/bp102c11.pdf" },
          { id: "ncd-260.1", title: "NCD 260.1 Adult Liver Transplantation", url: "https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=70" },
          { id: "ncd-260.3", title: "NCD 260.3 Pancreas Transplants", url: "https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=107" },
          { id: "ncd-260.5", title: "NCD 260.5 Intestinal and Multi-Visceral Transplantation", url: "https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=280" },
          { id: "ncd-260.9", title: "NCD 260.9 Heart Transplants", url: "https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=112" },
          { id: "cms-part-b-id", title: "Medicare Part B Immunosuppressive Drug Benefit", url: "https://www.cms.gov/partbid-provider" },
          { id: "cms-2552-10", title: "Form CMS-2552-10, Worksheet D-4", url: "https://www.cms.gov/files/document/r26p240f.pdf" },
          { id: "hrsa-optn", title: "HRSA OPTN policies and modernization", url: "https://www.hrsa.gov/optn/policies-bylaws/policies" },
        ],
        semantics: "Source metadata is authoritative context, not a coverage determination. Licensed CPT content, current grouper files, payer policy, and date-effective program records remain required where applicable.",
        autonomousClaimSubmission: false,
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to load transplant references");
    }
  });

  app.post("/api/transplant/documents/extract", upload.fields([{ name: "documents", maxCount: 8 }]), async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const files = (((req.files || {}) as Record<string, UploadedPgxFile[]>).documents || []);
      if (!files.length) throw new RouteError(400, "Upload at least one transplant document.");
      const documents = [] as Array<Record<string, unknown>>;
      for (const file of files) {
        const extracted = await extractTextFromPgxFile(file);
        const normalized = extracted.text.replace(/\s+/g, " ").trim();
        const lower = normalized.toLowerCase();
        const documentType = /operative report|procedure performed|implantation/.test(lower) ? "operative-report"
          : /donor|organ procurement|procurement organization/.test(lower) ? "donor-acquisition"
          : /discharge summary|discharge date/.test(lower) ? "discharge-summary"
          : /immunosuppress|tacrolimus|cyclosporine|mycophenolate/.test(lower) ? "pharmacy"
          : /invoice|cost report|standard acquisition charge|sac\b/.test(lower) ? "acquisition-cost"
          : "unclassified";
        let stored: Awaited<ReturnType<typeof uploadSpecialtyObject>> = null;
        try {
          stored = await uploadSpecialtyObject("transplant", createSpecialtyObjectKey("transplant", user.id), file.buffer, extracted.mimeType);
        } catch {
          // Extraction remains usable when encrypted object storage is temporarily unavailable.
        }
        documents.push({
          fileName: extracted.fileName,
          documentType,
          byteSize: file.buffer.length,
          sha256: extracted.validation.sha256,
          pageCount: extracted.validation.pageCount,
          extractionMethod: extracted.validation.extractionMethod,
          requiresManualReview: extracted.validation.requiresManualReview || !normalized,
          textPreview: normalized.slice(0, 600),
          objectKey: stored?.key || null,
          warnings: [extracted.warning, !normalized ? "No native text was available. Route image or scanned PDF pages through an approved OCR/vision service and verify every claim-bound field." : ""].filter(Boolean),
        });
      }
      res.json({
        success: true,
        documents,
        notice: "Classification and native text are preliminary evidence only. Diagnoses, complications, procedures, and coverage facts require source-page verification.",
        requiresHumanReview: true,
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to process transplant documents");
    }
  });

  app.post("/api/transplant/evaluate", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const candidate = req.body?.caseInput as TransplantCaseInput | undefined;
      if (!candidate?.serviceDate || !candidate.organ || !candidate.ageCategory || !candidate.payerMode || !candidate.purpose) {
        throw new RouteError(400, "Service date, organ, age category, payer, and episode purpose are required.");
      }
      const caseInput: TransplantCaseInput = {
        ...candidate,
        diagnosisCodes: Array.isArray(candidate.diagnosisCodes) ? candidate.diagnosisCodes : [],
        programApprovals: Array.isArray(candidate.programApprovals) ? candidate.programApprovals : [],
      };
      const evaluation = evaluateTransplantCase(caseInput);
      const professionalCodes = evaluation.claimLanes.flatMap((lane) => lane.lines)
        .filter((line) => line.codeSystem === "CPT" && line.code)
        .map((line) => String(line.code));
      const stateCode = String(req.body?.stateCode || "").trim().toUpperCase();
      if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) throw new RouteError(400, "Use a two-letter service state for CMS evidence.");
      const cmsEvidence = evaluation.diagnosisCodes.length && professionalCodes.length
        ? await getMcdBatchPairEvidence({ diagnosisCodes: evaluation.diagnosisCodes, procedureCodes: professionalCodes, stateCode: stateCode || undefined, limit: 20 })
        : { source: "cloudflare-mcd", pairs: [] };
      res.json({
        success: true,
        evaluation,
        cmsEvidence,
        evidenceSemantics: "MCD evidence is supporting context. An absent local match is not noncoverage, and the transplant program, NCD, manual, grouper, and payer pathways remain separate gates.",
        autonomousClaimSubmission: false,
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to build the transplant lifecycle worksheet");
    }
  });

  // ============ AMBULANCE SPECIALTY CODING ROUTES ============

  app.get("/api/ambulance/references", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      res.json({
        policyVersion: AMBULANCE_POLICY_VERSION,
        hcpcs: AMBULANCE_HCPCS,
        originDestination: ORIGIN_DESTINATION_LABELS,
        als2Procedures: ALS2_PROCEDURE_LABELS,
        modifiers: {
          GM: "Multiple patients on one ambulance trip",
          QL: "Patient pronounced dead after ambulance called",
          QM: "Service provided under arrangement by an institutional provider",
          QN: "Service furnished directly by an institutional provider",
        },
        placeOfService: { "41": "Ambulance - land", "42": "Ambulance - air or water" },
        sources: [
          { id: "cms-bp-100-02-ch10", title: "Medicare Benefit Policy Manual, Chapter 10", url: "https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/bp102c10.pdf" },
          { id: "cms-cp-100-04-ch15", title: "Medicare Claims Processing Manual, Chapter 15", url: "https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/downloads/clm104c15.pdf" },
          { id: "cms-afs-puf-2026", title: "CY 2026 Ambulance Fee Schedule PUF", url: "https://www.cms.gov/medicare/payment/fee-schedules/ambulance/ambulance-fee-schedule-public-use-files" },
          { id: "nemsis-v351", title: "NEMSIS v3.5.1 data dictionaries and XSD", url: "https://nemsis.org/technical-resources/version-3/version-3-data-dictionaries/" },
        ],
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to load ambulance references");
    }
  });

  app.post("/api/ambulance/nemsis/import", upload.single("nemsisFile"), async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const file = req.file as UploadedPgxFile | undefined;
      if (!file?.buffer) throw new RouteError(400, "Upload a NEMSIS EMSDataSet XML file.");
      const mime = String(file.mimetype || "").toLowerCase();
      if (!mime.includes("xml") && !String(file.originalname || "").toLowerCase().endsWith(".xml")) throw new RouteError(400, "Only NEMSIS XML files are accepted.");
      const imported = parseNemsisXml(file.buffer);
      res.json({ success: true, imported, autonomousClaimSubmission: false, requiresCoderApproval: true });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to import the NEMSIS record");
    }
  });

  app.post("/api/ambulance/evaluate", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const candidate = req.body?.caseInput as AmbulanceCaseInput | undefined;
      if (!candidate || !candidate.serviceDate || !candidate.payerMode || !candidate.entityType || !candidate.transportMode) {
        throw new RouteError(400, "A service date, payer mode, entity type, and transport mode are required.");
      }
      const caseInput: AmbulanceCaseInput = {
        ...candidate,
        loadedMiles: candidate.loadedMiles ?? 0,
        patientCount: Number(candidate.patientCount || 1),
        medications: Array.isArray(candidate.medications) ? candidate.medications : [],
        als2Procedures: Array.isArray(candidate.als2Procedures) ? candidate.als2Procedures : [],
        diagnosisCodes: Array.isArray(candidate.diagnosisCodes) ? candidate.diagnosisCodes : [],
      };
      const evaluation = evaluateAmbulanceCase(caseInput);
      const rate = req.body?.rate as AmbulanceRateInput | undefined;
      const paymentEstimate = estimateAmbulancePayment(caseInput, evaluation, rate);
      const stateCode = String(req.body?.stateCode || "").trim().toUpperCase();
      if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) throw new RouteError(400, "Use a two-letter service state for CMS evidence.");
      const procedureCodes = evaluation.lines.filter((line) => line.category === "base").map((line) => line.hcpcs);
      const cmsEvidence = evaluation.diagnosisCodes.length && procedureCodes.length
        ? await getMcdBatchPairEvidence({ diagnosisCodes: evaluation.diagnosisCodes, procedureCodes, stateCode: stateCode || undefined, limit: 20 })
        : { source: "cloudflare-mcd", pairs: [] };
      res.json({
        success: true,
        evaluation,
        paymentEstimate,
        cmsEvidence,
        evidenceSemantics: "MCD evidence is supporting coverage context. No matching local article is not a noncoverage determination; the national AFS and MAC claim-processing files remain controlling.",
        autonomousClaimSubmission: false,
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to build the ambulance coding worksheet");
    }
  });

  // ============ PGx SPECIALTY CODING ROUTES ============

  app.get("/api/pgx/knowledge/genes", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const rows = await db.select().from(pgxGenes).orderBy(asc(pgxGenes.symbol));
      res.json({
        genes: rows.length > 0
          ? rows
          : PGX_GENES.map((gene) => ({
              id: gene.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              symbol: gene,
              displayName: gene,
              defaultCpt: PGX_TIER_1_MAP[gene] || null,
              phenotypeNotes: "Starter PGx gene. Verify current CPIC/FDA and payer guidance.",
              sourceUrl: "https://cpicpgx.org/guidelines/",
            })),
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to load PGx genes");
    }
  });

  app.get("/api/pgx/knowledge/drugs", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const q = String(req.query.q || "").trim().toLowerCase();
      const rows = await db.select().from(pgxGeneDrugPairs).orderBy(asc(pgxGeneDrugPairs.drug));
      const sourceRows = rows.length > 0 ? rows : PGX_GENE_DRUG_PAIRS.map((pair) => ({
        id: `${pair.gene}-${pair.drug}`,
        gene: pair.gene,
        drug: pair.drug,
        drugClass: pair.drugClass,
        cpicLevel: pair.cpicLevel,
        cptCodes: pair.cptCodes,
        tableSource: pair.tableSource,
        recommendation: pair.recommendation,
        sourceUrl: pair.sourceUrl,
        createdAt: null,
        updatedAt: null,
      }));
      const filtered = q
        ? sourceRows.filter((row) => row.drug.toLowerCase().includes(q) || row.gene.toLowerCase().includes(q))
        : sourceRows;
      res.json({ drugs: filtered.slice(0, 80) });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to load PGx drugs");
    }
  });

  app.get("/api/pgx/knowledge/gene-drug/:gene/:drug", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const gene = req.params.gene.toUpperCase();
      const drug = req.params.drug.toLowerCase();
      const row = await db.query.pgxGeneDrugPairs.findFirst({
        where: and(eq(pgxGeneDrugPairs.gene, gene), eq(pgxGeneDrugPairs.drug, drug)),
      });
      const fallback = PGX_GENE_DRUG_PAIRS.find((pair) => pair.gene === gene && pair.drug === drug);
      if (!row && !fallback) return res.status(404).json({ message: "Gene-drug pair not found" });
      res.json(row || fallback);
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to load gene-drug pair");
    }
  });

  app.get("/api/pgx/knowledge/cms-groups", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const cpt = String(req.query.cpt || "").trim().toUpperCase();
      const rows = await db.select().from(pgxCmsGroups).orderBy(asc(pgxCmsGroups.groupNumber), asc(pgxCmsGroups.groupType), asc(pgxCmsGroups.code));
      const sourceRows = rows.length > 0 ? rows : PGX_CMS_GROUPS.map((group) => ({
        id: `${group.articleId}-${group.groupNumber}-${group.groupType}-${group.code}`,
        articleId: group.articleId,
        groupNumber: group.groupNumber,
        groupType: group.groupType,
        code: group.code,
        description: group.description || null,
        sourceUrl: "https://www.cms.gov/medicare-coverage-database/",
        updatedAt: null,
      }));
      const groupsWithCpt = cpt
        ? new Set(sourceRows.filter((group) => group.groupType === "cpt" && group.code === cpt).map((group) => group.groupNumber))
        : null;
      res.json({
        groups: groupsWithCpt
          ? sourceRows.filter((group) => groupsWithCpt.has(group.groupNumber))
          : sourceRows,
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to load PGx CMS groups");
    }
  });

  app.post("/api/burn/extract", upload.fields([
    { name: "clinicalNote", maxCount: 1 },
    { name: "operativeReport", maxCount: 1 },
    { name: "pageImages", maxCount: 24 },
  ]), async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const files = (req.files || {}) as Record<string, UploadedPgxFile[]>;
      const sourceFiles = [...(files.clinicalNote || []), ...(files.operativeReport || [])];
      if (!sourceFiles.length) throw new RouteError(400, "Upload a clinical note or operative report.");
      const warnings: string[] = [];
      const textParts = [String(req.body?.clinicalText || "").trim(), String(req.body?.operativeText || "").trim()].filter(Boolean);
      const r2Objects: Array<{ key: string; url: string; contentType?: string }> = [];
      for (const file of sourceFiles) {
        if ((file.size || 0) > 20 * 1024 * 1024) throw new RouteError(400, "Burn documents must be 20MB or smaller.");
        const extracted = await extractTextFromPgxFile(file);
        if (extracted.text) textParts.push(extracted.text);
        if (extracted.warning) warnings.push(`${extracted.fileName}: ${extracted.warning}`);
        try {
          const stored = await uploadPgxObject(createPgxObjectKey(user.id), file.buffer, extracted.mimeType || "application/octet-stream");
          if (stored) r2Objects.push({ key: stored.key, url: stored.url, contentType: extracted.mimeType });
        } catch {
          warnings.push(`${extracted.fileName}: secure storage was unavailable; OCR continued without an R2 copy.`);
        }
      }

      const emptyVision: BurnDocumentUnderstandingResult = { used: false, diagnoses: [], regions: [], procedures: [], warnings: [] };
      const [clinicalVision, operativeVision] = await Promise.all([
        files.clinicalNote?.[0] ? understandBurnDocument(files.clinicalNote[0]) : Promise.resolve(emptyVision),
        files.operativeReport?.[0] ? understandBurnDocument(files.operativeReport[0]) : Promise.resolve(emptyVision),
      ]);
      const pageResults: BurnDocumentUnderstandingResult[] = [];
      const pageFiles = files.pageImages || [];
      for (let index = 0; index < pageFiles.length; index += 3) {
        pageResults.push(...await Promise.all(pageFiles.slice(index, index + 3).map((file) => {
          const sourcePage = Number(file.originalname?.match(/burn-page-(\d+)/i)?.[1] || 1);
          return understandBurnDocument(file, { sourcePage });
        })));
      }
      const results = [clinicalVision, operativeVision, ...pageResults];
      warnings.push(...results.flatMap((result) => result.warnings));
      const best = <T>(rows: T[], key: (row: T) => string, score: (row: T) => number) => Array.from(new Map(
        [...rows].sort((left, right) => score(right) - score(left)).map((row) => [key(row), row]),
      ).values());
      const diagnoses = best(results.flatMap((row) => row.diagnoses), (row) => row.code, (row) => row.confidence);
      const regions = best(results.flatMap((row) => row.regions), (row) => `${row.regionId}-${row.burnDepth}`, (row) => row.confidence);
      const procedures = best(results.flatMap((row) => row.procedures), (row) => row.type, (row) => row.confidence + (row.performed ? 1 : 0));
      const noteName = clinicalVision.patientName || pageResults.find((row) => row.patientName)?.patientName;
      const opName = operativeVision.patientName;
      const patientMatch = await matchPgxPatient(noteName, opName);
      if (patientMatch.databaseStatus === "document_mismatch") warnings.push("Patient names differ between the clinical note and operative report. Stop and verify the files.");
      if (patientMatch.databaseStatus === "not_found") warnings.push("The extracted patient name was not found in the patient database; verify spelling before billing.");
      if (!results.some((row) => row.used)) warnings.push("Handwriting-aware visual OCR did not run; all extracted fields require manual source verification.");
      const documentedTotalTbsa = results.map((row) => row.documentedTotalTbsa).find((value) => value !== undefined);
      const documentedThirdDegreeTbsa = results.map((row) => row.documentedThirdDegreeTbsa).find((value) => value !== undefined);
      const product = results.find((row) => row.product)?.product;
      res.json({
        success: true,
        extracted: {
          patientName: patientMatch.databasePatient?.name || noteName || opName,
          patientAge: results.map((row) => row.patientAge).find((value) => value !== undefined),
          serviceDate: results.map((row) => row.serviceDate).find(Boolean),
          diagnoses, regions, procedures, documentedTotalTbsa, documentedThirdDegreeTbsa, product,
          patientMatch, warnings: Array.from(new Set(warnings.filter(Boolean))),
          nativeTextAvailable: textParts.some((text) => text.length > 40),
        },
        r2: { configured: isPgxR2Configured(), objects: r2Objects },
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to extract burn documents");
    }
  });

  app.post("/api/burn/analyze", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const candidate = req.body?.caseInput as BurnCaseInput | undefined;
      if (!candidate || !Number.isFinite(candidate.patientAge) || !Array.isArray(candidate.regions) || !candidate.service) {
        throw new RouteError(400, "A complete burn case review is required.");
      }
      const regions: BurnRegionInput[] = candidate.regions.map((row) => ({ regionId: row.regionId, surface: row.surface, burnDepth: Number(row.burnDepth) as any, percentBurned: Number(row.percentBurned) }));
      const service: BurnServiceInput = { ...candidate.service, performed: candidate.service.performed === true };
      const caseInput: BurnCaseInput = { ...candidate, patientAge: Number(candidate.patientAge), regions, service };
      const analysis = analyzeBurnCase(caseInput);
      const procedureCodes = analysis.serviceLines.map((row) => row.code.trim().toUpperCase()).filter((code) => /^[A-Z]?\d{4,5}$/.test(code));
      const diagnosisCodes = Array.from(new Set([
        ...(Array.isArray(req.body?.diagnosisCodes) ? req.body.diagnosisCodes : []),
        ...(analysis.extentCode ? [analysis.extentCode] : []),
      ].map((code) => String(code || "").trim().toUpperCase()).filter((code) => /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code))));
      const stateCode = String(req.body?.stateCode || "").trim().toUpperCase();
      if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) throw new RouteError(400, "Use a two-letter service state for MAC evidence.");
      const catalog = await Promise.all(procedureCodes.map(async (code) => ({
        code,
        articles: await getMcdCodeCoverageRows(code, { kind: "article", stateCode: stateCode || undefined, limit: 100 }),
      })));
      const pairEvidence = diagnosisCodes.length && procedureCodes.length ? await getMcdBatchPairEvidence({ diagnosisCodes, procedureCodes, stateCode: stateCode || undefined, limit: 20 }) : { source: "cloudflare-mcd", pairs: [] };
      res.json({ success: true, analysis, cmsEvidence: { pairEvidence, catalog }, evidenceSemantics: "not_found means no matching local CMS article evidence was found; it does not mean noncovered" });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to build the burn coding worksheet");
    }
  });

  app.post("/api/pgx/extract", upload.fields([
    { name: "labReport", maxCount: 1 },
    { name: "requisition", maxCount: 1 },
    { name: "diagnosisPageImages", maxCount: 12 },
  ]), async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const files = (req.files || {}) as Record<string, UploadedPgxFile[]>;
      const labTextParts = [String(req.body?.labText || "").trim()].filter(Boolean);
      const requisitionTextParts = [String(req.body?.requisitionText || "").trim()].filter(Boolean);
      const r2Objects: Array<{ key: string; url: string; contentType?: string }> = [];
      const warnings: string[] = [];

      for (const [uploadedFiles, destination] of [
        [files.labReport || [], labTextParts],
        [files.requisition || [], requisitionTextParts],
      ] as Array<[UploadedPgxFile[], string[]]>) {
        for (const file of uploadedFiles) {
          if ((file.size || 0) > 20 * 1024 * 1024) {
            throw new RouteError(400, "PGx files must be 20MB or smaller.");
          }

          const extracted = await extractTextFromPgxFile(file);
          if (extracted.warning) warnings.push(`${extracted.fileName}: ${extracted.warning}`);
          if (extracted.text) destination.push(extracted.text);

          try {
            const uploadResult = await uploadPgxObject(
              createPgxObjectKey(user.id),
              file.buffer,
              extracted.mimeType || "application/octet-stream",
            );
            if (uploadResult) r2Objects.push({ key: uploadResult.key, url: uploadResult.url, contentType: extracted.mimeType });
          } catch {
            warnings.push(`${extracted.fileName}: secure storage was temporarily unavailable; extraction continued without an R2 copy.`);
          }
        }
      }

      const emptyVision = { used: false, patientName: undefined as string | undefined, selections: [], medications: [], genes: [], warnings: [] };
      const readDiagnosisPages = async () => {
        const pageFiles = files.diagnosisPageImages || [];
        const results: Awaited<ReturnType<typeof understandPgxDocument>>[] = [];
        for (let index = 0; index < pageFiles.length; index += 3) {
          results.push(...await Promise.all(pageFiles.slice(index, index + 3).map((file) => {
            const sourcePage = Number(file.originalname?.match(/diagnosis-page-(\d+)/i)?.[1] || 1);
            return understandPgxDocument(file, "requisition", { sourcePage });
          })));
        }
        return results;
      };
      const [labVision, wholeRequisitionVision, pageVisionResults] = await Promise.all([
        files.labReport?.[0] ? understandPgxDocument(files.labReport[0], "lab") : Promise.resolve(emptyVision),
        files.requisition?.[0] ? understandPgxDocument(files.requisition[0], "requisition") : Promise.resolve(emptyVision),
        readDiagnosisPages(),
      ]);
      const requisitionVision = {
        used: wholeRequisitionVision.used || pageVisionResults.some((result) => result.used),
        patientName: wholeRequisitionVision.patientName || pageVisionResults.find((result) => result.patientName)?.patientName,
        selections: Array.from(new Map(
          [...wholeRequisitionVision.selections, ...pageVisionResults.flatMap((result) => result.selections)]
            .sort((left, right) => right.confidence - left.confidence)
            .map((selection) => [selection.code, selection]),
        ).values()),
        medications: Array.from(new Map(
          [...wholeRequisitionVision.medications, ...pageVisionResults.flatMap((result) => result.medications)]
            .sort((left, right) => right.confidence - left.confidence)
            .map((medication) => [medication.name.toLowerCase(), medication]),
        ).values()),
        genes: wholeRequisitionVision.genes,
        warnings: [...wholeRequisitionVision.warnings, ...pageVisionResults.flatMap((result) => result.warnings)],
      };
      warnings.push(...labVision.warnings, ...requisitionVision.warnings);

      const combinedText = [
        labTextParts.length ? `--- CODICAL LAB REPORT START ---\n${labTextParts.join("\n\n")}\n--- CODICAL LAB REPORT END ---` : "",
        requisitionTextParts.length ? `--- CODICAL REQUISITION START ---\n${requisitionTextParts.join("\n\n")}\n--- CODICAL REQUISITION END ---` : "",
      ].filter(Boolean).join("\n\n").trim();
      if (combinedText.length < 20) {
        throw new RouteError(400, "Add readable PGx lab text or upload a TXT/PDF document.");
      }

      const extracted = extractPgxDataFromText(combinedText);
      if (requisitionVision.selections.length > 0) {
        const acceptedVisionCodes = requisitionVision.selections
          .filter((selection) => selection.confidence >= 0.8)
          .map((selection) => selection.code);
        extracted.diagnosisSelections = requisitionVision.selections;
        extracted.diagnosisCodes = Array.from(new Set([...acceptedVisionCodes, ...extracted.diagnosisCodes]));
        extracted.warnings = extracted.warnings.filter((warning) => !warning.startsWith("No source-documented ICD-10-CM code"));
      }
      if (labVision.genes.length > 0) {
        const genes = new Map(extracted.genes.map((gene) => [gene.gene, gene]));
        for (const gene of labVision.genes) genes.set(gene.gene, gene);
        extracted.genes = Array.from(genes.values());
        extracted.panel.geneCount = extracted.genes.length;
      }
      if (requisitionVision.medications.length > 0) {
        const medications = new Map(extracted.medications.map((medication) => [medication.name.toLowerCase(), medication]));
        for (const medication of requisitionVision.medications.filter((item) => item.confidence >= .72)) {
          medications.set(medication.name.toLowerCase(), { name: medication.name, source: "detected" });
        }
        extracted.medications = Array.from(medications.values());
        extracted.warnings = extracted.warnings.filter((warning) => !warning.startsWith("No active medication"));
      }
      const labDocumentName = labVision.patientName || (labTextParts.length ? extractPgxDataFromText(labTextParts.join("\n\n")).patient.name : undefined);
      const requisitionDocumentName = requisitionVision.patientName || (requisitionTextParts.length ? extractPgxDataFromText(requisitionTextParts.join("\n\n")).patient.name : undefined);
      const patientMatch = await matchPgxPatient(labDocumentName, requisitionDocumentName);
      extracted.patient = { name: patientMatch.databasePatient?.name || labDocumentName || requisitionDocumentName || extracted.patient.name };
      extracted.patientMatch = patientMatch;
      if (patientMatch.databaseStatus === "document_mismatch") warnings.push("The patient names on the laboratory report and requisition do not match. Stop and verify the documents.");
      if (patientMatch.databaseStatus === "not_found") warnings.push("The extracted patient name was not found in the patient database; verify spelling or add the patient before final billing.");
      extracted.warnings.push(...warnings);
      res.json({
        success: true,
        extracted,
        r2: {
          configured: isPgxR2Configured(),
          objects: r2Objects,
        },
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to extract PGx data");
    }
  });

  app.post("/api/pgx/analyze", async (req, res) => {
    try {
      await getAuthenticatedChatUser(req);
      const extracted = req.body?.extracted;
      if (!extracted || !Array.isArray(extracted.genes)) {
        throw new RouteError(400, "extracted PGx data is required.");
      }

      const pairRows = await db.select().from(pgxGeneDrugPairs);
      const stateCode = String(req.body?.stateCode || "").trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(stateCode)) throw new RouteError(400, "A two-letter Medicare service state is required for MAC-specific coverage review.");
      const geneDrugPairs = pairRows.map((row) => ({ gene: row.geneSymbol || row.gene, drug: row.drugName || row.drug, drugClass: row.drugClass || "", cpicLevel: row.cpicLevel as "A" | "B" | "C" | "D", cptCodes: row.cptCodes || [], tableSource: String(row.tableSource).toUpperCase().includes("FDA") ? "CPIC/FDA" as const : "CPIC" as const, recommendation: row.recommendation, sourceUrl: row.sourceUrl || "https://cpicpgx.org/guidelines/" }));
      const analysisInput = {
        extracted,
        primaryIcd10: req.body?.primaryIcd10,
        diagnosisCodes: Array.isArray(req.body?.diagnosisCodes)
          ? req.body.diagnosisCodes.map((code: unknown) => String(code))
          : undefined,
        drugNames: parseManualDrugNames(req.body?.drugNames),
        payerAcceptsPanel: req.body?.payerAcceptsPanel !== false,
        stateCode,
        cmsGroups: [] as PgxCmsGroup[],
        geneDrugPairs,
      };
      const preliminary = analyzePgxCoding(analysisInput);
      const mcdEvidence = await getMcdBatchPairEvidence({
        diagnosisCodes: preliminary.icd10.map((row) => row.code),
        procedureCodes: preliminary.cptSelection.codes.map((row) => row.code),
        stateCode,
        limit: 30,
      });
      const cmsGroups: PgxCmsGroup[] = [];
      const cmsDrugEvidence: PgxCmsDrugEvidence[] = [];
      for (const pair of mcdEvidence?.pairs || []) {
        for (const evidence of pair.evidence || []) {
          if (evidence.coverageStatus !== "covered" || !/pharmacogenom/i.test(evidence.title)) continue;
          const articleId = evidence.displayId?.startsWith("A") ? evidence.displayId : `A${evidence.articleId}`;
          const groupNumber = Number(evidence.groupNumber);
          if (!Number.isInteger(groupNumber)) continue;
          cmsGroups.push(
            { articleId, groupNumber, groupType: "cpt", code: pair.procedureCode },
            { articleId, groupNumber, groupType: "icd10", code: pair.icdCode },
          );
          for (const association of evidence.geneDrugAssociations || []) {
            cmsDrugEvidence.push({
              articleId,
              gene: association.gene.toUpperCase(),
              drug: association.drug.toLowerCase(),
              cptCodes: association.cptCodes,
              guidance: association.guidance,
              intendedUse: association.intendedUse,
            });
          }
        }
      }
      const uniqueCmsDrugEvidence = Array.from(new Map(cmsDrugEvidence.map((row) => [
        `${row.articleId}:${row.gene}:${row.drug}:${row.cptCodes.join(",")}`,
        row,
      ])).values());
      const analysis = analyzePgxCoding({ ...analysisInput, cmsGroups, cmsDrugEvidence: uniqueCmsDrugEvidence });
      if (!mcdEvidence) analysis.extracted.warnings.push("The current CMS/MAC coverage service was unavailable; all CPT/diagnosis relationships remain in review.");

      res.json({ success: true, analysis });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to analyze PGx data");
    }
  });

  app.post("/api/pgx/generate-claim", async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const analysis = req.body?.analysis as PgxAnalysisResult | undefined;
      if (!analysis?.cptSelection || !analysis?.extracted) {
        throw new RouteError(400, "analysis is required.");
      }
      if (!analysis.billingWorksheet || !Array.isArray(analysis.billingWorksheet.serviceLines) || !Array.isArray(analysis.billingWorksheet.evidenceRows)) {
        throw new RouteError(409, "This analysis uses an older PGx claim format. Rebuild the billing worksheet with the current engine, then download it again.");
      }

      const claimJson = buildPgxClaimPreview(analysis);
      const pdf = await generatePgxPdfBuffer(analysis, claimJson);
      let uploadResult = null;
      try {
        uploadResult = await uploadPgxObject(
          createPgxObjectKey(user.id),
          pdf,
          "application/pdf",
        );
      } catch {
        // R2 is optional for claim generation. The inline PDF remains downloadable.
      }

      res.json({
        success: true,
        claimJson,
        claimType: "PGX_BILLING_WORKSHEET",
        downloadUrl: uploadResult?.url || null,
        filename: "PGx_Billing_Worksheet.pdf",
        pdfBase64: pdf.toString("base64"),
      });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to generate PGx claim");
    }
  });

  app.get("/api/pgx/analyses", async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);

      const rows = await db.select()
        .from(pgxAnalyses)
        .where(eq(pgxAnalyses.userId, user.id))
        .orderBy(desc(pgxAnalyses.createdAt))
        .limit(30);
      res.json({ analyses: rows });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to list PGx analyses");
    }
  });

  app.post("/api/pgx/analyses", async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const analysis = req.body?.analysis as PgxAnalysisResult | undefined;
      if (!analysis?.extracted) throw new RouteError(400, "analysis is required.");

      const claimJson = req.body?.claimJson || buildPgxClaimPreview(analysis);
      const [created] = await db.insert(pgxAnalyses)
        .values({
          id: randomUUID(),
          userId: user.id,
          patientName: analysis.extracted.patient?.name || null,
          labName: analysis.extracted.lab?.name || null,
          primaryIcd10: analysis.icd10?.[0]?.code || null,
          drugNames: analysis.extracted.medications?.map((medication) => medication.name) || [],
          extractedData: analysis.extracted as any,
          analysisResult: analysis as any,
          claimJson: claimJson as any,
          claimNarrative: analysis.narrative,
          r2Objects: req.body?.r2Objects || [],
        })
        .returning();

      res.status(201).json({ success: true, analysis: created });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to save PGx analysis");
    }
  });

  app.get("/api/pgx/analyses/:id", async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const row = await db.query.pgxAnalyses.findFirst({
        where: and(eq(pgxAnalyses.id, req.params.id), eq(pgxAnalyses.userId, user.id)),
      });
      if (!row) return res.status(404).json({ message: "PGx analysis not found" });
      res.json(row);
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to load PGx analysis");
    }
  });

  app.put("/api/pgx/analyses/:id", async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const [updated] = await db.update(pgxAnalyses)
        .set({
          analysisResult: req.body?.analysisResult || req.body?.analysis || {},
          claimJson: req.body?.claimJson || {},
          claimNarrative: req.body?.claimNarrative || req.body?.analysis?.narrative || null,
          updatedAt: new Date(),
        })
        .where(and(eq(pgxAnalyses.id, req.params.id), eq(pgxAnalyses.userId, user.id)))
        .returning();
      if (!updated) return res.status(404).json({ message: "PGx analysis not found" });
      res.json({ success: true, analysis: updated });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to update PGx analysis");
    }
  });

  app.delete("/api/pgx/analyses/:id", async (req, res) => {
    try {
      const user = await getAuthenticatedChatUser(req);
      const deleted = await db.delete(pgxAnalyses)
        .where(and(eq(pgxAnalyses.id, req.params.id), eq(pgxAnalyses.userId, user.id)))
        .returning({ id: pgxAnalyses.id });
      if (deleted.length === 0) return res.status(404).json({ message: "PGx analysis not found" });
      res.json({ success: true });
    } catch (error: any) {
      return sendRouteError(res, error, "Failed to delete PGx analysis");
    }
  });

  app.post("/api/admin/sync-cms-pgx", async (req, res) => {
    const user = await getAuthenticatedChatUser(req);
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Administrator access required." });
    }
    res.json({
      success: true,
      status: "starter-seed",
      message: "PGx billing analysis uses the current Cloudflare CMS MCD release with active-article, MAC/state, CPT/ICD-group, and article gene/drug evidence checks.",
    });
  });

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
        return res.status(503).json({ message: "Medicare coverage evidence is temporarily unavailable." });
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
        return res.status(503).json({ message: "Medicare coverage evidence is temporarily unavailable." });
      }

      return res.json(result);
    } catch (error: any) {
      res.status(502).json({ message: error.message });
    }
  });

  app.get("/api/coverage/crosswalk", async (req, res) => {
    try {
      const result = await getMcdCrosswalk({
        direction: req.query.direction,
        code: req.query.code,
        limit: req.query.limit,
        letter: req.query.letter,
        status: req.query.status,
      });

      if (result.source === "unavailable") {
        return res.status(503).json({ message: "Medicare crosswalk index is temporarily unavailable." });
      }

      return res.json(result);
    } catch (error: any) {
      res.status(error?.statusCode || 502).json({ message: error.message || "Crosswalk lookup failed" });
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

      if (mcdRows) {
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

  // Code details hub - single endpoint for all code data
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
        console.warn("Coverage cache code lookup failed; falling back to CMS Coverage API:", error?.message || error);
      }

      if (loadedCoverageFromMcd) {
        try {
          results.coverageIntelligence = await getMcdCodeCoverageIntelligence(code, { limit: 8 });
        } catch (error: any) {
          console.warn("Coverage cache lookup failed:", error?.message || error);
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
  
        const prompt = `You are an assistant inside Codical Health Team Chat, a professional healthcare team chat.
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
{"summary":"brief summary","cpt_codes":[{"code":"XXXXX","description":"desc","units":1,"modifiers":[],"rationale":"why"}],"icd10_codes":[{"code":"X00.0","description":"desc","type":"primary","rationale":"why"}],"hcpcs_codes":[],"pos_code":{"code":"11","description":"Office"},"revenue_codes":[],"billing_notes":"notes","confidence":"high","disclaimer":"Draft coding suggestions. Verify with a certified coder before billing."}`;
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

      if (!requestedProfile.supabaseId && !requestedProfile.email) {
        return res.status(400).json({ message: "Supabase user id or email is required" });
      }

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
      let aiText = "I'm your coding assistant. How can I help you today?";

      if (apiKey) {
        const prompt = `You are a coding assistant inside Codical Health Team Chat.
Respond conversationally, helpfully, and professionally.
Keep responses concise unless the user asks for more detail.

GUARDRAIL: You are specialized in medical coding and healthcare billing.
If the conversation or any shared files are entirely unrelated to healthcare, clinical documentation, or medical billing, politely state:
"I am focused on assisting with medical coding and healthcare billing. I'm unable to process this request as it appears to be unrelated to these specialized fields."

Conversation transcript (with file contents):
${transcript.slice(0, 16000)}

Reply as the coding assistant to the latest user message only. No markdown fencing.`;

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
            const prompt = `You are a coding assistant inside Codical Health Team Chat.
  Respond conversationally, helpfully, and professionally.
  Keep responses concise unless the user asks for more detail.
  
  GUARDRAIL: You are specialized in medical coding and healthcare billing.
  If the conversation or any shared files are entirely unrelated to healthcare, clinical documentation, or medical billing, politely state:
  "I am focused on assisting with medical coding and healthcare billing. I'm unable to process this request as it appears to be unrelated to these specialized fields."

  Conversation transcript (with file contents):
  ${transcript.slice(0, 16000)}
  
  Reply as the coding assistant to the latest user message only. No markdown fencing.`;
  
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



