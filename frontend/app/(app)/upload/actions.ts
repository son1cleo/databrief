"use server";

import { redirect } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { getApiToken } from "@/lib/apiToken";
import type { ReportConfigRequest, ReportOut, UploadPreview } from "@/lib/types";

type ActionResult<T> = { success: true; data: T } | { success: false; status: number; message: string };

export async function uploadFile(formData: FormData): Promise<ActionResult<UploadPreview>> {
  const token = await getApiToken();
  if (!token) redirect("/login");

  try {
    // Next.js deserializes the incoming FormData when the server action is called,
    // which can leave File streams in a consumed state. Re-materialise the file
    // bytes into a fresh FormData so Node's fetch has a clean multipart body.
    const incoming = formData.get("file");
    if (!incoming || typeof incoming === "string") {
      return { success: false, status: 400, message: "No file provided" };
    }
    const bytes = await incoming.arrayBuffer();
    const fresh = new FormData();
    fresh.append("file", new Blob([bytes], { type: incoming.type }), incoming.name);

    const data = await apiFetch<UploadPreview>("/api/uploads", { method: "POST", token, body: fresh });
    return { success: true, data };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, status: err.status, message: err.message };
    return { success: false, status: 500, message: "Upload failed" };
  }
}

export async function createReport(config: ReportConfigRequest): Promise<ActionResult<ReportOut>> {
  const token = await getApiToken();
  if (!token) redirect("/login");

  try {
    const data = await apiFetch<ReportOut>("/api/reports", {
      method: "POST",
      token,
      body: JSON.stringify(config),
    });
    return { success: true, data };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, status: err.status, message: err.message };
    return { success: false, status: 500, message: "Could not start report generation" };
  }
}

export async function getReport(reportId: string): Promise<ReportOut> {
  const token = await getApiToken();
  if (!token) redirect("/login");

  return apiFetch<ReportOut>(`/api/reports/${reportId}`, { token });
}
