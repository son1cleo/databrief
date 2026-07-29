"use client";

import { useId, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ComposedChart,
  Area,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type {
  ChartData,
  BarChartData,
  LineChartData,
  ScatterChartData,
  HistogramChartData,
  DoseResponseChartData,
  BoxChartData,
} from "@/lib/chartData";

// Same visual height budget the old PNGs used, tuned per chart shape --
// Recharts' ResponsiveContainer requires an explicit parent height.
const CHART_HEIGHT: Record<ChartData["kind"], number> = {
  bar: 320,
  line: 360,
  scatter: 400,
  histogram: 340,
  doseResponse: 360,
  box: 340,
};

const gridColor = "var(--border-soft)";
const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 };
const tooltipContentStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-soft)",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
};
const tooltipLabelStyle: React.CSSProperties = { color: "var(--foreground)", marginBottom: 2 };

function fmt(v: number, decimals = 2): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function BarChartView({ data }: { data: BarChartData }) {
  const chartData = data.entries.map((e, i) => ({ ...e, isWinner: i === 0 }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid stroke={gridColor} horizontal={false} />
        <XAxis type="number" tick={axisTick} stroke={gridColor} />
        <YAxis type="category" dataKey="label" tick={axisTick} width={140} stroke={gridColor} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(v) => [fmt(Number(v)), data.xlabel || "Value"]}
        />
        <Bar dataKey="value" radius={4}>
          {chartData.map((d, i) => (
            <Cell key={i} fill="var(--brand-hover)" fillOpacity={d.isWinner ? 1 : 0.45} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({ data }: { data: LineChartData }) {
  const gradientId = useId();
  const chartData = data.points.map((p, i) => ({
    x: p.x,
    y: p.y,
    trendY: data.trend ? data.trend.slope * i + data.trend.intercept : null,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--brand-hover)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--brand-hover)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={gridColor} vertical={false} />
        <XAxis dataKey="x" tick={axisTick} stroke={gridColor} minTickGap={28} />
        <YAxis tick={axisTick} stroke={gridColor} width={56} />
        <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} formatter={(v) => fmt(Number(v))} />
        <Area
          type="monotone"
          dataKey="y"
          stroke="var(--brand-hover)"
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={{ r: 3, fill: "var(--brand-hover)", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          name={data.ylabel || "Value"}
          isAnimationActive={false}
        />
        {data.trend && (
          <Line
            type="linear"
            dataKey="trendY"
            stroke="var(--error)"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            dot={false}
            name="Trend"
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ScatterChartView({ data }: { data: ScatterChartData }) {
  const trendLine =
    data.trend && data.points.length > 0
      ? (() => {
          const xs = data.points.map((p) => p.x);
          const xLo = Math.min(...xs);
          const xHi = Math.max(...xs);
          const { slope, intercept } = data.trend;
          return [
            { x: xLo, y: slope * xLo + intercept },
            { x: xHi, y: slope * xHi + intercept },
          ];
        })()
      : null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid stroke={gridColor} />
        <XAxis type="number" dataKey="x" name={data.xlabel} tick={axisTick} stroke={gridColor} />
        <YAxis type="number" dataKey="y" name={data.ylabel} tick={axisTick} stroke={gridColor} width={56} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: gridColor }}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(v) => fmt(Number(v))}
        />
        <Scatter data={data.points} dataKey="y" fill="var(--brand-hover)" fillOpacity={0.5} isAnimationActive={false} />
        {trendLine && (
          <Line
            data={trendLine}
            dataKey="y"
            stroke="var(--error)"
            strokeDasharray="7 5"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function HistogramChartView({ data }: { data: HistogramChartData }) {
  const chartData = data.bins.map((b) => ({ mid: (b.x0 + b.x1) / 2, count: b.count }));
  const domain: [number, number] = [data.bins[0]?.x0 ?? 0, data.bins[data.bins.length - 1]?.x1 ?? 1];
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3" style={{ background: "var(--brand-hover)" }} />
          Mean: {fmt(data.mean)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 border-t-[1.5px]" style={{ borderColor: "var(--error)", borderStyle: "dashed" }} />
          +1 SD: {fmt(data.mean + data.stdev)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 border-t-[1.5px]" style={{ borderColor: "var(--error)", borderStyle: "dashed" }} />
          -1 SD: {fmt(data.mean - data.stdev)}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis type="number" dataKey="mid" domain={domain} tick={axisTick} stroke={gridColor} tickFormatter={(v: number) => fmt(v, 1)} />
            <YAxis tick={axisTick} stroke={gridColor} width={36} allowDecimals={false} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              formatter={(v) => [Number(v), "Count"]}
              labelFormatter={(v) => fmt(Number(v), 2)}
            />
            <Bar dataKey="count" fill="var(--brand)" fillOpacity={0.55} radius={1} isAnimationActive={false} />
            <ReferenceLine x={data.mean} stroke="var(--brand-hover)" strokeWidth={2} />
            <ReferenceLine x={data.mean + data.stdev} stroke="var(--error)" strokeDasharray="6 4" />
            <ReferenceLine x={data.mean - data.stdev} stroke="var(--error)" strokeDasharray="6 4" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DoseResponseChartView({ data }: { data: DoseResponseChartData }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.entries} margin={{ left: 8, right: 16, top: 24, bottom: 4 }}>
        <CartesianGrid stroke={gridColor} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} stroke={gridColor} />
        <YAxis tick={axisTick} stroke={gridColor} width={56} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(v) => {
            const n = Number(v);
            return [`${n >= 0 ? "+" : ""}${fmt(n, 3)}`, data.title];
          }}
        />
        <ReferenceLine y={0} stroke={gridColor} />
        <Bar dataKey="value" radius={3} isAnimationActive={false}>
          {data.entries.map((e, i) => (
            <Cell key={i} fill="var(--brand-hover)" fillOpacity={e.value === data.peakValue ? 1 : 0.45} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Recharts has no native box-plot primitive, and there's only ever one box
// per chart here (a single finding's five-number summary, not a faceted
// multi-group plot) -- not a case where Recharts' declarative multi-series
// model buys anything. Hand-rolled SVG instead, ported from the equivalent
// static boxChart() geometry in lib/charts.ts, with hover state driving a
// small tooltip so it's still fully interactive.
function BoxPlotView({ data }: { data: BoxChartData }) {
  const width = 240;
  const height = 300;
  const plotTop = 20;
  const plotBottom = height - 32;
  const centerX = width / 2;
  const boxW = 84;

  const allVals = [data.whiskerLo, data.whiskerHi, ...data.outliers, ...(data.mostExtreme !== null ? [data.mostExtreme] : [])];
  const dataMin = Math.min(...allVals);
  const dataMax = Math.max(...allVals);
  const pad = (dataMax - dataMin || 1) * 0.12;
  const lo = dataMin - pad;
  const hi = dataMax + pad;
  const y = (v: number) => plotBottom - ((v - lo) / (hi - lo)) * (plotBottom - plotTop);

  const [hover, setHover] = useState<{ label: string; value: number; cx: number; cy: number } | null>(null);
  const showTip = (label: string, value: number, cx: number, cy: number) => setHover({ label, value, cx, cy });
  const hideTip = () => setHover(null);

  return (
    <div className="relative flex h-full items-center justify-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full max-h-full w-auto max-w-full">
        {[0, 1, 2, 3, 4].map((g) => {
          const val = lo + ((hi - lo) * g) / 4;
          const gy = y(val);
          return (
            <g key={g}>
              <line x1={28} y1={gy} x2={width - 12} y2={gy} stroke={gridColor} strokeDasharray="3 3" />
              <text x={24} y={gy + 3} fontSize={9} fill="var(--muted-foreground)" textAnchor="end">
                {fmt(val, 1)}
              </text>
            </g>
          );
        })}

        <line x1={centerX} y1={y(data.whiskerHi)} x2={centerX} y2={y(data.q3)} stroke="var(--brand-hover)" strokeWidth={1.5} />
        <line x1={centerX} y1={y(data.q1)} x2={centerX} y2={y(data.whiskerLo)} stroke="var(--brand-hover)" strokeWidth={1.5} />
        <line
          x1={centerX - 16}
          y1={y(data.whiskerHi)}
          x2={centerX + 16}
          y2={y(data.whiskerHi)}
          stroke="var(--brand-hover)"
          strokeWidth={1.5}
          onMouseEnter={() => showTip("Upper whisker", data.whiskerHi, centerX, y(data.whiskerHi))}
          onMouseLeave={hideTip}
        />
        <line
          x1={centerX - 16}
          y1={y(data.whiskerLo)}
          x2={centerX + 16}
          y2={y(data.whiskerLo)}
          stroke="var(--brand-hover)"
          strokeWidth={1.5}
          onMouseEnter={() => showTip("Lower whisker", data.whiskerLo, centerX, y(data.whiskerLo))}
          onMouseLeave={hideTip}
        />

        <rect
          x={centerX - boxW / 2}
          y={y(data.q3)}
          width={boxW}
          height={Math.max(y(data.q1) - y(data.q3), 1)}
          rx={3}
          fill="var(--brand)"
          fillOpacity={0.35}
          stroke="var(--brand-hover)"
          strokeWidth={1}
          onMouseEnter={() => showTip("Q1–Q3", data.q3, centerX, (y(data.q1) + y(data.q3)) / 2)}
          onMouseLeave={hideTip}
        />

        <line
          x1={centerX - boxW / 2}
          y1={y(data.median)}
          x2={centerX + boxW / 2}
          y2={y(data.median)}
          stroke="var(--brand-hover)"
          strokeWidth={2}
          onMouseEnter={() => showTip("Median", data.median, centerX, y(data.median))}
          onMouseLeave={hideTip}
        />

        {data.outliers.map((v, i) => (
          <circle
            key={i}
            cx={centerX}
            cy={y(v)}
            r={3.5}
            fill="var(--error)"
            fillOpacity={0.6}
            onMouseEnter={() => showTip("Outlier", v, centerX, y(v))}
            onMouseLeave={hideTip}
          />
        ))}

        {data.mostExtreme !== null && (
          <>
            <line
              x1={28}
              y1={y(data.mostExtreme)}
              x2={width - 12}
              y2={y(data.mostExtreme)}
              stroke="var(--error)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <circle
              cx={centerX}
              cy={y(data.mostExtreme)}
              r={4}
              fill="var(--error)"
              onMouseEnter={() => showTip("Most extreme", data.mostExtreme as number, centerX, y(data.mostExtreme as number))}
              onMouseLeave={hideTip}
            />
          </>
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 font-mono text-[11px] whitespace-nowrap shadow-md"
          style={{
            left: `${(hover.cx / width) * 100}%`,
            top: `${(hover.cy / height) * 100}%`,
            marginTop: -8,
            background: "var(--surface)",
            borderColor: "var(--border-soft)",
            color: "var(--foreground)",
          }}
        >
          {hover.label}: {fmt(hover.value)}
        </div>
      )}
    </div>
  );
}

export function InteractiveChart({ data }: { data: ChartData }) {
  return (
    <div className="w-full">
      <p className="mb-3 text-center font-display text-sm font-semibold text-foreground">{data.title}</p>
      <div style={{ height: CHART_HEIGHT[data.kind] }}>
        {data.kind === "bar" && <BarChartView data={data} />}
        {data.kind === "line" && <LineChartView data={data} />}
        {data.kind === "scatter" && <ScatterChartView data={data} />}
        {data.kind === "histogram" && <HistogramChartView data={data} />}
        {data.kind === "doseResponse" && <DoseResponseChartView data={data} />}
        {data.kind === "box" && <BoxPlotView data={data} />}
      </div>
    </div>
  );
}
