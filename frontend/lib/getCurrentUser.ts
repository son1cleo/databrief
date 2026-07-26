import "server-only";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";

// Live user row (plan/usage/brand kit) for the signed-in session. Deliberately
// not stuffed into the JWT session cookie — those fields (reports_used etc.)
// change often and would go stale until the next sign-in otherwise.
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({ where: { email: session.user.email } });
});

/** Maps the Prisma User row to the snake_case UserOut shape the frontend's
 * existing components (StatsBar, etc.) already expect. */
export function toUserOut(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.image,
    provider: user.provider,
    plan: user.plan,
    reports_used: user.reportsUsed,
    reports_limit: user.reportsLimit,
    industry: user.industry,
    onboarded: user.onboarded ? 1 : 0,
    brand_logo_url: user.brandLogoUrl,
    brand_primary: user.brandPrimary,
    brand_secondary: user.brandSecondary,
    brand_font: user.brandFont,
    default_pptx_theme: user.defaultPptxTheme,
    preferred_llm_provider: user.preferredLlmProvider,
    created_at: user.createdAt.toISOString(),
  };
}
