import Link from "next/link";
import { auth } from "@/lib/auth";
import { getApiToken } from "@/lib/apiToken";
import { apiFetch } from "@/lib/api";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import type { UserOut } from "@/lib/types";

export default async function SettingsPage() {
  const session = await auth();
  const token = await getApiToken();
  const user = await apiFetch<UserOut>("/api/auth/me", { token });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <Link href="/settings/billing" className="text-sm text-brand hover:underline">
          Billing &amp; plan
        </Link>
      </div>
      <ProfileSettings user={user} avatarUrl={session?.user?.image} />
    </div>
  );
}
