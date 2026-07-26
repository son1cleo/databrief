import "server-only";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { z } from "zod";
import type { LlmProvider } from "./providers";

const GraphState = Annotation.Root({
  systemPrompt: Annotation<string>,
  userMessage: Annotation<string>,
  result: Annotation<unknown>({ default: () => null, reducer: (_prev, next) => next }),
  providerUsed: Annotation<string | null>({ default: () => null, reducer: (_prev, next) => next }),
  errors: Annotation<string[]>({ default: () => [], reducer: (prev, next) => prev.concat(next) }),
});

export type FallbackResult<T> = { result: T; provider: string } | { result: null; providerErrors: string[] };

/** Tries each provider in order via structured output (tool-calling under the
 * hood), stopping at the first success. Each provider attempt is a node in a
 * small LangGraph state machine — a transient failure on one provider (rate
 * limit, timeout, malformed output) only advances to the next node, it never
 * aborts the whole call. Falls through to the caller's own fallback when
 * every configured provider fails (or none are configured at all). */
export async function runWithFallback<T>(
  providers: LlmProvider[],
  systemPrompt: string,
  userMessage: string,
  schema: z.ZodType<T>
): Promise<FallbackResult<T>> {
  if (providers.length === 0) {
    return { result: null, providerErrors: ["No LLM providers configured"] };
  }

  const builder = new StateGraph(GraphState);

  for (const provider of providers) {
    builder.addNode(provider.name, async (state: typeof GraphState.State) => {
      try {
        const structured = provider.model.withStructuredOutput(schema);
        const result = await structured.invoke([
          new SystemMessage(state.systemPrompt),
          new HumanMessage(state.userMessage),
        ]);
        return { result, providerUsed: provider.name };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { errors: [`${provider.name}: ${message}`] };
      }
    });
  }

  builder.addEdge(START, providers[0].name as never);
  providers.forEach((provider, i) => {
    const next = providers[i + 1]?.name ?? END;
    builder.addConditionalEdges(provider.name as never, (state: typeof GraphState.State) =>
      state.result !== null ? END : next
    );
  });

  const graph = builder.compile();
  const finalState = await graph.invoke({ systemPrompt, userMessage, result: null, providerUsed: null, errors: [] });

  if (finalState.result !== null) {
    return { result: finalState.result as T, provider: finalState.providerUsed as string };
  }
  return { result: null, providerErrors: finalState.errors };
}
