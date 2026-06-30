"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { getApiToken } from "@/lib/apiToken";
import type { ReportListItem } from "@/lib/types";

export async function listReports(limit = 50, offset = 0): Promise<ReportListItem[]> {
  const token = await getApiToken();
  if (!token) redirect("/login");

  return apiFetch<ReportListItem[]>(`/api/reports?limit=${limit}&offset=${offset}`, { token });
}

export async function deleteReport(reportId: string): Promise<void> {
  const token = await getApiToken();
  if (!token) redirect("/login");

  await apiFetch(`/api/reports/${reportId}`, { method: "DELETE", token });
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}
