import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { prisma } from "@/lib/db";
import { downloadBytes, deleteObject, StorageNotConfiguredError } from "@/lib/storage";
import { detectFileType, detectDataType, parsePreview, UnsupportedFileTypeError } from "@/lib/fileParsing";

const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB ?? "50");

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

  let bytes: Buffer;
  try {
    bytes = await downloadBytes(objectKey);
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: "File storage isn't configured yet." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not read the uploaded file" }, { status: 404 });
  }

  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (bytes.length > maxBytes) {
    await deleteObject(objectKey).catch(() => {});
    return NextResponse.json({ error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit` }, { status: 400 });
  }

  let preview;
  try {
    preview = await parsePreview(bytes, fileType);
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
      fileSizeBytes: bytes.length,
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
