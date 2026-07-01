import Link from "next/link";
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
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground md:text-2xl">Dashboard</h1>
        <Link
          href="/upload"
          className="shrink-0 rounded bg-brand px-3 py-1.5 font-mono text-xs text-white hover:bg-brand-hover"
        >
          New Report →
        </Link>
      </div>

      <StatsBar user={user} totalReports={reports.length} />
      <UsageProgress used={user.reports_used} limit={user.reports_limit} plan={user.plan} />
      <RecentReports reports={reports} />
    </div>
  );
}
