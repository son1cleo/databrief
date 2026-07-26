// Display labels only -- kept free of "server-only" so client components
// (e.g. the settings page's provider picker) can import it directly.
export const LLM_PROVIDER_LABELS: Record<string, string> = {
  groq: "Groq (Llama 3.3 70B)",
  mistral: "Mistral (Mistral Large)",
  nvidia: "NVIDIA NIM (Llama 3.1 70B)",
};
