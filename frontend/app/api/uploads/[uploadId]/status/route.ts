import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uploadId } = await params;
  const upload = await prisma.upload.findFirst({ where: { id: uploadId, userId: user.id } });
  if (!upload) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

  return NextResponse.json({ upload_id: upload.id, status: upload.status, message: upload.errorMessage });
}
