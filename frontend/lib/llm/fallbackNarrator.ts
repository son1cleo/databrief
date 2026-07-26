import "server-only";
import type { Finding } from "@/lib/analysis";
import type { StoryArc } from "@/lib/story";
import type { StoryBlock } from "./schemas";

export function countWords(blocks: StoryBlock[]): number {
  let count = 0;
  for (const b of blocks) {
    if (b.type === "heading" || b.type === "paragraph") count += b.text.split(/\s+/).filter(Boolean).length;
    else if (b.type === "list") count += b.items.join(" ").split(/\s+/).filter(Boolean).length;
  }
  return count;
}

function findingIndex(findings: Finding[], target: Finding): number {
  return findings.indexOf(target);
}

/** Deterministic template narrator — used when no LLM provider is configured
 * or every configured provider fails, so the pipeline never hard-fails on an
 * external dependency. Ported from llm_service.py's _fallback_story_html,
 * producing structured blocks instead of HTML strings. */
export function fallbackStoryBlocks(storyArc: StoryArc): { blocks: StoryBlock[]; wordCount: number } {
  if (storyArc.raw_text !== undefined) {
    return fallbackTextStoryBlocks(storyArc);
  }

  const hook = storyArc.hook || "Your data has a story to tell.";
  const context = storyArc.context || "";
  const findings = storyArc.findings || [];
  const implication = storyArc.implication || "";
  const action = storyArc.action || "";
  const openQuestion = storyArc.open_question;
  const question = storyArc.question;

  const blocks: StoryBlock[] = [{ type: "heading", level: 1, text: hook }];

  if (question) {
    blocks.push({ type: "paragraph", text: `Answering: "${question}"` });
  }
  blocks.push({ type: "paragraph", text: context });

  const combinedRankings = findings.filter((f) => f.type === "ranking" && f.extra.is_combined);
  const individualRankings = findings.filter((f) => f.type === "ranking" && !f.extra.is_combined);
  const otherFindings = findings.filter((f) => f.type !== "ranking");

  if (combinedRankings.length > 0) {
    const top = combinedRankings[0];
    const topEntity = String(top.extra.top_entity ?? "");
    const topValue = Number(top.extra.top_value ?? 0);
    const combinedCols = (top.extra.combined_cols as string[]) ?? [];
    const leaderboard = (top.extra.leaderboard as Record<string, number>) ?? {};
    const colsReadable = combinedCols.map((c) => c.replace(/_/g, " ").replace("tournament", "").trim()).join(" and ");

    blocks.push({ type: "heading", level: 2, text: "The Headline" });
    blocks.push({
      type: "paragraph",
      text: `${topEntity} comes out on top when measuring ${colsReadable} combined, accumulating ${Math.round(topValue).toLocaleString("en-US")} total contributions.`,
    });
    const entries = Object.entries(leaderboard).slice(0, 5);
    if (entries.length > 0) {
      blocks.push({ type: "heading", level: 2, text: "The Full Leaderboard" });
      blocks.push({
        type: "list",
        items: entries.map(([name, val]) => `${name} -- ${Math.round(val).toLocaleString("en-US")} contributions`),
      });
    }
    blocks.push({ type: "chart", findingRef: findingIndex(findings, top) });
  }

  if (individualRankings.length > 0) {
    blocks.push({ type: "heading", level: 2, text: "Breaking It Down" });
    for (const f of individualRankings.slice(0, 3)) {
      const topEntity = String(f.extra.top_entity ?? "");
      const col = String(f.extra.col ?? "")
        .replace(/_/g, " ")
        .replace("tournament", "")
        .trim();
      const leaderboard = (f.extra.leaderboard as Record<string, number>) ?? {};
      const items = Object.entries(leaderboard);
      if (items.length > 0) {
        const rest = items
          .slice(1, 3)
          .map(([n, v]) => `${n} (${Math.round(v).toLocaleString("en-US")})`)
          .join(", ");
        blocks.push({
          type: "paragraph",
          text: `${topEntity} leads in ${col}` + (rest ? `, followed by ${rest}.` : "."),
        });
        blocks.push({ type: "chart", findingRef: findingIndex(findings, f) });
      }
    }
  }

  if (combinedRankings.length === 0 && individualRankings.length === 0 && otherFindings.length > 0) {
    blocks.push({ type: "heading", level: 2, text: "What the data shows" });
    for (const f of otherFindings.slice(0, 5)) {
      blocks.push({ type: "paragraph", text: f.description });
      blocks.push({ type: "chart", findingRef: findingIndex(findings, f) });
    }
  } else if (otherFindings.length > 0) {
    blocks.push({ type: "heading", level: 2, text: "What else the data shows" });
    for (const f of otherFindings.slice(0, 3)) {
      blocks.push({ type: "paragraph", text: f.description });
      blocks.push({ type: "chart", findingRef: findingIndex(findings, f) });
    }
  }

  if (implication) {
    blocks.push({ type: "heading", level: 2, text: "What this means" });
    blocks.push({ type: "paragraph", text: implication });
  }
  if (action) {
    blocks.push({ type: "heading", level: 2, text: "What to do next" });
    blocks.push({ type: "paragraph", text: action });
  }
  if (openQuestion) {
    blocks.push({ type: "heading", level: 2, text: "Worth investigating" });
    blocks.push({ type: "paragraph", text: openQuestion });
  }

  return { blocks, wordCount: countWords(blocks) };
}

function fallbackTextStoryBlocks(storyArc: StoryArc): { blocks: StoryBlock[]; wordCount: number } {
  const hook = storyArc.hook || "Here's what's in this document.";
  const context = storyArc.context || "";
  const question = storyArc.question;
  const snippet = (storyArc.raw_text || "").slice(0, 1500);

  const blocks: StoryBlock[] = [
    { type: "heading", level: 1, text: hook },
    { type: "paragraph", text: context },
  ];
  if (question) {
    blocks.push({ type: "paragraph", text: `In answer to: "${question}"` });
  }
  blocks.push({ type: "heading", level: 2, text: "Excerpt" });
  blocks.push({ type: "paragraph", text: snippet });

  return { blocks, wordCount: countWords(blocks) };
}
