"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getApiToken } from "@/lib/apiToken";

export async function completeOnboarding(data: { industry: string; default_pptx_theme: string }) {
  const token = await getApiToken();
  if (!token) redirect("/login");

  await apiFetch("/api/auth/me", {
    method: "PATCH",
    token,
    body: JSON.stringify({
      industry: data.industry,
      default_pptx_theme: data.default_pptx_theme,
      onboarded: 1,
    }),
  });

  redirect("/dashboard");
}
