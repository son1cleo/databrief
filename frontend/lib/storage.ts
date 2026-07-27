import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";

// Neon Object Storage (S3-compatible, branch-scoped, via the AWS SDK). Unlike
// the old Python backend, there is no local-disk fallback — Vercel functions
// have no persistent filesystem, so this is required in every environment.
// Credentials are separate from the Postgres connection string — generate
// them under the branch's "Credentials" page (APP BACKEND section) in the
// Neon console, or via `neon env pull`.

const PRESIGNED_URL_EXPIRY = 3600;

// The AWS SDK v3's default NodeHttpHandler has NO request timeout (0 =
// unlimited) -- if a connection stalls mid-transfer, `client().send(...)`
// hangs forever instead of throwing, which left uploads stuck on "Uploading…"
// with no error surfaced anywhere. These bound every S3 call so a stalled
// connection fails fast and predictably instead of hanging the request.
const CONNECTION_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 60_000;
// socketTimeout above only fires on total inactivity -- a connection that
// keeps trickling a few bytes at a time never goes quiet long enough to trip
// it, yet is still too slow to ever finish. This is a hard wall-clock cap on
// top of it so a slow-but-technically-alive transfer can't hang forever either.
const TRANSFER_DEADLINE_MS = 300_000;
// A HEAD carries no body, so it should only ever cost a round trip -- it
// doesn't need the full transfer budget.
const METADATA_DEADLINE_MS = 15_000;

// This storage throttles each connection individually rather than capping
// total bandwidth: measured against one 17MB object, a single stream sustains
// ~0.03 MB/s while 16 concurrent ranged reads reach ~0.25 MB/s (~7.7x). So a
// whole-object read is issued as parallel byte ranges instead of one stream,
// which is the difference between ~8 minutes and ~70 seconds for that file.
const DOWNLOAD_CHUNK_BYTES = 1024 * 1024;
const DOWNLOAD_CONCURRENCY = 16;

export class StorageNotConfiguredError extends Error {}
export class StorageTimeoutError extends Error {}

/** Runs an S3 call under a hard wall-clock deadline, independent of the
 * per-socket inactivity timeout configured on the client. Rethrows as
 * StorageTimeoutError specifically when our own deadline fired, so callers
 * can treat it as retryable instead of a generic/permanent failure. */
async function withDeadline<T>(
  op: (signal: AbortSignal) => Promise<T>,
  label: string,
  deadlineMs: number = TRANSFER_DEADLINE_MS
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deadlineMs);
  try {
    return await op(controller.signal);
  } catch (err) {
    if (timedOut) throw new StorageTimeoutError(`Timed out ${label} after ${deadlineMs}ms`);
    throw err;
  } finally {
    clearTimeout(deadline);
  }
}

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
    maxAttempts: 2,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    }),
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
  await withDeadline(
    (abortSignal) =>
      client().send(
        new PutObjectCommand({ Bucket: bucket(), Key: objectKey, Body: data, ContentType: contentType }),
        { abortSignal }
      ),
    `uploading ${objectKey}`
  );
}

/** Object size without transferring the body. Lets callers enforce size
 * limits and decide how much to read before paying for a full download --
 * reads from this storage run at a small fraction of write speed, so pulling
 * 16MB back just to measure it is prohibitively slow. */
export async function objectSize(objectKey: string): Promise<number> {
  const res = await withDeadline(
    (abortSignal) => client().send(new HeadObjectCommand({ Bucket: bucket(), Key: objectKey }), { abortSignal }),
    `reading metadata for ${objectKey}`,
    METADATA_DEADLINE_MS
  );
  return res.ContentLength ?? 0;
}

/** Fetches only the first `maxBytes` of an object via an HTTP Range request.
 * Used for previews of large line-oriented files, where the head of the file
 * already contains everything shown -- the caller is responsible for knowing
 * the result may be cut mid-record. */
export async function downloadRange(objectKey: string, maxBytes: number): Promise<Buffer> {
  return withDeadline(async (abortSignal) => {
    const res = await client().send(
      new GetObjectCommand({ Bucket: bucket(), Key: objectKey, Range: `bytes=0-${maxBytes - 1}` }),
      { abortSignal }
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty response body for object ${objectKey}`);
    return Buffer.from(bytes);
  }, `downloading first ${maxBytes} bytes of ${objectKey}`);
}

async function getRange(
  objectKey: string,
  start: number,
  end: number,
  abortSignal: AbortSignal
): Promise<{ buffer: Buffer; contentRange?: string }> {
  const res = await client().send(
    new GetObjectCommand({ Bucket: bucket(), Key: objectKey, Range: `bytes=${start}-${end}` }),
    { abortSignal }
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty response body for object ${objectKey}`);
  return { buffer: Buffer.from(bytes), contentRange: res.ContentRange };
}

/** Total object size out of a `Content-Range: bytes 0-1048575/17201137`
 * header, or null if the response wasn't a partial one. */
function totalSizeFromContentRange(contentRange?: string): number | null {
  const match = contentRange?.match(/\/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

export async function downloadBytes(objectKey: string, deadlineMs?: number): Promise<Buffer> {
  return withDeadline(
    async (abortSignal) => {
      // The first ranged read doubles as the size probe -- its Content-Range
      // reports the total, so no extra HEAD round trip is needed. A server
      // that ignores Range simply returns the whole body here, which is
      // already the correct result.
      const first = await getRange(objectKey, 0, DOWNLOAD_CHUNK_BYTES - 1, abortSignal);
      const total = totalSizeFromContentRange(first.contentRange);
      if (total === null || total <= first.buffer.length) return first.buffer;

      const ranges: Array<[number, number]> = [];
      for (let start = first.buffer.length; start < total; start += DOWNLOAD_CHUNK_BYTES) {
        ranges.push([start, Math.min(start + DOWNLOAD_CHUNK_BYTES, total) - 1]);
      }

      // Fixed-size worker pool over the range list, so concurrency stays
      // bounded no matter how large the object is.
      const parts: Buffer[] = new Array(ranges.length);
      let cursor = 0;
      const worker = async () => {
        for (let i = cursor++; i < ranges.length; i = cursor++) {
          parts[i] = (await getRange(objectKey, ranges[i][0], ranges[i][1], abortSignal)).buffer;
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, ranges.length) }, worker)
      );

      return Buffer.concat([first.buffer, ...parts]);
    },
    `downloading ${objectKey}`,
    deadlineMs
  );
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

/** Starts an S3 multipart upload and returns the storage-assigned UploadId.
 * That id (plus the per-part ETags collected as parts land) is the only
 * state a multipart upload needs -- storage tracks it server-side, so none
 * of this needs a database row. */
export async function createMultipartUpload(objectKey: string, contentType: string): Promise<string> {
  const res = await withDeadline(
    (abortSignal) =>
      client().send(
        new CreateMultipartUploadCommand({ Bucket: bucket(), Key: objectKey, ContentType: contentType }),
        { abortSignal }
      ),
    `starting multipart upload for ${objectKey}`,
    METADATA_DEADLINE_MS
  );
  if (!res.UploadId) throw new Error(`No UploadId returned for ${objectKey}`);
  return res.UploadId;
}

/** Presigned URL for a single part PUT. The browser uploads part bytes
 * directly to storage, same as the existing single-shot presignedUploadUrl,
 * just scoped to one part of a larger object. */
export async function presignedUploadPartUrl(
  objectKey: string,
  uploadId: string,
  partNumber: number,
  expiry: number = PRESIGNED_URL_EXPIRY
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: bucket(),
    Key: objectKey,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(client(), command, { expiresIn: expiry });
}

/** Assembles the uploaded parts into the final object. Parts must be listed
 * in ascending PartNumber order. */
export async function completeMultipartUpload(
  objectKey: string,
  uploadId: string,
  parts: CompletedPart[]
): Promise<void> {
  await withDeadline(
    (abortSignal) =>
      client().send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket(),
          Key: objectKey,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts
              .sort((a, b) => a.partNumber - b.partNumber)
              .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
          },
        }),
        { abortSignal }
      ),
    `completing multipart upload for ${objectKey}`,
    METADATA_DEADLINE_MS
  );
}

/** Cancels an in-progress multipart upload and releases the parts already
 * uploaded, so a client that gives up (exhausted retries, user cancels)
 * doesn't leave an orphaned incomplete upload sitting in storage. */
export async function abortMultipartUpload(objectKey: string, uploadId: string): Promise<void> {
  await client().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: objectKey, UploadId: uploadId }));
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
