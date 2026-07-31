"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createReportForUser, getReportForUser, toReportOut } from "@/lib/reports";
import { ApiError } from "@/lib/api";
import type { ReportConfigRequest, ReportOut } from "@/lib/types";

type ActionResult<T> = { success: true; data: T } | { success: false; status: number; message: string };

export async function createReport(config: ReportConfigRequest): Promise<ActionResult<ReportOut>> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await createReportForUser(user, {
    uploadId: config.upload_id,
    formats: config.formats,
    pptxTheme: config.pptx_theme,
    applyBrandKit: config.apply_brand_kit,
    industry: config.industry,
    questions: config.questions,
  });

  if (!result.ok) return { success: false, status: result.status, message: result.message };
  return { success: true, data: toReportOut(result.report) as ReportOut };
}

export async function getReport(reportId: string): Promise<ReportOut> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const report = await getReportForUser(user.id, reportId);
  if (!report) throw new ApiError(404, "Report not found");
  return toReportOut(report) as ReportOut;
}
