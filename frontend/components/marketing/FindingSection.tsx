"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";

const DATA = [
  { label: "IT", value: 8.4 },
  { label: "Manufacturing", value: 4.3 },
  { label: "Food", value: 3.7 },
  { label: "Real Estate", value: 2.1 },
  { label: "Banking", value: 1.2 },
];

export function FindingSection() {
  return (
    <section id="finding" className="border-t border-border py-24">
      <div className="mx-auto grid max-w-7xl gap-12 rounded-lg border border-border bg-surface p-8 sm:grid-cols-2 sm:p-12">
        <div>
          <p className="mb-6 font-mono text-xs text-data-ink">MEDIAN ROA BY INDUSTRY</p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DATA} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="#1e2739" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 10]}
                  tick={{ fill: "#8b949e", fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                  stroke="#1e2739"
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: "#e6edf3", fontSize: 13, fontWeight: 500 }}
                  width={110}
                  stroke="#1e2739"
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{ background: "#0a0e1a", border: "1px solid #1e2739", fontSize: 12 }}
                  labelStyle={{ color: "#e6edf3" }}
                  formatter={(v) => [`${v}%`, "Median ROA"]}
                />
                <Bar dataKey="value" radius={4}>
                  {DATA.map((d) => (
                    <Cell
                      key={d.label}
                      fill={d.label === "Real Estate" ? "rgba(59,130,246,0.95)" : "rgba(59,130,246,0.22)"}
                      stroke={d.label === "Real Estate" ? "rgba(59,130,246,1)" : "rgba(59,130,246,0.4)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="mb-6 inline-block rounded border border-border bg-background px-3 py-1.5 font-mono text-[11px] text-brand">
            FINDING_01
          </div>
          <h2 className="mb-5 font-display text-2xl leading-snug font-bold sm:text-[28px]">
            Real estate is the most leveraged sector. But leverage alone doesn&apos;t drive returns.
          </h2>
          <p className="mb-7 text-[15px] leading-relaxed text-muted-foreground">
            DataBrief found a <span className="text-foreground">negative correlation</span> between
            debt-to-equity ratio and return on assets across 724 real-estate company-years. Higher debt
            does not reliably improve profitability — in fact, the opposite tends to be true. This is
            the kind of finding the engine surfaces automatically, ranked by how surprising it is.
          </p>
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-brand" />
            Source: SEC EDGAR · 2015–2022
          </div>
        </div>
      </div>
    </section>
  );
}
