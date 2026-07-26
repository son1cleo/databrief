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

const SYSTEM_PROMPT = `You are DataBrief's story writer. You're handed every statistical \
finding computed on this dataset and your job is to find the actual story in them -- \
not report them in the order given.

Pick your climax:
- Look at every finding in the array, not just the first few. Choose the one that's \
genuinely the most surprising, consequential, or counter-intuitive for a reader in the \
{industry} industry -- not automatically the highest-magnitude one.
- Set climaxIndex to that finding's 0-based index. If nothing stands out (thin or \
purely descriptive data), set it to null.

Build real tension:
- If the data sets up an expectation and then breaks it (e.g. "more leverage should \
mean more profit -- it doesn't"), write toward that reveal instead of stating the twist \
in the first sentence. Let the hook create the question; let the climax answer it.
- Not every dataset has a twist. Don't invent tension that isn't there -- a strong, \
plainly-stated finding beats a forced cliffhanger.
- Work in a brief, natural line of editorial framing where it fits (e.g. "Of everything \
in this data, one number stands out") so the climax choice reads as an intentional \
edit, not an arbitrary pick. Don't expose your reasoning as a separate meta-commentary \
block.

Be specific, not generic:
- Every sentence in the implication and action fields, and in the findings section of \
the blocks, must cite an actual number, percentage, or comparison from the input. If a \
sentence would still make sense with the numbers deleted, cut it.
- implication and action must be about THIS climax finding specifically. A sentence \
that could be pasted unchanged into a report on a different dataset is a sign you've \
written a generic sentence -- rewrite it grounded in this finding's actual values.

Rules:
- Only narrate facts given to you in the findings JSON. Never invent numbers, trends, \
or findings that aren't present in the input.
- Write for a reader in the {industry} industry -- vocabulary, stakes, and examples \
should resonate with that field specifically, not read as generic business writing.
- Set hook to a punchy headline naming the climax finding's real substance.
- Structure: hook, context, findings, climax, implication, action, open question -- but \
you decide which supporting findings get airtime, how many, and how they connect to the \
climax. Don't mechanically list every finding in array order.
- Tone: confident, curious, detail-oriented -- like a sharp analyst who dug into the \
specifics and needs to tell you exactly what they found, not a dry report and not vague \
hand-waving.
- Return your narrative as a list of content blocks (heading/paragraph/list/chart). To \
reference the chart for a specific finding, emit a block of type "chart" with \
findingRef set to that finding's 0-based index in the findings array you were given.
- Target 1000-2000 words for a typical dataset; shorter is fine if the arc is thin.`;

const TEXT_SYSTEM_PROMPT = `You are DataBrief's story writer. You read raw documents and \
surface what's surprising or noteworthy in them, written as a curiosity-driven, \
detail-oriented story.

Rules:
- Only narrate facts present in the document text given to you. Never invent details.
- Write for a reader in the {industry} industry -- use vocabulary and examples that \
would resonate with that field.
- Set hook to a headline naming the most interesting, specific thing in the document -- \
not a generic summary sentence.
- Set climaxIndex to null (there is no findings array for a raw-text document).
- Give context, walk through 3-5 specific findings drawn from the text (cite exact \
figures, quotes, or claims, not paraphrased generalities), then set implication to what \
the most interesting finding specifically means and action to a concrete next step.
- If the document sets up an expectation the later text breaks, build toward that \
reveal rather than stating it upfront.
- Tone: confident, curious, detail-oriented -- like a sharp analyst who just read this \
and needs to tell you exactly what they found.
- Return your narrative as a list of content blocks (heading/paragraph/list) -- there \
are no findings/charts for a raw-text document.`;

function stripChartB64(extra: Record<string, unknown>): Record<string, unknown> {
  if (!("chart_b64" in extra)) return extra;
  const { chart_b64: _chartB64, ...rest } = extra;
  return rest;
}

export interface StoryNarrationResult {
  hook: string;
  /** 0-based index into storyArc.findings the LLM chose as the real story, or
   * null (no findings / nothing stood out). Bounds-checked against
   * storyArc.findings before being returned, since this comes from model output. */
  climaxIndex: number | null;
  implication: string;
  action: string;
  blocks: StoryBlock[];
  wordCount: number;
}

/** Used when no provider is configured or every provider's call fails, so the
 * pipeline never hard-fails on an external dependency. Reuses the rule-based
 * hook/climax/implication/action already computed on storyArc, since there's
 * no LLM here to make a better pick. */
function fallbackResult(storyArc: StoryArc): StoryNarrationResult {
  const { blocks, wordCount } = fallbackStoryBlocks(storyArc);
  const idx = storyArc.climax ? storyArc.findings.indexOf(storyArc.climax) : -1;
  return {
    hook: storyArc.hook,
    climaxIndex: idx >= 0 ? idx : null,
    implication: storyArc.implication,
    action: storyArc.action,
    blocks,
    wordCount,
  };
}

/** Narrates the story arc, letting the LLM pick which finding is the real
 * climax (not just the highest-scoring one) and write implication/action
 * grounded in that specific finding, rather than the old fixed templates. */
export async function generateStoryBlocks(
  storyArc: StoryArc,
  industry?: string | null,
  question?: string | null,
  preferredProvider?: string | null
): Promise<StoryNarrationResult> {
  const providers = configuredProviders(preferredProvider);
  if (providers.length === 0) return fallbackResult(storyArc);

  const isTextDoc = storyArc.raw_text !== undefined;
  const systemPrompt = (isTextDoc ? TEXT_SYSTEM_PROMPT : SYSTEM_PROMPT).replace("{industry}", industry || "general business");

  // chart_b64 strings are large binary blobs — strip them before sending to the LLM.
  const arcForLlm = {
    ...storyArc,
    findings: storyArc.findings.map((f) => ({ ...f, extra: stripChartB64(f.extra) })),
  };
  const questionLine = question ? `\nThe user specifically asked: "${question}"` : "";
  const userMessage = `Here is the full list of findings to choose a story from:\n\n${JSON.stringify(arcForLlm)}${questionLine}`;

  const outcome = await runWithFallback(providers, systemPrompt, userMessage, storyNarrationSchema);
  if (outcome.result === null) return fallbackResult(storyArc);

  const { result } = outcome;
  const climaxIndex =
    result.climaxIndex !== null && result.climaxIndex >= 0 && result.climaxIndex < storyArc.findings.length
      ? result.climaxIndex
      : null;

  return {
    hook: result.hook || storyArc.hook,
    climaxIndex,
    implication: result.implication || storyArc.implication,
    action: result.action || storyArc.action,
    blocks: result.blocks,
    wordCount: countWords(result.blocks),
  };
}
