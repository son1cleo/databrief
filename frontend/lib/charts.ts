import "server-only";
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { mean, sampleStd, quantile, median, linearRegression, type Finding, type Row } from "@/lib/analysis";

const ACCENT = "#2563eb";
const ACCENT_LIGHT = "#93c5fd";
const DANGER = "#ef4444";
const TEXT = "#1a1a1a";
const GRID = "#e5e7eb";
const BG = "#ffffff";
const FONT = "sans-serif";

function canvasToBase64(canvas: { toBuffer: (mime: "image/png") => Buffer }): string {
  return canvas.toBuffer("image/png").toString("base64");
}

function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function drawTitle(ctx: SKRSContext2D, title: string, width: number, y: number): void {
  ctx.fillStyle = TEXT;
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, 24, y);
}

function dashedLine(ctx: SKRSContext2D, x1: number, y1: number, x2: number, y2: number, dash: number[] = [5, 4]) {
  ctx.save();
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Horizontal bar chart — ranking/leaderboard findings. `labels`/`values` are
// assumed already sorted descending (winner first); the winner is drawn at
// the top in the darker accent color, the rest in the lighter one.
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

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  drawTitle(ctx, title, width, 34);

  // vertical gridlines
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  const gridSteps = 5;
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = "#6b7280";
  for (let g = 0; g <= gridSteps; g++) {
    const gx = plotLeft + ((plotRight - plotLeft) * g) / gridSteps;
    dashedLine(ctx, gx, chartTop - 10, gx, chartBottom, [3, 3]);
    ctx.textAlign = "center";
    ctx.fillText(fmtNum((maxVal * g) / gridSteps), gx, chartBottom + 16);
  }

  labels.forEach((label, i) => {
    const y = chartTop + i * rowH;
    const barW = (values[i] / (maxVal * 1.18)) * (plotRight - plotLeft);
    const barH = rowH * 0.6;
    const barY = y + (rowH - barH) / 2;
    ctx.fillStyle = i === 0 ? ACCENT : ACCENT_LIGHT;
    ctx.fillRect(plotLeft, barY, Math.max(barW, 1), barH);

    ctx.fillStyle = TEXT;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = "right";
    const truncated = label.length > 24 ? `${label.slice(0, 23)}…` : label;
    ctx.fillText(truncated, plotLeft - 10, barY + barH / 2 + 4);

    ctx.textAlign = "left";
    ctx.fillText(fmtNum(values[i]), plotLeft + barW + 8, barY + barH / 2 + 4);
  });

  if (xlabel) {
    ctx.fillStyle = "#6b7280";
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(xlabel, (plotLeft + plotRight) / 2, height - 12);
  }

  return canvasToBase64(canvas);
}

// ---------------------------------------------------------------------------
// Line chart — trend findings, with an optional dashed OLS trendline.
// ---------------------------------------------------------------------------
export function lineChart(x: string[], y: number[], title: string, xlabel = "", ylabel = "", addTrendline = true): string {
  const width = 900;
  const height = 460;
  const plotLeft = 70;
  const plotRight = width - 40;
  const plotTop = 60;
  const plotBottom = height - (x.length > 8 ? 90 : 60);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  drawTitle(ctx, title, width, 34);

  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  const padY = (maxY - minY || 1) * 0.1;
  const yLo = minY - padY;
  const yHi = maxY + padY;

  const xPos = (i: number) => plotLeft + (x.length <= 1 ? 0 : (i / (x.length - 1)) * (plotRight - plotLeft));
  const yPos = (v: number) => plotBottom - ((v - yLo) / (yHi - yLo)) * (plotBottom - plotTop);

  // gridlines + y ticks
  ctx.strokeStyle = GRID;
  ctx.fillStyle = "#6b7280";
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "right";
  for (let g = 0; g <= 4; g++) {
    const val = yLo + ((yHi - yLo) * g) / 4;
    const gy = yPos(val);
    dashedLine(ctx, plotLeft, gy, plotRight, gy, [3, 3]);
    ctx.fillText(fmtNum(val, 1), plotLeft - 8, gy + 4);
  }

  // trendline (drawn first, under the data line)
  if (addTrendline && x.length >= 3) {
    const xNum = x.map((_, i) => i);
    const { slope, intercept } = linearRegression(xNum, y);
    ctx.strokeStyle = DANGER;
    ctx.lineWidth = 1.5;
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    xNum.forEach((xi, i) => {
      const py = yPos(slope * xi + intercept);
      const px = xPos(i);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  }

  // data line + markers
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  y.forEach((v, i) => {
    const px = xPos(i);
    const py = yPos(v);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  y.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(xPos(i), yPos(v), 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // x labels (rotated if many)
  ctx.fillStyle = TEXT;
  ctx.font = `10px ${FONT}`;
  const rotate = x.length > 8;
  const stride = Math.max(1, Math.ceil(x.length / 12));
  x.forEach((label, i) => {
    if (i % stride !== 0 && i !== x.length - 1) return;
    const px = xPos(i);
    ctx.save();
    if (rotate) {
      ctx.translate(px, plotBottom + 14);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = "right";
      ctx.fillText(label, 0, 0);
    } else {
      ctx.textAlign = "center";
      ctx.fillText(label, px, plotBottom + 16);
    }
    ctx.restore();
  });

  if (xlabel) {
    ctx.fillStyle = "#6b7280";
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(xlabel, (plotLeft + plotRight) / 2, height - 10);
  }
  if (ylabel) {
    ctx.save();
    ctx.translate(16, (plotTop + plotBottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(ylabel, 0, 0);
    ctx.restore();
  }

  if (addTrendline && x.length >= 3) {
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillStyle = ACCENT;
    ctx.fillText("— Value", plotRight - 120, plotTop - 10);
    ctx.fillStyle = DANGER;
    ctx.fillText("- - Trend", plotRight - 50, plotTop - 10);
  }

  return canvasToBase64(canvas);
}

// ---------------------------------------------------------------------------
// Scatter chart — correlation findings, with an OLS regression line.
// ---------------------------------------------------------------------------
export function scatterChart(x: number[], y: number[], title: string, xlabel = "", ylabel = ""): string {
  const width = 700;
  const height = 520;
  const plotLeft = 70;
  const plotRight = width - 30;
  const plotTop = 60;
  const plotBottom = height - 60;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  drawTitle(ctx, title, width, 34);

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

  ctx.strokeStyle = GRID;
  ctx.fillStyle = "#6b7280";
  ctx.font = `11px ${FONT}`;
  for (let g = 0; g <= 4; g++) {
    const gy = plotTop + ((plotBottom - plotTop) * g) / 4;
    dashedLine(ctx, plotLeft, gy, plotRight, gy, [3, 3]);
    ctx.textAlign = "right";
    ctx.fillText(fmtNum(yHi - ((yHi - yLo) * g) / 4, 1), plotLeft - 8, gy + 4);
  }

  if (x.length >= 3) {
    const { slope, intercept } = linearRegression(x, y);
    ctx.strokeStyle = DANGER;
    ctx.lineWidth = 2;
    ctx.save();
    ctx.setLineDash([7, 5]);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(px(xLo), py(slope * xLo + intercept));
    ctx.lineTo(px(xHi), py(slope * xHi + intercept));
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = ACCENT;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < x.length; i++) {
    ctx.beginPath();
    ctx.arc(px(x[i]), py(y[i]), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#6b7280";
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(xlabel || "x", (plotLeft + plotRight) / 2, height - 12);
  ctx.save();
  ctx.translate(16, (plotTop + plotBottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(ylabel || "y", 0, 0);
  ctx.restore();

  return canvasToBase64(canvas);
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

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  drawTitle(ctx, title, width, 34);

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

  ctx.strokeStyle = GRID;
  ctx.fillStyle = "#6b7280";
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "right";
  for (let g = 0; g <= 4; g++) {
    const gy = plotBottom - ((plotBottom - plotTop) * g) / 4;
    dashedLine(ctx, plotLeft, gy, plotRight, gy, [3, 3]);
    ctx.fillText(fmtNum((maxCount * g) / 4), plotLeft - 8, gy + 4);
  }

  ctx.fillStyle = ACCENT_LIGHT;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 0.5;
  counts.forEach((c, i) => {
    const barH = (c / maxCount) * (plotBottom - plotTop);
    const x0 = plotLeft + i * barW;
    ctx.fillRect(x0, plotBottom - barH, Math.max(barW - 1, 1), barH);
    ctx.strokeRect(x0, plotBottom - barH, Math.max(barW - 1, 1), barH);
  });

  const m = mean(values);
  const s = sampleStd(values);
  const refLine = (val: number, color: string, dash: boolean) => {
    const x0 = px(val);
    ctx.strokeStyle = color;
    ctx.lineWidth = dash ? 1.5 : 2;
    if (dash) dashedLine(ctx, x0, plotTop, x0, plotBottom, [6, 4]);
    else {
      ctx.beginPath();
      ctx.moveTo(x0, plotTop);
      ctx.lineTo(x0, plotBottom);
      ctx.stroke();
    }
  };
  refLine(m, ACCENT, false);
  refLine(m + s, DANGER, true);
  refLine(m - s, DANGER, true);

  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "left";
  let legendY = 50;
  const legendX = plotRight - 150;
  const legendEntry = (color: string, label: string) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 16, legendY);
    ctx.stroke();
    ctx.fillStyle = TEXT;
    ctx.fillText(label, legendX + 20, legendY + 4);
    legendY += 16;
  };
  legendEntry(ACCENT, `Mean: ${fmtNum(m, 2)}`);
  legendEntry(DANGER, `+1 SD: ${fmtNum(m + s, 2)}`);
  legendEntry(DANGER, `-1 SD: ${fmtNum(m - s, 2)}`);

  if (xlabel) {
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "center";
    ctx.fillText(xlabel, (plotLeft + plotRight) / 2, height - 12);
  }
  ctx.save();
  ctx.translate(16, (plotTop + plotBottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillStyle = "#6b7280";
  ctx.fillText("Count", 0, 0);
  ctx.restore();

  return canvasToBase64(canvas);
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

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  drawTitle(ctx, title, width, 34);

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

  ctx.strokeStyle = GRID;
  ctx.fillStyle = "#6b7280";
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "right";
  for (let g = 0; g <= 4; g++) {
    const val = lo + ((hi - lo) * g) / 4;
    const gy = py(val);
    dashedLine(ctx, 60, gy, width - 30, gy, [3, 3]);
    ctx.fillText(fmtNum(val, 1), 55, gy + 4);
  }

  // whiskers
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX, py(whiskerHi));
  ctx.lineTo(centerX, py(q3));
  ctx.moveTo(centerX, py(q1));
  ctx.lineTo(centerX, py(whiskerLo));
  ctx.stroke();
  [whiskerHi, whiskerLo].forEach((v) => {
    ctx.beginPath();
    ctx.moveTo(centerX - 20, py(v));
    ctx.lineTo(centerX + 20, py(v));
    ctx.stroke();
  });

  // box (Q1-Q3)
  ctx.fillStyle = ACCENT_LIGHT;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5;
  const boxTop = py(q3);
  const boxBottom = py(q1);
  ctx.fillRect(centerX - boxW / 2, boxTop, boxW, boxBottom - boxTop);
  ctx.strokeRect(centerX - boxW / 2, boxTop, boxW, boxBottom - boxTop);

  // median line
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - boxW / 2, py(med));
  ctx.lineTo(centerX + boxW / 2, py(med));
  ctx.stroke();

  // outlier points
  ctx.fillStyle = DANGER;
  ctx.globalAlpha = 0.6;
  outliers.forEach((v) => {
    ctx.beginPath();
    ctx.arc(centerX, py(v), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  if (outlierVal !== null) {
    const oy = py(outlierVal);
    ctx.strokeStyle = DANGER;
    ctx.lineWidth = 1.5;
    dashedLine(ctx, 60, oy, width - 30, oy, [6, 4]);
    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = DANGER;
    ctx.textAlign = "left";
    // Clear of the dashed line itself (drawing directly on it makes the
    // dashes cut through the letterforms and look garbled).
    ctx.fillText(`Most extreme: ${fmtNum(outlierVal, 2)}`, centerX + boxW / 2 + 15, oy - 8);
  }

  if (ylabel) {
    ctx.save();
    ctx.translate(16, (plotTop + plotBottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(ylabel, 0, 0);
    ctx.restore();
  }

  return canvasToBase64(canvas);
}

// ---------------------------------------------------------------------------
// Dispatch by finding type — mirrors chart_service.py::chart_for_finding.
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
      return lineChart(x, y, `${metricCol} over time`, dateCol, metricCol.replace(/_/g, " "));
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
        `${colA} vs ${colB} (r=${r.toFixed(2)})`,
        colA.replace(/_/g, " "),
        colB.replace(/_/g, " ")
      );
    }

    if (type === "distribution" && columns.length > 0) {
      const col = columns[0];
      const values = rows.map((r) => r[col]).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      if (values.length < 8) return null;
      const skew = Number(extra.skew ?? 0);
      return histogramChart(values, `Distribution of ${col} (skew=${skew.toFixed(2)})`, col.replace(/_/g, " "));
    }

    if (type === "dose_response") {
      const bins = (extra.bins as Record<string, number>) ?? {};
      if (Object.keys(bins).length === 0) return null;
      const xCol = (extra.independent_var as string) ?? columns[0] ?? "X";
      const outcomeLabel = (extra.outcome_label as string) ?? (columns[1]?.replace(/_/g, " ") ?? "Outcome");
      return doseResponseBarChart(bins, xCol, outcomeLabel);
    }

    if (type === "outlier" && columns.length > 0) {
      const col = columns[0];
      const values = rows.map((r) => r[col]).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      const outlierVal = finding.value;
      return boxChart(values, `Outliers in ${col}`, col.replace(/_/g, " "), outlierVal ?? null);
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
  const plotTop = 70;
  const plotBottom = height - 70;

  const labels = Object.keys(bins);
  const values = labels.map((k) => bins[k]);
  const peakVal = Math.max(...values);
  const absMax = Math.max(...values.map(Math.abs)) || 1;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  const xReadable = xCol.replace(/_/g, " ");
  drawTitle(ctx, `${outcomeLabel} by ${xReadable} usage (quartiles)`, width, 34);

  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const pad = (hi - lo || 1) * 0.2;
  const yLo = lo - pad;
  const yHi = hi + pad;
  const py = (v: number) => plotBottom - ((v - yLo) / (yHi - yLo)) * (plotBottom - plotTop);
  const zeroY = py(0);

  ctx.strokeStyle = GRID;
  ctx.fillStyle = "#6b7280";
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "right";
  for (let g = 0; g <= 4; g++) {
    const val = yLo + ((yHi - yLo) * g) / 4;
    const gy = py(val);
    dashedLine(ctx, plotLeft, gy, plotRight, gy, [3, 3]);
    ctx.fillText(fmtNum(val, 2), plotLeft - 8, gy + 4);
  }

  const barW = ((plotRight - plotLeft) / labels.length) * 0.55;
  const slot = (plotRight - plotLeft) / labels.length;
  labels.forEach((label, i) => {
    const val = values[i];
    const x0 = plotLeft + i * slot + (slot - barW) / 2;
    const barY = Math.min(zeroY, py(val));
    const barH = Math.abs(py(val) - zeroY);
    ctx.fillStyle = val === peakVal ? ACCENT : ACCENT_LIGHT;
    ctx.fillRect(x0, barY, barW, Math.max(barH, 1));

    ctx.font = `${val === peakVal ? "bold " : ""}11px ${FONT}`;
    ctx.fillStyle = val === peakVal ? ACCENT : TEXT;
    ctx.textAlign = "center";
    const labelY = val >= 0 ? barY - 6 : barY + barH + 14;
    ctx.fillText(`${val >= 0 ? "+" : ""}${val.toFixed(3)}`, x0 + barW / 2, labelY);

    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = TEXT;
    ctx.fillText(label, x0 + barW / 2, plotBottom + 18);
  });

  ctx.strokeStyle = GRID;
  ctx.beginPath();
  ctx.moveTo(plotLeft, zeroY);
  ctx.lineTo(plotRight, zeroY);
  ctx.stroke();

  ctx.fillStyle = "#6b7280";
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`${xReadable} quartile`, (plotLeft + plotRight) / 2, height - 12);

  return canvasToBase64(canvas);
}
