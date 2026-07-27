import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { completeMultipartUpload, StorageNotConfiguredError, type CompletedPart } from "@/lib/storage";

function isCompletedPartArray(value: unknown): value is CompletedPart[] {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        p &&
        typeof p.partNumber === "number" &&
        typeof p.etag === "string" &&
        p.partNumber >= 1 &&
        p.etag.length > 0
    )
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const objectKey = body?.objectKey;
  const uploadId = body?.uploadId;
  const parts = body?.parts;
  if (typeof objectKey !== "string" || typeof uploadId !== "string" || !objectKey || !uploadId || !isCompletedPartArray(parts)) {
    return NextResponse.json({ error: "Missing objectKey, uploadId, or parts" }, { status: 400 });
  }
  if (!objectKey.startsWith(`uploads/${user.id}/`)) {
    return NextResponse.json({ error: "Invalid object key" }, { status: 400 });
  }
  if (parts.length === 0) {
    return NextResponse.json({ error: "No parts to complete" }, { status: 400 });
  }

  try {
    await completeMultipartUpload(objectKey, uploadId, parts);
    return NextResponse.json({ objectKey });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: "File storage isn't configured yet." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not complete upload. Please try again." }, { status: 502 });
  }
}
