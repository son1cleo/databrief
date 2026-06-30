import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    reports: "3 reports",
    overage: null,
    cta: "Start free",
    featured: false,
  },
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    reports: "20 reports / month",
    overage: "$3 per extra report",
    cta: "Start with Starter",
    featured: false,
  },
  {
    name: "Growth",
    price: "$149",
    period: "/mo",
    reports: "100 reports / month",
    overage: "$2 per extra report",
    cta: "Start with Growth",
    featured: true,
  },
  {
    name: "Business",
    price: "$399",
    period: "/mo",
    reports: "Unlimited reports",
    overage: null,
    cta: "Start with Business",
    featured: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Pricing</p>
          <h2 className="mx-auto max-w-lg text-[clamp(28px,4vw,40px)] font-bold leading-tight">
            Pay for stories, not seats.
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "flex flex-col rounded-xl border p-6",
                plan.featured ? "border-brand bg-brand/[0.06] glow-accent" : "border-border bg-surface"
              )}
            >
              {plan.featured && (
                <span className="mb-3 w-fit rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  MOST POPULAR
                </span>
              )}
              <h3 className="text-sm font-semibold text-text-muted">{plan.name}</h3>
              <div className="mt-2 mb-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight">{plan.price}</span>
                {plan.period && <span className="text-sm text-text-muted">{plan.period}</span>}
              </div>
              <ul className="mb-6 flex-1 space-y-2.5 text-[13px] text-text-muted">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 shrink-0 text-brand" />
                  {plan.reports}
                </li>
                {plan.overage && (
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-brand" />
                    {plan.overage}
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 shrink-0 text-brand" />
                  PDF, Word &amp; PPTX export
                </li>
              </ul>
              <Link
                href="/login"
                className={cn(
                  "rounded-md px-4 py-2.5 text-center text-sm font-medium transition-colors",
                  plan.featured
                    ? "bg-brand text-white hover:bg-brand-hover"
                    : "border border-border text-foreground hover:border-text-subtle"
                )}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
