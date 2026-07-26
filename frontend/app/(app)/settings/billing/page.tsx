import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getUsage } from "@/lib/billing";
import { BillingPlans } from "@/components/settings/BillingPlans";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const usage = getUsage(user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <BillingPlans usage={usage} />
    </div>
  );
}
