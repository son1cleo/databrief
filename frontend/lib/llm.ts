import "server-only";
import { configuredProviders } from "@/lib/llm/providers";
import { fallbackNarrationResult } from "@/lib/llm/fallbackNarrator";
import { runStructuredNarrationTurns, runTextNarrationTurns } from "@/lib/llm/narrationAgent";
import type { StoryNarrationResult } from "@/lib/llm/schemas";
import type { StoryArc } from "@/lib/story";

/** Narrates the story arc, letting the LLM pick which finding is the real
 * climax (not just the highest-scoring one) and write chapters grounded in
 * the report's question plan (storyArc.plan/storyArc.questions) rather than
 * a fixed dataset-wide template. */
export async function generateStoryBlocks(
  storyArc: StoryArc,
  industry?: string | null,
  preferredProvider?: string | null
): Promise<StoryNarrationResult> {
  const providers = configuredProviders(preferredProvider);
  if (providers.length === 0) {
    console.log("[narration] falling back: no LLM providers configured (check GROQ_API_KEY/MISTRAL_API_KEY/NVIDIA_API_KEY in this process's env)");
    return fallbackNarrationResult(storyArc);
  }

  const isTextDoc = storyArc.raw_text !== undefined;
  const result = isTextDoc
    ? await runTextNarrationTurns(storyArc, industry, providers)
    : await runStructuredNarrationTurns(storyArc, industry, providers);

  if (result === null) {
    console.log(
      `[narration] falling back: providers were configured (${providers.map((p) => p.name).join(", ")}) but the turn sequence failed -- see [narration] turn-failed logs above for the actual provider errors`
    );
  }

  return result ?? fallbackNarrationResult(storyArc);
}
