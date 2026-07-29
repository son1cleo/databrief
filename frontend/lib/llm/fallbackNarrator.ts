import "server-only";
import type { Finding } from "@/lib/analysis";
import { stripLeadIn, ensureDistinctHeadline, type StoryArc } from "@/lib/story";
import { chapterForFindingType, type StoryBlock, type Chapter, type StoryNarrationResult } from "./schemas";

function findingIndex(findings: Finding[], target: Finding): number {
  return findings.indexOf(target);
}

function chapterBlocks(findings: Finding[], all: Finding[], limit: number): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  for (const f of findings.slice(0, limit)) {
    blocks.push({ type: "paragraph", text: f.description });
    blocks.push({ type: "chart", findingRef: findingIndex(all, f) });
  }
  return blocks;
}

/** Deterministic template narrator — used when no LLM provider is configured
 * or every configured provider fails, so the pipeline never hard-fails on an
 * external dependency. Buckets findings into the same 3-chapter shape the
 * LLM path produces (see lib/llm.ts's normalizeChapters), just via a fixed
 * type->chapter heuristic instead of the LLM's judgment. */
export function fallbackNarrationResult(storyArc: StoryArc): StoryNarrationResult {
  if (storyArc.raw_text !== undefined) {
    return fallbackTextNarrationResult(storyArc);
  }

  const findings = storyArc.findings || [];
  const climaxIdx = storyArc.climax ? findings.indexOf(storyArc.climax) : -1;

  const combinedRankings = findings.filter((f) => f.type === "ranking" && f.extra.is_combined);

  const macroTrend = chapterBlocks(
    findings.filter((f) => chapterForFindingType(f.type) === "macro_trend"),
    findings,
    3
  );
  const anomalies = chapterBlocks(
    findings.filter((f) => chapterForFindingType(f.type) === "anomalies"),
    findings,
    3
  );
  const correlatedDrivers: StoryBlock[] = [];
  if (combinedRankings.length > 0) {
    const top = combinedRankings[0];
    const topEntity = String(top.extra.top_entity ?? "");
    const topValue = Number(top.extra.top_value ?? 0);
    const combinedCols = (top.extra.combined_cols as string[]) ?? [];
    const leaderboard = (top.extra.leaderboard as Record<string, number>) ?? {};
    const colsReadable = combinedCols.map((c) => c.replace(/_/g, " ").replace("tournament", "").trim()).join(" and ");
    correlatedDrivers.push({
      type: "paragraph",
      text: `${topEntity} comes out on top when measuring ${colsReadable} combined, accumulating ${Math.round(topValue).toLocaleString("en-US")} total contributions.`,
    });
    const entries = Object.entries(leaderboard).slice(0, 5);
    if (entries.length > 0) {
      correlatedDrivers.push({
        type: "list",
        items: entries.map(([name, val]) => `${name} -- ${Math.round(val).toLocaleString("en-US")} contributions`),
      });
    }
    correlatedDrivers.push({ type: "chart", findingRef: findingIndex(findings, top) });
  }
  correlatedDrivers.push(
    ...chapterBlocks(
      findings.filter((f) => f.type === "correlation" || f.type === "dose_response" || (f.type === "ranking" && !f.extra.is_combined)),
      findings,
      3
    )
  );
  const chapters: Chapter[] = [
    { id: "macro_trend", title: "Chapter I — The Macro Trend", blocks: macroTrend, citedFindingIndices: [] },
    { id: "anomalies", title: "Chapter II — Anomalies & Outliers", blocks: anomalies, citedFindingIndices: [] },
    { id: "correlated_drivers", title: "Chapter III — Correlated Drivers", blocks: correlatedDrivers, citedFindingIndices: [] },
  ];

  const hook = stripLeadIn(storyArc.hook);
  return {
    headline: ensureDistinctHeadline(hook, hook),
    hook,
    climaxIndex: climaxIdx >= 0 ? climaxIdx : null,
    chapters,
    focusQuestionCallout: storyArc.question && storyArc.open_question ? storyArc.open_question : null,
    implication: storyArc.implication,
    // Only one rule-based action exists without an LLM to generate 3
    // distinct pillars -- return what's real (0 or 1) rather than padding
    // with duplicate text that would read as an obvious bug in the report.
    actions: storyArc.action ? [storyArc.action] : [],
    wordCount: countWordsInChapters(chapters),
  };
}

function fallbackTextNarrationResult(storyArc: StoryArc): StoryNarrationResult {
  const hook = stripLeadIn(storyArc.hook || "Here's what stood out in this document.");
  const snippet = (storyArc.raw_text || "").slice(0, 1500);

  const chapters: Chapter[] = [
    { id: "macro_trend", title: "Chapter I — The Macro Trend", blocks: [{ type: "paragraph", text: storyArc.context || "" }], citedFindingIndices: [] },
    { id: "anomalies", title: "Chapter II — Anomalies & Outliers", blocks: [{ type: "paragraph", text: snippet }], citedFindingIndices: [] },
    { id: "correlated_drivers", title: "Chapter III — Correlated Drivers", blocks: [], citedFindingIndices: [] },
  ];

  return {
    headline: ensureDistinctHeadline(hook, hook),
    hook,
    climaxIndex: null,
    chapters,
    focusQuestionCallout: storyArc.question ? `In answer to: "${storyArc.question}"` : null,
    implication: storyArc.implication,
    actions: [],
    wordCount: countWordsInChapters(chapters),
  };
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
