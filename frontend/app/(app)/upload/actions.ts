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
    const data = await apiFetch<UploadPreview>("/api/uploads", { method: "POST", token, body: formData });
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
