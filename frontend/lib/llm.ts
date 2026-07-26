import "server-only";
import { configuredProviders } from "@/lib/llm/providers";
import { runWithFallback } from "@/lib/llm/fallbackGraph";
import { columnClassificationSchema, storyNarrationSchema, type ColumnClassification, type StoryBlock } from "@/lib/llm/schemas";
import { fallbackStoryBlocks, countWords } from "@/lib/llm/fallbackNarrator";
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
  sampleValues: Record<string, unknown[]>
): Promise<ColumnClassification> {
  const fallback: ColumnClassification = {
    relevant_cols: [],
    independent_var: null,
    dependent_var: null,
    question_type: "general",
  };

  const providers = configuredProviders();
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

const SYSTEM_PROMPT = `You are DataBrief's story writer. You turn pre-computed statistical \
findings into a curiosity-driven narrative that makes the reader lean forward.

Rules:
- Only narrate the facts given to you in the story arc JSON. Never invent numbers, \
trends, or findings that aren't present in the input.
- Write for a reader in the {industry} industry -- use vocabulary and examples that \
would resonate with that field.
- Follow the story arc structure exactly: open with the hook, establish context, walk \
through the findings in order, build to the climax, explain the implication, recommend \
the action, and close with the open question.
- Tone: confident, curious, a little provocative -- like a smart colleague who just \
found something you need to see, not a dry report.
- Return your narrative as a list of content blocks (heading/paragraph/list/chart). To \
reference the chart for a specific finding, emit a block of type "chart" with \
findingRef set to that finding's 0-based index in the findings array you were given.
- Target 1000-2000 words for a typical dataset; shorter is fine if the arc is thin.`;

const TEXT_SYSTEM_PROMPT = `You are DataBrief's story writer. You read raw documents and \
surface what's surprising or noteworthy in them, written as a curiosity-driven story.

Rules:
- Only narrate facts present in the document text given to you. Never invent details.
- Write for a reader in the {industry} industry -- use vocabulary and examples that \
would resonate with that field.
- Open with a hook naming the most interesting thing in the document, give context, \
walk through 3-5 specific findings drawn from the text, then close with an implication \
and a question worth investigating further.
- Tone: confident, curious, a little provocative -- like a smart colleague who just \
read this and needs to tell you about it.
- Return your narrative as a list of content blocks (heading/paragraph/list) -- there \
are no findings/charts for a raw-text document.`;

function stripChartB64(extra: Record<string, unknown>): Record<string, unknown> {
  if (!("chart_b64" in extra)) return extra;
  const { chart_b64: _chartB64, ...rest } = extra;
  return rest;
}

/** Returns (blocks, wordCount). Falls back to a deterministic template if no
 * provider is configured or every configured provider's call fails, so the
 * pipeline never hard-fails on an external dependency. */
export async function generateStoryBlocks(
  storyArc: StoryArc,
  industry?: string | null,
  question?: string | null
): Promise<{ blocks: StoryBlock[]; wordCount: number }> {
  const providers = configuredProviders();
  if (providers.length === 0) return fallbackStoryBlocks(storyArc);

  const isTextDoc = storyArc.raw_text !== undefined;
  const systemPrompt = (isTextDoc ? TEXT_SYSTEM_PROMPT : SYSTEM_PROMPT).replace("{industry}", industry || "general business");

  // chart_b64 strings are large binary blobs — strip them before sending to the LLM.
  const arcForLlm = {
    ...storyArc,
    findings: storyArc.findings.map((f) => ({ ...f, extra: stripChartB64(f.extra) })),
  };
  const questionLine = question ? `\nThe user specifically asked: "${question}"` : "";
  const userMessage = `Here is the pre-computed story arc to narrate:\n\n${JSON.stringify(arcForLlm)}${questionLine}`;

  const outcome = await runWithFallback(providers, systemPrompt, userMessage, storyNarrationSchema);
  if (outcome.result === null) return fallbackStoryBlocks(storyArc);

  return { blocks: outcome.result.blocks, wordCount: countWords(outcome.result.blocks) };
}
