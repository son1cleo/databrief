import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createReportForUser, listReportsForUser, toReportOut, toReportListItem } from "@/lib/reports";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const uploadId = body?.upload_id;
  if (typeof uploadId !== "string" || !uploadId) {
    return NextResponse.json({ error: "Missing upload_id" }, { status: 400 });
  }

  const result = await createReportForUser(user, {
    uploadId,
    formats: Array.isArray(body?.formats) ? body.formats : undefined,
    pptxTheme: typeof body?.pptx_theme === "string" ? body.pptx_theme : undefined,
    applyBrandKit: Boolean(body?.apply_brand_kit),
    industry: typeof body?.industry === "string" ? body.industry : undefined,
    question: typeof body?.question === "string" ? body.question : undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json(toReportOut(result.report), { status: 201 });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "20") || 20;
  const offset = Number(searchParams.get("offset") ?? "0") || 0;

  const reports = await listReportsForUser(user.id, limit, offset);
  return NextResponse.json(reports.map(toReportListItem));
}
