"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createCheckoutSession, createPortalSession, StripeNotConfiguredError } from "@/lib/billing";

type ActionResult = { success: true; url: string } | { success: false; message: string };

function absoluteUrl(path: string): string {
  return new URL(path, process.env.NEXTAUTH_URL).toString();
}

export async function startCheckout(plan: "starter" | "growth" | "business"): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  try {
    const url = await createCheckoutSession(
      user,
      plan,
      absoluteUrl("/settings/billing?checkout=success"),
      absoluteUrl("/settings/billing?checkout=cancelled")
    );
    return { success: true, url };
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return { success: false, message: "Billing isn't configured yet. Add Stripe API keys to enable checkout." };
    }
    if (err instanceof Error && err.message.startsWith("No Stripe price configured")) {
      return { success: false, message: "Stripe rejected the request. Check your Stripe API keys and price IDs." };
    }
    return { success: false, message: "Could not start checkout. Please try again." };
  }
}

export async function openBillingPortal(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  try {
    const url = await createPortalSession(user, absoluteUrl("/settings/billing"));
    return { success: true, url };
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return { success: false, message: "Billing isn't configured yet. Add Stripe API keys to enable the portal." };
    }
    return { success: false, message: "Could not open the billing portal. Please try again." };
  }
}
