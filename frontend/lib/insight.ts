import "server-only";
import type { Finding } from "@/lib/analysis";

// Baseline story-worthiness per finding type — outliers/trends/correlations make
// for a better hook than plain descriptive stats or housekeeping data-quality notes.
const TYPE_WEIGHTS: Record<string, number> = {
  ranking: 1.0,
  dose_response: 1.0,
  outlier: 1.0,
  trend: 1.0,
  correlation: 0.9,
  distribution: 0.7,
  descriptive: 0.4,
  data_quality: 0.3,
};

const SURPRISE_WEIGHT = 0.5;
const CONFIDENCE_WEIGHT = 0.3;
const TYPE_WEIGHT_FACTOR = 0.2;

function isTrivialCorrelation(f: Finding): boolean {
  if (f.type !== "correlation" || f.columns.length < 2) return false;
  const cols = f.columns.map((c) => c.toLowerCase());
  for (const preP of ["pre_", "before_"]) {
    for (const postP of ["post_", "after_"]) {
      const a = cols[0].replace(preP, "").replace(postP, "");
      const b = cols[1].replace(preP, "").replace(postP, "");
      if (a === b) return true;
    }
  }
  return false;
}

/** Scores findings by surprise factor, business impact, and statistical
 * confidence. Ranking findings and findings on question-relevant columns
 * are always promoted to the top. */
export function rankFindings(findings: Finding[], topN = 5, relevantCols: string[] | null = null): Finding[] {
  const relevantSet = new Set(relevantCols ?? []);

  function score(finding: Finding): number {
    if (finding.type === "ranking") return 10.0;
    if (finding.type === "dose_response") return 9.0;
    if (isTrivialCorrelation(finding)) return 0.1;
    if (finding.type === "outlier" && relevantSet.size > 0 && finding.columns.every((c) => relevantSet.has(c))) {
      return 0.3;
    }
    let base =
      SURPRISE_WEIGHT * finding.magnitude +
      CONFIDENCE_WEIGHT * finding.confidence +
      TYPE_WEIGHT_FACTOR * (TYPE_WEIGHTS[finding.type] ?? 0.5);
    if (relevantSet.size > 0 && finding.columns.some((c) => relevantSet.has(c))) {
      base *= 1.5;
    }
    return base;
  }

  return [...findings].sort((a, b) => score(b) - score(a)).slice(0, topN);
}
