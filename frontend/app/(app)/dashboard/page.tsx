import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getApiToken } from "@/lib/apiToken";
import { apiFetch } from "@/lib/api";
import { listReports } from "@/app/(app)/reports/actions";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { UsageProgress } from "@/components/dashboard/UsageProgress";
import { RecentReports } from "@/components/dashboard/RecentReports";
import type { UserOut } from "@/lib/types";

export default async function DashboardPage() {
  const token = await getApiToken();
  const [user, reports] = await Promise.all([
    apiFetch<UserOut>("/api/auth/me", { token }),
    listReports(6, 0),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Button
          render={<Link href="/upload" />}
          nativeButton={false}
          className="bg-brand hover:bg-brand-hover"
        >
          New Report
        </Button>
      </div>

      <StatsBar user={user} totalReports={reports.length} />
      <UsageProgress used={user.reports_used} limit={user.reports_limit} plan={user.plan} />
      <RecentReports reports={reports} />
    </div>
  );
}
