import type { UserOut } from "@/lib/types";
import { CountUp } from "./CountUp";

interface StatsBarProps {
  user: UserOut;
  totalReports: number;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  business: "Business",
};

export function StatsBar({ user, totalReports }: StatsBarProps) {
  const remaining = user.plan === "business" ? null : Math.max(user.reports_limit - user.reports_used, 0);

  const stats: { label: string; value: React.ReactNode }[] = [
    { label: "Plan", value: PLAN_LABELS[user.plan] ?? user.plan },
    { label: "Reports This Period", value: <CountUp value={user.reports_used} /> },
    { label: "Reports Remaining", value: remaining === null ? "Unlimited" : <CountUp value={remaining} /> },
    { label: "Total Reports", value: <CountUp value={totalReports} /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">{stat.label}</p>
          <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
