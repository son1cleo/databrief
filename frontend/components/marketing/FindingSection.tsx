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
    <section id="finding" className="px-6 py-24">
      <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-surface p-8 sm:p-12 grid gap-12 sm:grid-cols-2 items-center">
        <div>
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Median ROA by Industry
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DATA} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="#1f1f1f" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 10]}
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                  stroke="#1f1f1f"
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: "#ffffff", fontSize: 13, fontWeight: 500 }}
                  width={110}
                  stroke="#1f1f1f"
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{ background: "#111111", border: "1px solid #1f1f1f", fontSize: 12 }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(v) => [`${v}%`, "Median ROA"]}
                />
                <Bar dataKey="value" radius={4}>
                  {DATA.map((d) => (
                    <Cell
                      key={d.label}
                      fill={d.label === "Real Estate" ? "rgba(37,99,235,0.95)" : "rgba(37,99,235,0.22)"}
                      stroke={d.label === "Real Estate" ? "rgba(37,99,235,1)" : "rgba(37,99,235,0.4)"}
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
          <h2 className="mb-5 text-2xl sm:text-[28px] font-bold leading-snug">
            Real estate is the most leveraged sector. But leverage alone doesn&apos;t drive returns.
          </h2>
          <p className="mb-7 text-[15px] leading-relaxed text-text-muted">
            DataBrief found a <span className="text-foreground">negative correlation</span> between
            debt-to-equity ratio and return on assets across 724 real-estate company-years. Higher debt
            does not reliably improve profitability — in fact, the opposite tends to be true. This is
            the kind of finding the engine surfaces automatically, ranked by how surprising it is.
          </p>
          <div className="flex items-center gap-2 font-mono text-xs text-text-muted">
            <span className="size-1.5 rounded-full bg-brand shrink-0" />
            Source: SEC EDGAR · 2015–2022
          </div>
        </div>
      </div>
    </section>
  );
}
