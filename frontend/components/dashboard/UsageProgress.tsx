import Link from "next/link";
import { Activity, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

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
    <Panel>
      <PanelHeader
        icon={Activity}
        title="Monthly usage"
        action={
          <Badge variant={atLimit ? "warning" : "neutral"}>
            {used} / {limit} reports
          </Badge>
        }
      />
      <PanelBody className="space-y-3">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-inset">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${
              atLimit ? "bg-warning" : "bg-brand"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {atLimit ? (
          <p className="flex items-start gap-2 text-xs text-warning">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>
              You&apos;ve used all your reports.{" "}
              <Link href="/settings/billing" className="font-medium underline">
                Upgrade your plan
              </Link>{" "}
              to keep generating.
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Resets at the start of your next billing period.
          </p>
        )}
      </PanelBody>
    </Panel>
  );
}
