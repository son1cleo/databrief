import "server-only";
import type { Finding } from "@/lib/analysis";

const IMPLICATION_TEMPLATES: Record<string, string> = {
  ranking: "A clear leader has emerged -- but the gap between first and the rest tells its own story.",
  dose_response: "There is an optimal level -- both too little and too much may be counterproductive.",
  outlier: "A handful of records are skewing the picture -- worth checking whether they're errors or genuinely exceptional cases.",
  trend: "The direction of this trend, if it continues, will materially change the numbers that matter.",
  correlation: "This relationship suggests one of these factors may be driving the other -- or both are being pulled by something else.",
  distribution: "Most of the value (or risk) is concentrated in a small slice of the data, not spread evenly.",
  descriptive: "This baseline is the yardstick everything else in the dataset should be measured against.",
  data_quality: "Gaps in the data limit how much confidence to place in any single number here.",
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
      return `Yes -- but only up to a point. ${titleCase(x)} peaks at ${peakBucket} usage, then hurts more than it helps`;
    }
    if (pattern === "linear_positive") return `Yes -- more ${x} consistently improves ${outcome}`;
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
    return `${entity} has the highest ${col} in this dataset with ${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  return clean[0]?.description ?? findings[0]?.description ?? "Your data has a story to tell.";
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface StoryArc {
  hook: string;
  context: string;
  findings: Finding[];
  climax: Finding | null;
  implication: string;
  action: string;
  open_question: string | null;
  question: string | null;
  raw_text?: string;
}

/** Assembles the pre-computed story arc the LLM (or fallback writer)
 * narrates. No new facts are invented here — only structure and framing. */
export function buildStoryArc(
  findings: Finding[],
  rowCount: number | null,
  columnCount: number | null,
  columns: string[],
  question: string | null = null
): StoryArc {
  if (findings.length === 0) {
    return {
      hook: "This dataset didn't surface any statistically notable findings.",
      context: buildDatasetContext(rowCount, columnCount, columns),
      findings: [],
      climax: null,
      implication: "More data or a different cut may be needed to find a story here.",
      action: "Try uploading a richer dataset or asking a more specific question.",
      open_question: null,
      question,
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
    open_question: question
      ? `What else might explain ${question.replace(/\?$/, "")}?`
      : findings.length > 1
        ? `What's behind ${findings[1].columns.join(", ")}?`
        : null,
    question,
  };
}

/** For unstructured uploads (PDF/DOCX/TXT/image) — no pre-computed Findings
 * exist, so the raw extracted text is handed to the LLM to find the
 * interesting angle itself rather than narrating fabricated statistics. */
export function buildTextStoryArc(text: string, question: string | null = null): StoryArc {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return {
    hook: "Here's what stood out in this document.",
    context: `This document contains approximately ${wordCount.toLocaleString("en-US")} words.`,
    findings: [],
    climax: null,
    implication: "",
    action: "",
    open_question: null,
    question,
    raw_text: text.slice(0, 8000),
  };
}
