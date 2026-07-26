import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { prisma } from "@/lib/db";
import { presignedDownloadUrl } from "@/lib/storage";

const EXTENSIONS = { pdf: "pdf", word: "docx", pptx: "pptx" } as const;
const PATH_FIELDS = { pdf: "pdfPath", word: "wordPath", pptx: "pptxPath" } as const;

type Format = keyof typeof EXTENSIONS;

function isFormat(value: string): value is Format {
  return value === "pdf" || value === "word" || value === "pptx";
}

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string; format: string }> }) {
  const { reportId, format } = await params;
  if (!isFormat(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const report = await prisma.report.findFirst({ where: { id: reportId, userId: user.id } });
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const objectKey = report[PATH_FIELDS[format]];
  if (!objectKey) {
    return NextResponse.json({ error: `${format} export not available yet` }, { status: 404 });
  }

  const filename = `${(report.title || "databrief-report").slice(0, 60)}.${EXTENSIONS[format]}`;
  const url = await presignedDownloadUrl(objectKey, filename);
  return NextResponse.redirect(url, 302);
}
