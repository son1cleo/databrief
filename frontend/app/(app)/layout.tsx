import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentUser, toUserOut } from "@/lib/getCurrentUser";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const pathname = (await headers()).get("x-pathname") ?? "";
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const user = toUserOut(currentUser);

  const isOnboarding = pathname.startsWith("/onboarding");
  if (!user.onboarded && !isOnboarding) redirect("/onboarding");
  if (user.onboarded && isOnboarding) redirect("/dashboard");

  if (isOnboarding) {
    return (
      <main className="flex-1">
        <PageTransition key={pathname}>{children}</PageTransition>
      </main>
    );
  }

  return (
    // Outer frame: the app sits inset on the darkest backdrop, so the rail and
    // the content panel read as two separate surfaces floating on it.
    <div className="flex flex-1 flex-col bg-background md:p-3">
      <Sidebar />
      {/* ml clears the fixed rail (left-3 + w-16) plus the same gap again. */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas md:ml-19 md:rounded-3xl md:border md:border-border-soft">
        <AppHeader user={session.user} plan={user.plan} />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-6 md:pb-8">
          <PageTransition key={pathname}>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
