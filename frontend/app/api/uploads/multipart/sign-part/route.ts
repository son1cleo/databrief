import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { presignedUploadPartUrl, StorageNotConfiguredError } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const objectKey = body?.objectKey;
  const uploadId = body?.uploadId;
  const partNumber = body?.partNumber;
  if (
    typeof objectKey !== "string" ||
    typeof uploadId !== "string" ||
    typeof partNumber !== "number" ||
    !objectKey ||
    !uploadId ||
    partNumber < 1
  ) {
    return NextResponse.json({ error: "Missing objectKey, uploadId, or partNumber" }, { status: 400 });
  }
  // Same ownership check as the rest of the upload API — object keys are
  // namespaced by user id at init time.
  if (!objectKey.startsWith(`uploads/${user.id}/`)) {
    return NextResponse.json({ error: "Invalid object key" }, { status: 400 });
  }

  try {
    const url = await presignedUploadPartUrl(objectKey, uploadId, partNumber);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: "File storage isn't configured yet." }, { status: 503 });
    }
    throw err;
  }
}
