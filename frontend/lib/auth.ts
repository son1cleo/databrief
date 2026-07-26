import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

class InvalidLoginError extends CredentialsSignin {
  code = "invalid_credentials";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : null;
        const password = typeof credentials?.password === "string" ? credentials.password : null;
        if (!email || !password) throw new InvalidLoginError();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) throw new InvalidLoginError();

        const valid = await verifyPassword(password, user.password);
        if (!valid) throw new InvalidLoginError();

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  events: {
    async signIn({ user, account }) {
      if (!user.id || !account) return;
      // The Prisma adapter already created/linked the User + Account rows —
      // just record which provider they most recently signed in with.
      await prisma.user
        .update({ where: { id: user.id }, data: { provider: account.provider } })
        .catch((err) => {
          console.error("Failed to record sign-in provider:", err);
        });
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.provider = account.provider;
      }
      if (profile) {
        token.picture = (profile as { picture?: string; avatar_url?: string }).picture ?? (profile as { avatar_url?: string }).avatar_url;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.provider = token.provider as string | undefined;
        session.user.image = (token.picture as string | undefined) ?? session.user.image;
      }
      return session;
    },
  },
});
