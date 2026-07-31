import "server-only";
import type { Finding } from "@/lib/analysis";
import type { QuestionPlanEntry } from "@/lib/llm/schemas";

export const IMPLICATION_TEMPLATES: Record<string, string> = {
  ranking: "A clear leader has emerged -- but the gap between first and the rest tells its own story.",
  dose_response: "There is an optimal level -- both too little and too much may be counterproductive.",
  outlier: "A handful of records are skewing the picture -- worth checking whether they're errors or genuinely exceptional cases.",
  trend: "The direction of this trend, if it continues, will materially change the numbers that matter.",
  correlation: "This relationship suggests one of these factors may be driving the other -- or both are being pulled by something else.",
  distribution: "Most of the value (or risk) is concentrated in a small slice of the data, not spread evenly.",
  descriptive: "This baseline is the yardstick everything else in the dataset should be measured against.",
  data_quality: "Gaps in the data limit how much confidence to place in any single number here.",
};

// Deterministic, type-keyed headline labels for the no-LLM fallback path.
// The fallback only ever has one rule-based sentence (the hook) to work
// with -- calling ensureDistinctHeadline(hook, hook) always detects them as
// identical and falls back to extracting the hook's own first sentence,
// which is by definition still the same text. These give the fallback a
// real, structurally distinct headline instead.
export const HEADLINE_TEMPLATES: Record<string, string> = {
  ranking: "The Leaderboard",
  dose_response: "The Dose-Response Curve",
  outlier: "Outliers Worth a Second Look",
  trend: "The Trend Line",
  correlation: "What's Driving What",
  distribution: "Where the Data Concentrates",
  descriptive: "The Baseline Numbers",
  data_quality: "A Data Quality Check",
};

const ACTION_TEMPLATES: Record<string, string> = {
  ranking: "Focus on what the top performers share, and whether those traits can be replicated.",
  dose_response: "Identify the sweet spot range and design interventions that keep usage within it.",
  outlier: "Investigate the flagged records individually before drawing conclusions from the averages.",
  trend: "Decide whether to reinforce or reverse this trajectory, and set a checkpoint to re-measure it.",
  correlation: "Test whether the relationship holds outside this dataset before acting on it.",
  distribution: "Segment the analysis so the dominant values don't drown out the rest of the story.",
  descriptive: "Use this range as the baseline for future comparisons.",
  data_quality: "Improve data collection in the gaps before relying on this dataset for high-stakes decisions.",
};

export function buildDatasetContext(rowCount: number | null, columnCount: number | null, columns: string[]): string {
  const parts: string[] = [];
  if (rowCount !== null && columnCount !== null) {
    parts.push(`This dataset contains ${rowCount.toLocaleString("en-US")} rows and ${columnCount} columns`);
  }
  if (columns.length > 0) {
    const shown = columns.slice(0, 8).join(", ");
    const more = columns.length > 8 ? `, and ${columns.length - 8} more` : "";
    parts.push(`covering ${shown}${more}`);
  }
  return parts.length > 0 ? `${parts.join(" ")}.` : "Dataset overview unavailable.";
}

/** Builds the opening hook. Dose-response and ranking findings answer the
 * question directly. Change-column findings are never used as hooks. */
function questionHook(findings: Finding[], question: string | null | undefined): string {
  const clean = findings.filter((f) => !f.columns.some((c) => c.startsWith("change_")));

  if (!question) {
    return clean[0]?.description ?? findings[0]?.description ?? "Your data has a story to tell.";
  }

  const dose = findings.filter((f) => f.type === "dose_response");
  if (dose.length > 0) {
    const top = dose[0];
    const x = String(top.extra.independent_var ?? "").replace(/_/g, " ");
    const pattern = top.extra.pattern;
    const outcome = (top.extra.outcome_label as string) ?? "performance";
    const peakBucket = top.extra.peak_bucket;
    if (pattern === "inverted_u" && peakBucket) {
      return `There's a sweet spot: ${titleCase(x)} peaks at ${peakBucket} usage, then hurts more than it helps`;
    }
    if (pattern === "linear_positive") return `More ${x} consistently improves ${outcome}`;
    if (pattern === "linear_negative") return `Surprisingly, more ${x} is associated with worse ${outcome}`;
    return top.description;
  }

  const ranking = findings.filter((f) => f.type === "ranking");
  if (ranking.length > 0) {
    const top = ranking[0];
    const entity = String(top.extra.top_entity ?? "");
    const val = Number(top.extra.top_value ?? 0);
    if (top.extra.is_combined) {
      const combinedCols = (top.extra.combined_cols as string[]) ?? [];
      const readable = combinedCols.map((c) => c.replace(/_/g, " ").replace("tournament", "").trim()).join(" + ");
      return `${entity} leads in combined ${readable} with ${val.toLocaleString("en-US", { maximumFractionDigits: 0 })} total contributions`;
    }
    const col = (top.extra.col as string) ?? top.columns[top.columns.length - 1] ?? "";
    return `${entity} has the highest ${col.replace(/_/g, " ")} in this dataset with ${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  return clean[0]?.description ?? findings[0]?.description ?? "Your data has a story to tell.";
}

/** Direct, declarative answer to the user's focus question -- shares
 * questionHook()'s dose_response/ranking finding selection and fact
 * extraction, but phrased as a straight answer rather than a teaser (the
 * hook is deliberately teaser-style; reusing its exact wording here would
 * recreate the hook/callout duplication bug already fixed on the LLM path).
 * Returns null when there's no question, or no question-relevant finding to
 * answer from -- callers must not show a callout in that case, not
 * fabricate one (this replaces a previous bug where the fallback path used
 * `open_question`, a "what else might explain X?" follow-up template, as if
 * it were an answer -- it never actually answered anything). */
export function questionAnswer(findings: Finding[], question: string | null | undefined): string | null {
  if (!question) return null;

  const dose = findings.filter((f) => f.type === "dose_response");
  if (dose.length > 0) {
    const top = dose[0];
    const x = String(top.extra.independent_var ?? "").replace(/_/g, " ");
    const pattern = top.extra.pattern;
    const outcome = (top.extra.outcome_label as string) ?? "performance";
    const peakBucket = top.extra.peak_bucket;
    if (pattern === "inverted_u" && peakBucket) {
      return `${titleCase(x)} helps ${outcome} up to about ${peakBucket} usage, then the benefit reverses.`;
    }
    if (pattern === "linear_positive") return `More ${x} consistently tracks with better ${outcome} across this dataset.`;
    if (pattern === "linear_negative") return `More ${x} tracks with worse ${outcome} across this dataset -- the opposite of what's often assumed.`;
    return top.description;
  }

  const ranking = findings.filter((f) => f.type === "ranking");
  if (ranking.length > 0) {
    const top = ranking[0];
    const entity = String(top.extra.top_entity ?? "");
    const val = Number(top.extra.top_value ?? 0);
    if (top.extra.is_combined) {
      const combinedCols = (top.extra.combined_cols as string[]) ?? [];
      const readable = combinedCols.map((c) => c.replace(/_/g, " ").replace("tournament", "").trim()).join(" + ");
      return `${entity} tops this ranking, with ${val.toLocaleString("en-US", { maximumFractionDigits: 0 })} combined ${readable}.`;
    }
    const col = (top.extra.col as string) ?? top.columns[top.columns.length - 1] ?? "";
    return `${entity} leads the dataset in ${col.replace(/_/g, " ")}, at ${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}.`;
  }

  return null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const LEAD_IN_PATTERN = /^(yes|no|answer)\s*[-:]+\s*/i;

/** Defensive backstop (belt-and-suspenders alongside the system prompt
 * rules) against headline/hook text that reads like a raw LLM reply to an
 * internal question ("Yes -- more X improves Y") rather than published
 * report copy. Strips the lead-in and re-capitalizes what's left. */
export function stripLeadIn(s: string): string {
  const stripped = s.replace(LEAD_IN_PATTERN, "").trim();
  if (!stripped) return s.trim();
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** True if a run of `minWords`+ consecutive words appears verbatim in both
 * strings (e.g. "there is a sweet spot") -- a stronger signal of copy/
 * paraphrase-anchoring than exact-string equality alone, which is what let
 * headline/hook/chapters converge on the same clause even when the two
 * fields weren't byte-identical. */
function hasSharedPhrase(a: string, b: string, minWords = 3): boolean {
  const wordsA = normalizeWords(a);
  const wordsB = ` ${normalizeWords(b).join(" ")} `;
  if (wordsA.length < minWords) return false;
  for (let i = 0; i <= wordsA.length - minWords; i++) {
    const phrase = wordsA.slice(i, i + minWords).join(" ");
    if (wordsB.includes(` ${phrase} `)) return true;
  }
  return false;
}

/** If headline and hook are identical, or share a substantial verbatim
 * phrase (3+ consecutive words -- e.g. both saying "there is a sweet
 * spot"), derive a short distinct headline from the hook's first clause
 * instead of displaying overlapping text in the report header. Applies to
 * both the deterministic fallback (which only has one rule-based sentence
 * to work with) and as a backstop against the LLM converging on similar
 * phrasing across fields. */
export function ensureDistinctHeadline(headline: string, hook: string): string {
  const identical = headline.trim().toLowerCase() === hook.trim().toLowerCase();
  if (!identical && !hasSharedPhrase(headline, hook)) return headline;
  const firstSentence = hook.split(/(?<=[.!?])\s+/)[0] ?? hook;
  return firstSentence.length <= 80 ? firstSentence : `${firstSentence.slice(0, 77)}...`;
}

/** Rule-based data-confidence score (0-100), never LLM-invented -- combines
 * the mean statistical `confidence` across findings with the dataset's
 * completeness ratio (from the `data_quality` finding, when present). Null
 * when there are no findings to derive a score from (nothing fabricated). */
function computeDataConfidence(findings: Finding[]): number | null {
  if (findings.length === 0) return null;

  const meanConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;

  const qualityFinding = findings.find((f) => f.type === "data_quality");
  let completeness = 1;
  if (qualityFinding) {
    const missing = Number(qualityFinding.extra.missing_cells ?? 0);
    const total = Number(qualityFinding.extra.total_cells ?? 0);
    if (total > 0) completeness = 1 - missing / total;
  }

  const score = (meanConfidence * 0.6 + completeness * 0.4) * 100;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export interface StoryArc {
  hook: string;
  context: string;
  findings: Finding[];
  climax: Finding | null;
  implication: string;
  action: string;
  /** All questions this report answers -- either user-supplied or
   * auto-generated when the user asked none. Empty when there's truly
   * nothing to structure the report around (planning/auto-gen both failed). */
  questions: string[];
  /** The plan that decided which analysis tools ran for each question
   * (lib/llm/planner.ts). Null for raw-text uploads (no tools to plan
   * against) or when planning never ran. */
  plan: QuestionPlanEntry[] | null;
  /** 0-100, rule-based (see computeDataConfidence); null when there's
   * nothing to derive a score from (no findings / raw-text upload). */
  dataConfidence: number | null;
  rowCount: number | null;
  columnCount: number | null;
  raw_text?: string;
}

/** Assembles the pre-computed story arc the LLM (or fallback writer)
 * narrates. No new facts are invented here — only structure and framing. */
export function buildStoryArc(
  findings: Finding[],
  rowCount: number | null,
  columnCount: number | null,
  columns: string[],
  questions: string[] = [],
  plan: QuestionPlanEntry[] | null = null
): StoryArc {
  const question = questions[0] ?? null;

  if (findings.length === 0) {
    return {
      hook: "This dataset didn't surface any statistically notable findings.",
      context: buildDatasetContext(rowCount, columnCount, columns),
      findings: [],
      climax: null,
      implication: "More data or a different cut may be needed to find a story here.",
      action: "Try uploading a richer dataset or asking a more specific question.",
      questions,
      plan,
      dataConfidence: null,
      rowCount,
      columnCount,
    };
  }

  // Dose-response findings are the climax when present; otherwise highest magnitude.
  // Never let a derived change_ column finding dominate the climax.
  const doseFindings = findings.filter((f) => f.type === "dose_response");
  const nonChange = findings.filter((f) => !f.columns.some((c) => c.startsWith("change_")));
  const climaxPool = doseFindings.length > 0 ? doseFindings : nonChange.length > 0 ? nonChange : findings;
  const climax = climaxPool.reduce((best, f) => (f.magnitude > best.magnitude ? f : best));

  return {
    hook: questionHook(findings, question),
    context: buildDatasetContext(rowCount, columnCount, columns),
    findings,
    climax,
    implication: IMPLICATION_TEMPLATES[climax.type] ?? IMPLICATION_TEMPLATES.descriptive,
    action: ACTION_TEMPLATES[climax.type] ?? ACTION_TEMPLATES.descriptive,
    questions,
    plan,
    dataConfidence: computeDataConfidence(findings),
    rowCount,
    columnCount,
  };
}

/** For unstructured uploads (PDF/DOCX/TXT/image) — no pre-computed Findings
 * exist, so the raw extracted text is handed to the LLM to find the
 * interesting angle itself rather than narrating fabricated statistics. */
export function buildTextStoryArc(text: string, questions: string[] = []): StoryArc {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return {
    hook: "Here's what stood out in this document.",
    context: `This document contains approximately ${wordCount.toLocaleString("en-US")} words.`,
    findings: [],
    climax: null,
    implication: "",
    action: "",
    questions,
    plan: null,
    dataConfidence: null,
    rowCount: null,
    columnCount: null,
    raw_text: text.slice(0, 8000),
  };
}
