// Shared, dependency-free chart-data shapes -- deliberately NOT in
// lib/charts.ts (which is "server-only") so client components can import
// this type without any risk of pulling server-only code into the browser
// bundle. lib/charts.ts's chartDataForFinding() is the only producer;
// components/reports/InteractiveChart.tsx is the only consumer.

export interface BarChartData {
  kind: "bar";
  title: string;
  xlabel: string;
  entries: { label: string; value: number }[];
}

export interface LineChartData {
  kind: "line";
  title: string;
  xlabel: string;
  ylabel: string;
  points: { x: string; y: number }[];
  trend: { slope: number; intercept: number } | null;
}

export interface ScatterChartData {
  kind: "scatter";
  title: string;
  xlabel: string;
  ylabel: string;
  points: { x: number; y: number }[];
  r: number;
  trend: { slope: number; intercept: number } | null;
}

export interface HistogramChartData {
  kind: "histogram";
  title: string;
  xlabel: string;
  bins: { x0: number; x1: number; count: number }[];
  mean: number;
  stdev: number;
}

export interface DoseResponseChartData {
  kind: "doseResponse";
  title: string;
  xlabel: string;
  entries: { label: string; value: number }[];
  peakValue: number;
}

export interface BoxChartData {
  kind: "box";
  title: string;
  ylabel: string;
  q1: number;
  median: number;
  q3: number;
  whiskerLo: number;
  whiskerHi: number;
  outliers: number[];
  mostExtreme: number | null;
}

export type ChartData =
  | BarChartData
  | LineChartData
  | ScatterChartData
  | HistogramChartData
  | DoseResponseChartData
  | BoxChartData;
