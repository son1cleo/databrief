import "server-only";
import { prisma } from "@/lib/db";
import { inngest, GENERATE_REPORT_EVENT, type GenerateReportEventData } from "./client";
import { buildTextStoryArc, type StoryArc } from "@/lib/story";
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

export const generateReport = inngest.createFunction(
  { id: "generate-report", retries: 2, triggers: { event: GENERATE_REPORT_EVENT } },
  async ({ event, step }) => {
    const { reportId, industry, question, formats } = event.data as GenerateReportEventData;

    try {
      const { report, upload, user } = await step.run("load-metadata", () => loadReportMetadata(reportId));

      const isStructured = STRUCTURED_TYPES.has(upload.dataType ?? "");

      let storyArc: StoryArc;
      let findingsCount = 0;
      let rows: Awaited<ReturnType<typeof parseUploadTabular>>["rows"] | null = null;

      if (isStructured) {
        const parsed = await step.run("parse-upload", () => parseUploadTabular(upload));

        const columnMeta = question
          ? await step.run("classify-question", () => classifyQuestion(question, parsed.columns, parsed.rows))
          : null;

        const built = await step.run("analyze-and-chart", () =>
          analyzeAndBuildStoryArc(parsed.rows, parsed.columns, question, columnMeta)
        );
        storyArc = built.storyArc;
        findingsCount = built.findingsCount;
        rows = built.rows;
      } else {
        const text = await step.run("parse-upload", () => parseUploadText(upload));
        storyArc = await step.run("build-text-story-arc", () => buildTextStoryArc(text, question));
      }

      const narration = await step.run("narrate", () => narrate(storyArc, industry, question, rows));
      storyArc = narration.storyArc;

      const title = deriveTitle(storyArc.hook);

      // Persist narration now so the report is inspectable even if export
      // generation subsequently fails, mirroring the Python version's
      // db.flush() before building files.
      await step.run("save-narration", () =>
        prisma.report.update({
          where: { id: reportId },
          data: {
            title,
            hook: storyArc.hook,
            storyJson: storyArc as object,
            storyBlocks: narration.blocks as object,
            wordCount: narration.wordCount,
            findingsCount,
          },
        })
      );

      const brand = brandFor(report, user);

      const pdfPath = await step.run("build-pdf", () => buildAndUploadPdf(reportId, title, narration, storyArc, brand));

      const wordPath = formats.includes("word")
        ? await step.run("build-word", () => buildAndUploadWord(reportId, title, narration, storyArc, brand))
        : null;

      const pptxPath = formats.includes("pptx")
        ? await step.run("build-pptx", () => buildAndUploadPptx(reportId, storyArc, report.pptxTheme, brand))
        : null;

      await step.run("mark-done", () =>
        prisma.report.update({ where: { id: reportId }, data: { pdfPath, wordPath, pptxPath, status: "done" } })
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
