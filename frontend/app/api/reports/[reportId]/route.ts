import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getReportForUser, deleteReportForUser, toReportOut } from "@/lib/reports";

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId } = await params;
  const report = await getReportForUser(user.id, reportId);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  return NextResponse.json(toReportOut(report));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId } = await params;
  const deleted = await deleteReportForUser(user.id, reportId);
  if (!deleted) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
