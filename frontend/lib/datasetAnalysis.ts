import "server-only";
import { parseUploadTabular, parseUploadText } from "@/lib/inngest/pipeline";
import { analyze, numericColumns, datetimeColumns, mean, sampleStd, type Row, type Finding } from "@/lib/analysis";
import { chartForFinding } from "@/lib/charts";
import type { Upload } from "@/lib/generated/prisma/client";

type UploadFileRef = Pick<Upload, "storagePath" | "fileType" | "dataType">;

export interface ColumnSummary {
  name: string;
  kind: "numeric" | "datetime" | "categorical";
  missingPct: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
  distinctCount?: number;
  topValue?: string;
}

export interface FindingWithChart {
  finding: Finding;
  chart: string | null;
}

export interface StructuredInsights {
  kind: "structured";
  rowCount: number;
  columnCount: number;
  columns: ColumnSummary[];
  findingsByType: Record<string, FindingWithChart[]>;
  dataQuality: Finding | null;
  preview: { columns: string[]; rows: Row[] };
}

export interface TextInsights {
  kind: "text";
  charCount: number;
  wordCount: number;
  preview: string;
}

export type DatasetInsights = StructuredInsights | TextInsights;

// Findings are sorted by magnitude and capped per type — a wide dataset can
// produce dozens of correlation pairs alone, and rendering a canvas chart for
// every one of them would make the page slow for no added insight.
const MAX_FINDINGS_PER_TYPE = 6;
const PREVIEW_ROWS = 15;
const TEXT_PREVIEW_CHARS = 4000;

function isMissing(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function buildColumnSummaries(rows: Row[], columns: string[]): ColumnSummary[] {
  const numericSet = new Set(numericColumns(rows, columns));
  const dateSet = new Set(datetimeColumns(rows, columns, [...numericSet]));

  return columns.map((name) => {
    const values = rows.map((r) => r[name]);
    const missingCount = values.filter(isMissing).length;
    const missingPct = rows.length ? missingCount / rows.length : 0;

    if (numericSet.has(name)) {
      const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      return {
        name,
        kind: "numeric" as const,
        missingPct,
        mean: nums.length ? mean(nums) : undefined,
        std: nums.length > 1 ? sampleStd(nums) : undefined,
        min: nums.length ? Math.min(...nums) : undefined,
        max: nums.length ? Math.max(...nums) : undefined,
      };
    }

    if (dateSet.has(name)) {
      const times = values
        .filter((v) => !isMissing(v))
        .map((v) => Date.parse(String(v)))
        .filter((t) => !Number.isNaN(t));
      return {
        name,
        kind: "datetime" as const,
        missingPct,
        minDate: times.length ? new Date(Math.min(...times)).toISOString().slice(0, 10) : undefined,
        maxDate: times.length ? new Date(Math.max(...times)).toISOString().slice(0, 10) : undefined,
      };
    }

    const counts = new Map<string, number>();
    for (const v of values) {
      if (isMissing(v)) continue;
      const key = String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let topValue: string | undefined;
    let topCount = 0;
    for (const [value, count] of counts) {
      if (count > topCount) {
        topValue = value;
        topCount = count;
      }
    }
    return { name, kind: "categorical" as const, missingPct, distinctCount: counts.size, topValue };
  });
}

export async function buildDatasetInsights(upload: UploadFileRef): Promise<DatasetInsights> {
  if (upload.dataType === "unstructured") {
    const text = await parseUploadText(upload);
    const trimmed = text.trim();
    return {
      kind: "text",
      charCount: text.length,
      wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
      preview: text.slice(0, TEXT_PREVIEW_CHARS),
    };
  }

  const { columns, rows: rawRows } = await parseUploadTabular(upload);
  const rows = rawRows as Row[];
  const findings = analyze(rows, columns);

  let dataQuality: Finding | null = null;
  const grouped: Record<string, Finding[]> = {};
  for (const finding of findings) {
    if (finding.type === "data_quality") {
      dataQuality = finding;
      continue;
    }
    // Descriptive stats (mean/std/min/max) are already surfaced in the
    // column summary table, so skip them here to avoid showing them twice.
    if (finding.type === "descriptive") continue;
    (grouped[finding.type] ??= []).push(finding);
  }

  const findingsByType: Record<string, FindingWithChart[]> = {};
  for (const [type, list] of Object.entries(grouped)) {
    const top = [...list].sort((a, b) => b.magnitude - a.magnitude).slice(0, MAX_FINDINGS_PER_TYPE);
    findingsByType[type] = top.map((finding) => ({ finding, chart: chartForFinding(finding, rows) }));
  }

  return {
    kind: "structured",
    rowCount: rows.length,
    columnCount: columns.length,
    columns: buildColumnSummaries(rows, columns),
    findingsByType,
    dataQuality,
    preview: { columns, rows: rows.slice(0, PREVIEW_ROWS) },
  };
}
