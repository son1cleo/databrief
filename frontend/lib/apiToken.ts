import "server-only";
import { SignJWT } from "jose";
import { auth } from "@/lib/auth";

const secret = () => new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

/**
 * Mints a short-lived HS256 JWT (shared NEXTAUTH_SECRET) for the current
 * session, sent as a Bearer token to FastAPI. Kept separate from NextAuth's
 * own encrypted session cookie so the backend only ever has to verify one
 * simple signed token shape.
 */
export async function getApiToken(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  return new SignJWT({
    email: session.user.email,
    name: session.user.name,
    picture: session.user.image,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret());
}
