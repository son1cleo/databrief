import { NextRequest, NextResponse } from "next/server";
import { getApiToken } from "@/lib/apiToken";

const API_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export async function POST(request: NextRequest) {
  const token = await getApiToken();
  if (!token) return new NextResponse("Unauthorized", { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";

  // Pipe the raw multipart body straight through to FastAPI — no re-parsing,
  // no re-serialisation, no size limit from the Server Actions bodySizeLimit.
  const res = await fetch(`${API_URL}/api/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body: request.body,
    duplex: "half",
  } as RequestInit & { duplex: string });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
