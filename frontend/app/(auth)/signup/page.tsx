import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { CredentialsForm } from "@/components/auth/CredentialsForm";
import { signup } from "./actions";

export default async function SignupPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="glow-brand w-full max-w-sm rounded-lg border border-border bg-surface p-10">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Your data knows something you don&apos;t. Find out what.
          </p>
        </div>
        <OAuthButtons callbackUrl="/dashboard" />
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] text-muted-foreground">OR</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <CredentialsForm mode="signup" action={signup} />
        <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
        <p className="mt-4 text-center font-mono text-[10px] text-muted-foreground">
          By continuing, you agree to DataBrief&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
