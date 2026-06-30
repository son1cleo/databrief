import { FileStack, Sparkles, FileOutput } from "lucide-react";

const FEATURES = [
  {
    icon: FileStack,
    title: "Any Format In",
    description:
      "CSV, Excel, XML, PDF, scanned images, raw text — DataBrief detects structure automatically and parses it without a schema.",
  },
  {
    icon: Sparkles,
    title: "Curiosity-Driven Insights",
    description:
      "Trends, outliers, correlations, and distribution shifts are ranked by surprise factor and business impact, not just statistical significance.",
  },
  {
    icon: FileOutput,
    title: "Three Export Formats",
    description:
      "Every story ships as a polished PDF, an editable Word document, and a branded PowerPoint deck in one of five visual themes.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="border-t border-border px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Platform</p>
        <h2 className="mb-16 max-w-md text-[clamp(28px,4vw,40px)] font-bold leading-tight">
          Built for data storytelling, not dashboards.
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-surface p-7 transition-colors hover:border-brand/35"
            >
              <div className="mb-5 flex size-10 items-center justify-center rounded-lg bg-brand/10">
                <Icon className="size-5 text-brand" />
              </div>
              <h3 className="mb-2.5 text-[15px] font-semibold">{title}</h3>
              <p className="text-[13px] leading-relaxed text-text-muted">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
