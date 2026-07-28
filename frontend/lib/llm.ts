import "server-only";
import { configuredProviders } from "@/lib/llm/providers";
import { runWithFallback } from "@/lib/llm/fallbackGraph";
import { columnClassificationSchema, type ColumnClassification, type StoryNarrationResult } from "@/lib/llm/schemas";
import { fallbackNarrationResult } from "@/lib/llm/fallbackNarrator";
import { runStructuredNarrationTurns, runTextNarrationTurns } from "@/lib/llm/narrationAgent";
import type { StoryArc } from "@/lib/story";

const COLUMN_RESOLVER_PROMPT = `You are a data analyst. A user has uploaded a dataset and asked a question. \
Your job is to identify which columns are relevant to answering their question.

question_type guide:
- "ranking": who/what has the most/best/highest
- "dose_response": does more X lead to better/worse Y?
- "comparison": how do groups compare?
- "trend": how did X change over time?
- "general": anything else

Rules:
- Only return column names that actually exist in the dataset
- relevant_cols should include all columns needed to answer the question (2-6 max)
- independent_var is the input/cause being tested -- null if not applicable
- dependent_var is the outcome being measured -- null if not applicable`;

/** One small LLM call to identify which columns answer the question. Falls
 * back to the empty/general result on any failure — analyze()'s own
 * keyword-matching fallback (questionRelevantColumns) takes over from there. */
export async function identifyRelevantColumns(
  question: string,
  columns: string[],
  sampleValues: Record<string, unknown[]>,
  preferredProvider?: string | null
): Promise<ColumnClassification> {
  const fallback: ColumnClassification = {
    relevant_cols: [],
    independent_var: null,
    dependent_var: null,
    question_type: "general",
  };

  const providers = configuredProviders(preferredProvider);
  if (providers.length === 0) return fallback;

  const colContext = Object.fromEntries(
    Object.entries(sampleValues).map(([col, vals]) => [col, vals.slice(0, 3).map(String)])
  );
  const userMessage = `Question: "${question}"\n\nDataset columns with sample values:\n${JSON.stringify(colContext, null, 2)}`;

  const outcome = await runWithFallback(providers, COLUMN_RESOLVER_PROMPT, userMessage, columnClassificationSchema);
  if (outcome.result === null) return fallback;

  const { result } = outcome;
  return {
    relevant_cols: result.relevant_cols.filter((c) => columns.includes(c)),
    independent_var: result.independent_var && columns.includes(result.independent_var) ? result.independent_var : null,
    dependent_var: result.dependent_var && columns.includes(result.dependent_var) ? result.dependent_var : null,
    question_type: result.question_type,
  };
}

/** Narrates the story arc as a fixed sequence of smaller LLM calls (see
 * lib/llm/narrationAgent.ts for the full turn-by-turn design and why a
 * single completion was replaced). Falls back to the deterministic
 * template narrator if no providers are configured, or if any turn in the
 * sequence exhausts its entire provider chain. */
export async function generateStoryBlocks(
  storyArc: StoryArc,
  industry?: string | null,
  question?: string | null,
  preferredProvider?: string | null
): Promise<StoryNarrationResult> {
  const providers = configuredProviders(preferredProvider);
  if (providers.length === 0) return fallbackNarrationResult(storyArc);

  const isTextDoc = storyArc.raw_text !== undefined;
  const result = isTextDoc
    ? await runTextNarrationTurns(storyArc, industry, question, providers)
    : await runStructuredNarrationTurns(storyArc, industry, question, providers);

  return result ?? fallbackNarrationResult(storyArc);
}
