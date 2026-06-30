const STATS = [
  { value: "885+", label: "Companies Analyzed" },
  { value: "10", label: "Industries Covered" },
  { value: "2009–2023", label: "Data Range" },
];

export function StatsBar() {
  return (
    <section className="border-y border-border px-6 py-14">
      <div className="mx-auto grid max-w-2xl grid-cols-3 text-center">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className={i < STATS.length - 1 ? "border-r border-border px-4 sm:px-8" : "px-4 sm:px-8"}
          >
            <div className="mb-1.5 text-[28px] sm:text-4xl font-extrabold tracking-tight">{stat.value}</div>
            <div className="text-xs sm:text-sm text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
