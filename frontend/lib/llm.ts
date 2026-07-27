import "server-only";
import type { Finding } from "@/lib/analysis";
import { configuredProviders } from "@/lib/llm/providers";
import { runWithFallback } from "@/lib/llm/fallbackGraph";
import {
  columnClassificationSchema,
  storyNarrationSchema,
  CHAPTER_IDS,
  chapterForFindingType,
  type ColumnClassification,
  type Chapter,
  type ChapterId,
  type StoryNarrationResult,
} from "@/lib/llm/schemas";
import { fallbackNarrationResult } from "@/lib/llm/fallbackNarrator";
import { stripLeadIn, ensureDistinctHeadline, type StoryArc } from "@/lib/story";

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
finding computed on this dataset and your job is to find the actual story in them -- not \
report them in the order given. You write to a fixed structure: Headline, Hook, three \
chapters, and Strategic Actions -- but you decide what goes in each and how much.

Pick your climax:
- Look at every finding in the array, not just the first few. Choose the one that's \
genuinely the most surprising, consequential, or counter-intuitive for a reader in the \
{industry} industry -- not automatically the highest-magnitude one.
- Set climaxIndex to that finding's 0-based index. If nothing stands out (thin or purely \
descriptive data), set it to null.

Build real tension:
- If the data sets up an expectation and then breaks it (e.g. "more leverage should mean \
more profit -- it doesn't"), write toward that reveal instead of stating the twist in the \
first sentence. Let the hook create the question; let the climax answer it.
- Not every dataset has a twist. Don't invent tension that isn't there -- a strong, \
plainly-stated finding beats a forced cliffhanger.

Be specific, not generic:
- Every sentence in the chapters, implication, and actions must cite an actual number, \
percentage, or comparison from the input. If a sentence would still make sense with the \
numbers deleted, cut it.
- implication and actions must be about the actual findings in THIS dataset. A sentence \
that could be pasted unchanged into a report on a different dataset is a sign you've \
written a generic sentence -- rewrite it grounded in real values.

Structure (fixed shape, your content within it):
- headline: a punchy, journalistic title summarizing the central takeaway -- distinct \
from the hook, more like a newspaper headline than a sentence.
- hook: exactly 3 sentences establishing the core tension or discovery, grounded in the \
climax finding's real numbers.
- chapters: exactly 3, in this order --
  1. macro_trend: the baseline/overall direction in the data.
  2. anomalies: outliers, surprises, or things that break the expected pattern.
  3. correlated_drivers: relationships between variables -- what's driving what.
  You decide which findings support each chapter and how many to use. If a dataset \
genuinely has nothing relevant to one of these chapters (e.g. no time-series data for \
macro_trend), say so briefly in a sentence or two rather than fabricating content or \
stretching an unrelated finding to fit.
- focusQuestionCallout: if the user asked a specific question (given below), answer it \
directly here citing real numbers. Otherwise set it to null -- don't invent a question \
that wasn't asked.
- implication: what the climax finding specifically means, grounded in its actual values.
- actions: exactly 3 concrete, prescriptive next steps ("action pillars"), each tied to a \
specific finding's actual numbers -- not generic advice.

Never sound like a template or a data dump:
- Never start the headline or hook with "Yes --", "No --", "Answer:", or similar Q&A-style \
replies to an internal question -- write them as a standalone editorial headline and lead, \
not a reply to a prompt.
- headline and hook must say different things. headline is a short title; hook is 3 full \
sentences of context and tension. Never let one be a truncated copy or repeat of the other.
- NO REPETITION anywhere in the report: never reuse the same phrase or clause (3+ words in \
a row, e.g. "there is a sweet spot") across the headline, hook, and chapters. Say the same \
underlying fact in genuinely different words each time it comes up, or don't repeat it at all.
- BAN METADATA STATEMENTS: never mention row counts, column counts, or describe the dataset \
in database terms (e.g. "This dataset contains 50,000 rows and 17 columns" or "the dataset \
covers various aspects of..."). The reader uploaded this data themselves -- they don't need \
its shape described back to them. Open chapters with what the numbers reveal, not what the \
file looks like.
- NEVER list raw minimums, maximums, and averages as standalone sentences lifted straight \
from the input data (e.g. "X ranges from 1.00 to 35.86, averaging 11.21. Y ranges from..."). \
That reads like a database dump, not a report. Weave metrics into a flowing paragraph that \
explains what the numbers mean for a reader in the {industry} industry -- the "so what," \
never a bare printout of stats.
- THE "SO WHAT?" RULE: never state a statistic without explaining its real-world \
implication. WRONG: "There are 216 outliers in Skill Retention Score." RIGHT: "216 students \
show near-zero skill retention (as low as 10.78) -- a pattern consistent with over-reliance \
on the tool rather than genuine learning." Always answer: what does this number mean for \
the people or decisions behind the data?
- CONNECT THE CHAPTERS into one throughline, not three independent summaries: chapter 1 \
establishes the baseline trend; chapter 2 shows where that trend breaks down or creates risk \
(and reference chapter 1's trend when explaining why the break matters); chapter 3 explains \
the variable most responsible for both. Each chapter should build on the last, not restate it.
- Column names in the input may be snake_case (underscores). Always convert to normal \
spaced words when writing prose (e.g. "study hours", never "study_hours").

Rules:
- Only narrate facts given to you in the findings JSON. Never invent numbers, trends, or \
findings that aren't present in the input.
- Write for a reader in the {industry} industry -- vocabulary, stakes, and examples should \
resonate with that field specifically, not read as generic business writing.
- Tone: confident, curious, detail-oriented -- like a sharp analyst who dug into the \
specifics and needs to tell you exactly what they found, not a dry report and not vague \
hand-waving.
- CHARTS ARE REQUIRED, not optional: a report with zero chart blocks is an incomplete, \
unacceptable report. Every chapter's content is a list of content blocks \
(heading/paragraph/list/chart) -- you MUST include at least one "chart" block for the \
climax finding, and one for at least one other finding per chapter that has meaningful \
data behind it (ranking/trend/correlation/distribution/dose_response/outlier types all \
support a chart; descriptive/data_quality findings don't). Set findingRef to that finding's \
0-based index in the findings array you were given. Place each chart block immediately \
after the paragraph that discusses that specific finding -- never group all of a chapter's \
charts together at the end, detached from the text that explains them, and never omit \
charts entirely.
- Target 1000-2000 words total across all chapters for a typical dataset; shorter is fine \
if the arc is thin.`;

const TEXT_SYSTEM_PROMPT = `You are DataBrief's story writer. You read raw documents and \
surface what's surprising or noteworthy in them, written as a curiosity-driven, \
detail-oriented story. You write to the same fixed structure DataBrief uses for \
structured data -- Headline, Hook, three chapters, and Strategic Actions -- adapted for a \
document instead of statistical findings.

Rules:
- Only narrate facts present in the document text given to you. Never invent details.
- Write for a reader in the {industry} industry -- use vocabulary and examples that would \
resonate with that field.
- headline: a punchy title naming the most interesting, specific thing in the document.
- hook: exactly 3 sentences establishing the core discovery or tension.
- Set climaxIndex to null (there is no findings array for a raw-text document).
- chapters: exactly 3, adapted for this document --
  1. macro_trend: the document's main narrative or overall theme.
  2. anomalies: the most surprising or noteworthy specific details (cite exact figures, \
quotes, or claims, not paraphrased generalities).
  3. correlated_drivers: how different parts of the document connect or relate to each \
other. If nothing meaningful connects, keep this chapter brief rather than forcing it.
- focusQuestionCallout: if the user asked a specific question (given below), answer it \
directly citing the document's actual content. Otherwise null.
- implication: what the most interesting finding specifically means.
- actions: exactly 3 concrete next steps.
- If the document sets up an expectation the later text breaks, build toward that reveal \
rather than stating it upfront.
- Tone: confident, curious, detail-oriented -- like a sharp analyst who just read this and \
needs to tell you exactly what they found.
- NO REPETITION: never reuse the same phrase or clause (3+ words in a row) across the \
headline, hook, and chapters. Say the same underlying point in genuinely different words \
each time, or don't repeat it.
- THE "SO WHAT?" RULE: never state a detail without its real-world implication -- always \
answer what it means, not just what it is.
- CONNECT THE CHAPTERS into one throughline: chapter 1 sets up the main narrative, chapter \
2 shows what breaks or surprises within it, chapter 3 explains why. Each should build on \
the last, not restate it.
- Never start the headline or hook with "Yes --", "No --", "Answer:", or similar Q&A-style \
replies to an internal question -- write them as a standalone editorial headline and lead.
- headline and hook must say different things -- never let one be a truncated copy of the \
other.
- Each chapter's blocks are heading/paragraph/list only -- there are no findings/charts \
for a raw-text document.`;

function stripChartB64(extra: Record<string, unknown>): Record<string, unknown> {
  if (!("chart_b64" in extra)) return extra;
  const { chart_b64: _chartB64, ...rest } = extra;
  return rest;
}

/** Facts only, no pre-written prose. Strips `description` (the finding's
 * own pre-built sentence, e.g. "there is a sweet spot -- outcome peaks at
 * High usage then declines") alongside chart_b64. Without this, the LLM
 * consistently anchors on/lightly paraphrases the pre-written sentence
 * instead of synthesizing its own -- which is what produced near-identical
 * phrasing repeated across headline/hook/chapters. Every number the LLM
 * needs (value/magnitude/confidence/columns/extra) survives this strip;
 * only the ready-made sentence is removed, forcing real synthesis. */
function factsOnly(finding: Finding): Record<string, unknown> {
  const { description: _description, extra, ...rest } = finding;
  return { ...rest, extra: stripChartB64(extra) };
}

function defaultChapterTitle(id: ChapterId): string {
  switch (id) {
    case "macro_trend":
      return "Chapter I — The Macro Trend";
    case "anomalies":
      return "Chapter II — Anomalies & Outliers";
    case "correlated_drivers":
      return "Chapter III — Correlated Drivers";
  }
}

/** Guarantees exactly 3 chapters, one per CHAPTER_IDS, in canonical order --
 * defensive normalization rather than trusting the model's output shape
 * directly, same spirit as the existing climaxIndex bounds-check. Any
 * missing/duplicate/mis-ordered chapter from the model is filled with an
 * empty placeholder rather than dropped or left out of order. */
function normalizeChapters(chapters: Chapter[]): Chapter[] {
  const byId = new Map<ChapterId, Chapter>();
  for (const ch of chapters) {
    if ((CHAPTER_IDS as readonly string[]).includes(ch.id) && !byId.has(ch.id)) byId.set(ch.id, ch);
  }
  return CHAPTER_IDS.map((id) => byId.get(id) ?? { id, title: defaultChapterTitle(id), blocks: [] });
}

/** Caps at 3 action items, deduplicated. Does NOT pad short lists with a
 * repeated fallback string -- padding 1 real action with the same fallback
 * text twice produced two visibly identical bullet points in the report,
 * which reads as an obvious bug. Only falls back to the single rule-based
 * action when the model returned nothing usable at all. */
function normalizeActions(actions: string[], fallback: string): string[] {
  const seen = new Set<string>();
  const cleaned = actions
    .map((a) => a.trim())
    .filter((a) => a.length > 0 && !seen.has(a.toLowerCase()) && seen.add(a.toLowerCase()));
  if (cleaned.length > 0) return cleaned.slice(0, 3);
  return fallback ? [fallback] : [];
}

/** Guarantees the climax finding gets a chart, even if the model didn't
 * emit one. The prompt asks for a "chart" block after the paragraph
 * discussing a finding, but that's a request, not a contract -- a run can
 * come back with zero chart blocks anywhere (verified separately that
 * chartForFinding() itself renders correctly; the gap is upstream, in
 * whether the model asks for one at all). A report with no visualizations
 * at all is a real product defect, so this doesn't rely on prompt
 * compliance: if no chapter already references climaxIndex, append one to
 * whichever chapter its finding type belongs in (same heuristic the no-LLM
 * fallback uses), or the first non-empty chapter if that one's empty. */
function ensureClimaxChart(chapters: Chapter[], climaxIndex: number | null, findings: Finding[]): Chapter[] {
  if (climaxIndex === null) return chapters;
  const alreadyReferenced = chapters.some((ch) =>
    ch.blocks.some((b) => b.type === "chart" && b.findingRef === climaxIndex)
  );
  if (alreadyReferenced) return chapters;

  const climax = findings[climaxIndex];
  if (!climax) return chapters;

  // Chapters passed in here are always the normalized 3-chapter set (see
  // call site), so the preferred chapter always exists -- no fallback needed.
  const targetId = chapterForFindingType(climax.type);
  return chapters.map((ch) =>
    ch.id === targetId ? { ...ch, blocks: [...ch.blocks, { type: "chart" as const, findingRef: climaxIndex }] } : ch
  );
}

function countWordsInChapters(chapters: Chapter[]): number {
  let count = 0;
  for (const ch of chapters) {
    for (const b of ch.blocks) {
      if (b.type === "heading" || b.type === "paragraph") count += b.text.split(/\s+/).filter(Boolean).length;
      else if (b.type === "list") count += b.items.join(" ").split(/\s+/).filter(Boolean).length;
    }
  }
  return count;
}

/** Narrates the story arc, letting the LLM pick which finding is the real
 * climax (not just the highest-scoring one) and write the journalistic
 * chapter structure grounded in that finding, rather than the old fixed
 * templates. */
export async function generateStoryBlocks(
  storyArc: StoryArc,
  industry?: string | null,
  question?: string | null,
  preferredProvider?: string | null
): Promise<StoryNarrationResult> {
  const providers = configuredProviders(preferredProvider);
  if (providers.length === 0) return fallbackNarrationResult(storyArc);

  const isTextDoc = storyArc.raw_text !== undefined;
  const systemPrompt = (isTextDoc ? TEXT_SYSTEM_PROMPT : SYSTEM_PROMPT).replace("{industry}", industry || "general business");

  // Deliberately NOT spreading storyArc here. It carries pre-written
  // rule-based prose (hook, context, implication, action, climax's own
  // description) meant only as a no-LLM fallback -- handing that to the LLM
  // as "input" gave it something to anchor on and lightly paraphrase rather
  // than synthesize, which is what produced near-identical phrasing
  // repeated across headline/hook/chapters. Only raw facts go in: findings
  // stripped of their own pre-written description (factsOnly), or the raw
  // document text for a text upload (that IS the source material, not
  // pre-written narrative -- it must still reach the LLM). No dataset-shape
  // metadata (row/column counts) either -- the system prompt bans restating
  // it, so it isn't worth the anchoring risk to include at all.
  const questionLine = question ? `\nThe user specifically asked: "${question}"` : "";
  const userMessage = isTextDoc
    ? `Here is the document text to narrate:\n\n${storyArc.raw_text}${questionLine}`
    : `Here is the full list of findings to choose a story from:\n\n${JSON.stringify(storyArc.findings.map(factsOnly))}${questionLine}`;

  const outcome = await runWithFallback(providers, systemPrompt, userMessage, storyNarrationSchema);
  if (outcome.result === null) return fallbackNarrationResult(storyArc);

  const { result } = outcome;
  const climaxIndex =
    result.climaxIndex !== null && result.climaxIndex >= 0 && result.climaxIndex < storyArc.findings.length
      ? result.climaxIndex
      : null;
  const chapters = ensureClimaxChart(normalizeChapters(result.chapters), climaxIndex, storyArc.findings);
  const hook = stripLeadIn(result.hook || storyArc.hook);
  const headline = ensureDistinctHeadline(stripLeadIn(result.headline || storyArc.hook), hook);

  return {
    headline,
    hook,
    climaxIndex,
    chapters,
    focusQuestionCallout: question ? result.focusQuestionCallout || null : null,
    implication: result.implication || storyArc.implication,
    actions: normalizeActions(result.actions, storyArc.action),
    wordCount: countWordsInChapters(chapters),
  };
}
