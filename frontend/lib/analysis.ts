import "server-only";

const CORRELATION_THRESHOLD = 0.5;
const SKEW_THRESHOLD = 1.0;
const IQR_MULTIPLIER = 1.5;

export type Row = Record<string, unknown>;

export interface Finding {
  type: string; // descriptive | trend | outlier | correlation | distribution | data_quality | ranking | dose_response
  columns: string[];
  description: string;
  value: number | null;
  magnitude: number; // 0-1, how large/impactful the effect is
  confidence: number; // 0-1, how statistically trustworthy the finding is
  extra: Record<string, unknown>;
}

function makeFinding(f: Omit<Finding, "magnitude" | "confidence"> & { magnitude: number; confidence: number }): Finding {
  return {
    ...f,
    magnitude: Math.min(Math.max(round3(f.magnitude), 0), 1),
    confidence: Math.min(Math.max(round3(f.confidence), 0), 1),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Low-level stats primitives (hand-rolled, not a generic stats library, so we
// can guarantee exact parity with pandas/numpy formulas & conventions).
// ---------------------------------------------------------------------------

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (ddof=1), matching pandas' Series.std() default. */
export function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const sumSq = values.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

/** Linear-interpolation quantile matching pandas'/numpy's default `linear` method. */
export function quantile(sortedValues: number[], q: number): number {
  const n = sortedValues.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedValues[0];
  const pos = q * (n - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sortedValues[lower];
  const frac = pos - lower;
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * frac;
}

export function median(values: number[]): number {
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

/** pandas Series.skew(): bias-corrected (adjusted Fisher-Pearson) sample skewness. */
export function skewness(values: number[]): number {
  const n = values.length;
  if (n < 3) return NaN;
  const m = mean(values);
  const s = sampleStd(values);
  if (s === 0) return NaN;
  const sumCubed = values.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sumCubed;
}

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? NaN : num / denom;
}

/** Ordinary least squares, matching np.polyfit(x, y, 1) -> [slope, intercept]. */
export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let den = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

// ---------------------------------------------------------------------------
// Column introspection
// ---------------------------------------------------------------------------

function isMissing(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

export function numericColumns(rows: Row[], columns: string[]): string[] {
  return columns.filter((col) => {
    let sawNumber = false;
    for (const row of rows) {
      const v = row[col];
      if (isMissing(v)) continue;
      if (typeof v !== "number" || Number.isNaN(v)) return false;
      sawNumber = true;
    }
    return sawNumber;
  });
}

export function datetimeColumns(rows: Row[], columns: string[], numericCols: string[]): string[] {
  const numericSet = new Set(numericCols);
  const result: string[] = [];
  for (const col of columns) {
    if (numericSet.has(col)) continue;
    const sample = rows
      .map((r) => r[col])
      .filter((v) => !isMissing(v))
      .slice(0, 20);
    if (sample.length === 0) continue;
    let success = 0;
    for (const v of sample) {
      if (!Number.isNaN(Date.parse(String(v)))) success++;
    }
    if (success / sample.length > 0.8) result.push(col);
  }
  return result;
}

export function labelColumn(columns: string[], numericCols: string[]): string | null {
  const numericSet = new Set(numericCols);
  const candidates = columns.filter((c) => !numericSet.has(c));
  const nameCols = candidates.filter((c) => c.toLowerCase().includes("name"));
  if (nameCols.length > 0) return nameCols[0];
  const nonId = candidates.filter((c) => !["_id", "_code", "_key"].some((x) => c.toLowerCase().includes(x)));
  return nonId[0] ?? candidates[0] ?? null;
}

/** Given a Post_* / *_after column, find the matching Pre_* / *_before column. */
export function findPreColumn(columns: string[], postCol: string): string | null {
  const postLower = postCol.toLowerCase();
  const pairs: [string, string][] = [
    ["post_", "pre_"],
    ["after_", "before_"],
    ["_post", "_pre"],
    ["_after", "_before"],
  ];
  for (const [postPrefix, prePrefix] of pairs) {
    if (postLower.includes(postPrefix)) {
      const candidate = postLower.replace(postPrefix, prePrefix);
      const found = columns.find((c) => c.toLowerCase() === candidate);
      if (found) return found;
    }
  }
  const postStripped = postLower.replace("post", "").replace(/_/g, "");
  for (const col of columns) {
    const colLower = col.toLowerCase();
    if (colLower.includes("pre")) {
      const colStripped = colLower.replace("pre", "").replace(/_/g, "");
      if (postStripped && colStripped === postStripped) return col;
    }
  }
  return null;
}

function numericValues(rows: Row[], col: string): number[] {
  const out: number[] = [];
  for (const row of rows) {
    const v = row[col];
    if (isMissing(v)) continue;
    if (typeof v === "number" && !Number.isNaN(v)) out.push(v);
  }
  return out;
}

function isChangeCol(col: string): boolean {
  return col.startsWith("change_");
}

// ---------------------------------------------------------------------------
// Finding generators
// ---------------------------------------------------------------------------

function descriptiveFindings(rows: Row[], numericCols: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const col of numericCols.filter((c) => !isChangeCol(c))) {
    const series = numericValues(rows, col);
    if (series.length === 0) continue;
    const m = mean(series);
    const std = sampleStd(series);
    const cv = m ? Math.abs(std / m) : 0;
    const min = Math.min(...series);
    const max = Math.max(...series);
    findings.push(
      makeFinding({
        type: "descriptive",
        columns: [col],
        description: `${col} ranges from ${fmt(min)} to ${fmt(max)}, averaging ${fmt(m)}.`,
        value: m,
        magnitude: cv / 2,
        confidence: series.length / 50,
        extra: { mean: m, std, min, max },
      })
    );
  }
  return findings;
}

function trendFindings(rows: Row[], numericCols: string[], dateCols: string[]): Finding[] {
  if (dateCols.length === 0 || numericCols.length === 0) return [];
  const findings: Finding[] = [];
  const dateCol = dateCols[0];

  for (const col of numericCols) {
    const pairs: { t: number; v: number }[] = [];
    for (const row of rows) {
      const rawDate = row[dateCol];
      const rawVal = row[col];
      if (isMissing(rawDate) || isMissing(rawVal)) continue;
      const t = Date.parse(String(rawDate));
      if (Number.isNaN(t) || typeof rawVal !== "number" || Number.isNaN(rawVal)) continue;
      pairs.push({ t, v: rawVal });
    }
    pairs.sort((a, b) => a.t - b.t);
    if (pairs.length < 3) continue;

    const minT = pairs[0].t;
    const x = pairs.map((p) => (p.t - minT) / 86_400_000); // days since start
    const y = pairs.map((p) => p.v);
    if (Math.max(...x) === 0) continue;

    const { slope, intercept } = linearRegression(x, y);
    const predicted = x.map((xi) => slope * xi + intercept);
    const yMean = mean(y);
    const ssRes = predicted.reduce((acc, p, i) => acc + (y[i] - p) ** 2, 0);
    const ssTot = y.reduce((acc, v) => acc + (v - yMean) ** 2, 0);
    const rSquared = ssTot ? 1 - ssRes / ssTot : 0;

    const startVal = predicted[0];
    const endVal = predicted[predicted.length - 1];
    const pctChange = startVal ? ((endVal - startVal) / Math.abs(startVal)) * 100 : 0;
    const direction = pctChange >= 0 ? "increased" : "decreased";

    findings.push(
      makeFinding({
        type: "trend",
        columns: [col, dateCol],
        description: `${col} ${direction} by ${fmt(Math.abs(pctChange), 1)}% over the observed period (by ${dateCol}).`,
        value: pctChange,
        magnitude: Math.abs(pctChange) / 100,
        confidence: Math.max(rSquared, 0),
        extra: { slope, r_squared: rSquared },
      })
    );
  }
  return findings;
}

function outlierFindings(rows: Row[], numericCols: string[], labelCol: string | null): Finding[] {
  const findings: Finding[] = [];
  for (const col of numericCols.filter((c) => !isChangeCol(c))) {
    const indexed = rows
      .map((row, idx) => ({ idx, v: row[col] }))
      .filter((r) => !isMissing(r.v) && typeof r.v === "number" && !Number.isNaN(r.v)) as { idx: number; v: number }[];
    if (indexed.length < 5) continue;

    const sorted = [...indexed].sort((a, b) => a.v - b.v).map((r) => r.v);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    if (iqr === 0) continue;
    const lower = q1 - IQR_MULTIPLIER * iqr;
    const upper = q3 + IQR_MULTIPLIER * iqr;
    const outliers = indexed.filter((r) => r.v < lower || r.v > upper);
    if (outliers.length === 0) continue;

    const med = median(sorted);
    const mostExtreme = outliers.reduce((best, r) => (Math.abs(r.v - med) > Math.abs(best.v - med) ? r : best));
    const label = labelCol ? ` (${String(rows[mostExtreme.idx][labelCol])})` : "";
    const pctOfData = outliers.length / indexed.length;

    findings.push(
      makeFinding({
        type: "outlier",
        columns: [col],
        description: `${col} has ${outliers.length} outlier${outliers.length !== 1 ? "s" : ""} (${(pctOfData * 100).toFixed(1)}% of values); the most extreme is ${fmt(mostExtreme.v)}${label}.`,
        value: mostExtreme.v,
        magnitude: Math.abs(mostExtreme.v - med) / (iqr || 1) / 4,
        confidence: 1.0 - pctOfData,
        extra: { outlier_count: outliers.length, pct_of_data: pctOfData },
      })
    );
  }
  return findings;
}

function correlationFindings(rows: Row[], numericCols: string[]): Finding[] {
  if (numericCols.length < 2) return [];
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const n = rows.length;

  for (const colA of numericCols) {
    for (const colB of numericCols) {
      if (colA === colB) continue;
      const key = [colA, colB].sort().join("::");
      if (seen.has(key)) continue;
      if (isChangeCol(colA) && isChangeCol(colB)) continue;
      seen.add(key);

      const pairs = rows
        .map((row) => ({ a: row[colA], b: row[colB] }))
        .filter((p) => !isMissing(p.a) && !isMissing(p.b) && typeof p.a === "number" && typeof p.b === "number") as {
        a: number;
        b: number;
      }[];
      if (pairs.length < 2) continue;
      const r = pearsonCorrelation(
        pairs.map((p) => p.a),
        pairs.map((p) => p.b)
      );
      if (Number.isNaN(r) || Math.abs(r) < CORRELATION_THRESHOLD) continue;

      const direction = r > 0 ? "positively" : "negatively";
      findings.push(
        makeFinding({
          type: "correlation",
          columns: [colA, colB],
          description: `${colA} and ${colB} are ${direction} correlated (r=${r.toFixed(2)}).`,
          value: r,
          magnitude: Math.abs(r),
          confidence: n / 30,
          extra: { r, n },
        })
      );
    }
  }
  return findings;
}

function distributionFindings(rows: Row[], numericCols: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const col of numericCols.filter((c) => !isChangeCol(c))) {
    const series = numericValues(rows, col);
    if (series.length < 8) continue;
    const skew = skewness(series);
    if (Number.isNaN(skew) || Math.abs(skew) < SKEW_THRESHOLD) continue;
    const direction = skew > 0 ? "right" : "left";
    findings.push(
      makeFinding({
        type: "distribution",
        columns: [col],
        description: `${col} is heavily ${direction}-skewed (skew=${skew.toFixed(2)}), meaning a small number of ${skew > 0 ? "large" : "small"} values dominate.`,
        value: skew,
        magnitude: Math.abs(skew) / 3,
        confidence: series.length / 50,
        extra: { skew },
      })
    );
  }
  return findings;
}

function dataQualityFinding(rows: Row[], columns: string[]): Finding {
  const totalCells = rows.length * columns.length;
  let missing = 0;
  for (const row of rows) {
    for (const col of columns) {
      if (isMissing(row[col])) missing++;
    }
  }
  const missingPct = totalCells ? missing / totalCells : 0;
  const qualityScore = Math.max(0, 1 - missingPct);
  return makeFinding({
    type: "data_quality",
    columns,
    description: `Dataset is ${(qualityScore * 100).toFixed(0)}% complete (${missing} missing values across ${totalCells} cells).`,
    value: qualityScore,
    magnitude: missingPct,
    confidence: 1.0,
    extra: { missing_cells: missing, total_cells: totalCells },
  });
}

// ---------------------------------------------------------------------------
// Question-aware helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "in", "of", "and", "or", "who", "what",
  "how", "most", "has", "have", "are", "for", "to", "by", "with",
  "does", "using", "more", "actually", "there", "point", "students",
  "combined", "both", "terms", "impact",
]);

export function questionRelevantColumns(columns: string[], question: string | null | undefined): string[] {
  if (!question) return [];
  const questionLower = question.toLowerCase();
  const keywords = questionLower
    .split(/\s+/)
    .map((w) => w.replace(/[?.,!]+$/, ""))
    .filter((w) => !STOP_WORDS.has(w));

  let matched: string[] = [];
  for (const col of columns) {
    const colLower = col.toLowerCase().replace(/_/g, " ");
    for (const kw of keywords) {
      if (kw.length >= 3 && (colLower.includes(kw) || colLower.startsWith(kw))) {
        matched.push(col);
        break;
      }
    }
  }

  matched = matched.filter((c) => !["_team", "_opponent"].some((n) => c.toLowerCase().includes(n)));

  const preferred: string[] = [];
  const alreadyCovered = new Set<string>();
  for (const kw of keywords) {
    const tournamentCols = matched.filter((c) => c.toLowerCase().includes(kw) && c.toLowerCase().includes("tournament"));
    const otherCols = matched.filter((c) => c.toLowerCase().includes(kw) && !c.toLowerCase().includes("tournament"));
    if (tournamentCols.length > 0) {
      preferred.push(...tournamentCols);
      otherCols.forEach((c) => alreadyCovered.add(c));
    } else {
      preferred.push(...otherCols.filter((c) => !alreadyCovered.has(c)));
    }
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of preferred) {
    if (!seen.has(c)) {
      seen.add(c);
      result.push(c);
    }
  }
  return result;
}

export function isRankingQuestion(question: string | null | undefined): boolean {
  if (!question) return false;
  const triggers = ["who", "most", "highest", "top", "best", "greatest", "leading", "leader"];
  const q = question.toLowerCase();
  return triggers.some((t) => q.includes(t));
}

export function isDoseResponseQuestion(question: string | null | undefined): boolean {
  if (!question) return false;
  const triggers = [
    "does", "affect", "help", "hurt", "impact", "more", "less",
    "better", "worse", "improve", "point where", "too much", "optimal",
  ];
  const q = question.toLowerCase();
  return triggers.some((t) => q.includes(t));
}

export function isComparisonQuestion(question: string | null | undefined): boolean {
  if (!question) return false;
  const triggers = [
    "compare", "versus", "vs", "differ", "difference", "between", "among",
    "which group", "which region", "which department", "which category",
  ];
  const q = question.toLowerCase();
  return triggers.some((t) => q.includes(t));
}

// ---------------------------------------------------------------------------
// Dose-response: quartile bucketing.
//
// NOTE: pandas' pd.qcut() bins by VALUE quantile edges and can collapse
// buckets when there are many duplicate values (handled there via a
// [4,3,2]-quantile fallback loop). We instead bucket by RANK position, which
// always yields exactly `nq` non-empty buckets given the >=20-row guard
// below — a deliberate simplification, since the only thing that matters
// downstream is comparing bucket medians in order, not exact bin edges.
// ---------------------------------------------------------------------------

const QCUT_LABELS = ["Low", "Medium", "High", "Very High"];

function qcutBuckets(values: number[], nq: number): number[] {
  const n = values.length;
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const bucketOf = new Array<number>(n);
  order.forEach((originalIdx, rank) => {
    bucketOf[originalIdx] = Math.min(nq - 1, Math.floor((rank * nq) / n));
  });
  return bucketOf;
}

function doseResponseFindings(
  rows: Row[],
  question: string | null | undefined,
  relevantCols: string[],
  numericCols: string[],
  independentVar?: string | null,
  dependentVar?: string | null
): Finding[] {
  if (relevantCols.length === 0 && !(independentVar && dependentVar)) return [];

  const numericSet = new Set(numericCols);
  const pairsToTest: [string, string][] =
    independentVar && dependentVar
      ? [[independentVar, dependentVar]]
      : relevantCols.flatMap((x) =>
          relevantCols
            .filter((y) => y !== x && numericSet.has(x) && numericSet.has(y))
            .map((y): [string, string] => [x, y])
        );

  const findings: Finding[] = [];
  for (const [xCol, yCol] of pairsToTest.slice(0, 5)) {
    const preCol = findPreColumn(Object.keys(rows[0] ?? {}), yCol);
    const usedPrePost = preCol !== null && preCol !== undefined;

    const sub: { x: number; outcome: number }[] = [];
    for (const row of rows) {
      const xv = row[xCol];
      const yv = row[yCol];
      if (isMissing(xv) || isMissing(yv) || typeof xv !== "number" || typeof yv !== "number") continue;
      if (usedPrePost) {
        const prev = row[preCol as string];
        if (isMissing(prev) || typeof prev !== "number") continue;
        sub.push({ x: xv, outcome: yv - prev });
      } else {
        sub.push({ x: xv, outcome: yv });
      }
    }
    if (sub.length < 20) continue;

    const xArr = sub.map((s) => s.x);
    const yArr = sub.map((s) => s.outcome);
    if (sampleStd(xArr) === 0 || sampleStd(yArr) === 0) continue;
    const r = pearsonCorrelation(xArr, yArr);

    const nq = 4;
    const bucketIdx = qcutBuckets(xArr, nq);
    const bucketValues: number[][] = Array.from({ length: nq }, () => []);
    bucketIdx.forEach((b, i) => bucketValues[b].push(yArr[i]));
    const bins: Record<string, number> = {};
    QCUT_LABELS.slice(0, nq).forEach((label, i) => {
      if (bucketValues[i].length > 0) bins[label] = round3(median(bucketValues[i]));
    });

    const keys = Object.keys(bins);
    const vals = keys.map((k) => bins[k]);
    let pattern: string;
    let peakBucket: string | null = null;
    if (vals.length >= 3) {
      const peakIdx = vals.indexOf(Math.max(...vals));
      if (peakIdx > 0 && peakIdx < vals.length - 1) {
        pattern = "inverted_u";
        peakBucket = keys[peakIdx];
      } else if (vals[vals.length - 1] > vals[0]) {
        pattern = "linear_positive";
      } else {
        pattern = "linear_negative";
      }
    } else if (vals.length >= 2) {
      pattern = vals[vals.length - 1] > vals[0] ? "linear_positive" : "linear_negative";
    } else {
      pattern = "general";
    }

    const outcomeLabel = usedPrePost ? `${yCol.replace(/_/g, " ")} change (vs pre)` : yCol.replace(/_/g, " ");
    const patternDescs: Record<string, string> = {
      inverted_u: `there is a sweet spot -- outcome peaks at ${peakBucket} usage then declines`,
      linear_positive: "more X consistently associates with better outcome",
      linear_negative: "more X consistently associates with worse outcome",
      general: "no clear directional pattern detected",
    };
    const bucketStr = keys.map((k) => `${k}: ${bins[k] >= 0 ? "+" : ""}${bins[k].toFixed(3)}`).join(", ");
    const description = `When examining how ${xCol.replace(/_/g, " ")} affects ${outcomeLabel}, ${patternDescs[pattern]}. By usage level: ${bucketStr}.`;

    findings.push(
      makeFinding({
        type: "dose_response",
        columns: [xCol, yCol],
        description,
        value: r,
        magnitude: Math.abs(r) + 0.2,
        confidence: sub.length / 100,
        extra: {
          r,
          n: sub.length,
          pattern,
          bins,
          peak_bucket: peakBucket,
          independent_var: xCol,
          dependent_var: yCol,
          outcome_label: outcomeLabel,
          used_pre_post: usedPrePost,
        },
      })
    );
  }
  return findings;
}

function comparisonFindings(rows: Row[], relevantCols: string[], numericCols: string[]): Finding[] {
  const findings: Finding[] = [];
  const numericSet = new Set(numericCols);
  const catCols = relevantCols.filter((c) => !numericSet.has(c));
  const numCols = relevantCols.filter((c) => numericSet.has(c));
  if (catCols.length === 0 || numCols.length === 0) return findings;

  for (const catCol of catCols.slice(0, 1)) {
    for (const metricCol of numCols.slice(0, 3)) {
      const groups = new Map<string, number[]>();
      for (const row of rows) {
        const key = row[catCol];
        const val = row[metricCol];
        if (isMissing(key) || isMissing(val) || typeof val !== "number") continue;
        const k = String(key);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(val);
      }
      const stats = Array.from(groups.entries())
        .map(([k, vals]) => ({ key: k, mean: mean(vals), count: vals.length }))
        .filter((g) => g.count >= 5)
        .sort((a, b) => b.mean - a.mean);
      if (stats.length < 2) continue;

      const best = stats[0];
      const leaderboard = Object.fromEntries(stats.slice(0, 5).map((g) => [g.key, g.mean]));
      const leaderboardStr = stats
        .slice(0, 5)
        .map((g) => `${g.key} (${fmt(g.mean)})`)
        .join(", ");

      findings.push(
        makeFinding({
          type: "ranking",
          columns: [catCol, metricCol],
          description: `${best.key} has the highest average ${metricCol} (${fmt(best.mean)}). Top groups: ${leaderboardStr}.`,
          value: best.mean,
          magnitude: 0.92,
          confidence: 0.85,
          extra: { top_entity: best.key, top_value: best.mean, leaderboard, col: metricCol, is_combined: false },
        })
      );
    }
  }
  return findings;
}

function aggregateByLabel(rows: Row[], labelCol: string, col: string, useMax: boolean): Map<string, number> {
  const acc = new Map<string, number>();
  for (const row of rows) {
    const key = row[labelCol];
    const val = row[col];
    if (isMissing(key) || isMissing(val) || typeof val !== "number") continue;
    const k = String(key);
    if (!acc.has(k)) {
      acc.set(k, val);
    } else {
      acc.set(k, useMax ? Math.max(acc.get(k)!, val) : acc.get(k)! + val);
    }
  }
  return acc;
}

function topN(map: Map<string, number>, n: number): [string, number][] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function rankingFindings(
  rows: Row[],
  columns: string[],
  question: string | null | undefined,
  relevantCols: string[],
  numericCols: string[],
  force = false
): Finding[] {
  if (relevantCols.length === 0) return [];
  const questionLower = (question ?? "").toLowerCase();
  if (!force) {
    if (!questionLower) return [];
    const triggers = ["who", "most", "highest", "top", "best", "greatest", "leading", "leader", "impact"];
    if (!triggers.some((t) => questionLower.includes(t))) return [];
  }

  const labelCol = labelColumn(columns, numericCols);
  if (labelCol === null) return [];

  const numericSet = new Set(numericCols);
  const numericRelevant = relevantCols.filter((c) => numericSet.has(c));
  if (numericRelevant.length === 0) return [];

  const findings: Finding[] = [];
  const useMaxFor = (col: string) => ["total", "tournament", "career", "season"].some((kw) => col.toLowerCase().includes(kw));

  if (numericRelevant.length >= 2 && ["and", "combined", "both", "plus"].some((w) => questionLower.includes(w))) {
    let combined: Map<string, number> | null = null;
    for (const col of numericRelevant) {
      const series = aggregateByLabel(rows, labelCol, col, useMaxFor(col));
      if (combined === null) {
        combined = new Map(series);
      } else {
        for (const [k, v] of series) combined.set(k, (combined.get(k) ?? 0) + v);
      }
    }
    if (combined && combined.size > 0) {
      const top5 = topN(combined, 5);
      const [topEntity, topValue] = top5[0];
      const leaderboardStr = top5.map(([name, val]) => `${name} (${fmt(val, 0)})`).join(", ");
      const combinedLabel = numericRelevant.join(" + ");
      findings.push(
        makeFinding({
          type: "ranking",
          columns: [labelCol, ...numericRelevant],
          description: `${topEntity} leads in combined ${combinedLabel} with ${fmt(topValue, 0)} total contributions. Top 5: ${leaderboardStr}.`,
          value: topValue,
          magnitude: 0.99,
          confidence: 0.95,
          extra: {
            top_entity: topEntity,
            top_value: topValue,
            leaderboard: Object.fromEntries(top5),
            combined_cols: numericRelevant,
            is_combined: true,
          },
        })
      );
    }
  }

  for (const col of numericRelevant) {
    const series = aggregateByLabel(rows, labelCol, col, useMaxFor(col));
    if (series.size === 0) continue;
    const top5 = topN(series, 5);
    const [topEntity, topValue] = top5[0];
    const leaderboardStr = top5.map(([name, val]) => `${name} (${fmt(val, 0)})`).join(", ");
    findings.push(
      makeFinding({
        type: "ranking",
        columns: [labelCol, col],
        description: `${topEntity} leads in ${col} with ${fmt(topValue, 0)}. Top 5: ${leaderboardStr}.`,
        value: topValue,
        magnitude: 0.95,
        confidence: 0.95,
        extra: { top_entity: topEntity, top_value: topValue, leaderboard: Object.fromEntries(top5), col, is_combined: false },
      })
    );
  }

  return findings;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface AnalyzeOptions {
  question?: string | null;
  relevantCols?: string[] | null;
  questionType?: string | null;
  independentVar?: string | null;
  dependentVar?: string | null;
}

/** Runs the full stats engine over parsed rows and returns every candidate Finding. */
export function analyze(rows: Row[], columns: string[], options: AnalyzeOptions = {}): Finding[] {
  const { question = null, questionType = null, independentVar = null, dependentVar = null } = options;
  const numericCols = numericColumns(rows, columns);
  const dateCols = datetimeColumns(rows, columns, numericCols);
  const labelCol = labelColumn(columns, numericCols);
  const relevantCols = options.relevantCols ?? questionRelevantColumns(columns, question);

  let findings: Finding[] = [];

  if (questionType === "ranking" || isRankingQuestion(question)) {
    findings = findings.concat(rankingFindings(rows, columns, question, relevantCols, numericCols, questionType === "ranking"));
  }
  if (questionType === "dose_response" || isDoseResponseQuestion(question)) {
    findings = findings.concat(doseResponseFindings(rows, question, relevantCols, numericCols, independentVar, dependentVar));
  }
  if (questionType === "comparison" || isComparisonQuestion(question)) {
    findings = findings.concat(comparisonFindings(rows, relevantCols, numericCols));
  }

  findings = findings.concat(descriptiveFindings(rows, numericCols));
  findings = findings.concat(trendFindings(rows, numericCols, dateCols));
  findings = findings.concat(outlierFindings(rows, numericCols, labelCol));
  findings = findings.concat(correlationFindings(rows, numericCols));
  findings = findings.concat(distributionFindings(rows, numericCols));
  findings.push(dataQualityFinding(rows, columns));

  return findings;
}
