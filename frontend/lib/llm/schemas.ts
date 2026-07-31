import { z } from "zod";

// ---------------------------------------------------------------------------
// Question planning (lib/llm/planner.ts) -- run BEFORE any analysis tool.
// Decides, per submitted question, whether the dataset can answer it, which
// columns matter, and which of the deterministic tools in lib/analysis.ts
// actually need to run -- replacing the old single-question column-relevance
// classifier (columnClassificationSchema, removed) with an explicit plan
// lib/analysis.ts's analyze() executes directly.
// ---------------------------------------------------------------------------

export const MAX_QUESTIONS = 5;

export const generatedQuestionsSchema = z.object({
  questions: z
    .array(z.string())
    .describe(
      `2-4 of the most valuable, specific questions this dataset can answer, phrased the way a \
business stakeholder would ask them (not a statistics term) -- favor questions that surface a \
real decision or risk, not "what is the average of X."`
    ),
});
export type GeneratedQuestions = z.infer<typeof generatedQuestionsSchema>;

export const ANALYSIS_TOOLS = [
  "descriptive",
  "trend",
  "outlier",
  "correlation",
  "distribution",
  "ranking",
  "comparison",
  "dose_response",
] as const;
export type AnalysisTool = (typeof ANALYSIS_TOOLS)[number];

export const questionPlanEntrySchema = z.object({
  questionIndices: z
    .array(z.number().int())
    .describe(
      "0-based indices into the submitted questions array this entry covers -- more than one index means these questions were similar enough to answer together in one chapter."
    ),
  answerable: z.boolean().describe("False if this dataset's columns genuinely can't answer the question."),
  unanswerableReason: z.string().nullable().describe("Brief, specific reason if answerable is false, otherwise null."),
  relevant_cols: z.array(z.string()).describe("2-6 columns needed to answer this question."),
  independent_var: z.string().nullable().describe("The input/cause column being tested, or null if not applicable."),
  dependent_var: z.string().nullable().describe("The outcome column being measured, or null if not applicable."),
  tools: z
    .array(z.enum(ANALYSIS_TOOLS))
    .describe(
      `Only the tools that actually help answer this question -- descriptive (basic stats), trend (change over \
time), outlier (extreme values), correlation (relationship between two numeric columns), distribution \
(skew/concentration), ranking (who/what is highest), comparison (how groups differ), dose_response (does more X \
change Y, and is there a sweet spot).`
    ),
  depth: z.enum(["brief", "standard", "deep"]).describe("How much detail this question warrants."),
});
export type QuestionPlanEntry = z.infer<typeof questionPlanEntrySchema>;

export const multiQuestionPlanSchema = z.object({
  entries: z.array(questionPlanEntrySchema),
});
export type MultiQuestionPlan = z.infer<typeof multiQuestionPlanSchema>;

// ---------------------------------------------------------------------------
// Narration block contract. React-PDF/docx/pptxgenjs can't render arbitrary
// HTML (unlike the old WeasyPrint pipeline), so the LLM emits a block list
// instead -- all three export formats and the web viewer consume this shape.
// ---------------------------------------------------------------------------

export const storyBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2)]), text: z.string() }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("list"), items: z.array(z.string()) }),
  z.object({ type: z.literal("chart"), findingRef: z.number().int().describe("0-based index into the findings array") }),
]);

export type StoryBlock = z.infer<typeof storyBlockSchema>;

// Fixed 3-chapter shape -- ONLY still used by the deterministic no-LLM
// fallback narrator (lib/llm/fallbackNarrator.ts), which has no question
// plan to structure chapters around and no LLM to write dynamic subtitles.
// The real LLM narration path (lib/llm/narrationAgent.ts) builds one chapter
// per question/question-cluster from a QuestionPlanEntry instead of this
// fixed list -- see chapterTurnSchema and the Chapter interface below.
export const CHAPTER_IDS = ["macro_trend", "anomalies", "correlated_drivers"] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

/** Heuristic finding-type -> chapter mapping, used only by the fallback
 * narrator to bucket findings into its fixed 3-chapter shape. */
export function chapterForFindingType(type: string): ChapterId {
  if (type === "trend" || type === "descriptive") return "macro_trend";
  if (type === "outlier" || type === "data_quality" || type === "distribution") return "anomalies";
  return "correlated_drivers"; // correlation, dose_response, ranking (as a supporting finding)
}

const citedFindingIndicesField = z
  .array(z.number().int())
  .describe(
    "0-based indices (from the findings catalog you were given) of every finding this section discusses or cites a number from. Used so later sections know what's already been covered -- list every one you actually used, don't omit any."
  );

// Per-turn schemas for the multi-turn narration agent (lib/llm/narrationAgent.ts).
// Each turn produces one slice of StoryNarrationResult instead of one call
// producing the whole thing -- repetition across sections was the evidenced
// bug; each turn sees what earlier turns already wrote and is told not to
// restate it (see narrationAgent.ts's alreadyPublishedNote/citedFindingsNote).
export const climaxHookSchema = z.object({
  climaxIndex: z
    .number()
    .int()
    .nullable()
    .describe(
      "0-based index into the findings catalog of whichever finding is genuinely the best story here (most surprising/consequential), not necessarily the highest-magnitude one. Null if there are no findings or nothing stands out."
    ),
  headline: z.string().describe("A punchy, journalistic title summarizing the central takeaway -- distinct from the hook, more like a newspaper headline"),
  hook: z.string().describe("A 3-sentence narrative opening establishing the core tension or discovery, grounded in the climax finding's actual numbers"),
  citedFindingIndices: citedFindingIndicesField,
});
export type ClimaxHookTurn = z.infer<typeof climaxHookSchema>;

// What the model produces for one question-chapter turn. No `id` field --
// code decides chapter identity/position/labeling (which question(s) it
// answers, its numbering), not the model, since an unanswerable question is
// skipped deterministically before any turn runs and numbering must stay
// consistent regardless.
export const chapterTurnSchema = z.object({
  subtitle: z
    .string()
    .describe('A short descriptive subtitle for this chapter, e.g. "Did Marketing Spend Drive Signups?" -- code prepends "Chapter N -- " to it.'),
  blocks: z
    .array(storyBlockSchema)
    .describe("This chapter's content. Keep brief (even a single short paragraph) rather than fabricate content if the dataset has nothing genuinely relevant."),
  citedFindingIndices: citedFindingIndicesField,
});
export type ChapterTurn = z.infer<typeof chapterTurnSchema>;

export const actionsSchema = z.object({
  actions: z
    .array(z.string())
    .describe("Exactly 3 concrete, prescriptive next steps ('action pillars'), each grounded in a specific finding's actual numbers"),
  citedFindingIndices: citedFindingIndicesField,
});
export type ActionsTurn = z.infer<typeof actionsSchema>;

// Final assembled chapter -- merges the model-produced subtitle/blocks/
// citedFindingIndices (chapterTurnSchema) with code-populated identity
// fields. Not derived from a Zod schema since the model never produces this
// full shape directly.
export interface Chapter {
  /** "q0".."q{MAX_QUESTIONS-1}" for question chapters, "context" for the
   * trailing dataset-wide chapter, or a CHAPTER_IDS value on the fallback
   * narrator's fixed-shape path. */
  id: string;
  /** 0-based indices into the report's questions[] this chapter answers. Empty for "context" and for the fallback path. */
  questionIndices: number[];
  /** Verbatim question text(s) this chapter answers, joined with " / ". Null for "context", and for the legacy/fallback path (no per-chapter label). */
  questionLabel: string | null;
  title: string;
  blocks: StoryBlock[];
  citedFindingIndices: number[];
}

// Shared return shape for both the real LLM path (lib/llm/narrationAgent.ts)
// and the deterministic no-LLM fallback (lib/llm/fallbackNarrator.ts) --
// declared here (not in either of those files) so neither has to import the
// other.
export interface StoryNarrationResult {
  headline: string;
  hook: string;
  /** 0-based index into storyArc.findings chosen as the real story, or null
   * (no findings / nothing stood out). */
  climaxIndex: number | null;
  /** One per question/question-cluster (<= MAX_QUESTIONS), plus an optional
   * trailing "context" chapter -- variable length. Only the fallback
   * narrator still produces the old fixed 3-chapter shape. */
  chapters: Chapter[];
  /** Legacy-only: populated by the deterministic fallback narrator and by
   * pre-redesign DB rows read back from storage. The real LLM narration path
   * always sets this null -- a question's answer now opens its own chapter
   * (Chapter.questionLabel) instead of a separate callout box. */
  focusQuestionCallout: string | null;
  implication: string;
  /** Exactly 3 (or fewer if the model returned less and nothing was left to fall back on). */
  actions: string[];
  wordCount: number;
}
