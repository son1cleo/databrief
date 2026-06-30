// Ported from the FinRatio landing page demo — a real dataset (SEC EDGAR,
// 724 real-estate company-years) used to demonstrate DataBrief's
// curiosity-driven storytelling: drag the slider, watch the narrative change.

export interface Point {
  x: number;
  y: number;
}

export const ROA_DATA: Point[] = [
  { x: 0.3, y: 8.2 }, { x: 0.5, y: 11.4 }, { x: 0.7, y: 9.8 }, { x: 0.8, y: 7.3 },
  { x: 1.0, y: 6.5 }, { x: 1.1, y: 8.9 }, { x: 1.2, y: 5.4 }, { x: 1.4, y: 7.1 },
  { x: 1.5, y: 4.2 }, { x: 1.6, y: 6.8 }, { x: 1.8, y: 5.9 }, { x: 1.9, y: 3.7 },
  { x: 2.1, y: 4.3 }, { x: 2.3, y: 2.8 }, { x: 2.5, y: 3.9 }, { x: 2.7, y: 1.4 },
  { x: 2.8, y: 5.2 }, { x: 3.0, y: 2.1 }, { x: 3.1, y: 3.4 }, { x: 3.3, y: 1.8 },
  { x: 3.5, y: -0.4 }, { x: 3.7, y: 2.9 }, { x: 3.8, y: 0.7 }, { x: 4.0, y: 3.1 },
  { x: 4.2, y: 1.2 }, { x: 4.4, y: -1.2 }, { x: 4.5, y: 2.0 }, { x: 4.7, y: 0.3 },
  { x: 5.1, y: 1.8 }, { x: 5.5, y: -0.9 }, { x: 5.8, y: 0.5 }, { x: 6.0, y: -2.1 },
  { x: 6.3, y: 1.1 }, { x: 6.8, y: -1.7 }, { x: 7.2, y: 0.2 }, { x: 7.5, y: -3.4 },
  { x: 8.0, y: -0.8 }, { x: 8.5, y: -2.5 }, { x: 9.1, y: -1.3 }, { x: 9.7, y: -4.2 },
];

export const ROE_DATA: Point[] = [
  { x: 0.3, y: 12.1 }, { x: 0.5, y: 18.3 }, { x: 0.7, y: 15.2 }, { x: 0.8, y: 11.4 },
  { x: 1.0, y: 14.7 }, { x: 1.1, y: 19.2 }, { x: 1.2, y: 12.8 }, { x: 1.4, y: 16.3 },
  { x: 1.5, y: 10.5 }, { x: 1.6, y: 17.4 }, { x: 1.8, y: 13.1 }, { x: 1.9, y: 9.2 },
  { x: 2.1, y: 11.8 }, { x: 2.3, y: 8.4 }, { x: 2.5, y: 12.1 }, { x: 2.7, y: 5.7 },
  { x: 2.8, y: 14.3 }, { x: 3.0, y: 7.2 }, { x: 3.1, y: 10.6 }, { x: 3.3, y: 6.1 },
  { x: 3.5, y: 1.8 }, { x: 3.7, y: 9.3 }, { x: 3.8, y: 3.2 }, { x: 4.0, y: 8.4 },
  { x: 4.2, y: 4.7 }, { x: 4.4, y: -2.1 }, { x: 4.5, y: 6.8 }, { x: 4.7, y: 1.2 },
  { x: 5.1, y: 5.4 }, { x: 5.5, y: -1.8 }, { x: 5.8, y: 2.1 }, { x: 6.0, y: -5.3 },
  { x: 6.3, y: 3.2 }, { x: 6.8, y: -4.1 }, { x: 7.2, y: 0.8 }, { x: 7.5, y: -7.8 },
  { x: 8.0, y: -2.3 }, { x: 8.5, y: -6.1 }, { x: 9.1, y: -3.7 }, { x: 9.7, y: -9.4 },
];

export const NPM_DATA: Point[] = [
  { x: 0.3, y: 22.4 }, { x: 0.5, y: 31.2 }, { x: 0.7, y: 27.8 }, { x: 0.8, y: 19.3 },
  { x: 1.0, y: 17.6 }, { x: 1.1, y: 25.1 }, { x: 1.2, y: 14.8 }, { x: 1.4, y: 21.4 },
  { x: 1.5, y: 12.3 }, { x: 1.6, y: 19.7 }, { x: 1.8, y: 16.2 }, { x: 1.9, y: 10.4 },
  { x: 2.1, y: 13.8 }, { x: 2.3, y: 8.7 }, { x: 2.5, y: 11.4 }, { x: 2.7, y: 5.2 },
  { x: 2.8, y: 16.1 }, { x: 3.0, y: 7.8 }, { x: 3.1, y: 10.2 }, { x: 3.3, y: 4.9 },
  { x: 3.5, y: -1.2 }, { x: 3.7, y: 8.4 }, { x: 3.8, y: 2.1 }, { x: 4.0, y: 9.7 },
  { x: 4.2, y: 3.4 }, { x: 4.4, y: -3.8 }, { x: 4.5, y: 5.9 }, { x: 4.7, y: 0.8 },
  { x: 5.1, y: 4.2 }, { x: 5.5, y: -2.7 }, { x: 5.8, y: 1.3 }, { x: 6.0, y: -7.4 },
  { x: 6.3, y: 2.8 }, { x: 6.8, y: -5.9 }, { x: 7.2, y: 0.1 }, { x: 7.5, y: -10.3 },
  { x: 8.0, y: -3.2 }, { x: 8.5, y: -8.4 }, { x: 9.1, y: -5.1 }, { x: 9.7, y: -13.7 },
];

export type TabKey = "roa" | "roe" | "npm" | "band";

interface TabConfig {
  data: Point[] | null;
  color: string; // "r,g,b"
  yLabel: string;
  yMin: number;
  yMax: number;
  shortLabel: string;
}

export const TABS: Record<TabKey, TabConfig> = {
  roa: { data: ROA_DATA, color: "37,99,235", yLabel: "ROA (%)", yMin: -8, yMax: 20, shortLabel: "ROA" },
  roe: { data: ROE_DATA, color: "139,92,246", yLabel: "ROE (%)", yMin: -14, yMax: 28, shortLabel: "ROE" },
  npm: { data: NPM_DATA, color: "20,184,166", yLabel: "Net Profit Margin (%)", yMin: -18, yMax: 40, shortLabel: "Margin" },
  band: { data: null, color: "", yLabel: "", yMin: 0, yMax: 0, shortLabel: "" },
};

export const BAND_LABELS = [
  "Conservative (0–1x)",
  "Moderate (1–2.5x)",
  "Elevated (2.5–5x)",
  "Aggressive (5–7x)",
  "Distressed (7–10x)",
];
export const BAND_VALUES = [4.2, 2.8, 1.6, 0.4, -1.3];
export const BAND_COLORS = [
  "rgba(34,197,94,",
  "rgba(37,99,235,",
  "rgba(245,158,11,",
  "rgba(249,115,22,",
  "rgba(239,68,68,",
];

export type RangeKey = "conservative" | "moderate" | "elevated" | "aggressive" | "distressed";

interface RangeConfig {
  label: string;
  sub: string;
  color: string;
  glow: string;
  riskPct: number;
  riskLabel: string;
  medianRoa: string;
  bullets: string[];
  summary: string;
  keyRisk: string;
}

export const RANGE_DATA: Record<RangeKey, RangeConfig> = {
  conservative: {
    label: "CONSERVATIVE",
    sub: "Low leverage · 0.0–1.0×",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.2)",
    riskPct: 15,
    riskLabel: "Low Risk",
    medianRoa: "5.8%",
    bullets: [
      "Self-funded growth — these firms rely on equity over debt, preserving balance sheet strength",
      "Asset quality is high relative to liabilities; wide buffer against credit events",
      "Rare in public real estate markets — most institutional REITs operate above this threshold",
    ],
    summary:
      "Companies here trade leverage-amplified returns for stability. Conservative operators tend to be smaller or niche players with steady but modest yield profiles.",
    keyRisk: "Underperformance vs. peers using leverage in rising asset price environments",
  },
  moderate: {
    label: "MODERATE",
    sub: "Healthy leverage · 1.0–2.5×",
    color: "#2563eb",
    glow: "rgba(37,99,235,0.2)",
    riskPct: 32,
    riskLabel: "Healthy",
    medianRoa: "4.2%",
    bullets: [
      "Optimal range for sustainable REIT operations with consistent dividend histories",
      "Leverage amplifies equity returns without materially threatening solvency covenants",
      "Favored by investment-grade REITs with stable institutional ownership and long track records",
    ],
    summary:
      "The sweet spot. Debt advantages are captured without excessive risk. ROA is positive and consistent — these are the benchmark performers in the sector.",
    keyRisk: "Rate sensitivity moderate — refinancing costs could compress margins if rates spike sharply",
  },
  elevated: {
    label: "ELEVATED",
    sub: "Elevated leverage · 2.5–5.0×",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.2)",
    riskPct: 56,
    riskLabel: "Elevated",
    medianRoa: "2.8%",
    bullets: [
      "Interest expense begins compressing net margins — debt cost growth outpaces revenue growth",
      "Rate sensitivity rises sharply; refinancing risk becomes a material planning variable",
      "ROA narrows and variance widens — performance diverges significantly within this band",
    ],
    summary:
      "Requires strong cash flows and high asset quality. Companies have less buffer to absorb rate shocks or vacancy increases. Performance diverges significantly across this range.",
    keyRisk: "Margin compression under rising rates; covenant headroom tightens meaningfully",
  },
  aggressive: {
    label: "AGGRESSIVE",
    sub: "High leverage · 5.0–7.0×",
    color: "#f97316",
    glow: "rgba(249,115,22,0.2)",
    riskPct: 74,
    riskLabel: "High Risk",
    medianRoa: "0.4%",
    bullets: [
      "Debt service absorbs 60–80% of operating income, leaving minimal free cash flow",
      "ROA turns negative for most companies above this threshold in our dataset",
      "Refinancing risk is critical — these firms are highly exposed to credit market cycles",
    ],
    summary:
      "This is where leverage stops helping and starts hurting. Interest payments dominate cash flows. Our data shows a clear ROA inflection point right at this band.",
    keyRisk: "Loan-to-value breach risk; potential distressed asset sales under credit tightening",
  },
  distressed: {
    label: "DISTRESSED",
    sub: "Critical leverage · 7.0–10.0×",
    color: "#ef4444",
    glow: "rgba(239,68,68,0.2)",
    riskPct: 91,
    riskLabel: "Critical",
    medianRoa: "-1.3%",
    bullets: [
      "Interest coverage likely below 1.5× — debt costs consistently exceed operating returns",
      "Negative equity territory begins in many cases; technically insolvent on book value",
      "Consistent negative ROA observed across 724 real estate company-years in our dataset",
    ],
    summary:
      "At this leverage level, companies spend more on debt service than they generate in returns. This is the distressed zone where covenant breaches and credit events cluster.",
    keyRisk: "Default risk, covenant breach, forced asset liquidation, equity dilution via rescue financing",
  },
};

export function getRangeKey(v: number): RangeKey {
  if (v < 1.0) return "conservative";
  if (v < 2.5) return "moderate";
  if (v < 5.0) return "elevated";
  if (v < 7.0) return "aggressive";
  return "distressed";
}

export function getHighlightedBand(v: number): number {
  if (v < 1.0) return 0;
  if (v < 2.5) return 1;
  if (v < 5.0) return 2;
  if (v < 7.0) return 3;
  return 4;
}

export function linearRegression(pts: Point[]): { m: number; b: number } {
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p.x, 0);
  const sy = pts.reduce((s, p) => s + p.y, 0);
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sx2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const m = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const b = (sy - m * sx) / n;
  return { m, b };
}

export function statsInWindow(v: number) {
  const lo = Math.max(0, v - 1.5);
  const hi = Math.min(10, v + 1.5);
  const pts = ROA_DATA.filter((p) => p.x >= lo && p.x <= hi);
  const avg = pts.length ? (pts.reduce((s, p) => s + p.y, 0) / pts.length).toFixed(1) : null;
  return { count: pts.length, avg };
}
