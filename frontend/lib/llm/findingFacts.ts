import "server-only";
import type { Finding } from "@/lib/analysis";

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
export function factsOnly(finding: Finding): Record<string, unknown> {
  const { description: _description, extra, ...rest } = finding;
  return { ...rest, extra: stripChartB64(extra) };
}

/** Full findings list, factsOnly()-stripped, serialized once and reused by
 * every narration turn. NOTE: deliberately NOT a stripped-down "catalog" of
 * just type/value/magnitude -- specific numbers a chapter needs to cite
 * (e.g. outlier_count, leaderboard entries, dose-response peak_bucket) live
 * in `extra`, which a bare catalog line would drop, silencing exactly the
 * kind of specific citation the "so what" prompt rule requires. Findings
 * are already capped at 40 upstream and each factsOnly() entry is small
 * (a few hundred bytes -- leaderboards/bins are already capped in
 * analysis.ts), so sending the full list to each of the ~6 turns costs
 * tokens but not correctness -- the tradeoff Phase 1 accepts over losing
 * real data a turn might need. */
export function buildFindingsJson(findings: Finding[]): string {
  return JSON.stringify(findings.map(factsOnly));
}
