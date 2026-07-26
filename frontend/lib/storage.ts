import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Neon Object Storage (S3-compatible, branch-scoped, via the AWS SDK). Unlike
// the old Python backend, there is no local-disk fallback — Vercel functions
// have no persistent filesystem, so this is required in every environment.
// Credentials are separate from the Postgres connection string — generate
// them under the branch's "Credentials" page (APP BACKEND section) in the
// Neon console, or via `neon env pull`.

const PRESIGNED_URL_EXPIRY = 3600;

export class StorageNotConfiguredError extends Error {}

function client(): S3Client {
  const endpoint = process.env.NEON_STORAGE_ENDPOINT;
  const accessKeyId = process.env.NEON_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.NEON_STORAGE_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new StorageNotConfiguredError("Neon Object Storage credentials are not configured");
  }
  return new S3Client({
    region: process.env.NEON_STORAGE_REGION || "us-east-2",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // Neon Object Storage uses path-style addressing (bucket in the URL
    // path), unlike AWS S3's default virtual-hosted-style.
    forcePathStyle: true,
  });
}

function bucket(): string {
  return process.env.NEON_STORAGE_BUCKET_NAME || "databrief";
}

export async function presignedUploadUrl(
  objectKey: string,
  contentType: string,
  expiry: number = PRESIGNED_URL_EXPIRY
): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket(), Key: objectKey, ContentType: contentType });
  return getSignedUrl(client(), command, { expiresIn: expiry });
}

export async function presignedDownloadUrl(
  objectKey: string,
  filename: string = "",
  expiry: number = PRESIGNED_URL_EXPIRY
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: objectKey,
    ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
  });
  return getSignedUrl(client(), command, { expiresIn: expiry });
}

export async function uploadBytes(
  objectKey: string,
  data: Buffer | Uint8Array,
  contentType: string = "application/octet-stream"
): Promise<void> {
  await client().send(new PutObjectCommand({ Bucket: bucket(), Key: objectKey, Body: data, ContentType: contentType }));
}

export async function downloadBytes(objectKey: string): Promise<Buffer> {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: objectKey }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty response body for object ${objectKey}`);
  return Buffer.from(bytes);
}

export async function deleteObject(objectKey: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: objectKey }));
}

export async function deletePrefix(prefix: string): Promise<void> {
  const s3 = client();
  let continuationToken: string | undefined;
  do {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: continuationToken })
    );
    const objects = (list.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: objects } }));
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
}
