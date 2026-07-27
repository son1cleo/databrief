import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createMultipartUpload, StorageNotConfiguredError } from "@/lib/storage";
import { detectFileType, UnsupportedFileTypeError } from "@/lib/fileParsing";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const filename = body?.filename;
  if (typeof filename !== "string" || !filename) {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }

  try {
    detectFileType(filename);
  } catch (err) {
    if (err instanceof UnsupportedFileTypeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const contentType = typeof body?.contentType === "string" ? body.contentType : "application/octet-stream";
  const ext = filename.slice(filename.lastIndexOf("."));
  const objectKey = `uploads/${user.id}/${randomUUID()}${ext}`;

  try {
    const uploadId = await createMultipartUpload(objectKey, contentType);
    return NextResponse.json({ uploadId, objectKey });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: "File storage isn't configured yet." }, { status: 503 });
    }
    throw err;
  }
}
