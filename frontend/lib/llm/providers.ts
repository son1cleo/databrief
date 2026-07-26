import "server-only";
import { ChatGroq } from "@langchain/groq";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface LlmProvider {
  name: string;
  model: BaseChatModel;
}

/** Providers are tried in this order (Groq first — fastest/cheapest for this
 * workload), skipping any whose API key isn't configured. All three are
 * optional; the deterministic template narrator is the final fallback if
 * none are configured or all of them fail. */
export function configuredProviders(): LlmProvider[] {
  const providers: LlmProvider[] = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "groq",
      model: new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0,
      }),
    });
  }

  if (process.env.MISTRAL_API_KEY) {
    providers.push({
      name: "mistral",
      model: new ChatMistralAI({
        apiKey: process.env.MISTRAL_API_KEY,
        model: process.env.MISTRAL_MODEL || "mistral-large-latest",
        temperature: 0,
      }),
    });
  }

  if (process.env.NVIDIA_API_KEY) {
    providers.push({
      name: "nvidia",
      model: new ChatOpenAI({
        apiKey: process.env.NVIDIA_API_KEY,
        model: process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
        temperature: 0,
        configuration: { baseURL: "https://integrate.api.nvidia.com/v1" },
      }),
    });
  }

  return providers;
}
