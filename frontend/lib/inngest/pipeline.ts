import "server-only";
import { prisma } from "@/lib/db";
import { downloadBytes, uploadBytes } from "@/lib/storage";
import { parseTabular, parseText, type TabularData } from "@/lib/fileParsing";
import { analyze, findPreColumn, type Row } from "@/lib/analysis";
import { rankFindings } from "@/lib/insight";
import { chartForFinding } from "@/lib/charts";
import { buildStoryArc, buildTextStoryArc, type StoryArc } from "@/lib/story";
import { identifyRelevantColumns, generateStoryBlocks } from "@/lib/llm";
import type { ColumnClassification, StoryNarrationResult } from "@/lib/llm/schemas";
import { renderReportPdf } from "@/lib/exports/pdf";
import { buildWordDocument } from "@/lib/exports/word";
import { buildPptx } from "@/lib/exports/pptx";
import { buildDatasetLabel, type ExportBrand } from "@/lib/exports/types";
import type { Report, Upload, User } from "@/lib/generated/prisma/client";

// Step return values are round-tripped through JSON by Inngest for durable
// replay, so Date fields on any Prisma row that crosses a step boundary come
// back as strings, not Date objects. These minimal, duck-typed views only
// name the fields each function actually needs, so they stay valid on either
// side of a step boundary instead of requiring the exact Prisma model type.
type UploadFileRef = Pick<Upload, "storagePath" | "fileType">;
type ReportBrandRef = Pick<Report, "isBranded">;
type UserBrandRef = Pick<User, "brandPrimary" | "brandLogoUrl" | "brandFont">;

// Cheap per-step timing so real numbers are available (in logs, and in
// Inngest's own Runs tab) instead of guessing where report-generation time
// actually goes. Wraps the callback passed to step.run/direct invocation
// rather than the step call itself, so it measures actual work time.
export function withTiming<T>(reportId: string, label: string, fn: () => T | Promise<T>): () => Promise<T> {
  return async () => {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      console.log(`[timing] report=${reportId} step=${label} ms=${Date.now() - start}`);
    }
  };
}

export function deriveTitle(hook: string): string {
  const title = hook.trim().replace(/\.+$/, "");
  return title.length <= 70 ? title : `${title.slice(0, 67)}...`;
}

export async function loadReportMetadata(reportId: string): Promise<{ report: Report; upload: Upload; user: User }> {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Report not found");
  const upload = await prisma.upload.findUnique({ where: { id: report.uploadId } });
  if (!upload) throw new Error("Source upload no longer exists");
  const user = await prisma.user.findUnique({ where: { id: report.userId } });
  if (!user) throw new Error("Report owner no longer exists");
  return { report, upload, user };
}

export async function parseUploadTabular(upload: UploadFileRef): Promise<TabularData> {
  const bytes = await downloadBytes(upload.storagePath);
  return parseTabular(bytes, upload.fileType ?? "csv");
}

export async function parseUploadText(upload: UploadFileRef): Promise<string> {
  const bytes = await downloadBytes(upload.storagePath);
  return parseText(bytes, upload.fileType ?? "txt");
}

export async function classifyQuestion(
  question: string,
  columns: string[],
  rows: Row[],
  preferredProvider?: string | null
): Promise<ColumnClassification> {
  const sampleValues = Object.fromEntries(
    columns.map((col) => [
      col,
      rows
        .slice(0, 5)
        .map((r) => r[col])
        .filter((v) => v !== null && v !== undefined),
    ])
  );
  return identifyRelevantColumns(question, columns, sampleValues, preferredProvider);
}

const POST_PREFIXES = ["post_", "_post", "after_"];
const IMPROVE_WORDS = ["better", "worse", "improve", "change", "help", "hurt", "impact", "affect"];

/** Auto-computes change_X columns for detected pre/post pairs so they're
 * first-class columns for the stats engine, mirroring analysis_worker.py's
 * orchestration (this logic lives in the Celery task, not analysis_service.py
 * itself, so it isn't part of analyze()). */
export function addChangeColumns(
  rows: Row[],
  columns: string[],
  question: string | null,
  relevantCols: string[]
): { rows: Row[]; columns: string[]; relevantCols: string[] } {
  const changeColsAdded: string[] = [];
  let nextRows = rows;
  const nextColumns = [...columns];

  for (const col of columns) {
    if (POST_PREFIXES.some((p) => col.toLowerCase().includes(p))) {
      const preCol = findPreColumn(columns, col);
      if (preCol) {
        const changeCol = `change_${col}`;
        nextRows = nextRows.map((r) => {
          const post = r[col];
          const pre = r[preCol];
          return {
            ...r,
            [changeCol]: typeof post === "number" && typeof pre === "number" ? post - pre : null,
          };
        });
        nextColumns.push(changeCol);
        changeColsAdded.push(changeCol);
      }
    }
  }

  let nextRelevantCols = relevantCols;
  if (changeColsAdded.length > 0 && question) {
    const q = question.toLowerCase();
    if (IMPROVE_WORDS.some((w) => q.includes(w))) {
      nextRelevantCols = [...relevantCols, ...changeColsAdded];
    }
  }

  return { rows: nextRows, columns: nextColumns, relevantCols: nextRelevantCols };
}

// Upper bound on findings handed to the LLM for climax selection/narration.
// correlationFindings() is O(columns^2), so an uncapped list scales with
// dataset width, not row count -- bounding it keeps the narration prompt
// (and thus its latency) predictable regardless of how many columns a
// dataset has, while still giving the LLM far more range than a fixed top-5.
const MAX_FINDINGS_FOR_NARRATION = 40;

export function analyzeAndBuildStoryArc(
  rows: Row[],
  columns: string[],
  question: string | null,
  columnMeta: ColumnClassification | null
): { storyArc: StoryArc; findingsCount: number; rows: Row[] } {
  const { rows: finalRows, columns: finalColumns, relevantCols } = addChangeColumns(
    rows,
    columns,
    question,
    columnMeta?.relevant_cols ?? []
  );

  const findings = analyze(finalRows, finalColumns, {
    question,
    relevantCols,
    questionType: columnMeta?.question_type ?? null,
    independentVar: columnMeta?.independent_var ?? null,
    dependentVar: columnMeta?.dependent_var ?? null,
  });
  // Every finding up to MAX_FINDINGS_FOR_NARRATION goes to the story arc (and
  // the LLM) so it can pick the best narrative climax itself, not just the
  // highest insight.ts score -- charts are rendered lazily in narrate() only
  // for whichever findings end up referenced, so this doesn't mean rendering
  // a chart per finding here.
  const ranked = rankFindings(findings, MAX_FINDINGS_FOR_NARRATION, relevantCols);
  const storyArc = buildStoryArc(ranked, finalRows.length, finalColumns.length, finalColumns, question);
  return { storyArc, findingsCount: ranked.length, rows: finalRows };
}

/** Narrates the story arc and folds the LLM's climax choice (and its
 * implication/first action, for anything that still keys off a single
 * finding) back into the returned storyArc. Charts are rendered here,
 * lazily, only for findings the narration actually references (via chart
 * blocks nested inside any chapter, or the chosen climax), since the LLM
 * sees every finding rather than a pre-rendered top 5. */
export async function narrate(
  storyArc: StoryArc,
  industry: string | null,
  question: string | null,
  rows: Row[] | null,
  preferredProvider?: string | null
): Promise<{ storyArc: StoryArc; narration: StoryNarrationResult }> {
  const result = await generateStoryBlocks(storyArc, industry, question, preferredProvider);

  const updatedArc: StoryArc = {
    ...storyArc,
    hook: result.hook,
    implication: result.implication,
    action: result.actions[0] ?? storyArc.action,
    climax: result.climaxIndex !== null ? (storyArc.findings[result.climaxIndex] ?? storyArc.climax) : storyArc.climax,
  };

  if (rows) {
    const referenced = new Set<number>();
    for (const chapter of result.chapters) {
      for (const b of chapter.blocks) if (b.type === "chart") referenced.add(b.findingRef);
    }
    if (result.climaxIndex !== null) referenced.add(result.climaxIndex);
    for (const idx of referenced) {
      const finding = updatedArc.findings[idx];
      if (finding && !finding.extra.chart_b64) {
        const b64 = chartForFinding(finding, rows);
        if (b64) finding.extra.chart_b64 = b64;
      }
    }
  }

  return { storyArc: updatedArc, narration: result };
}

export interface GeneratedStory {
  storyArc: StoryArc;
  findingsCount: number;
  narration: StoryNarrationResult;
}

/** Parses, classifies, analyzes, and narrates a structured upload, all in
 * one call. This MUST stay a single Inngest step (not split across several
 * step.run calls) -- Inngest checkpoints every step's return value as
 * durable run state, and the raw parsed rows (parsed.rows / built.rows) can
 * easily be many MB for a real dataset, which blows past Inngest's run state
 * size limit ("run state size limit exceeded") if they're ever returned from
 * a step. Keeping rows in this function's local scope means they never cross
 * a step boundary at all -- only the final, much smaller narrated result
 * does. The tradeoff: a failed narrate() call retries the whole thing
 * (re-parse + re-analyze), not just narration, since there's no
 * checkpoint between the sub-phases anymore. Sub-phases are still
 * individually timed via withTiming for visibility, just not as separate
 * durable Inngest steps. */
export async function generateStructuredStory(
  reportId: string,
  upload: UploadFileRef,
  question: string | null,
  industry: string | null,
  preferredProvider?: string | null
): Promise<GeneratedStory> {
  const parsed = await withTiming(reportId, "parse-upload", () => parseUploadTabular(upload))();

  const columnMeta = question
    ? await withTiming(reportId, "classify-question", () =>
        classifyQuestion(question, parsed.columns, parsed.rows, preferredProvider)
      )()
    : null;

  const built = await withTiming(reportId, "analyze-and-chart", () =>
    analyzeAndBuildStoryArc(parsed.rows, parsed.columns, question, columnMeta)
  )();

  const narrated = await withTiming(reportId, "narrate", () =>
    narrate(built.storyArc, industry, question, built.rows, preferredProvider)
  )();

  return {
    storyArc: narrated.storyArc,
    findingsCount: built.findingsCount,
    narration: narrated.narration,
  };
}

/** Same reasoning as generateStructuredStory -- kept as one step so no large
 * intermediate value (here, the raw document text) is ever returned from a
 * step.run call. */
export async function generateTextStory(
  reportId: string,
  upload: UploadFileRef,
  question: string | null,
  industry: string | null,
  preferredProvider?: string | null
): Promise<Omit<GeneratedStory, "findingsCount">> {
  const text = await withTiming(reportId, "parse-upload", () => parseUploadText(upload))();
  const storyArc = await withTiming(reportId, "build-text-story-arc", () => buildTextStoryArc(text, question))();
  const narrated = await withTiming(reportId, "narrate", () => narrate(storyArc, industry, question, null, preferredProvider))();
  return { storyArc: narrated.storyArc, narration: narrated.narration };
}

export function brandFor(report: ReportBrandRef, user: UserBrandRef): ExportBrand {
  return {
    isBranded: report.isBranded,
    primaryColor: user.brandPrimary,
    logoUrl: user.brandLogoUrl,
    font: user.brandFont,
  };
}

export async function buildAndUploadPdf(
  reportId: string,
  title: string,
  narration: StoryNarrationResult,
  storyArc: StoryArc,
  brand: ExportBrand,
  filename: string
): Promise<string> {
  const metadata = {
    title,
    datasetLabel: buildDatasetLabel(filename, storyArc.rowCount, storyArc.columnCount),
    dataConfidence: storyArc.dataConfidence,
    question: storyArc.question,
  };
  const buffer = await renderReportPdf({ metadata, narration, findings: storyArc.findings, brand });
  const objectKey = `reports/${reportId}/report.pdf`;
  await uploadBytes(objectKey, buffer, "application/pdf");
  return objectKey;
}

export async function buildAndUploadWord(
  reportId: string,
  title: string,
  narration: StoryNarrationResult,
  storyArc: StoryArc,
  brand: ExportBrand,
  filename: string
): Promise<string> {
  const metadata = {
    title,
    datasetLabel: buildDatasetLabel(filename, storyArc.rowCount, storyArc.columnCount),
    dataConfidence: storyArc.dataConfidence,
    question: storyArc.question,
  };
  const buffer = await buildWordDocument({ metadata, narration, findings: storyArc.findings, brand });
  const objectKey = `reports/${reportId}/report.docx`;
  await uploadBytes(objectKey, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  return objectKey;
}

export async function buildAndUploadPptx(
  reportId: string,
  storyArc: StoryArc,
  narration: StoryNarrationResult,
  theme: string | null,
  brand: ExportBrand,
  filename: string
): Promise<string> {
  const metadata = {
    title: deriveTitle(narration.headline),
    datasetLabel: buildDatasetLabel(filename, storyArc.rowCount, storyArc.columnCount),
    dataConfidence: storyArc.dataConfidence,
    question: storyArc.question,
  };
  const buffer = await buildPptx({ metadata, narration, storyArc, theme, brand });
  const objectKey = `reports/${reportId}/report.pptx`;
  await uploadBytes(objectKey, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  return objectKey;
}
