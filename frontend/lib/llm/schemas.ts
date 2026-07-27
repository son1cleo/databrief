import { z } from "zod";

export const columnClassificationSchema = z.object({
  relevant_cols: z.array(z.string()).describe("Column names relevant to answering the question (2-6 max)"),
  independent_var: z.string().nullable().describe("The input/cause column being tested, or null"),
  dependent_var: z.string().nullable().describe("The outcome column being measured, or null"),
  question_type: z.enum(["ranking", "dose_response", "comparison", "trend", "general"]),
});

export type ColumnClassification = z.infer<typeof columnClassificationSchema>;

// Structured narration contract. React-PDF/docx/pptxgenjs can't render
// arbitrary HTML (unlike the old WeasyPrint pipeline), so the LLM emits a
// block list instead — all three export formats consume this same shape.
export const storyBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2)]), text: z.string() }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("list"), items: z.array(z.string()) }),
  z.object({ type: z.literal("chart"), findingRef: z.number().int().describe("0-based index into the findings array") }),
]);

export type StoryBlock = z.infer<typeof storyBlockSchema>;

// Fixed journalistic chapter skeleton -- the LLM decides which findings go
// in which chapter and writes freely within each, but the 3 slots and their
// order are fixed for visual consistency across every report.
export const CHAPTER_IDS = ["macro_trend", "anomalies", "correlated_drivers"] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

/** Heuristic finding-type -> chapter mapping. Used by the no-LLM fallback
 * narrator to bucket findings, and by the real LLM path as a fallback
 * placement when a finding needs a chart injected but wasn't referenced by
 * any chapter's blocks (see ensureClimaxChart in lib/llm.ts). */
export function chapterForFindingType(type: string): ChapterId {
  if (type === "trend" || type === "descriptive") return "macro_trend";
  if (type === "outlier" || type === "data_quality" || type === "distribution") return "anomalies";
  return "correlated_drivers"; // correlation, dose_response, ranking (as a supporting finding)
}

export const chapterSchema = z.object({
  id: z.enum(CHAPTER_IDS),
  title: z.string().describe('Chapter heading, e.g. "Chapter I — The Macro Trend"'),
  blocks: z
    .array(storyBlockSchema)
    .describe("This chapter's content. Keep brief (even a single short paragraph) rather than fabricate content if the dataset has nothing genuinely relevant to this chapter."),
});
export type Chapter = z.infer<typeof chapterSchema>;

export const storyNarrationSchema = z.object({
  headline: z.string().describe("A punchy, journalistic title summarizing the central takeaway -- distinct from the hook, more like a newspaper headline"),
  hook: z.string().describe("A 3-sentence narrative opening establishing the core tension or discovery, grounded in the climax finding's actual numbers"),
  climaxIndex: z
    .number()
    .int()
    .nullable()
    .describe(
      "0-based index into the findings array of whichever finding is genuinely the best story here (most surprising/consequential for the industry), not necessarily the highest-magnitude one. Null if there are no findings (raw-text documents) or nothing stands out."
    ),
  chapters: z
    .array(chapterSchema)
    .describe(
      `Exactly 3 chapters, one each for ids "${CHAPTER_IDS.join('", "')}", in that order -- macro_trend (baseline/overall trend), anomalies (outliers/surprises), correlated_drivers (relationships between variables)`
    ),
  focusQuestionCallout: z
    .string()
    .nullable()
    .describe("A direct answer to the user's focus question, citing real numbers. Null if the user didn't ask one."),
  implication: z
    .string()
    .describe("What the climax finding specifically means, citing its actual numbers -- never a generic sentence that could apply to any dataset"),
  actions: z
    .array(z.string())
    .describe("Exactly 3 concrete, prescriptive next steps ('action pillars'), each grounded in a specific finding's actual numbers"),
});

export type StoryNarration = z.infer<typeof storyNarrationSchema>;

// Shared return shape for both the real LLM path (lib/llm.ts) and the
// deterministic no-LLM fallback (lib/llm/fallbackNarrator.ts) -- declared
// here (not in either of those files) so neither has to import the other.
export interface StoryNarrationResult {
  headline: string;
  hook: string;
  /** 0-based index into storyArc.findings chosen as the real story, or null
   * (no findings / nothing stood out). */
  climaxIndex: number | null;
  /** Exactly 3, one per CHAPTER_IDS, in canonical order. */
  chapters: Chapter[];
  focusQuestionCallout: string | null;
  implication: string;
  /** Exactly 3. */
  actions: string[];
  wordCount: number;
}
