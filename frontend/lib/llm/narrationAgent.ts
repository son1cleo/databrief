import "server-only";
import type { z } from "zod";
import type { Finding } from "@/lib/analysis";
import type { LlmProvider } from "./providers";
import { runWithFallback } from "./fallbackGraph";
import {
  climaxHookSchema,
  chapterTurnSchema,
  actionsSchema,
  type Chapter,
  type ChapterTurn,
  type StoryBlock,
  type StoryNarrationResult,
  type QuestionPlanEntry,
} from "./schemas";
import { buildFindingsJson } from "./findingFacts";
import { stripLeadIn, ensureDistinctHeadline, type StoryArc } from "@/lib/story";

// ---------------------------------------------------------------------------
// Why this file exists: generateStoryBlocks() used to ask one LLM completion
// to write the entire report (headline, hook, 3 chapters, callout, actions)
// in one shot. When a single finding was legitimately the climax AND the
// best answer to the user's question AND the obvious Chapter I subject,
// nothing stopped the model from writing about it three times in one pass --
// a real bug observed in production (report4.pdf: the same GPA/study-hours
// correlation restated near-verbatim in the hook, the focus answer, and
// Chapter I). This module replaces that single call with a fixed, code-driven
// sequence of calls -- never model-controlled, no loop the model can extend
// -- where each later call is shown what earlier calls already wrote and
// told not to restate it.
//
// Chapters are now built one per question (or question-cluster) from the
// report's question plan (storyArc.plan), not from a fixed 3-chapter
// dataset-wide template -- a chapter's job is to answer its question
// directly, not to summarize a generic theme. See questionChapterFragment
// and the loop in runStructuredNarrationTurns.
// ---------------------------------------------------------------------------

const ACCESSIBILITY_RULE = `- Write for a mixed audience of technical and non-technical readers: the first time a \
statistical term appears (correlation coefficient, magnitude, confidence, dose-response, \
standard deviation, etc.), pair it with a short plain-English gloss of what it means in \
context (e.g. "a correlation coefficient of 0.376 -- a moderate, real relationship, not a \
coincidence"). Don't drop the number to simplify -- frame it, don't omit it. A term glossed \
once earlier in the report (see "already published" below) doesn't need re-explaining -- use \
it bare after that instead of repeating the same explanation.`;

const NO_REPETITION_RULE = `- NO REPETITION: never reuse the same phrase or clause (3+ words in a row) that already \
appears in the "already published elsewhere in this report" text below. Say the same \
underlying fact in genuinely different words, or add new supporting detail, rather than \
restating it.`;

const LEAD_IN_RULE = `- Never start with "Yes --", "No --", "Answer:", or similar Q&A-style replies to an \
internal question -- write as standalone editorial copy, not a reply to a prompt.`;

const STRUCTURED_PREAMBLE = (industry: string) => `You are DataBrief's story writer. You are writing ONE section at a time of a larger \
report about a dataset -- you'll be told exactly which section below. Every sentence you \
write must cite an actual number, percentage, or comparison from the findings you're given; \
if a sentence would still make sense with the numbers deleted, cut it.

${ACCESSIBILITY_RULE}
${NO_REPETITION_RULE}
${LEAD_IN_RULE}
- BAN METADATA STATEMENTS: never mention row counts, column counts, or describe the dataset \
in database terms. The reader uploaded this data themselves.
- NEVER list raw minimums, maximums, and averages as standalone sentences lifted straight \
from the input (e.g. "X ranges from 1.00 to 35.86, averaging 11.21"). Weave metrics into a \
flowing explanation of what they mean for a reader in the ${industry} industry.
- THE "SO WHAT?" RULE: never state a statistic without its real-world implication. WRONG: \
"There are 216 outliers in Skill Retention Score." RIGHT: "216 students show near-zero \
skill retention -- a pattern consistent with over-reliance on the tool rather than genuine \
learning."
- Column names may be snake_case -- always convert to normal spaced words in prose.
- Only narrate facts present in the findings JSON you're given. Never invent numbers or findings.
- Write for a reader in the ${industry} industry -- vocabulary and stakes should resonate with that field.
- Tone: confident, curious, detail-oriented -- like a sharp analyst who dug into the specifics.`;

const TEXT_PREAMBLE = (industry: string) => `You are DataBrief's story writer. You are writing ONE section at a time of a larger \
report about an uploaded document -- you'll be told exactly which section below.

${ACCESSIBILITY_RULE}
${NO_REPETITION_RULE}
${LEAD_IN_RULE}
- Only narrate facts present in the document text you're given. Never invent details.
- Write for a reader in the ${industry} industry -- use vocabulary and examples that resonate with that field.
- Tone: confident, curious, detail-oriented -- like a sharp analyst who just read this and needs to report exactly what they found.`;

function alreadyPublishedNote(history: string[]): string {
  if (history.length === 0) return "";
  return `\n\nAlready published elsewhere in this report -- do not reuse 3+ word phrases from \
this, and if you restate a number, frame it differently or add new context:\n\n${history.join("\n\n")}`;
}

function citedFindingsNote(cited: Set<number>): string {
  if (cited.size === 0) return "";
  return `\n\nFindings already discussed as a primary subject elsewhere: [${[...cited].join(", ")}]. \
You may reference one briefly to connect ideas, but don't make it the main subject again.`;
}

const CLIMAX_HOOK_FRAGMENT_STRUCTURED = `SECTION: Headline + Hook (and picking the climax finding).

Pick your climax: look at every finding in the findings JSON, not just the first few. Choose \
the one that's genuinely the most surprising, consequential, or counter-intuitive -- not \
automatically the highest-magnitude one. Set climaxIndex to that finding's 0-based index \
(matching its position in the findings array you were given). If nothing stands out (thin or \
purely descriptive data), set it to null.

Build real tension: if the data sets up an expectation and breaks it, let the hook create the \
question rather than stating the twist immediately. Not every dataset has a twist -- a \
strong, plainly-stated finding beats a forced cliffhanger.

- headline: a punchy, journalistic title summarizing the central takeaway -- distinct from \
the hook, more like a newspaper headline than a sentence. Keep it to one line.
- hook: exactly 3 sentences establishing the core tension or discovery, grounded in the \
climax finding's real numbers.
- headline and hook must say different things -- never let one be a truncated copy of the other.
- citedFindingIndices: list every finding index (0-based, into the findings array) you cited a number from.`;

const CLIMAX_HOOK_FRAGMENT_TEXT = `SECTION: Headline + Hook.

Set climaxIndex to null (there is no findings array for a document).
- headline: a punchy title naming the most interesting, specific thing in the document.
- hook: exactly 3 sentences establishing the core discovery or tension, citing specifics from the document.
- headline and hook must say different things -- never let one be a truncated copy of the other.
- If the document sets up an expectation the later text breaks, build toward that reveal rather than stating it upfront.
- citedFindingIndices: leave this as an empty array (there are no findings for a document).`;

const ACTIONS_FRAGMENT = `SECTION: Strategic Actions.

Write exactly 3 concrete, prescriptive next steps ("action pillars"). Each must be tied to a \
specific finding's actual numbers (or a specific document detail) already discussed in this \
report -- not generic advice that could apply to any dataset. Keep each to roughly 15-30 words.
- citedFindingIndices: list every finding index you cited (empty array for a document).`;

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
function toRoman(n: number): string {
  return ROMAN_NUMERALS[n - 1] ?? String(n);
}

const DEPTH_WORD_BUDGET: Record<QuestionPlanEntry["depth"], string> = {
  brief: "roughly 120-200 words",
  standard: "roughly 250-400 words",
  deep: "roughly 400-600 words",
};

/** One chapter turn per question (or question-cluster). Replaces the old
 * standalone "Focus Question Callout" turn entirely -- the direct answer now
 * opens the chapter itself instead of living in a separate box before a
 * generic, dataset-wide chapter. */
function questionChapterFragment(
  chapterNumber: number,
  questionTexts: string[],
  depth: QuestionPlanEntry["depth"],
  isFirst: boolean,
  isTextDoc: boolean
): string {
  const qLine =
    questionTexts.length === 1
      ? `The reader specifically asked: "${questionTexts[0]}"`
      : `The reader asked these related questions -- answer them together: ${questionTexts.map((q) => `"${q}"`).join("; ")}`;
  const chartRule = isTextDoc
    ? `- Blocks are heading/paragraph/list only -- there are no findings/charts for a document, never emit a "chart" block.`
    : `- CHARTS ARE REQUIRED if there's a chart-able finding behind this question (ranking/trend/correlation/distribution/dose_response/outlier \
types all support a chart; descriptive/data_quality don't). Set findingRef to that finding's 0-based index in the findings array you were given.`;

  return `SECTION: Chapter ${toRoman(chapterNumber)}.

${qLine}

Open with a direct, concrete answer citing real numbers -- the question itself is already shown to the reader \
separately, so don't restate it as a heading or repeat "the answer is." Then give the supporting evidence and \
context that makes the answer credible and actionable.
${isFirst ? "This is the report's opening chapter -- it also sets the overall tone." : "Connect back to what's already published where relevant -- don't repeat it, build on it."}
- subtitle: a short, specific subtitle for this chapter (not a restatement of the question verbatim).
- If there's genuinely nothing relevant to answer this from the dataset, say so briefly rather than fabricating content.
${chartRule}
- Keep this chapter to ${DEPTH_WORD_BUDGET[depth]}.
- citedFindingIndices: list every finding index you cited a number from (empty array for a document).`;
}

/** Trailing chapter for leftover dataset-wide content not tied to any
 * question. `forced` (no question plan exists at all) makes this the
 * report's only chapter, so it must always produce real content -- the
 * pre-redesign pipeline's "always show 3 generic chapters" behavior
 * collapses into this single path instead of running in parallel with the
 * question-driven one. When not forced, it's a genuinely optional add-on
 * that's allowed to come back empty. */
function contextChapterFragment(chapterNumber: number, isTextDoc: boolean, forced: boolean): string {
  const chartRule = isTextDoc
    ? `- Blocks are heading/paragraph/list only -- there are no findings/charts for a document, never emit a "chart" block.`
    : `- Include at least one "chart" block if there's a chart-able finding worth showing (ranking/trend/correlation/distribution/dose_response/outlier).`;

  if (forced) {
    return `SECTION: Chapter ${toRoman(chapterNumber)} (the report's only chapter -- no specific question was asked or could be answered).

Cover the most interesting, consequential things in this dataset${isTextDoc ? " or document" : ""}: the main trend \
or pattern, any real surprises or anomalies, and what's driving what. Write it as one cohesive chapter, not three \
separate mini-sections.
- subtitle: a short, specific subtitle for this chapter.
${chartRule}
- Keep this chapter to roughly 350-550 words.
- citedFindingIndices: list every finding index you cited a number from (empty array for a document).`;
  }

  return `SECTION: Chapter ${toRoman(chapterNumber)} (Additional Context).

Cover only genuinely important things about this dataset${isTextDoc ? " or document" : ""} that haven't come up \
in answering the questions above -- e.g. a serious data-quality problem, or a strong pattern nobody asked about \
but that matters. If there's truly nothing left worth flagging, return an empty blocks array rather than padding \
this out.
- subtitle: a short, specific subtitle for this chapter.
${chartRule}
- Keep this chapter to roughly 100-200 words if there's something worth including.
- citedFindingIndices: list every finding index you cited a number from (empty array for a document).`;
}

function buildContextChapter(chapterNumber: number, result: ChapterTurn): Chapter {
  return {
    id: "context",
    questionIndices: [],
    questionLabel: null,
    title: `Chapter ${toRoman(chapterNumber)} — ${result.subtitle.trim() || "Additional Context"}`,
    blocks: result.blocks,
    citedFindingIndices: result.citedFindingIndices,
  };
}

/** Zero-LLM-call chapter for a question the plan flagged as unanswerable
 * from this dataset -- cost scales with answerable questions, not raw
 * question count. */
function buildUnanswerableChapter(id: string, chapterNumber: number, entry: QuestionPlanEntry, questionTexts: string[]): Chapter {
  const label = questionTexts.join(" / ");
  return {
    id,
    questionIndices: entry.questionIndices,
    questionLabel: label || null,
    title: `Chapter ${toRoman(chapterNumber)} — ${label || "Unanswerable"}`,
    blocks: [
      {
        type: "paragraph",
        text: entry.unanswerableReason || "This dataset doesn't contain the columns needed to answer this question.",
      },
    ],
    citedFindingIndices: [],
  };
}

/** True when there's a genuinely important dataset-wide finding not tied to
 * any question -- a real data-quality problem, or a strong pattern nobody
 * asked about but that's uncited so far. Deliberately narrow so the
 * "Additional Context" chapter stays rare, not a reversion to a whole-
 * dataset dump. */
function shouldIncludeContextChapter(findings: Finding[], cited: Set<number>): boolean {
  let badQuality = false;
  let strongUncited = false;
  findings.forEach((f, idx) => {
    if (f.questionIndices.length > 0) return;
    if (f.type === "data_quality" && typeof f.value === "number" && f.value < 0.8) badQuality = true;
    if (f.magnitude > 0.75 && !cited.has(idx)) strongUncited = true;
  });
  return badQuality || strongUncited;
}

/** Caps at 3 action items, deduplicated. Does NOT pad short lists with a
 * repeated fallback string -- padding 1 real action with the same fallback
 * text twice produced two visibly identical bullet points, which reads as an
 * obvious bug. Only falls back to the single rule-based action when the
 * model returned nothing usable at all. */
function normalizeActions(actions: string[], fallback: string): string[] {
  const seen = new Set<string>();
  const cleaned = actions
    .map((a) => a.trim())
    .filter((a) => a.length > 0 && !seen.has(a.toLowerCase()) && seen.add(a.toLowerCase()));
  if (cleaned.length > 0) return cleaned.slice(0, 3);
  return fallback ? [fallback] : [];
}

/** Guarantees the climax finding gets a chart, even if the chapter turn that
 * should have referenced it didn't. A report with no visualizations at all
 * is a real product defect, so this doesn't rely on prompt compliance.
 * Targets whichever chapter shares a question with the climax finding,
 * falling back to the "context" chapter, then the first chapter. */
function ensureClimaxChart(chapters: Chapter[], climaxIndex: number | null, findings: Finding[]): Chapter[] {
  if (climaxIndex === null) return chapters;
  const alreadyReferenced = chapters.some((ch) => ch.blocks.some((b) => b.type === "chart" && b.findingRef === climaxIndex));
  if (alreadyReferenced) return chapters;

  const climax = findings[climaxIndex];
  if (!climax) return chapters;

  const target =
    chapters.find((ch) => climax.questionIndices.some((qi) => ch.questionIndices.includes(qi))) ??
    chapters.find((ch) => ch.id === "context") ??
    chapters[0];
  if (!target) return chapters;

  return chapters.map((ch) =>
    ch === target ? { ...ch, blocks: [...ch.blocks, { type: "chart" as const, findingRef: climaxIndex }] } : ch
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

function normalizeWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

/** Finds runs of `minWords`+ consecutive words shared verbatim between two
 * texts (after normalizing case/punctuation). In testing, the "already
 * published, don't repeat" prompt instruction alone was NOT reliably
 * followed -- turns restated large verbatim spans from earlier turns
 * despite being shown the exact prior text and told not to. This detector
 * is what a retry (see callTurnGuarded) actually checks against, rather
 * than trusting prompt compliance. */
function findSharedPhrases(a: string, b: string, minWords = 6): string[] {
  const wordsA = normalizeWords(a);
  const bJoined = ` ${normalizeWords(b).join(" ")} `;
  const hits = new Set<string>();
  for (let i = 0; i <= wordsA.length - minWords; i++) {
    const phrase = wordsA.slice(i, i + minWords).join(" ");
    if (bJoined.includes(` ${phrase} `)) hits.add(phrase);
  }
  return [...hits];
}

function repetitionRetryNote(overlap: string[]): string {
  const examples = overlap.slice(0, 3).map((p) => `"${p}"`).join(", ");
  return `\n\nYour previous attempt at this section repeated text nearly verbatim from elsewhere in \
the report: ${examples}. Rewrite this section -- you may cite the same facts if relevant, but in \
genuinely different wording. Do not reuse these phrases.`;
}

function blocksText(blocks: StoryBlock[]): string {
  return blocks
    .map((b) => (b.type === "heading" || b.type === "paragraph" ? b.text : b.type === "list" ? b.items.join("; ") : ""))
    .filter(Boolean)
    .join(" ");
}

function chapterHistoryText(chapter: Chapter): string {
  return `${chapter.title}: ${blocksText(chapter.blocks)}`;
}

/** Runs one turn: calls runWithFallback with the given (already provider-
 * pinned) chain, and if a provider succeeds, re-pins that provider to the
 * front for the next turn's call -- so a report uses one provider throughout
 * in the common case, and gracefully falls to the next provider in the chain
 * only if the pinned one fails mid-report. Returns null on total exhaustion
 * of the provider chain, signaling the whole sequence should abort. */
async function callTurn<T>(
  providers: LlmProvider[],
  systemPrompt: string,
  userMessage: string,
  schema: z.ZodType<T>,
  label: string
): Promise<{ result: T; providers: LlmProvider[] } | null> {
  const outcome = await runWithFallback(providers, systemPrompt, userMessage, schema);
  if (!("provider" in outcome)) {
    console.log(`[narration] turn-failed label=${label} providers=${providers.map((p) => p.name).join(",")} errors=${JSON.stringify(outcome.providerErrors)}`);
    return null;
  }

  const pinned = providers.find((p) => p.name === outcome.provider);
  const reordered = pinned ? [pinned, ...providers.filter((p) => p !== pinned)] : providers;
  return { result: outcome.result, providers: reordered };
}

/** Wraps callTurn with one bounded retry (2 calls max, never more) when the
 * turn's output shares a long verbatim run of words with `historyText` --
 * see findSharedPhrases for why this check exists instead of trusting the
 * "don't repeat" prompt instruction alone. If the retry call itself fails
 * outright (provider exhaustion), falls back to the first (real, complete,
 * just imperfectly-worded) result rather than aborting the whole report
 * over a polish issue. */
async function callTurnGuarded<T>(
  providers: LlmProvider[],
  systemPrompt: string,
  baseUserMessage: string,
  schema: z.ZodType<T>,
  extractText: (result: T) => string,
  historyText: string,
  label: string
): Promise<{ result: T; providers: LlmProvider[] } | null> {
  const first = await callTurn(providers, systemPrompt, baseUserMessage, schema, label);
  if (!first) return null;
  if (!historyText) return first;

  const overlap = findSharedPhrases(extractText(first.result), historyText);
  if (overlap.length === 0) return first;

  const retryMessage = `${baseUserMessage}${repetitionRetryNote(overlap)}`;
  const retry = await callTurn(first.providers, systemPrompt, retryMessage, schema, `${label}-retry`);
  return retry ?? first;
}

/** Structured (findings-based) narration path: climax+hook, then one turn
 * per question/question-cluster from storyArc.plan (an unanswerable entry
 * costs zero LLM calls), then an optional/forced trailing "context" chapter,
 * then actions. Any single required turn's total provider-chain exhaustion
 * aborts the whole sequence (returns null) rather than letting later turns
 * retry a chain that just proved to be down -- the caller falls back to
 * fallbackNarrationResult() in that case. */
export async function runStructuredNarrationTurns(
  storyArc: StoryArc,
  industry: string | null | undefined,
  initialProviders: LlmProvider[]
): Promise<StoryNarrationResult | null> {
  const findings = storyArc.findings;
  const findingsJson = buildFindingsJson(findings);
  const industryName = industry || "general business";
  const preamble = STRUCTURED_PREAMBLE(industryName);

  const history: string[] = [];
  const cited = new Set<number>();
  let providers = initialProviders;

  function userMessage(fragment: string): string {
    return `${fragment}\n\nFindings JSON:\n${findingsJson}${alreadyPublishedNote(history)}${citedFindingsNote(cited)}`;
  }

  // Turn 1: climax + headline/hook. Headline/hook are produced together in
  // one call, so the cross-turn history guard doesn't apply -- instead
  // check headline against its own hook directly, and retry once if they
  // overlap heavily (ensureDistinctHeadline below is still kept as a final
  // mechanical backstop in case the retry doesn't fully fix it).
  let turn1 = await callTurn(providers, preamble, userMessage(CLIMAX_HOOK_FRAGMENT_STRUCTURED), climaxHookSchema, "climax-hook");
  if (!turn1) return null;
  providers = turn1.providers;
  const selfOverlap = findSharedPhrases(turn1.result.headline, turn1.result.hook);
  if (selfOverlap.length > 0) {
    const retryMessage = `${userMessage(CLIMAX_HOOK_FRAGMENT_STRUCTURED)}${repetitionRetryNote(selfOverlap)} The headline specifically \
must not restate the hook's exact wording -- name the stakes or the actors instead of repeating the same clause.`;
    const retry = await callTurn(providers, preamble, retryMessage, climaxHookSchema, "climax-hook-retry");
    if (retry) {
      turn1 = retry;
      providers = retry.providers;
    }
  }
  const climaxIndex =
    turn1.result.climaxIndex !== null && turn1.result.climaxIndex >= 0 && turn1.result.climaxIndex < findings.length
      ? turn1.result.climaxIndex
      : null;
  const hook = stripLeadIn(turn1.result.hook || storyArc.hook);
  const headline = ensureDistinctHeadline(stripLeadIn(turn1.result.headline || storyArc.hook), hook);
  history.push(`HEADLINE: ${headline}\nHOOK: ${hook}`);
  for (const idx of turn1.result.citedFindingIndices) cited.add(idx);

  // One turn per question/question-cluster (unanswerable entries cost zero
  // LLM calls). Falls to a single forced "context" chapter below when there
  // was no plan at all.
  const plan = storyArc.plan ?? [];
  const chapters: Chapter[] = [];
  let chapterNumber = 1;

  for (const entry of plan) {
    const questionTexts = entry.questionIndices.map((i) => storyArc.questions[i]).filter((q): q is string => Boolean(q));
    const label = questionTexts.join(" / ");
    const id = `q${entry.questionIndices[0] ?? chapters.length}`;

    if (!entry.answerable) {
      chapters.push(buildUnanswerableChapter(id, chapterNumber, entry, questionTexts));
      chapterNumber++;
      continue;
    }

    const turn = await callTurnGuarded(
      providers,
      preamble,
      userMessage(questionChapterFragment(chapterNumber, questionTexts, entry.depth, chapters.length === 0, false)),
      chapterTurnSchema,
      (r) => blocksText(r.blocks),
      history.join(" "),
      `chapter:${id}`
    );
    if (!turn) return null;
    providers = turn.providers;
    const chapter: Chapter = {
      id,
      questionIndices: entry.questionIndices,
      questionLabel: label || null,
      title: `Chapter ${toRoman(chapterNumber)} — ${turn.result.subtitle.trim() || label}`,
      blocks: turn.result.blocks,
      citedFindingIndices: turn.result.citedFindingIndices,
    };
    chapters.push(chapter);
    history.push(chapterHistoryText(chapter));
    for (const idx of chapter.citedFindingIndices) cited.add(idx);
    chapterNumber++;
  }

  // Trailing "context" chapter: forced (and required) when there's no plan
  // at all -- this collapses the old "always show 3 generic chapters"
  // behavior into a single code path instead of running it in parallel with
  // the question-driven one. Otherwise a genuinely optional add-on that's
  // allowed to fail or come back empty without aborting the report.
  const forced = plan.length === 0;
  if (forced || shouldIncludeContextChapter(findings, cited)) {
    const turn = await callTurnGuarded(
      providers,
      preamble,
      userMessage(contextChapterFragment(chapterNumber, false, forced)),
      chapterTurnSchema,
      (r) => blocksText(r.blocks),
      history.join(" "),
      "chapter:context"
    );
    if (forced) {
      if (!turn) return null;
      providers = turn.providers;
      const chapter = buildContextChapter(chapterNumber, turn.result);
      chapters.push(chapter);
      history.push(chapterHistoryText(chapter));
      for (const idx of chapter.citedFindingIndices) cited.add(idx);
    } else if (turn && turn.result.blocks.length > 0) {
      providers = turn.providers;
      const chapter = buildContextChapter(chapterNumber, turn.result);
      chapters.push(chapter);
      history.push(chapterHistoryText(chapter));
      for (const idx of chapter.citedFindingIndices) cited.add(idx);
    }
  }

  // Final turn: actions
  const turnActions = await callTurnGuarded(
    providers,
    preamble,
    userMessage(ACTIONS_FRAGMENT),
    actionsSchema,
    (r) => r.actions.join(" "),
    history.join(" "),
    "actions"
  );
  if (!turnActions) return null;

  const finalChapters = ensureClimaxChart(chapters, climaxIndex, findings);
  return {
    headline,
    hook,
    climaxIndex,
    chapters: finalChapters,
    focusQuestionCallout: null,
    implication: storyArc.implication,
    actions: normalizeActions(turnActions.result.actions, storyArc.action),
    wordCount: countWordsInChapters(finalChapters),
  };
}

/** Raw-text (PDF/DOCX/TXT upload, no findings array) narration path. Same
 * mechanism as the structured path -- fixed turns, shared textual history,
 * one chapter per question -- but no findings catalog, no tool-selection
 * plan (there's nothing to plan against), and no chart/citedFindingIndices
 * content (raw_text is already fully present in every turn's prompt, so
 * there's nothing to lazily reference or fetch). */
export async function runTextNarrationTurns(
  storyArc: StoryArc,
  industry: string | null | undefined,
  initialProviders: LlmProvider[]
): Promise<StoryNarrationResult | null> {
  const industryName = industry || "general business";
  const preamble = TEXT_PREAMBLE(industryName);
  const rawText = storyArc.raw_text ?? "";

  const history: string[] = [];
  let providers = initialProviders;

  function userMessage(fragment: string): string {
    return `${fragment}\n\nDocument text:\n${rawText}${alreadyPublishedNote(history)}`;
  }

  let turn1 = await callTurn(providers, preamble, userMessage(CLIMAX_HOOK_FRAGMENT_TEXT), climaxHookSchema, "climax-hook");
  if (!turn1) return null;
  providers = turn1.providers;
  const selfOverlap = findSharedPhrases(turn1.result.headline, turn1.result.hook);
  if (selfOverlap.length > 0) {
    const retryMessage = `${userMessage(CLIMAX_HOOK_FRAGMENT_TEXT)}${repetitionRetryNote(selfOverlap)} The headline specifically \
must not restate the hook's exact wording -- name the stakes or the specifics instead of repeating the same clause.`;
    const retry = await callTurn(providers, preamble, retryMessage, climaxHookSchema, "climax-hook-retry");
    if (retry) {
      turn1 = retry;
      providers = retry.providers;
    }
  }
  const hook = stripLeadIn(turn1.result.hook || storyArc.hook);
  const headline = ensureDistinctHeadline(stripLeadIn(turn1.result.headline || storyArc.hook), hook);
  history.push(`HEADLINE: ${headline}\nHOOK: ${hook}`);

  const questions = storyArc.questions ?? [];
  const chapters: Chapter[] = [];
  let chapterNumber = 1;

  for (let i = 0; i < questions.length; i++) {
    const turn = await callTurnGuarded(
      providers,
      preamble,
      userMessage(questionChapterFragment(chapterNumber, [questions[i]], "standard", chapters.length === 0, true)),
      chapterTurnSchema,
      (r) => blocksText(r.blocks),
      history.join(" "),
      `chapter:q${i}`
    );
    if (!turn) return null;
    providers = turn.providers;
    const chapter: Chapter = {
      id: `q${i}`,
      questionIndices: [i],
      questionLabel: questions[i],
      title: `Chapter ${toRoman(chapterNumber)} — ${turn.result.subtitle.trim() || questions[i]}`,
      blocks: turn.result.blocks,
      citedFindingIndices: [],
    };
    chapters.push(chapter);
    history.push(chapterHistoryText(chapter));
    chapterNumber++;
  }

  const forced = questions.length === 0;
  const contextTurn = await callTurnGuarded(
    providers,
    preamble,
    userMessage(contextChapterFragment(chapterNumber, true, forced)),
    chapterTurnSchema,
    (r) => blocksText(r.blocks),
    history.join(" "),
    "chapter:context"
  );
  if (forced) {
    if (!contextTurn) return null;
    providers = contextTurn.providers;
    const chapter = buildContextChapter(chapterNumber, contextTurn.result);
    chapters.push(chapter);
    history.push(chapterHistoryText(chapter));
  } else if (contextTurn && contextTurn.result.blocks.length > 0) {
    providers = contextTurn.providers;
    const chapter = buildContextChapter(chapterNumber, contextTurn.result);
    chapters.push(chapter);
    history.push(chapterHistoryText(chapter));
  }

  const turnActions = await callTurnGuarded(
    providers,
    preamble,
    userMessage(ACTIONS_FRAGMENT),
    actionsSchema,
    (r) => r.actions.join(" "),
    history.join(" "),
    "actions"
  );
  if (!turnActions) return null;

  return {
    headline,
    hook,
    climaxIndex: null,
    chapters,
    focusQuestionCallout: null,
    implication: storyArc.implication,
    actions: normalizeActions(turnActions.result.actions, storyArc.action),
    wordCount: countWordsInChapters(chapters),
  };
}
