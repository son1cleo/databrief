import { NextResponse } from "next/server";
import { getApiToken } from "@/lib/apiToken";

export async function GET() {
  const token = await getApiToken();
  if (!token) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ token });
}
