"use server";

import { redirect } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { getApiToken } from "@/lib/apiToken";

type ActionResult = { success: true; url: string } | { success: false; message: string };

export async function startCheckout(plan: "starter" | "growth" | "business"): Promise<ActionResult> {
  const token = await getApiToken();
  if (!token) redirect("/login");

  try {
    const { url } = await apiFetch<{ url: string }>("/api/billing/checkout", {
      method: "POST",
      token,
      body: JSON.stringify({ plan }),
    });
    return { success: true, url };
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      return { success: false, message: "Billing isn't configured yet. Add Stripe API keys to enable checkout." };
    }
    if (err instanceof ApiError && err.status === 502) {
      return { success: false, message: "Stripe rejected the request. Check your Stripe API keys and price IDs." };
    }
    return { success: false, message: "Could not start checkout. Please try again." };
  }
}

export async function openBillingPortal(): Promise<ActionResult> {
  const token = await getApiToken();
  if (!token) redirect("/login");

  try {
    const { url } = await apiFetch<{ url: string }>("/api/billing/portal", { token });
    return { success: true, url };
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      return { success: false, message: "Billing isn't configured yet. Add Stripe API keys to enable the portal." };
    }
    if (err instanceof ApiError && err.status === 502) {
      return { success: false, message: "Stripe rejected the request. Check your Stripe API keys." };
    }
    return { success: false, message: "Could not open the billing portal. Please try again." };
  }
}
