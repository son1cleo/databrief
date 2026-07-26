import Link from "next/link";
import { CreditCard } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentUser, toUserOut } from "@/lib/getCurrentUser";
import { availableProviderNames } from "@/lib/llm/providers";
import { Button } from "@/components/ui/button";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

export default async function SettingsPage() {
  const session = await auth();
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const user = toUserOut(currentUser);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Manage your account, report defaults, and billing.
        </p>
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/settings/billing" />}
          nativeButton={false}
          className="shrink-0"
        >
          <CreditCard />
          Billing &amp; plan
        </Button>
      </div>

      <ProfileSettings
        user={user}
        avatarUrl={session?.user?.image}
        availableProviders={availableProviderNames()}
      />
    </div>
  );
}
