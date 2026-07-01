import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getApiToken } from "@/lib/apiToken";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { PageTransition } from "@/components/layout/PageTransition";
import type { UserOut } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const pathname = (await headers()).get("x-pathname") ?? "";
  const token = await getApiToken();
  const user = await apiFetch<UserOut>("/api/auth/me", { token });

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
    <div className="flex flex-1">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Navbar user={session.user} plan={user.plan} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <PageTransition key={pathname}>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
