import "server-only";
import { prisma } from "@/lib/db";
import type { GenerateReportEventData } from "./client";
import {
  loadReportMetadata,
  generateStructuredStory,
  generateTextStory,
  brandFor,
  deriveTitle,
  buildAndUploadPdf,
  buildAndUploadWord,
  buildAndUploadPptx,
  withTiming,
} from "./pipeline";

const STRUCTURED_TYPES = new Set(["structured", "semi_structured"]);

/** Same orchestration as generateReport.ts's Inngest function, minus the
 * step.run() wrapping — used as a fallback when Inngest isn't reachable
 * (e.g. local dev without `inngest-cli dev` running) so report generation
 * still completes instead of getting stuck in "generating" forever. Runs
 * with no automatic per-step retry and no durability across a function
 * timeout — those are exactly what Inngest buys you over this path. */
export async function runGenerateReportPipelineDirect(data: GenerateReportEventData): Promise<void> {
  const { reportId, industry, questions, formats } = data;

  try {
    const { report, upload, user } = await withTiming(reportId, "load-metadata", () => loadReportMetadata(reportId))();
    const isStructured = STRUCTURED_TYPES.has(upload.dataType ?? "");

    const { storyArc, findingsCount, narration } = isStructured
      ? await generateStructuredStory(reportId, upload, questions, industry, user.preferredLlmProvider)
      : {
          ...(await generateTextStory(reportId, upload, questions, industry, user.preferredLlmProvider)),
          findingsCount: 0,
        };

    const title = deriveTitle(storyArc.hook);

    await withTiming(reportId, "save-narration", () =>
      prisma.report.update({
        where: { id: reportId },
        data: {
          title,
          hook: storyArc.hook,
          storyJson: storyArc as object,
          storyBlocks: narration as object,
          wordCount: narration.wordCount,
          findingsCount,
        },
      })
    )();

    const brand = brandFor(report, user);

    // Independent once narration is done -- run concurrently rather than
    // sequentially awaited (mirrors generateReport.ts's Inngest version).
    const [pdfPath, wordPath, pptxPath] = await Promise.all([
      withTiming(reportId, "build-pdf", () => buildAndUploadPdf(reportId, title, narration, storyArc, brand, upload.filename))(),
      formats.includes("word")
        ? withTiming(reportId, "build-word", () => buildAndUploadWord(reportId, title, narration, storyArc, brand, upload.filename))()
        : Promise.resolve(null),
      formats.includes("pptx")
        ? withTiming(reportId, "build-pptx", () => buildAndUploadPptx(reportId, storyArc, narration, report.pptxTheme, brand, upload.filename))()
        : Promise.resolve(null),
    ]);

    await withTiming(reportId, "mark-done", () =>
      prisma.report.update({ where: { id: reportId }, data: { pdfPath, wordPath, pptxPath, status: "done" } })
    )();
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
    await prisma.report
      .update({ where: { id: reportId }, data: { status: "failed", errorMessage: message } })
      .catch(() => {});
  }
}
