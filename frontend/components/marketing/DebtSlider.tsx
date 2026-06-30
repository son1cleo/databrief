"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  BarChart,
  Bar,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  TABS,
  TabKey,
  BAND_LABELS,
  BAND_VALUES,
  BAND_COLORS,
  RANGE_DATA,
  getRangeKey,
  getHighlightedBand,
  linearRegression,
  statsInWindow,
} from "./debt-slider-data";

const TAB_ORDER: { key: TabKey; label: string }[] = [
  { key: "roa", label: "ROA vs D/E" },
  { key: "roe", label: "ROE vs D/E" },
  { key: "npm", label: "Net Margin" },
  { key: "band", label: "Band View" },
];

export function DebtSlider() {
  const [value, setValue] = useState(2.4);
  const [tab, setTab] = useState<TabKey>("roa");

  const rangeKey = getRangeKey(value);
  const cfg = RANGE_DATA[rangeKey];
  const { count, avg } = statsInWindow(value);

  const tabCfg = TABS[tab];
  const trendLine = useMemo(() => {
    if (!tabCfg.data) return null;
    const { m, b } = linearRegression(tabCfg.data);
    return [
      { x: 0, y: b },
      { x: 10, y: m * 10 + b },
    ];
  }, [tabCfg.data]);

  const highlightedBand = getHighlightedBand(value);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 sm:p-7 text-left">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-1">
            Leverage Explorer
          </p>
          <p className="text-sm font-semibold">Drag the slider — watch the story respond</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TAB_ORDER.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-md border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                tab === key
                  ? "border-brand bg-brand/15 text-blue-400"
                  : "border-border bg-background text-text-muted hover:text-foreground hover:border-text-subtle"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
        {/* Left: chart + slider + stat chips */}
        <div>
          <div className="h-[260px] rounded-lg border border-border bg-[#0d0d0d] p-2">
            <ResponsiveContainer width="100%" height="100%">
              {tab === "band" ? (
                <BarChart data={bandChartData(highlightedBand)} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke="rgba(31,31,31,0.8)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "#6b7280", fontSize: 9 }}
                    tickFormatter={(v) => `${v}%`}
                    stroke="#1f1f1f"
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    width={130}
                    stroke="#1f1f1f"
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{ background: "#0d0d0d", border: "1px solid #1f1f1f", fontSize: 12 }}
                    labelStyle={{ color: "#fff" }}
                    formatter={(v) => [`${v}%`, "Median ROA"]}
                  />
                  <Bar dataKey="value" radius={4}>
                    {BAND_VALUES.map((_, i) => (
                      <Cell
                        key={i}
                        fill={BAND_COLORS[i] + (i === highlightedBand ? "0.9)" : "0.18)")}
                        stroke={BAND_COLORS[i] + (i === highlightedBand ? "1)" : "0.35)")}
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <ComposedChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(31,31,31,0.8)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, 10]}
                    tick={{ fill: "#6b7280", fontSize: 9 }}
                    stroke="#1f1f1f"
                    label={{ value: "D/E Ratio", position: "insideBottom", offset: -2, fill: "#6b7280", fontSize: 10 }}
                  />
                  <YAxis
                    type="number"
                    domain={[tabCfg.yMin, tabCfg.yMax]}
                    tick={{ fill: "#6b7280", fontSize: 9 }}
                    tickFormatter={(v) => `${v}%`}
                    stroke="#1f1f1f"
                  />
                  <Tooltip
                    cursor={{ stroke: "#374151" }}
                    contentStyle={{ background: "#0d0d0d", border: "1px solid #1f1f1f", fontSize: 12 }}
                    labelStyle={{ color: "#fff" }}
                    formatter={(v, name) =>
                      name === "y" ? [`${Number(v).toFixed(1)}%`, tabCfg.shortLabel] : [v, name]
                    }
                  />
                  <ReferenceLine
                    x={value}
                    stroke="rgba(96,165,250,0.85)"
                    strokeDasharray="5 4"
                    label={{
                      value: `${value.toFixed(1)}×`,
                      position: "top",
                      fill: "#fff",
                      fontSize: 10,
                    }}
                  />
                  <Scatter
                    data={tabCfg.data ?? []}
                    dataKey="y"
                    fill={`rgba(${tabCfg.color},0.55)`}
                    stroke={`rgba(${tabCfg.color},0.85)`}
                  />
                  {trendLine && (
                    <Line
                      data={trendLine}
                      dataKey="y"
                      stroke="rgba(239,68,68,0.4)"
                      strokeWidth={1.5}
                      strokeDasharray="7 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Slider */}
          <div className="mt-5 rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-text-muted">D/E Ratio</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-semibold tracking-tight">{value.toFixed(1)}</span>
                <span className="text-[11px] text-text-muted">{rangeKey.slice(0, 3).toUpperCase()}</span>
              </div>
            </div>
            <Slider
              min={0}
              max={10}
              step={0.1}
              value={[value]}
              onValueChange={(v) => setValue(Array.isArray(v) ? v[0] : v)}
            />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-text-muted">
              <span>0.0</span>
              <span>2.5</span>
              <span>5.0</span>
              <span>7.5</span>
              <span>10.0</span>
            </div>
          </div>

          {/* Live stat chips */}
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Companies</div>
              <div className="font-mono text-xl font-semibold">{count}</div>
              <div className="text-[10px] text-text-subtle">in ±1.5x window</div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Avg ROA</div>
              <div className="font-mono text-xl font-semibold">{avg !== null ? `${avg}%` : "—"}</div>
              <div className="text-[10px] text-text-subtle">in this window</div>
            </div>
          </div>
        </div>

        {/* Right: analysis panel */}
        <div className="rounded-lg border border-border bg-[#0d0d0d] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: cfg.color, boxShadow: `0 0 0 3px ${cfg.glow}` }}
              />
              <span className="font-mono text-[11px] font-semibold tracking-wide" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
            <span className="rounded border border-border bg-surface px-2.5 py-0.5 text-[11px] text-text-muted">
              {cfg.riskLabel}
            </span>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wide text-text-muted">Risk Score</span>
              <span className="font-mono text-xs font-semibold">{cfg.riskPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${cfg.riskPct}%`, background: cfg.color }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[9px]">
              <span className="text-success">LOW</span>
              <span className="text-warning">MED</span>
              <span className="text-error">HIGH</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-2.5 mb-4">
            <span className="text-xs text-text-muted">Median ROA at this band</span>
            <span className="font-mono text-base font-semibold">{cfg.medianRoa}</span>
          </div>

          <div className="border-t border-surface-2 mb-4" />

          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-3">
            Market Analysis
          </p>
          <div className="mb-4">
            {cfg.bullets.map((text, i) => (
              <div
                key={i}
                className="flex gap-2.5 items-start py-2 text-[13px] leading-relaxed text-zinc-300 border-b border-surface-2 last:border-b-0"
              >
                <span className="mt-1.5 size-1 rounded-full shrink-0" style={{ background: cfg.color }} />
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div
            className="rounded-r-md border-l-2 px-3.5 py-3 mb-3.5 transition-colors"
            style={{ borderLeftColor: cfg.color, background: "#111827" }}
          >
            <p className="text-xs italic leading-relaxed text-zinc-400">&quot;{cfg.summary}&quot;</p>
          </div>

          <div className="flex gap-2 items-start">
            <span className="text-warning text-[11px] mt-px shrink-0">⚠</span>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Key Risk </span>
              <span className="text-xs leading-relaxed text-text-muted">{cfg.keyRisk}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function bandChartData(highlighted: number) {
  return BAND_LABELS.map((label, i) => ({ label, value: BAND_VALUES[i], highlighted: i === highlighted }));
}
