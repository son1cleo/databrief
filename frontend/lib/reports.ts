import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { inngest, GENERATE_REPORT_EVENT } from "@/lib/inngest/client";
import { runGenerateReportPipelineDirect } from "@/lib/inngest/pipelineRunner";
import { reportOverageUsage } from "@/lib/billing";
import { deletePrefix } from "@/lib/storage";
import type { Report, User } from "@/lib/generated/prisma/client";

export function toReportOut(report: Report) {
  return {
    id: report.id,
    user_id: report.userId,
    upload_id: report.uploadId,
    title: report.title,
    hook: report.hook,
    story_json: report.storyJson,
    story_blocks: report.storyBlocks,
    word_count: report.wordCount,
    findings_count: report.findingsCount,
    status: report.status,
    error_message: report.errorMessage,
    pptx_theme: report.pptxTheme,
    is_branded: report.isBranded,
    created_at: report.createdAt.toISOString(),
    updated_at: report.updatedAt.toISOString(),
    pdf_ready: report.pdfPath !== null,
    word_ready: report.wordPath !== null,
    pptx_ready: report.pptxPath !== null,
  };
}

export function toReportListItem(report: Report) {
  return {
    id: report.id,
    title: report.title,
    hook: report.hook,
    word_count: report.wordCount,
    findings_count: report.findingsCount,
    status: report.status,
    pptx_theme: report.pptxTheme,
    is_branded: report.isBranded,
    created_at: report.createdAt.toISOString(),
    pdf_ready: report.pdfPath !== null,
    word_ready: report.wordPath !== null,
    pptx_ready: report.pptxPath !== null,
  };
}

export type CreateReportResult =
  | { ok: true; report: Report }
  | { ok: false; status: number; message: string };

export interface CreateReportParams {
  uploadId: string;
  formats?: string[];
  pptxTheme?: string | null;
  applyBrandKit?: boolean;
  industry?: string | null;
  question?: string | null;
}

/** Ports the plan-limit/overage gating + report creation from
 * backend/src/api/routes/reports.py::create_report, then publishes the
 * Inngest event that replaces `generate_report_task.delay(...)`. */
export async function createReportForUser(user: User, params: CreateReportParams): Promise<CreateReportResult> {
  const upload = await prisma.upload.findFirst({ where: { id: params.uploadId, userId: user.id } });
  if (!upload) return { ok: false, status: 404, message: "Upload not found" };

  const formats = params.formats && params.formats.length > 0 ? params.formats : ["pdf"];
  const pptxTheme = params.pptxTheme ?? "boardroom";
  const applyBrandKit = params.applyBrandKit ?? false;
  const industry = params.industry ?? null;
  const question = params.question ?? null;

  const overLimit = user.reportsUsed >= user.reportsLimit;
  let isOverage = false;
  if (overLimit) {
    if (user.plan === "business") {
      // effectively unlimited, no gate
    } else if (user.plan === "free") {
      return {
        ok: false,
        status: 402,
        message: "Report limit reached for your plan. Upgrade to generate more reports.",
      };
    } else {
      isOverage = true;
    }
  }

  const report = await prisma.report.create({
    data: { userId: user.id, uploadId: upload.id, pptxTheme, isBranded: applyBrandKit, status: "generating" },
  });

  const updatedUser = await prisma.user.update({ where: { id: user.id }, data: { reportsUsed: { increment: 1 } } });
  if (isOverage) await reportOverageUsage(updatedUser);

  const eventData = { reportId: report.id, industry, question, formats };
  try {
    await inngest.send({ name: GENERATE_REPORT_EVENT, data: eventData });
  } catch {
    // Inngest isn't reachable (e.g. local dev without `npx inngest-cli dev`
    // running, or no INNGEST_SIGNING_KEY in an environment without dev mode).
    // Run the same pipeline directly instead of leaving the report stuck in
    // "generating" — after() keeps this request's response fast while the
    // work continues. This path has no per-step retry or timeout-durability,
    // unlike the Inngest path; that resilience is exactly what Inngest buys.
    after(() => runGenerateReportPipelineDirect(eventData));
  }

  return { ok: true, report };
}

export async function listReportsForUser(userId: string, limit = 20, offset = 0): Promise<Report[]> {
  return prisma.report.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    skip: offset,
  });
}

export async function getReportForUser(userId: string, reportId: string): Promise<Report | null> {
  return prisma.report.findFirst({ where: { id: reportId, userId } });
}

export async function deleteReportForUser(userId: string, reportId: string): Promise<boolean> {
  const report = await getReportForUser(userId, reportId);
  if (!report) return false;
  // Cascade delete (Postgres) only removes the row — the exported
  // PDF/Word/PPTX objects in storage have to be cleaned up explicitly.
  await deletePrefix(`reports/${report.id}/`).catch(() => {});
  await prisma.report.delete({ where: { id: report.id } });
  return true;
}
