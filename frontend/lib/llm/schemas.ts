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

export const storyNarrationSchema = z.object({
  hook: z.string().describe("A punchy, curiosity-driven headline naming the real story, grounded in the climax finding's actual numbers"),
  climaxIndex: z
    .number()
    .int()
    .nullable()
    .describe(
      "0-based index into the findings array of whichever finding is genuinely the best story here (most surprising/consequential for the industry), not necessarily the highest-magnitude one. Null if there are no findings (raw-text documents) or nothing stands out."
    ),
  implication: z
    .string()
    .describe("What the climax finding specifically means, citing its actual numbers -- never a generic sentence that could apply to any dataset"),
  action: z.string().describe("A concrete, specific next step grounded in the climax finding's actual numbers"),
  blocks: z.array(storyBlockSchema),
});

export type StoryNarration = z.infer<typeof storyNarrationSchema>;
