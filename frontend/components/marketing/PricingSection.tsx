import Link from "next/link";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    tag: "STARTER",
    price: "$49",
    per: "/mo",
    reports: "20 reports/month",
    overage: "+ $3 per extra report",
    features: ["PDF + Word output", "All file formats", "1 user"],
    cta: "Get started",
    highlight: false,
  },
  {
    tag: "GROWTH",
    price: "$149",
    per: "/mo",
    reports: "100 reports/month",
    overage: "+ $2 per extra report",
    features: ["PDF + Word + PPTX", "5 themes", "5 users", "Brand kit"],
    cta: "Get started",
    highlight: true,
  },
  {
    tag: "BUSINESS",
    price: "$399",
    per: "/mo",
    reports: "Unlimited reports",
    overage: "No overage charges",
    features: ["All outputs", "20 users", "API access", "Priority queue"],
    cta: "Get started",
    highlight: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14">
          <p className="mb-3 font-mono text-xs text-data-ink">PRICING</p>
          <h2 className="font-display text-4xl font-bold tracking-tight text-foreground">
            Pay for stories, not seats.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.tag}
              className={cn(
                "flex flex-col rounded-lg border p-6",
                plan.highlight
                  ? "glow-brand border-brand bg-brand/5"
                  : "border-border bg-surface"
              )}
            >
              <p className="mb-4 font-mono text-xs tracking-wide text-data-ink">{plan.tag}</p>
              <div className="mb-1 flex items-baseline gap-1">
                <span className="font-display text-5xl font-extrabold tracking-tight text-foreground">
                  {plan.price}
                </span>
                <span className="font-mono text-sm text-muted-foreground">{plan.per}</span>
              </div>
              <p className="mb-1 font-mono text-xs text-muted-foreground">{plan.reports}</p>
              <p className="mb-6 font-mono text-xs text-muted-foreground">{plan.overage}</p>

              <ul className="mb-8 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 font-mono text-xs text-foreground/80">
                    <span className="size-1 shrink-0 rounded-full bg-data-ink" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className={cn(
                  "rounded px-4 py-2.5 text-center font-mono text-sm transition-all",
                  plan.highlight
                    ? "bg-brand text-white hover:bg-brand-hover"
                    : "border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
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
