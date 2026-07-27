import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { abortMultipartUpload } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const objectKey = body?.objectKey;
  const uploadId = body?.uploadId;
  if (typeof objectKey !== "string" || typeof uploadId !== "string" || !objectKey || !uploadId) {
    return NextResponse.json({ error: "Missing objectKey or uploadId" }, { status: 400 });
  }
  if (!objectKey.startsWith(`uploads/${user.id}/`)) {
    return NextResponse.json({ error: "Invalid object key" }, { status: 400 });
  }

  // Best-effort cleanup — the client is giving up either way, so a failure
  // here shouldn't surface as an error to the user.
  await abortMultipartUpload(objectKey, uploadId).catch(() => {});
  return NextResponse.json({ ok: true });
}
