import { getApiToken } from "@/lib/apiToken";
import { apiFetch } from "@/lib/api";
import { BillingPlans } from "@/components/settings/BillingPlans";
import type { UsageResponse } from "@/lib/types";

export default async function BillingPage() {
  const token = await getApiToken();
  const usage = await apiFetch<UsageResponse>("/api/billing/usage", { token });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <BillingPlans usage={usage} />
    </div>
  );
}
