import { redirect } from "next/navigation";
import { CreditCard, Settings } from "lucide-react";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getUsage } from "@/lib/billing";
import { BreadcrumbBar } from "@/components/ui/breadcrumb-bar";
import { BillingPlans } from "@/components/settings/BillingPlans";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const usage = getUsage(user);

  return (
    <div className="space-y-5">
      <BreadcrumbBar
        items={[
          { label: "Settings", href: "/settings", icon: Settings },
          { label: "Billing & plan", icon: CreditCard },
        ]}
      />
      <BillingPlans usage={usage} />
    </div>
  );
}
