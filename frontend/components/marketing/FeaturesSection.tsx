const FEATURES = [
  {
    tag: "01 — INPUT",
    title: "Any format.",
    body: "CSV, Excel, XML, PDF, Word, images, scanned documents. The engine detects structure automatically.",
  },
  {
    tag: "02 — ENGINE",
    title: "Finds the surprise.",
    body: "Statistical analysis ranks findings by how unexpected they are — not just how large. The outlier that changes everything gets found.",
  },
  {
    tag: "03 — OUTPUT",
    title: "Writes the story.",
    body: "A curiosity-driven narrative delivered as PDF, Word document, or a branded PowerPoint in five themes.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="border-t border-border py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14">
          <p className="mb-3 font-mono text-xs text-data-ink">HOW IT WORKS</p>
          <h2 className="font-display text-4xl font-bold tracking-tight text-foreground">
            Three steps. One story.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.tag}
              className="rounded-lg border border-border bg-surface p-6 transition-colors hover:border-border/80 hover:bg-surface-2"
            >
              <p className="mb-4 font-mono text-xs text-data-ink">{f.tag}</p>
              <h3 className="mb-3 font-display text-xl font-bold text-foreground">{f.title}</h3>
              <p className="font-sans text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
