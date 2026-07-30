import "server-only";
import type { z } from "zod";
import type { Finding } from "@/lib/analysis";
import type { LlmProvider } from "./providers";
import { runWithFallback } from "./fallbackGraph";
import {
  climaxHookSchema,
  calloutSchema,
  chapterSchema,
  actionsSchema,
  CHAPTER_IDS,
  chapterForFindingType,
  type Chapter,
  type ChapterId,
  type StoryBlock,
  type StoryNarrationResult,
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
// sequence of up to 6 smaller calls -- never model-controlled, no loop the
// model can extend -- where each later call is shown what earlier calls
// already wrote and told not to restate it. See docs/PROJECT_CONTEXT.md and
// the plan this was built from for the full rationale.
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

const CALLOUT_FRAGMENT = (question: string) => `SECTION: Focus Question Callout.

The user specifically asked: "${question}"

Answer it directly, citing real numbers or specifics as evidence. If the honest answer \
overlaps with something already published (see above), you may restate the core number since \
evading the real answer to avoid repetition would be worse -- but pair it with evidence that \
hasn't appeared yet (sample size, a comparison point, a confidence level, or supporting detail), \
rather than repeating the same sentence verbatim. Keep this to 80-150 words.
- citedFindingIndices: list every finding index you cited (empty array for a document).`;

interface ChapterCopy {
  role: string;
  connect: string;
}

const STRUCTURED_CHAPTER_COPY: Record<ChapterId, ChapterCopy> = {
  macro_trend: {
    role: "the baseline/overall direction in the data -- what's the main trend or pattern most findings agree on.",
    connect: "This is the first chapter -- it sets the baseline the rest of the report will build on.",
  },
  anomalies: {
    role: "outliers, surprises, or things that break the expected pattern.",
    connect: "Reference the baseline trend from Chapter I when explaining why this break matters -- don't write it as a standalone summary.",
  },
  correlated_drivers: {
    role: "relationships between variables -- what's driving what, and which variable is most responsible for the trend and the anomalies already discussed.",
    connect: "Explain the variable most responsible for both the baseline trend and the anomalies already covered -- this chapter should resolve, not repeat, what came before.",
  },
};

const TEXT_CHAPTER_COPY: Record<ChapterId, ChapterCopy> = {
  macro_trend: {
    role: "the document's main narrative or overall theme.",
    connect: "This is the first chapter -- it sets up the main narrative.",
  },
  anomalies: {
    role: "the most surprising or noteworthy specific details (cite exact figures, quotes, or claims, not paraphrased generalities).",
    connect: "Show what breaks or surprises within the narrative established in Chapter I.",
  },
  correlated_drivers: {
    role: "how different parts of the document connect or relate to each other. If nothing meaningful connects, keep this chapter brief rather than forcing it.",
    connect: "Explain why the surprise from Chapter II matters in light of Chapter I's narrative.",
  },
};

/** `hasQuestion` widens each chapter's word-budget target when there's no
 * Focus Question Callout turn to fill that space (that turn is skipped
 * entirely when no question was asked, see runStructuredNarrationTurns) --
 * without this, a no-question report comes out ~100-150 words shorter and
 * visibly thinner/shorter in page count than one with a question, for a
 * reason that has nothing to do with the actual data. */
function chapterFragment(chapterId: ChapterId, isTextDoc: boolean, hasQuestion: boolean): string {
  const copy = (isTextDoc ? TEXT_CHAPTER_COPY : STRUCTURED_CHAPTER_COPY)[chapterId];
  const title = defaultChapterTitle(chapterId);
  const chartRule = isTextDoc
    ? `- Blocks are heading/paragraph/list only -- there are no findings/charts for a document, never emit a "chart" block.`
    : `- CHARTS ARE REQUIRED: include at least one "chart" block for a finding with meaningful data behind it \
(ranking/trend/correlation/distribution/dose_response/outlier types all support a chart; descriptive/data_quality \
don't). Set findingRef to that finding's 0-based index in the findings array you were given. Place the chart block \
immediately after the paragraph that discusses that finding.`;
  const wordBudget = hasQuestion ? "roughly 300-500 words" : "roughly 350-550 words";
  return `SECTION: ${title} (id: "${chapterId}").

This chapter covers: ${copy.role}
${copy.connect}

- If there's genuinely nothing relevant to this chapter, say so briefly (a sentence or two) rather than fabricating content.
${chartRule}
- Keep this chapter to ${wordBudget}.
- citedFindingIndices: list every finding index you cited a number from (empty array for a document).`;
}

const ACTIONS_FRAGMENT = `SECTION: Strategic Actions.

Write exactly 3 concrete, prescriptive next steps ("action pillars"). Each must be tied to a \
specific finding's actual numbers (or a specific document detail) already discussed in this \
report -- not generic advice that could apply to any dataset. Keep each to roughly 15-30 words.
- citedFindingIndices: list every finding index you cited (empty array for a document).`;

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
 * is a real product defect, so this doesn't rely on prompt compliance. */
function ensureClimaxChart(chapters: Chapter[], climaxIndex: number | null, findings: Finding[]): Chapter[] {
  if (climaxIndex === null) return chapters;
  const alreadyReferenced = chapters.some((ch) => ch.blocks.some((b) => b.type === "chart" && b.findingRef === climaxIndex));
  if (alreadyReferenced) return chapters;

  const climax = findings[climaxIndex];
  if (!climax) return chapters;

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

/** Structured (findings-based) narration path: up to 6 turns -- climax+hook,
 * callout (skipped if no question was asked), one turn per chapter, actions.
 * 6 is a ceiling, not a target -- the callout turn simply isn't called when
 * there's no question, so a report with no question uses 5 calls, not 6.
 * Any single turn's total provider-chain exhaustion aborts the whole
 * sequence (returns null) rather than letting later turns retry a chain
 * that just proved to be down -- the caller falls back to
 * fallbackNarrationResult() in that case. */
export async function runStructuredNarrationTurns(
  storyArc: StoryArc,
  industry: string | null | undefined,
  question: string | null | undefined,
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

  // Turn 2: focus question callout -- skipped entirely if no question
  let focusQuestionCallout: string | null = null;
  if (question) {
    const turn2 = await callTurnGuarded(
      providers,
      preamble,
      userMessage(CALLOUT_FRAGMENT(question)),
      calloutSchema,
      (r) => r.focusQuestionCallout,
      history.join(" "),
      "callout"
    );
    if (!turn2) return null;
    providers = turn2.providers;
    focusQuestionCallout = turn2.result.focusQuestionCallout || null;
    if (focusQuestionCallout) history.push(`FOCUS QUESTION ANSWER: ${focusQuestionCallout}`);
    for (const idx of turn2.result.citedFindingIndices) cited.add(idx);
  }

  // Turns 3-5: one per chapter, in canonical order
  const chapters: Chapter[] = [];
  for (const chapterId of CHAPTER_IDS) {
    const turn = await callTurnGuarded(
      providers,
      preamble,
      userMessage(chapterFragment(chapterId, false, Boolean(question))),
      chapterSchema,
      (r) => blocksText(r.blocks),
      history.join(" "),
      `chapter:${chapterId}`
    );
    if (!turn) return null;
    providers = turn.providers;
    const chapter: Chapter = {
      id: chapterId,
      title: turn.result.title.trim() || defaultChapterTitle(chapterId),
      blocks: turn.result.blocks,
      citedFindingIndices: turn.result.citedFindingIndices,
    };
    chapters.push(chapter);
    history.push(chapterHistoryText(chapter));
    for (const idx of chapter.citedFindingIndices) cited.add(idx);
  }

  // Turn 6: actions
  const turn6 = await callTurnGuarded(
    providers,
    preamble,
    userMessage(ACTIONS_FRAGMENT),
    actionsSchema,
    (r) => r.actions.join(" "),
    history.join(" "),
    "actions"
  );
  if (!turn6) return null;

  const finalChapters = ensureClimaxChart(chapters, climaxIndex, findings);
  return {
    headline,
    hook,
    climaxIndex,
    chapters: finalChapters,
    focusQuestionCallout: question ? focusQuestionCallout : null,
    implication: storyArc.implication,
    actions: normalizeActions(turn6.result.actions, storyArc.action),
    wordCount: countWordsInChapters(finalChapters),
  };
}

/** Raw-text (PDF/DOCX/TXT upload, no findings array) narration path. Same
 * mechanism as the structured path -- fixed turns, shared textual history --
 * but no findings catalog and no chart/citedFindingIndices content (raw_text
 * is already fully present in every turn's prompt, so there's nothing to
 * lazily reference or fetch). */
export async function runTextNarrationTurns(
  storyArc: StoryArc,
  industry: string | null | undefined,
  question: string | null | undefined,
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

  let focusQuestionCallout: string | null = null;
  if (question) {
    const turn2 = await callTurnGuarded(
      providers,
      preamble,
      userMessage(CALLOUT_FRAGMENT(question)),
      calloutSchema,
      (r) => r.focusQuestionCallout,
      history.join(" "),
      "callout"
    );
    if (!turn2) return null;
    providers = turn2.providers;
    focusQuestionCallout = turn2.result.focusQuestionCallout || null;
    if (focusQuestionCallout) history.push(`FOCUS QUESTION ANSWER: ${focusQuestionCallout}`);
  }

  const chapters: Chapter[] = [];
  for (const chapterId of CHAPTER_IDS) {
    const turn = await callTurnGuarded(
      providers,
      preamble,
      userMessage(chapterFragment(chapterId, true, Boolean(question))),
      chapterSchema,
      (r) => blocksText(r.blocks),
      history.join(" "),
      `chapter:${chapterId}`
    );
    if (!turn) return null;
    providers = turn.providers;
    const chapter: Chapter = {
      id: chapterId,
      title: turn.result.title.trim() || defaultChapterTitle(chapterId),
      blocks: turn.result.blocks,
      citedFindingIndices: [],
    };
    chapters.push(chapter);
    history.push(chapterHistoryText(chapter));
  }

  const turn6 = await callTurnGuarded(
    providers,
    preamble,
    userMessage(ACTIONS_FRAGMENT),
    actionsSchema,
    (r) => r.actions.join(" "),
    history.join(" "),
    "actions"
  );
  if (!turn6) return null;

  return {
    headline,
    hook,
    climaxIndex: null,
    chapters,
    focusQuestionCallout: question ? focusQuestionCallout : null,
    implication: storyArc.implication,
    actions: normalizeActions(turn6.result.actions, storyArc.action),
    wordCount: countWordsInChapters(chapters),
  };
}
