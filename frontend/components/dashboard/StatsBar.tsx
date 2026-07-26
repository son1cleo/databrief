import { BadgeCheck, FileText, Files, Gauge, type LucideIcon } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { IconBadge } from "@/components/ui/icon-badge";
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

function StatCard({
  icon,
  color,
  label,
  value,
}: {
  icon: LucideIcon;
  color: "brand" | "success" | "warning" | "muted";
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Panel className="p-4">
      <IconBadge icon={icon} color={color} size="md" />
      <p className="mt-3.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground">{value}</p>
    </Panel>
  );
}

export function StatsBar({ user, totalReports }: StatsBarProps) {
  const unlimited = user.plan === "business";
  const remaining = unlimited ? null : Math.max(user.reports_limit - user.reports_used, 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={BadgeCheck}
        color="brand"
        label="Plan"
        value={PLAN_LABELS[user.plan] ?? user.plan}
      />
      <StatCard
        icon={FileText}
        color="muted"
        label="Reports used"
        value={<CountUp value={user.reports_used} />}
      />
      <StatCard
        icon={Gauge}
        color={remaining === 0 ? "warning" : "success"}
        label="Remaining"
        value={remaining === null ? "Unlimited" : <CountUp value={remaining} />}
      />
      <StatCard
        icon={Files}
        color="muted"
        label="Total reports"
        value={<CountUp value={totalReports} />}
      />
    </div>
  );
}
