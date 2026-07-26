import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser, toUserOut } from "@/lib/getCurrentUser";
import { listReports } from "@/app/(app)/reports/actions";
import { Button } from "@/components/ui/button";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { UsageProgress } from "@/components/dashboard/UsageProgress";
import { RecentReports } from "@/components/dashboard/RecentReports";

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const user = toUserOut(currentUser);
  const reports = await listReports(6, 0);
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Welcome back{firstName ? `, ${firstName}` : ""}. Here&apos;s where things stand.
        </p>
        <Button render={<Link href="/upload" />} nativeButton={false} className="shrink-0">
          <Plus />
          New report
        </Button>
      </div>

      <StatsBar user={user} totalReports={reports.length} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <UsageProgress used={user.reports_used} limit={user.reports_limit} plan={user.plan} />
        <RecentReports reports={reports} />
      </div>
    </div>
  );
}
