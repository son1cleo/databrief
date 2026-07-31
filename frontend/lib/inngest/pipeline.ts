import "server-only";
import { prisma } from "@/lib/db";
import { downloadBytes, uploadBytes } from "@/lib/storage";
import { parseTabular, parseText, type TabularData } from "@/lib/fileParsing";
import { analyze, findPreColumn, buildColumnSummaries, type Row } from "@/lib/analysis";
import { rankFindings } from "@/lib/insight";
import { chartForFinding, chartDataForFinding } from "@/lib/charts";
import { buildStoryArc, buildTextStoryArc, type StoryArc } from "@/lib/story";
import { generateStoryBlocks } from "@/lib/llm";
import { generateAutoQuestions, generateAutoQuestionsFromText, planQuestions } from "@/lib/llm/planner";
import { MAX_QUESTIONS, type QuestionPlanEntry, type StoryNarrationResult } from "@/lib/llm/schemas";
import { renderReportPdf } from "@/lib/exports/pdf";
import { buildWordDocument } from "@/lib/exports/word";
import { buildPptx } from "@/lib/exports/pptx";
import { buildDatasetLabel, type ExportBrand } from "@/lib/exports/types";
import { stripMarkdown } from "@/lib/markdown";
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
  // The narrator writes Markdown in the hook/headline; a title lands in plain
  // contexts (report list, PDF document metadata) that can't style it.
  const title = stripMarkdown(hook).trim().replace(/\.+$/, "");
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

const POST_PREFIXES = ["post_", "_post", "after_"];
const IMPROVE_WORDS = ["better", "worse", "improve", "change", "help", "hurt", "impact", "affect"];

/** Auto-computes change_X columns for detected pre/post pairs so they're
 * first-class columns for the stats engine. Always runs unconditionally
 * (cheap, deterministic) -- whether a change column actually matters to a
 * given question is decided separately in analyzeAndBuildStoryArc, once the
 * question plan exists, rather than gating the computation itself. */
export function addChangeColumns(rows: Row[], columns: string[]): { rows: Row[]; columns: string[]; changeColsAdded: string[] } {
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

  return { rows: nextRows, columns: nextColumns, changeColsAdded };
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
  questions: string[],
  plan: QuestionPlanEntry[] | null
): { storyArc: StoryArc; findingsCount: number; rows: Row[] } {
  const { rows: changedRows, columns: changedColumns, changeColsAdded } = addChangeColumns(rows, columns);

  // v1: global union -- if ANY question implies "did this get better/worse",
  // every plan entry gets the change_ columns appended to its relevant_cols.
  // A more precise per-entry version (only the entry whose dependent_var
  // matches) is a refinement to make only if narration misplacement is
  // actually observed in practice.
  const questionsText = questions.join(" ").toLowerCase();
  const shouldAddChangeCols = changeColsAdded.length > 0 && IMPROVE_WORDS.some((w) => questionsText.includes(w));
  const finalPlan: QuestionPlanEntry[] | null =
    plan && shouldAddChangeCols
      ? plan.map((entry) => ({ ...entry, relevant_cols: [...entry.relevant_cols, ...changeColsAdded] }))
      : plan;

  // No plan (planning never ran -- zero questions and auto-gen also came up
  // empty) falls to analyze()'s own legacy no-plan branch, the exact call
  // shape lib/datasetAnalysis.ts already uses -- must stay behaviorally
  // identical to the pre-redesign pipeline.
  const findings = finalPlan ? analyze(changedRows, changedColumns, { plan: finalPlan }) : analyze(changedRows, changedColumns);

  // Every finding up to MAX_FINDINGS_FOR_NARRATION goes to the story arc (and
  // the LLM) so it can pick the best narrative climax itself, not just the
  // highest insight.ts score -- charts are rendered lazily in narrate() only
  // for whichever findings end up referenced, so this doesn't mean rendering
  // a chart per finding here.
  const ranked = rankFindings(findings, { topN: MAX_FINDINGS_FOR_NARRATION, questionCount: questions.length });
  const storyArc = buildStoryArc(ranked, changedRows.length, changedColumns.length, changedColumns, questions, finalPlan);
  return { storyArc, findingsCount: ranked.length, rows: changedRows };
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
  rows: Row[] | null,
  preferredProvider?: string | null
): Promise<{ storyArc: StoryArc; narration: StoryNarrationResult }> {
  const result = await generateStoryBlocks(storyArc, industry, preferredProvider);

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
      if (!finding) continue;
      if (!finding.extra.chart_b64) {
        const b64 = chartForFinding(finding, rows);
        if (b64) finding.extra.chart_b64 = b64;
      }
      if (!finding.extra.chart_data) {
        const data = chartDataForFinding(finding, rows);
        if (data) finding.extra.chart_data = data;
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

/** Parses, plans, analyzes, and narrates a structured upload, all in one
 * call. This MUST stay a single Inngest step (not split across several
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
 * durable Inngest steps.
 *
 * When the user supplied no questions, auto-generates a small set before
 * planning -- the report always ends up structured around answering
 * something concrete, never a generic dataset-wide dump. */
export async function generateStructuredStory(
  reportId: string,
  upload: UploadFileRef,
  questions: string[],
  industry: string | null,
  preferredProvider?: string | null
): Promise<GeneratedStory> {
  const parsed = await withTiming(reportId, "parse-upload", () => parseUploadTabular(upload))();

  const rawQuestions = questions.slice(0, MAX_QUESTIONS);
  const finalQuestions =
    rawQuestions.length > 0
      ? rawQuestions
      : await withTiming(reportId, "auto-questions", () =>
          generateAutoQuestions(
            parsed.columns,
            buildColumnSummaries(parsed.rows, parsed.columns),
            parsed.rows.slice(0, 5),
            industry,
            preferredProvider
          )
        )();

  const plan =
    finalQuestions.length > 0
      ? await withTiming(reportId, "plan-questions", () =>
          planQuestions(finalQuestions, parsed.columns, buildColumnSummaries(parsed.rows, parsed.columns), preferredProvider)
        )()
      : null;

  const built = await withTiming(reportId, "analyze-and-chart", () =>
    analyzeAndBuildStoryArc(parsed.rows, parsed.columns, finalQuestions, plan)
  )();

  const narrated = await withTiming(reportId, "narrate", () => narrate(built.storyArc, industry, built.rows, preferredProvider))();

  return {
    storyArc: narrated.storyArc,
    findingsCount: built.findingsCount,
    narration: narrated.narration,
  };
}

/** Same reasoning as generateStructuredStory -- kept as one step so no large
 * intermediate value (here, the raw document text) is ever returned from a
 * step.run call. No deterministic-tool plan exists for raw text (there's no
 * Finding[] to plan against), so this only auto-generates questions when
 * none were supplied -- narrationAgent.ts still gives each one its own
 * chapter. */
export async function generateTextStory(
  reportId: string,
  upload: UploadFileRef,
  questions: string[],
  industry: string | null,
  preferredProvider?: string | null
): Promise<Omit<GeneratedStory, "findingsCount">> {
  const text = await withTiming(reportId, "parse-upload", () => parseUploadText(upload))();

  const rawQuestions = questions.slice(0, MAX_QUESTIONS);
  const finalQuestions =
    rawQuestions.length > 0
      ? rawQuestions
      : await withTiming(reportId, "auto-questions", () => generateAutoQuestionsFromText(text, industry, preferredProvider))();

  const storyArc = await withTiming(reportId, "build-text-story-arc", () => buildTextStoryArc(text, finalQuestions))();
  const narrated = await withTiming(reportId, "narrate", () => narrate(storyArc, industry, null, preferredProvider))();
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
    question: storyArc.questions[0] ?? null,
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
    question: storyArc.questions[0] ?? null,
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
    question: storyArc.questions[0] ?? null,
  };
  const buffer = await buildPptx({ metadata, narration, storyArc, theme, brand });
  const objectKey = `reports/${reportId}/report.pptx`;
  await uploadBytes(objectKey, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  return objectKey;
}
