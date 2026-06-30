"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { getApiToken } from "@/lib/apiToken";

export async function updateProfile(data: {
  industry?: string;
  default_pptx_theme?: string;
  brand_logo_url?: string;
  brand_primary?: string;
  brand_secondary?: string;
  brand_font?: string;
}): Promise<void> {
  const token = await getApiToken();
  if (!token) redirect("/login");

  await apiFetch("/api/auth/me", {
    method: "PATCH",
    token,
    body: JSON.stringify(data),
  });
  revalidatePath("/settings");
  revalidatePath("/brand-kit");
}
