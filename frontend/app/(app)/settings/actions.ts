"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function updateProfile(data: {
  industry?: string;
  default_pptx_theme?: string;
  brand_logo_url?: string;
  brand_primary?: string;
  brand_secondary?: string;
  brand_font?: string;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      industry: data.industry,
      defaultPptxTheme: data.default_pptx_theme,
      brandLogoUrl: data.brand_logo_url,
      brandPrimary: data.brand_primary,
      brandSecondary: data.brand_secondary,
      brandFont: data.brand_font,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/brand-kit");
}
