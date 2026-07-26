import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { prisma } from "@/lib/db";
import {
  downloadBytes,
  downloadRange,
  objectSize,
  deleteObject,
  StorageNotConfiguredError,
  StorageTimeoutError,
} from "@/lib/storage";
import { detectFileType, detectDataType, parsePreview, UnsupportedFileTypeError } from "@/lib/fileParsing";

const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB ?? "50");

// CSV is line-oriented, so the head of the file already contains the header
// and every row the preview shows. Reads from object storage are far slower
// than writes, and pulling a whole multi-MB CSV back just to show 10 rows
// takes minutes -- so only the head is fetched, and the full file is left for
// the background report pipeline, which can afford the time.
const CSV_PREVIEW_HEAD_BYTES = 256 * 1024;

/** Maps a storage failure to a response. A stalled/slow connection
 * (retryable) is deliberately distinguished from the object genuinely not
 * existing -- both used to surface as the same 404, which made a transient
 * timeout look like a permanent failure. */
function storageErrorResponse(err: unknown): NextResponse {
  if (err instanceof StorageNotConfiguredError) {
    return NextResponse.json({ error: "File storage isn't configured yet." }, { status: 503 });
  }
  if (err instanceof StorageTimeoutError) {
    return NextResponse.json({ error: "Storage took too long to respond. Please try again." }, { status: 504 });
  }
  return NextResponse.json({ error: "Could not read the uploaded file" }, { status: 404 });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const objectKey = body?.objectKey;
  const filename = body?.filename;
  if (typeof objectKey !== "string" || typeof filename !== "string" || !objectKey || !filename) {
    return NextResponse.json({ error: "Missing objectKey or filename" }, { status: 400 });
  }
  // Object keys are namespaced by user id at presign time — reject anything else.
  if (!objectKey.startsWith(`uploads/${user.id}/`)) {
    return NextResponse.json({ error: "Invalid object key" }, { status: 400 });
  }

  let fileType: string;
  try {
    fileType = detectFileType(filename);
  } catch (err) {
    if (err instanceof UnsupportedFileTypeError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
  const dataType = detectDataType(fileType);

  // Size comes from object metadata rather than the downloaded body, so an
  // oversized file is rejected before paying to transfer it.
  let sizeBytes: number;
  try {
    sizeBytes = await objectSize(objectKey);
  } catch (err) {
    return storageErrorResponse(err);
  }

  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    await deleteObject(objectKey).catch(() => {});
    return NextResponse.json({ error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit` }, { status: 400 });
  }

  const truncated = fileType === "csv" && sizeBytes > CSV_PREVIEW_HEAD_BYTES;

  let bytes: Buffer;
  try {
    bytes = truncated ? await downloadRange(objectKey, CSV_PREVIEW_HEAD_BYTES) : await downloadBytes(objectKey);
  } catch (err) {
    return storageErrorResponse(err);
  }

  let preview;
  try {
    preview = await parsePreview(bytes, fileType, { truncated });
  } catch (err) {
    await deleteObject(objectKey).catch(() => {});
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Could not parse file: ${message}` }, { status: 422 });
  }

  const upload = await prisma.upload.create({
    data: {
      userId: user.id,
      filename,
      fileType,
      dataType,
      fileSizeBytes: sizeBytes,
      rowCount: preview.rowCount,
      columnCount: preview.columnCount,
      storagePath: objectKey,
      status: "done",
    },
  });

  return NextResponse.json({
    upload_id: upload.id,
    columns: preview.columns,
    rows: preview.rows,
    text_preview: preview.textPreview,
    file_type: fileType,
    data_type: dataType,
    row_count: preview.rowCount,
    column_count: preview.columnCount,
  });
}
