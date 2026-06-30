import { NextResponse } from "next/server";
import { getApiToken } from "@/lib/apiToken";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const VALID_FORMATS = new Set(["pdf", "word", "pptx"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string; format: string }> }
) {
  const { reportId, format } = await params;
  if (!VALID_FORMATS.has(format)) {
    return NextResponse.json({ detail: "Invalid format" }, { status: 400 });
  }

  const token = await getApiToken();
  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const upstream = await fetch(`${API_URL}/api/exports/${reportId}/${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "Export not available");
    return NextResponse.json({ detail }, { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": upstream.headers.get("content-disposition") ?? "attachment",
    },
  });
}
