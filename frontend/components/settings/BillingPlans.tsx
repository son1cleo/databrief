"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { startCheckout, openBillingPortal } from "@/app/(app)/settings/billing/actions";
import type { UsageResponse } from "@/lib/types";

const PLANS = [
  { key: "free", name: "Free", price: "$0", reports: "3 reports", purchasable: false },
  { key: "starter", name: "Starter", price: "$49/mo", reports: "20 reports, $3/extra", purchasable: true },
  { key: "growth", name: "Growth", price: "$149/mo", reports: "100 reports, $2/extra", purchasable: true },
  { key: "business", name: "Business", price: "$399/mo", reports: "Unlimited reports", purchasable: true },
] as const;

interface BillingPlansProps {
  usage: UsageResponse;
}

export function BillingPlans({ usage }: BillingPlansProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = (plan: "starter" | "growth" | "business") => {
    setError(null);
    setPendingPlan(plan);
    startTransition(async () => {
      const result = await startCheckout(plan);
      if (result.success) {
        window.location.href = result.url;
      } else {
        setError(result.message);
        setPendingPlan(null);
      }
    });
  };

  const handlePortal = () => {
    setError(null);
    setPendingPlan("portal");
    startTransition(async () => {
      const result = await openBillingPortal();
      if (result.success) {
        window.location.href = result.url;
      } else {
        setError(result.message);
        setPendingPlan(null);
      }
    });
  };

  const pct = usage.reports_limit > 0 ? Math.min((usage.reports_used / usage.reports_limit) * 100, 100) : 0;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Current usage</p>
          <p className="text-sm text-text-muted">
            {usage.reports_used} / {usage.plan === "business" ? "∞" : usage.reports_limit} reports
          </p>
        </div>
        {usage.plan !== "business" && <Progress value={pct} className="h-2" />}
        {usage.overage_cents != null && (
          <p className="mt-3 text-xs text-text-muted">
            Reports beyond your limit are billed at ${(usage.overage_cents / 100).toFixed(2)} each.
          </p>
        )}
        {usage.plan !== "free" && (
          <Button variant="outline" size="sm" className="mt-4" onClick={handlePortal} disabled={isPending}>
            {pendingPlan === "portal" ? "Opening..." : "Manage billing"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.key === usage.plan;
          return (
            <div
              key={plan.key}
              className={cn(
                "flex flex-col rounded-xl border p-5",
                isCurrent ? "border-brand bg-brand/[0.06]" : "border-border bg-surface"
              )}
            >
              <h3 className="text-sm font-semibold">{plan.name}</h3>
              <p className="my-2 text-2xl font-bold tracking-tight">{plan.price}</p>
              <p className="mb-4 flex items-center gap-1.5 text-xs text-text-muted">
                <Check className="size-3.5 text-brand" />
                {plan.reports}
              </p>
              {isCurrent ? (
                <span className="mt-auto rounded-md border border-brand py-2 text-center text-sm font-medium text-brand">
                  Current plan
                </span>
              ) : plan.purchasable ? (
                <Button
                  className="mt-auto bg-brand hover:bg-brand-hover"
                  onClick={() => handleUpgrade(plan.key as "starter" | "growth" | "business")}
                  disabled={isPending}
                >
                  {pendingPlan === plan.key ? "Redirecting..." : "Upgrade"}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
