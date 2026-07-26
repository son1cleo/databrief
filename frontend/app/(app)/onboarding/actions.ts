"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function completeOnboarding(data: { industry: string; default_pptx_theme: string }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      industry: data.industry,
      defaultPptxTheme: data.default_pptx_theme,
      onboarded: true,
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
