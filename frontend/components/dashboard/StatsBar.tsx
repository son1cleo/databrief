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
    <div className="grid grid-cols-2 gap-px rounded-lg border border-border bg-border sm:flex sm:gap-0 sm:bg-surface overflow-hidden">
      {stats.map((stat, i) => (
        <div key={stat.label} className="flex items-center gap-4 bg-surface px-5 py-4 sm:flex-1 sm:gap-6 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <p className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground truncate">
              {stat.label}
            </p>
            <p className="font-display text-2xl font-bold text-foreground sm:text-3xl">{stat.value}</p>
          </div>
          {i < stats.length - 1 && <div className="hidden h-10 w-px bg-border sm:block ml-auto shrink-0" />}
        </div>
      ))}
    </div>
  );
}
