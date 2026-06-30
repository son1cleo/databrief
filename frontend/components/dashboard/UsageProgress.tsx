import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface UsageProgressProps {
  used: number;
  limit: number;
  plan: string;
}

export function UsageProgress({ used, limit, plan }: UsageProgressProps) {
  if (plan === "business") return null;

  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
  const atLimit = used >= limit;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Reports used this period</p>
        <p className="text-sm text-text-muted">
          {used} / {limit}
        </p>
      </div>
      <Progress value={pct} className="h-2" />
      {atLimit && (
        <p className="mt-3 text-xs text-warning">
          You&apos;ve used all your reports.{" "}
          <Link href="/settings/billing" className="underline">
            Upgrade your plan
          </Link>{" "}
          to keep generating.
        </p>
      )}
    </div>
  );
}
