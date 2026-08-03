import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const ALLOWED_STORAGE_ENVIRONMENTS = new Set(["development", "staging", "production"]);

function getPgxStorageEnvironment() {
  const value = String(process.env.PGX_STORAGE_ENV || "").trim().toLowerCase();
  return ALLOWED_STORAGE_ENVIRONMENTS.has(value) ? value : null;
}

function safePathSegment(value: string | number) {
  const normalized = String(value).trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || null;
}

export function createPgxObjectKey(userId: string | number, analysisId = randomUUID(), objectId = randomUUID()) {
  const environment = getPgxStorageEnvironment();
  const tenantId = safePathSegment(process.env.PGX_DEFAULT_TENANT_ID || "");
  const safeUserId = safePathSegment(userId);
  const safeAnalysisId = safePathSegment(analysisId);
  const safeObjectId = safePathSegment(objectId);
  if (!environment || !tenantId || !safeUserId || !safeAnalysisId || !safeObjectId) return null;
  return `pgx/${environment}/${tenantId}/${safeUserId}/${safeAnalysisId}/${safeObjectId}`;
}

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT
    || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

export function isPgxR2Configured() {
  return Boolean(
    getR2Client()
    && process.env.R2_BUCKET_PGX
    && getPgxStorageEnvironment()
    && safePathSegment(process.env.PGX_DEFAULT_TENANT_ID || ""),
  );
}

export function getPgxBucketName() {
  return process.env.R2_BUCKET_PGX || null;
}

export function isPgxObjectKeyOwnedBy(key: string, userId: string | number) {
  const environment = getPgxStorageEnvironment();
  const tenantId = safePathSegment(process.env.PGX_DEFAULT_TENANT_ID || "");
  const safeUserId = safePathSegment(userId);
  if (!environment || !tenantId || !safeUserId || key.includes("..") || key.includes("\\")) return false;
  return key.startsWith(`pgx/${environment}/${tenantId}/${safeUserId}/`);
}

export async function uploadPgxObject(
  key: string | null,
  body: Buffer,
  contentType = "application/octet-stream",
) {
  const client = getR2Client();
  const bucket = getPgxBucketName();
  if (!client || !bucket || !key || !isPgxR2Configured()) return null;

  const requiredPrefix = `pgx/${getPgxStorageEnvironment()}/${safePathSegment(process.env.PGX_DEFAULT_TENANT_ID || "")}/`;
  if (!key.startsWith(requiredPrefix) || key.includes("..") || key.includes("\\")) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
      { abortSignal: controller.signal },
    );
  } finally {
    clearTimeout(timeout);
  }

  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });

  return {
    bucket,
    key,
    url,
    expiresInSeconds: 300,
  };
}

export async function getPgxObject(key: string, userId: string | number) {
  const client = getR2Client();
  const bucket = getPgxBucketName();
  if (!client || !bucket || !isPgxObjectKeyOwnedBy(key, userId)) return null;

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  return response.Body || null;
}

export async function deletePgxObject(key: string, userId: string | number) {
  const client = getR2Client();
  const bucket = getPgxBucketName();
  if (!client || !bucket || !isPgxObjectKeyOwnedBy(key, userId)) return false;
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return true;
}
