import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/dashboard");

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="glow-brand w-full max-w-sm rounded-lg border border-border bg-surface p-10">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Your data knows something you don&apos;t. Find out what.
          </p>
        </div>
        <OAuthButtons callbackUrl={callbackUrl ?? "/dashboard"} />
        <p className="mt-6 text-center font-mono text-[10px] text-muted-foreground">
          By continuing, you agree to DataBrief&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
