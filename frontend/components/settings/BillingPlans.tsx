"use client";

import { useState, useTransition } from "react";
import { Check, CreditCard, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { SettingsSection } from "@/components/ui/settings-section";
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

  const unlimited = usage.plan === "business";
  const pct = usage.reports_limit > 0 ? Math.min((usage.reports_used / usage.reports_limit) * 100, 100) : 0;

  return (
    <div className="space-y-8">
      <SettingsSection title="Usage" description="Where you are in the current billing period.">
        <Panel>
          <PanelHeader
            icon={Gauge}
            title="Current usage"
            action={
              <Badge variant="neutral">
                {usage.reports_used} / {unlimited ? "∞" : usage.reports_limit} reports
              </Badge>
            }
          />
          <PanelBody className="space-y-3">
            {!unlimited && (
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-inset">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {usage.overage_cents != null && (
              <p className="text-xs text-muted-foreground">
                Reports beyond your limit are billed at ${(usage.overage_cents / 100).toFixed(2)} each.
              </p>
            )}
          </PanelBody>
          {usage.plan !== "free" && (
            <PanelFooter>
              <Button variant="outline" size="sm" onClick={handlePortal} disabled={isPending}>
                <CreditCard />
                {pendingPlan === "portal" ? "Opening…" : "Manage billing"}
              </Button>
            </PanelFooter>
          )}
        </Panel>
      </SettingsSection>

      {error && <p className="text-sm text-error">{error}</p>}

      <SettingsSection title="Plans" description="Upgrade or change your plan at any time.">
        <div className="grid gap-3 sm:grid-cols-2">
          {PLANS.map((plan) => {
            const isCurrent = plan.key === usage.plan;
            return (
              <Panel
                key={plan.key}
                className={cn("flex flex-col p-5", isCurrent && "border-brand/40 bg-brand/4")}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{plan.name}</h3>
                  {isCurrent && <Badge variant="brand">Current</Badge>}
                </div>
                <p className="my-2 font-display text-2xl font-bold tracking-tight text-foreground">
                  {plan.price}
                </p>
                <p className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="size-3.5 text-brand" />
                  {plan.reports}
                </p>
                {isCurrent ? (
                  <Button variant="outline" disabled className="mt-auto w-full">
                    Current plan
                  </Button>
                ) : plan.purchasable ? (
                  <Button
                    className="mt-auto w-full"
                    onClick={() => handleUpgrade(plan.key as "starter" | "growth" | "business")}
                    disabled={isPending}
                  >
                    {pendingPlan === plan.key ? "Redirecting…" : "Upgrade"}
                  </Button>
                ) : null}
              </Panel>
            );
          })}
        </div>
      </SettingsSection>
    </div>
  );
}
