import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentUser, toUserOut } from "@/lib/getCurrentUser";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

export default async function SettingsPage() {
  const session = await auth();
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const user = toUserOut(currentUser);

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
