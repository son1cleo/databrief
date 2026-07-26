"use server";

import { z } from "zod";
import { signInWithCredentials } from "@/lib/authActions";

export type LoginState = { message: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Password is required"),
});

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  return signInWithCredentials(parsed.data.email, parsed.data.password, "/dashboard");
}
