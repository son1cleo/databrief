"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { signInWithCredentials } from "@/lib/authActions";

export type SignupState = { message: string } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address")),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.password) {
    return { message: "An account with this email already exists. Try signing in instead." };
  }

  const passwordHash = await hashPassword(password);

  if (existing) {
    // Existing OAuth-only account — add a password so they can also sign in with credentials.
    await prisma.user.update({ where: { id: existing.id }, data: { password: passwordHash } });
  } else {
    await prisma.user.create({ data: { email, name, password: passwordHash, provider: "credentials" } });
  }

  return signInWithCredentials(email, password, "/dashboard");
}
