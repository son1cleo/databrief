import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { mean, sampleStd, quantile, median, linearRegression, type Finding, type Row } from "@/lib/analysis";

const ACCENT = "#2563eb";
const ACCENT_LIGHT = "#93c5fd";
const DANGER = "#ef4444";
const TEXT = "#1a1a1a";
const GRID = "#e5e7eb";
const BG = "#ffffff";
const MUTED = "#6b7280";
const FONT = "sans-serif";

// resvg needs a font on disk to resolve `font-family: sans-serif` -- its
// default (loadSystemFonts: true) works locally but isn't guaranteed on
// Vercel's serverless runtime, where "no fonts installed" silently renders
// blank text instead of erroring. Next.js already ships Geist (its own
// open-source font) for next/og's server-side image rendering -- the exact
// same problem, in the exact same runtime -- so it's reused here rather
// than bundling a separate font file. Falls back to resvg's default
// system-font search if this path ever moves (e.g. a Next.js upgrade).
const BUNDLED_FONT_PATH = join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf");
const BUNDLED_FONT_AVAILABLE = existsSync(BUNDLED_FONT_PATH);

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// SVG text doesn't auto-wrap or auto-shrink -- a long title (e.g. a
// correlation chart's "<col A> vs <col B> (r=0.67)") can otherwise run past
// the chart's right edge and overlap the plot boundary. Ellipsis-truncates
// using a conservative average-character-width estimate for a bold
// sans-serif face, rather than true text measurement (unavailable without a
// DOM), so it stays comfortably within the given width.
function fitTitle(title: string, availableWidth: number, fontSize = 18): string {
  const avgCharWidth = fontSize * 0.58;
  const maxChars = Math.max(1, Math.floor(availableWidth / avgCharWidth));
  return title.length > maxChars ? `${title.slice(0, maxChars - 1).trimEnd()}…` : title;
}

// Rasterizes an SVG string to a base64 PNG via resvg's Rust-backed engine --
// same return contract as the old canvas-based canvasToBase64() (raw base64,
// no data: prefix). 2x scale for crisp embedding in exported documents.
function svgToPngBase64(svg: string, width: number): string {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width * 2 },
    font: BUNDLED_FONT_AVAILABLE
      ? { fontFiles: [BUNDLED_FONT_PATH], sansSerifFamily: "Geist", defaultFontFamily: "Geist" }
      : undefined,
  });
  return resvg.render().asPng().toString("base64");
}

function wrapSvg(content: string, width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;
}

interface TextOpts {
  size?: number;
  weight?: string;
  color?: string;
  anchor?: "start" | "middle" | "end";
  rotate?: number;
}

function svgText(x: number, y: number, s: string, opts: TextOpts = {}): string {
  const { size = 11, weight = "normal", color = TEXT, anchor = "start", rotate } = opts;
  const transform = rotate !== undefined ? ` transform="rotate(${rotate} ${x} ${y})"` : "";
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}"${transform}>${esc(s)}</text>`;
}

function svgLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: { color?: string; width?: number; dash?: string; opacity?: number } = {}
): string {
  const { color = TEXT, width = 1, dash, opacity } = opts;
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  const opAttr = opacity !== undefined ? ` stroke-opacity="${opacity}"` : "";
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"${dashAttr}${opAttr} />`;
}

function svgRect(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: string; rx?: number } = {}
): string {
  const { fill = "none", rx = 0 } = opts;
  return `<rect x="${x}" y="${y}" width="${Math.max(w, 0)}" height="${Math.max(h, 0)}" rx="${rx}" fill="${fill}" />`;
}

function svgCircle(cx: number, cy: number, r: number, opts: { fill?: string; opacity?: number } = {}): string {
  const { fill = ACCENT, opacity } = opts;
  const opAttr = opacity !== undefined ? ` fill-opacity="${opacity}"` : "";
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${opAttr} />`;
}

function svgPolyline(
  points: [number, number][],
  opts: { color?: string; width?: number; dash?: string; opacity?: number } = {}
): string {
  const { color = ACCENT, width = 2, dash, opacity } = opts;
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  const opAttr = opacity !== undefined ? ` stroke-opacity="${opacity}"` : "";
  const pts = points.map(([x, y]) => `${x},${y}`).join(" ");
  return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${width}"${dashAttr}${opAttr} />`;
}

// Path data for the filled area under a data line down to a baseline y --
// paired with a gradient fill (url(#...)) at the call site for the
// "clean and beautiful" gradient-area look.
function areaPathD(points: [number, number][], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const linePts = points.map(([x, y]) => `${x},${y}`).join(" L ");
  return `M ${first[0]},${baselineY} L ${linePts} L ${last[0]},${baselineY} Z`;
}

// ---------------------------------------------------------------------------
// Horizontal bar chart — ranking/leaderboard findings. `labels`/`values` are
// assumed already sorted descending (winner first); the winner is drawn in
// the darker accent color, the rest in the lighter one.
// ---------------------------------------------------------------------------
export function horizontalBar(labels: string[], values: number[], title: string, xlabel = "", maxItems = 10): string {
  labels = labels.slice(0, maxItems);
  values = values.slice(0, maxItems);
  const n = labels.length;
  const rowH = 44;
  const width = 820;
  const chartTop = 70;
  const chartBottom = chartTop + n * rowH + 10;
  const height = chartBottom + (xlabel ? 40 : 20);
  const labelW = 190;
  const plotLeft = labelW + 16;
  const plotRight = width - 70;
  const maxVal = Math.max(...values, 1);

  let s = svgRect(0, 0, width, height, { fill: BG });
  s += svgText(24, 34, fitTitle(title, width - 48), { size: 18, weight: "bold" });

  const gridSteps = 5;
  for (let g = 0; g <= gridSteps; g++) {
    const gx = plotLeft + ((plotRight - plotLeft) * g) / gridSteps;
    s += svgLine(gx, chartTop - 10, gx, chartBottom, { color: GRID, dash: "3,3" });
    s += svgText(gx, chartBottom + 16, fmtNum((maxVal * g) / gridSteps), { size: 11, color: MUTED, anchor: "middle" });
  }

  labels.forEach((label, i) => {
    const y = chartTop + i * rowH;
    const barW = (values[i] / (maxVal * 1.18)) * (plotRight - plotLeft);
    const barH = rowH * 0.6;
    const barY = y + (rowH - barH) / 2;
    s += svgRect(plotLeft, barY, Math.max(barW, 1), barH, { fill: i === 0 ? ACCENT : ACCENT_LIGHT, rx: 4 });

    const truncated = label.length > 24 ? `${label.slice(0, 23)}…` : label;
    s += svgText(plotLeft - 10, barY + barH / 2 + 4, truncated, { size: 12, anchor: "end" });
    s += svgText(plotLeft + barW + 8, barY + barH / 2 + 4, fmtNum(values[i]), { size: 12 });
  });

  if (xlabel) {
    s += svgText((plotLeft + plotRight) / 2, height - 12, xlabel, { size: 11, color: MUTED, anchor: "middle" });
  }

  return svgToPngBase64(wrapSvg(s, width, height), width);
}

// ---------------------------------------------------------------------------
// Line chart — trend findings. Rendered as a gradient-filled area under the
// data line (not just a bare line), with an optional dashed OLS trendline.
// ---------------------------------------------------------------------------
export function lineChart(x: string[], y: number[], title: string, xlabel = "", ylabel = "", addTrendline = true): string {
  const width = 900;
  const height = 460;
  const plotLeft = 70;
  const plotRight = width - 40;
  const plotTop = 60;
  const plotBottom = height - (x.length > 8 ? 90 : 60);

  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  const padY = (maxY - minY || 1) * 0.1;
  const yLo = minY - padY;
  const yHi = maxY + padY;

  const xPos = (i: number) => plotLeft + (x.length <= 1 ? 0 : (i / (x.length - 1)) * (plotRight - plotLeft));
  const yPos = (v: number) => plotBottom - ((v - yLo) / (yHi - yLo)) * (plotBottom - plotTop);

  let s = `<defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="${ACCENT}" stop-opacity="0.35" />
    <stop offset="95%" stop-color="${ACCENT}" stop-opacity="0.02" />
  </linearGradient></defs>`;
  s += svgRect(0, 0, width, height, { fill: BG });
  s += svgText(24, 34, fitTitle(title, width - 48), { size: 18, weight: "bold" });

  for (let g = 0; g <= 4; g++) {
    const val = yLo + ((yHi - yLo) * g) / 4;
    const gy = yPos(val);
    s += svgLine(plotLeft, gy, plotRight, gy, { color: GRID, dash: "3,3" });
    s += svgText(plotLeft - 8, gy + 4, fmtNum(val, 1), { size: 11, color: MUTED, anchor: "end" });
  }

  const points: [number, number][] = y.map((v, i) => [xPos(i), yPos(v)]);
  s += `<path d="${areaPathD(points, plotBottom)}" fill="url(#areaFill)" />`;

  if (addTrendline && x.length >= 3) {
    const xNum = x.map((_, i) => i);
    const { slope, intercept } = linearRegression(xNum, y);
    const trendPoints: [number, number][] = xNum.map((xi, i) => [xPos(i), yPos(slope * xi + intercept)]);
    s += svgPolyline(trendPoints, { color: DANGER, width: 1.5, dash: "6,4", opacity: 0.7 });
  }

  s += svgPolyline(points, { color: ACCENT, width: 2.5 });
  points.forEach(([px, py]) => {
    s += svgCircle(px, py, 3, { fill: ACCENT });
  });

  const rotate = x.length > 8;
  const stride = Math.max(1, Math.ceil(x.length / 12));
  x.forEach((label, i) => {
    if (i % stride !== 0 && i !== x.length - 1) return;
    const px = xPos(i);
    if (rotate) {
      s += svgText(px, plotBottom + 14, label, { size: 10, anchor: "end", rotate: -45 });
    } else {
      s += svgText(px, plotBottom + 16, label, { size: 10, anchor: "middle" });
    }
  });

  if (xlabel) s += svgText((plotLeft + plotRight) / 2, height - 10, xlabel, { size: 11, color: MUTED, anchor: "middle" });
  if (ylabel) {
    s += svgText(16, (plotTop + plotBottom) / 2, ylabel, { size: 11, color: MUTED, anchor: "middle", rotate: -90 });
  }

  if (addTrendline && x.length >= 3) {
    s += svgText(plotRight - 120, plotTop - 10, "— Value", { size: 11, color: ACCENT });
    s += svgText(plotRight - 50, plotTop - 10, "- - Trend", { size: 11, color: DANGER });
  }

  return svgToPngBase64(wrapSvg(s, width, height), width);
}

// ---------------------------------------------------------------------------
// Scatter chart — correlation findings, with an OLS regression line.
// ---------------------------------------------------------------------------
export function scatterChart(x: number[], y: number[], title: string, xlabel = "", ylabel = ""): string {
  const width = 820; // matches the other chart types' width -- more headroom for the title
  const height = 520;
  const plotLeft = 70;
  const plotRight = width - 40;
  const plotTop = 60;
  const plotBottom = height - 60;

  const minX = Math.min(...x);
  const maxX = Math.max(...x);
  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  const padX = (maxX - minX || 1) * 0.05;
  const padY = (maxY - minY || 1) * 0.05;
  const xLo = minX - padX;
  const xHi = maxX + padX;
  const yLo = minY - padY;
  const yHi = maxY + padY;
  const px = (v: number) => plotLeft + ((v - xLo) / (xHi - xLo)) * (plotRight - plotLeft);
  const py = (v: number) => plotBottom - ((v - yLo) / (yHi - yLo)) * (plotBottom - plotTop);

  let s = svgRect(0, 0, width, height, { fill: BG });
  s += svgText(24, 34, fitTitle(title, width - 48), { size: 18, weight: "bold" });

  for (let g = 0; g <= 4; g++) {
    const gy = plotTop + ((plotBottom - plotTop) * g) / 4;
    s += svgLine(plotLeft, gy, plotRight, gy, { color: GRID, dash: "3,3" });
    s += svgText(plotLeft - 8, gy + 4, fmtNum(yHi - ((yHi - yLo) * g) / 4, 1), { size: 11, color: MUTED, anchor: "end" });
  }
  // x-axis tick values (previously only the y-axis had numeric ticks)
  for (let g = 0; g <= 4; g++) {
    const gx = plotLeft + ((plotRight - plotLeft) * g) / 4;
    s += svgText(gx, plotBottom + 16, fmtNum(xLo + ((xHi - xLo) * g) / 4, 1), { size: 11, color: MUTED, anchor: "middle" });
  }

  if (x.length >= 3) {
    const { slope, intercept } = linearRegression(x, y);
    s += svgLine(px(xLo), py(slope * xLo + intercept), px(xHi), py(slope * xHi + intercept), {
      color: DANGER,
      width: 2,
      dash: "7,5",
      opacity: 0.8,
    });
  }

  for (let i = 0; i < x.length; i++) {
    s += svgCircle(px(x[i]), py(y[i]), 3, { fill: ACCENT, opacity: 0.5 });
  }

  s += svgText((plotLeft + plotRight) / 2, height - 12, xlabel || "x", { size: 11, color: MUTED, anchor: "middle" });
  s += svgText(16, (plotTop + plotBottom) / 2, ylabel || "y", { size: 11, color: MUTED, anchor: "middle", rotate: -90 });

  return svgToPngBase64(wrapSvg(s, width, height), width);
}

// ---------------------------------------------------------------------------
// Histogram — distribution findings, with mean / ±1 SD reference lines.
// ---------------------------------------------------------------------------
export function histogramChart(values: number[], title: string, xlabel = ""): string {
  const width = 820;
  const height = 420;
  const plotLeft = 60;
  const plotRight = width - 30;
  const plotTop = 70;
  const plotBottom = height - 60;
  const bins = 30;

  let s = svgRect(0, 0, width, height, { fill: BG });
  s += svgText(24, 34, fitTitle(title, width - 48), { size: 18, weight: "bold" });

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const binW = (hi - lo || 1) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - lo) / binW));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts, 1);

  const px = (v: number) => plotLeft + ((v - lo) / (hi - lo || 1)) * (plotRight - plotLeft);
  const barW = (plotRight - plotLeft) / bins;

  for (let g = 0; g <= 4; g++) {
    const gy = plotBottom - ((plotBottom - plotTop) * g) / 4;
    s += svgLine(plotLeft, gy, plotRight, gy, { color: GRID, dash: "3,3" });
    s += svgText(plotLeft - 8, gy + 4, fmtNum((maxCount * g) / 4), { size: 11, color: MUTED, anchor: "end" });
  }

  counts.forEach((c, i) => {
    const barH = (c / maxCount) * (plotBottom - plotTop);
    const x0 = plotLeft + i * barW;
    s += svgRect(x0, plotBottom - barH, Math.max(barW - 1, 1), barH, { fill: ACCENT_LIGHT, rx: 1 });
  });

  const m = mean(values);
  const stdev = sampleStd(values);
  const refLine = (val: number, color: string, dash: boolean) => {
    const x0 = px(val);
    if (dash) {
      s += svgLine(x0, plotTop, x0, plotBottom, { color, width: 1.5, dash: "6,4" });
    } else {
      s += svgLine(x0, plotTop, x0, plotBottom, { color, width: 2 });
    }
  };
  refLine(m, ACCENT, false);
  refLine(m + stdev, DANGER, true);
  refLine(m - stdev, DANGER, true);

  let legendY = 50;
  const legendX = plotRight - 150;
  const legendEntry = (color: string, label: string) => {
    s += svgLine(legendX, legendY, legendX + 16, legendY, { color, width: 2 });
    s += svgText(legendX + 20, legendY + 4, label, { size: 11 });
    legendY += 16;
  };
  legendEntry(ACCENT, `Mean: ${fmtNum(m, 2)}`);
  legendEntry(DANGER, `+1 SD: ${fmtNum(m + stdev, 2)}`);
  legendEntry(DANGER, `-1 SD: ${fmtNum(m - stdev, 2)}`);

  if (xlabel) s += svgText((plotLeft + plotRight) / 2, height - 12, xlabel, { size: 11, color: MUTED, anchor: "middle" });
  s += svgText(16, (plotTop + plotBottom) / 2, "Count", { size: 11, color: MUTED, anchor: "middle", rotate: -90 });

  return svgToPngBase64(wrapSvg(s, width, height), width);
}

// ---------------------------------------------------------------------------
// Box plot — outlier findings.
// ---------------------------------------------------------------------------
export function boxChart(values: number[], title: string, ylabel = "", outlierVal: number | null = null): string {
  const width = 420;
  const height = 480;
  const plotTop = 60;
  const plotBottom = height - 60;
  const centerX = width / 2;
  const boxW = 120;

  let s = svgRect(0, 0, width, height, { fill: BG });
  s += svgText(24, 34, fitTitle(title, width - 48), { size: 18, weight: "bold" });

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const med = median(sorted);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const nonOutliers = sorted.filter((v) => v >= lowerFence && v <= upperFence);
  const whiskerLo = nonOutliers.length ? nonOutliers[0] : q1;
  const whiskerHi = nonOutliers.length ? nonOutliers[nonOutliers.length - 1] : q3;
  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);

  const dataMin = Math.min(sorted[0], outlierVal ?? sorted[0]);
  const dataMax = Math.max(sorted[sorted.length - 1], outlierVal ?? sorted[sorted.length - 1]);
  const pad = (dataMax - dataMin || 1) * 0.1;
  const lo = dataMin - pad;
  const hi = dataMax + pad;
  const py = (v: number) => plotBottom - ((v - lo) / (hi - lo)) * (plotBottom - plotTop);

  for (let g = 0; g <= 4; g++) {
    const val = lo + ((hi - lo) * g) / 4;
    const gy = py(val);
    s += svgLine(60, gy, width - 30, gy, { color: GRID, dash: "3,3" });
    s += svgText(55, gy + 4, fmtNum(val, 1), { size: 11, color: MUTED, anchor: "end" });
  }

  // whiskers
  s += svgLine(centerX, py(whiskerHi), centerX, py(q3), { color: ACCENT, width: 1.5 });
  s += svgLine(centerX, py(q1), centerX, py(whiskerLo), { color: ACCENT, width: 1.5 });
  [whiskerHi, whiskerLo].forEach((v) => {
    s += svgLine(centerX - 20, py(v), centerX + 20, py(v), { color: ACCENT, width: 1.5 });
  });

  // box (Q1-Q3)
  const boxTop = py(q3);
  const boxBottom = py(q1);
  s += svgRect(centerX - boxW / 2, boxTop, boxW, boxBottom - boxTop, { fill: ACCENT_LIGHT, rx: 3 });

  // median line
  s += svgLine(centerX - boxW / 2, py(med), centerX + boxW / 2, py(med), { color: ACCENT, width: 2 });

  // outlier points
  outliers.forEach((v) => {
    s += svgCircle(centerX, py(v), 3.5, { fill: DANGER, opacity: 0.6 });
  });

  if (outlierVal !== null) {
    const oy = py(outlierVal);
    s += svgLine(60, oy, width - 30, oy, { color: DANGER, width: 1.5, dash: "6,4" });
    // Clear of the dashed line itself (drawing directly on it makes the
    // dashes cut through the letterforms and look garbled).
    s += svgText(centerX + boxW / 2 + 15, oy - 8, `Most extreme: ${fmtNum(outlierVal, 2)}`, { size: 11, color: DANGER });
  }

  if (ylabel) {
    s += svgText(16, (plotTop + plotBottom) / 2, ylabel, { size: 11, color: MUTED, anchor: "middle", rotate: -90 });
  }

  return svgToPngBase64(wrapSvg(s, width, height), width);
}

// ---------------------------------------------------------------------------
// Dispatch by finding type — mirrors the original chart_service.py::chart_for_finding.
// ---------------------------------------------------------------------------
export function chartForFinding(finding: Finding, rows: Row[]): string | null {
  const { type, columns, extra } = finding;

  try {
    if (type === "ranking") {
      const leaderboard = (extra.leaderboard as Record<string, number>) ?? {};
      const entries = Object.entries(leaderboard).slice(0, 10);
      if (entries.length === 0) return null;
      const labels = entries.map(([k]) => k);
      const values = entries.map(([, v]) => v);
      const combinedCols = extra.combined_cols as string[] | undefined;
      const colLabel = combinedCols?.length
        ? combinedCols.map((c) => c.replace(/_/g, " ")).join(" + ")
        : (columns[columns.length - 1]?.replace(/_/g, " ") ?? "Value");
      return horizontalBar(labels, values, `Top ${labels.length} by ${colLabel}`, colLabel);
    }

    if (type === "trend" && columns.length >= 2) {
      const [metricCol, dateCol] = columns;
      let sub = rows
        .map((r) => ({ d: r[dateCol], v: r[metricCol] }))
        .filter((r) => r.d != null && r.d !== "" && typeof r.v === "number" && !Number.isNaN(r.v))
        .map((r) => ({ t: Date.parse(String(r.d)), v: r.v as number }))
        .filter((r) => !Number.isNaN(r.t))
        .sort((a, b) => a.t - b.t);
      if (sub.length < 3) return null;
      if (sub.length > 100) {
        const stride = Math.floor(sub.length / 100);
        sub = sub.filter((_, i) => i % stride === 0);
      }
      const x = sub.map((r) => new Date(r.t).toISOString().slice(0, 10));
      const y = sub.map((r) => r.v);
      return lineChart(x, y, `${metricCol.replace(/_/g, " ")} over time`, dateCol.replace(/_/g, " "), metricCol.replace(/_/g, " "));
    }

    if (type === "correlation" && columns.length >= 2) {
      const [colA, colB] = columns;
      let sub = rows
        .map((r) => ({ a: r[colA], b: r[colB] }))
        .filter((r) => typeof r.a === "number" && typeof r.b === "number") as { a: number; b: number }[];
      if (sub.length < 10) return null;
      if (sub.length > 2000) {
        // deterministic thinning rather than true random sampling — good enough for a chart preview
        const stride = Math.ceil(sub.length / 2000);
        sub = sub.filter((_, i) => i % stride === 0);
      }
      const r = Number(extra.r ?? 0);
      return scatterChart(
        sub.map((s) => s.a),
        sub.map((s) => s.b),
        `${colA.replace(/_/g, " ")} vs ${colB.replace(/_/g, " ")} (r=${r.toFixed(2)})`,
        colA.replace(/_/g, " "),
        colB.replace(/_/g, " ")
      );
    }

    if (type === "distribution" && columns.length > 0) {
      const col = columns[0];
      const values = rows.map((r) => r[col]).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      if (values.length < 8) return null;
      const skew = Number(extra.skew ?? 0);
      return histogramChart(values, `Distribution of ${col.replace(/_/g, " ")} (skew=${skew.toFixed(2)})`, col.replace(/_/g, " "));
    }

    if (type === "dose_response") {
      const bins = (extra.bins as Record<string, number>) ?? {};
      if (Object.keys(bins).length === 0) return null;
      const xCol = (extra.independent_var as string) ?? columns[0] ?? "the input variable";
      const outcomeLabel = (extra.outcome_label as string) ?? (columns[1]?.replace(/_/g, " ") ?? "Outcome");
      return doseResponseBarChart(bins, xCol, outcomeLabel);
    }

    if (type === "outlier" && columns.length > 0) {
      const col = columns[0];
      const values = rows.map((r) => r[col]).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      const outlierVal = finding.value;
      return boxChart(values, `Outliers in ${col.replace(/_/g, " ")}`, col.replace(/_/g, " "), outlierVal ?? null);
    }
  } catch (err) {
    console.error(`chartForFinding failed for type=${type}:`, err);
    return null;
  }

  return null;
}

function doseResponseBarChart(bins: Record<string, number>, xCol: string, outcomeLabel: string): string {
  const width = 820;
  const height = 460;
  const plotLeft = 70;
  const plotRight = width - 30;
  // Extra top clearance (vs. other charts' plotTop=60-70) so a tall peak
  // bar's value label never crowds the title or the topmost gridline.
  const plotTop = 95;
  const plotBottom = height - 70;

  const labels = Object.keys(bins);
  const values = labels.map((k) => bins[k]);
  const peakVal = Math.max(...values);

  let s = svgRect(0, 0, width, height, { fill: BG });
  const xReadable = xCol.replace(/_/g, " ");
  s += svgText(24, 34, fitTitle(`${outcomeLabel} by ${xReadable} usage (quartiles)`, width - 48), { size: 18, weight: "bold" });

  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const pad = (hi - lo || 1) * 0.2;
  const yLo = lo - pad;
  const yHi = hi + pad;
  const py = (v: number) => plotBottom - ((v - yLo) / (yHi - yLo)) * (plotBottom - plotTop);
  const zeroY = py(0);

  for (let g = 0; g <= 4; g++) {
    const val = yLo + ((yHi - yLo) * g) / 4;
    const gy = py(val);
    s += svgLine(plotLeft, gy, plotRight, gy, { color: GRID, dash: "3,3" });
    s += svgText(plotLeft - 8, gy + 4, fmtNum(val, 2), { size: 11, color: MUTED, anchor: "end" });
  }

  const barW = ((plotRight - plotLeft) / labels.length) * 0.55;
  const slot = (plotRight - plotLeft) / labels.length;
  labels.forEach((label, i) => {
    const val = values[i];
    const x0 = plotLeft + i * slot + (slot - barW) / 2;
    const barY = Math.min(zeroY, py(val));
    const barH = Math.abs(py(val) - zeroY);
    s += svgRect(x0, barY, barW, Math.max(barH, 1), { fill: val === peakVal ? ACCENT : ACCENT_LIGHT, rx: 3 });

    const labelY = val >= 0 ? barY - 12 : barY + barH + 16;
    s += svgText(x0 + barW / 2, labelY, `${val >= 0 ? "+" : ""}${val.toFixed(3)}`, {
      size: 11,
      weight: val === peakVal ? "bold" : "normal",
      color: val === peakVal ? ACCENT : TEXT,
      anchor: "middle",
    });
    s += svgText(x0 + barW / 2, plotBottom + 18, label, { size: 11, anchor: "middle" });
  });

  s += svgLine(plotLeft, zeroY, plotRight, zeroY, { color: GRID });
  s += svgText((plotLeft + plotRight) / 2, height - 12, `${xReadable} quartile`, { size: 11, color: MUTED, anchor: "middle" });

  return svgToPngBase64(wrapSvg(s, width, height), width);
}
