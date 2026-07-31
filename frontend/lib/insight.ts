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

export interface RankFindingsOptions {
  topN?: number;
  /** Legacy relevance boost, used only when no question plan tagged findings
   * with questionIndices (i.e. analyze()'s no-plan fallback branch). */
  relevantCols?: string[] | null;
  /** Number of questions/chapters in play -- when >0, up to `minPerQuestion`
   * findings per question are reserved before the global topN cut, so a
   * lower-magnitude-but-necessary finding for one question isn't crowded out
   * by another question's flashier findings. */
  questionCount?: number;
  minPerQuestion?: number;
}

/** Scores findings by surprise factor, business impact, and statistical
 * confidence. Ranking findings and findings tied to a question are always
 * promoted to the top; when multiple questions are in play, each is
 * guaranteed a minimum share of the capped result before the rest is filled
 * by score alone. */
export function rankFindings(findings: Finding[], options: RankFindingsOptions = {}): Finding[] {
  const { topN = 5, relevantCols = null, questionCount = 0, minPerQuestion = 3 } = options;
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
    if (finding.questionIndices.length > 0) {
      base *= 1.5;
    } else if (relevantSet.size > 0 && finding.columns.some((c) => relevantSet.has(c))) {
      base *= 1.5;
    }
    return base;
  }

  const sorted = [...findings].sort((a, b) => score(b) - score(a));
  if (questionCount === 0) return sorted.slice(0, topN);

  const reserved = new Set<Finding>();
  const result: Finding[] = [];
  for (let q = 0; q < questionCount; q++) {
    const forThisQuestion = sorted.filter((f) => f.questionIndices.includes(q) && !reserved.has(f)).slice(0, minPerQuestion);
    for (const f of forThisQuestion) {
      reserved.add(f);
      result.push(f);
    }
  }
  for (const f of sorted) {
    if (result.length >= topN) break;
    if (!reserved.has(f)) {
      result.push(f);
      reserved.add(f);
    }
  }
  return result.slice(0, topN);
}
