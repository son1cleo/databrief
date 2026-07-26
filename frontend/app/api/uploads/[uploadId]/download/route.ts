import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { prisma } from "@/lib/db";
import { presignedDownloadUrl } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const upload = await prisma.upload.findFirst({ where: { id: uploadId, userId: user.id } });
  if (!upload) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

  const url = await presignedDownloadUrl(upload.storagePath, upload.filename);
  return NextResponse.redirect(url, 302);
}
