import type { UserOut } from "@/lib/types";
import { CountUp } from "./CountUp";

interface StatsBarProps {
  user: UserOut;
  totalReports: number;
}

const PLAN_LABELS: Record<string, string> = {
  free: "free",
  starter: "starter",
  growth: "growth",
  business: "business",
};

export function StatsBar({ user, totalReports }: StatsBarProps) {
  const remaining = user.plan === "business" ? null : Math.max(user.reports_limit - user.reports_used, 0);

  const stats = [
    { label: "PLAN_STATUS", value: PLAN_LABELS[user.plan] ?? user.plan },
    { label: "REPORTS_USED", value: <CountUp value={user.reports_used} /> },
    {
      label: "REPORTS_REMAINING",
      value: remaining === null ? "unlimited" : <CountUp value={remaining} />,
    },
    { label: "TOTAL_REPORTS", value: <CountUp value={totalReports} /> },
  ];

  return (
    <div className="flex flex-col gap-6 overflow-x-auto rounded-lg border border-border bg-surface px-8 py-5 sm:flex-row sm:items-center">
      {stats.map((stat, i) => (
        <div key={stat.label} className="flex items-center gap-6 shrink-0">
          <div>
            <p className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground">
              {stat.label}
            </p>
            <p className="font-display text-3xl font-bold text-foreground">{stat.value}</p>
          </div>
          {i < stats.length - 1 && <div className="hidden h-10 w-px bg-border sm:block" />}
        </div>
      ))}
    </div>
  );
}
