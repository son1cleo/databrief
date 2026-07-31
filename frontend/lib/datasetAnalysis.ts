import "server-only";
import { parseUploadTabular, parseUploadText } from "@/lib/inngest/pipeline";
import { analyze, buildColumnSummaries, type Row, type Finding, type ColumnSummary } from "@/lib/analysis";
import { chartForFinding } from "@/lib/charts";
import type { Upload } from "@/lib/generated/prisma/client";

type UploadFileRef = Pick<Upload, "storagePath" | "fileType" | "dataType">;

export type { ColumnSummary } from "@/lib/analysis";

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
