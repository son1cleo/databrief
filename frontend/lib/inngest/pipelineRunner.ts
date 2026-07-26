import "server-only";
import { prisma } from "@/lib/db";
import { buildTextStoryArc } from "@/lib/story";
import type { GenerateReportEventData } from "./client";
import {
  loadReportMetadata,
  parseUploadTabular,
  parseUploadText,
  classifyQuestion,
  analyzeAndBuildStoryArc,
  narrate,
  brandFor,
  deriveTitle,
  buildAndUploadPdf,
  buildAndUploadWord,
  buildAndUploadPptx,
} from "./pipeline";

const STRUCTURED_TYPES = new Set(["structured", "semi_structured"]);

/** Same orchestration as generateReport.ts's Inngest function, minus the
 * step.run() wrapping — used as a fallback when Inngest isn't reachable
 * (e.g. local dev without `inngest-cli dev` running) so report generation
 * still completes instead of getting stuck in "generating" forever. Runs
 * with no automatic per-step retry and no durability across a function
 * timeout — those are exactly what Inngest buys you over this path. */
export async function runGenerateReportPipelineDirect(data: GenerateReportEventData): Promise<void> {
  const { reportId, industry, question, formats } = data;

  try {
    const { report, upload, user } = await loadReportMetadata(reportId);
    const isStructured = STRUCTURED_TYPES.has(upload.dataType ?? "");

    let storyArc;
    let findingsCount = 0;

    if (isStructured) {
      const parsed = await parseUploadTabular(upload);
      const columnMeta = question ? await classifyQuestion(question, parsed.columns, parsed.rows) : null;
      const built = analyzeAndBuildStoryArc(parsed.rows, parsed.columns, question, columnMeta);
      storyArc = built.storyArc;
      findingsCount = built.findingsCount;
    } else {
      const text = await parseUploadText(upload);
      storyArc = buildTextStoryArc(text, question);
    }

    const narration = await narrate(storyArc, industry, question);
    const title = deriveTitle(storyArc.hook);

    await prisma.report.update({
      where: { id: reportId },
      data: {
        title,
        hook: storyArc.hook,
        storyJson: storyArc as object,
        storyBlocks: narration.blocks as object,
        wordCount: narration.wordCount,
        findingsCount,
      },
    });

    const brand = brandFor(report, user);

    const pdfPath = await buildAndUploadPdf(reportId, title, narration, storyArc, brand);
    const wordPath = formats.includes("word") ? await buildAndUploadWord(reportId, title, narration, storyArc, brand) : null;
    const pptxPath = formats.includes("pptx") ? await buildAndUploadPptx(reportId, storyArc, report.pptxTheme, brand) : null;

    await prisma.report.update({ where: { id: reportId }, data: { pdfPath, wordPath, pptxPath, status: "done" } });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
    await prisma.report
      .update({ where: { id: reportId }, data: { status: "failed", errorMessage: message } })
      .catch(() => {});
  }
}
