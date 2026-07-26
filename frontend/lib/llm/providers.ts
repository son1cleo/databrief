import "server-only";
import { ChatGroq } from "@langchain/groq";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface LlmProvider {
  name: string;
  model: BaseChatModel;
}

export const PROVIDER_NAMES = ["groq", "mistral", "nvidia"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

/** Providers with an API key configured for this deployment, in the default
 * fallback order (Groq first -- fastest/cheapest for this workload). Cheap
 * env-only check with no model construction, so it's safe to call just to
 * populate the settings UI's provider choices. */
export function availableProviderNames(): ProviderName[] {
  return PROVIDER_NAMES.filter((name) => {
    if (name === "groq") return Boolean(process.env.GROQ_API_KEY);
    if (name === "mistral") return Boolean(process.env.MISTRAL_API_KEY);
    return Boolean(process.env.NVIDIA_API_KEY);
  });
}

function buildProvider(name: ProviderName): LlmProvider {
  switch (name) {
    case "groq":
      return {
        name,
        model: new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          temperature: 0,
        }),
      };
    case "mistral":
      return {
        name,
        model: new ChatMistralAI({
          apiKey: process.env.MISTRAL_API_KEY,
          model: process.env.MISTRAL_MODEL || "mistral-large-latest",
          temperature: 0,
        }),
      };
    case "nvidia":
      return {
        name,
        model: new ChatOpenAI({
          apiKey: process.env.NVIDIA_API_KEY,
          model: process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
          temperature: 0,
          configuration: { baseURL: "https://integrate.api.nvidia.com/v1" },
        }),
      };
  }
}

/** Providers are tried in order, skipping any whose API key isn't
 * configured. All three are optional; the deterministic template narrator is
 * the final fallback if none are configured or all of them fail.
 *
 * When `preferred` names a provider that's actually configured, it's moved
 * to the front so it's tried first -- the other configured providers still
 * stay in the chain as fallback if the preferred one fails, rather than
 * becoming the user's only option. An unset or unconfigured preference
 * leaves the default order untouched. */
export function configuredProviders(preferred?: string | null): LlmProvider[] {
  const available = availableProviderNames();
  const order =
    preferred && available.includes(preferred as ProviderName)
      ? [preferred as ProviderName, ...available.filter((name) => name !== preferred)]
      : available;
  return order.map(buildProvider);
}
