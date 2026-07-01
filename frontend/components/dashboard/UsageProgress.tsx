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
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-2 flex items-center justify-between font-mono text-xs">
        <span className="text-muted-foreground">MONTHLY USAGE</span>
        <span className="text-data-ink">
          {used} / {limit} reports
        </span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      {atLimit && (
        <p className="mt-3 font-mono text-xs text-warning">
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
