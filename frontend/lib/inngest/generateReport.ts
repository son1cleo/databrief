import "server-only";
import { prisma } from "@/lib/db";
import { inngest, GENERATE_REPORT_EVENT, type GenerateReportEventData } from "./client";
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

export const generateReport = inngest.createFunction(
  { id: "generate-report", retries: 2, triggers: { event: GENERATE_REPORT_EVENT } },
  async ({ event, step }) => {
    const { reportId, industry, questions, formats } = event.data as GenerateReportEventData;

    try {
      const { report, upload, user } = await step.run(
        "load-metadata",
        withTiming(reportId, "load-metadata", () => loadReportMetadata(reportId))
      );

      const isStructured = STRUCTURED_TYPES.has(upload.dataType ?? "");

      // Parse + classify + analyze + narrate all run inside ONE step here,
      // not one step per sub-phase. Inngest checkpoints every step.run
      // return value as durable run state, and the raw parsed rows can
      // easily be many MB for a real dataset -- returning them from their
      // own step (as this used to) blows past Inngest's run state size
      // limit ("run state size limit exceeded: state is too large"). Keeping
      // rows local to generateStructuredStory/generateTextStory means they
      // never cross a step boundary; only the final narrated result
      // (storyArc + blocks, much smaller) does. Sub-phases are still
      // individually timed via withTiming inside those functions for
      // visibility -- just not as separate durable steps.
      const { storyArc, findingsCount, narration } = await step.run(
        "generate-story",
        isStructured
          ? () => generateStructuredStory(reportId, upload, questions, industry, user.preferredLlmProvider)
          : () =>
              generateTextStory(reportId, upload, questions, industry, user.preferredLlmProvider).then((r) => ({
                ...r,
                findingsCount: 0,
              }))
      );

      const title = deriveTitle(storyArc.hook);

      // Persist narration now so the report is inspectable even if export
      // generation subsequently fails, mirroring the Python version's
      // db.flush() before building files.
      await step.run(
        "save-narration",
        withTiming(reportId, "save-narration", () =>
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
        )
      );

      const brand = brandFor(report, user);

      // PDF/Word/PPTX are independent once narration is done -- running them
      // as concurrent steps instead of sequential awaits cuts wall-clock time
      // by up to ~3x when all three formats are requested.
      const [pdfPath, wordPath, pptxPath] = await Promise.all([
        step.run(
          "build-pdf",
          withTiming(reportId, "build-pdf", () => buildAndUploadPdf(reportId, title, narration, storyArc, brand, upload.filename))
        ),
        formats.includes("word")
          ? step.run(
              "build-word",
              withTiming(reportId, "build-word", () => buildAndUploadWord(reportId, title, narration, storyArc, brand, upload.filename))
            )
          : Promise.resolve(null),
        formats.includes("pptx")
          ? step.run(
              "build-pptx",
              withTiming(reportId, "build-pptx", () => buildAndUploadPptx(reportId, storyArc, narration, report.pptxTheme, brand, upload.filename))
            )
          : Promise.resolve(null),
      ]);

      await step.run(
        "mark-done",
        withTiming(reportId, "mark-done", () =>
          prisma.report.update({ where: { id: reportId }, data: { pdfPath, wordPath, pptxPath, status: "done" } })
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
      await step
        .run("mark-failed", () => prisma.report.update({ where: { id: reportId }, data: { status: "failed", errorMessage: message } }))
        .catch(() => {});
      throw err;
    }
  }
);
