import "server-only";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

/** Signs in via the Credentials provider from a Server Action. Auth.js's
 * `signIn()` throws Next.js's internal redirect signal on success — that
 * must propagate, not get swallowed, so only `AuthError` is caught here. */
export async function signInWithCredentials(
  email: string,
  password: string,
  redirectTo: string
): Promise<{ message: string } | undefined> {
  try {
    await signIn("credentials", { email, password, redirectTo, redirect: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: "Invalid email or password." };
    }
    throw error;
  }
}
