"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { listReportsForUser, deleteReportForUser, toReportListItem } from "@/lib/reports";
import type { ReportListItem } from "@/lib/types";

export async function listReports(limit = 50, offset = 0): Promise<ReportListItem[]> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const reports = await listReportsForUser(user.id, limit, offset);
  return reports.map(toReportListItem) as ReportListItem[];
}

export async function deleteReport(reportId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await deleteReportForUser(user.id, reportId);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}
