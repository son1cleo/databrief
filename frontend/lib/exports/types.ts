import type { Finding } from "@/lib/analysis";
import type { StoryNarrationResult } from "@/lib/llm/schemas";
import type { StoryArc } from "@/lib/story";

export interface ExportBrand {
  isBranded: boolean;
  primaryColor?: string | null;
  logoUrl?: string | null;
  font?: string | null;
}

// Header/metadata every export format renders before the chapters --
// dataset identifier, confidence score, and (if a question was asked) the
// focus-question callout. `title` is used only for invisible document
// metadata (PDF <Document title>, the DB Report.title field) -- NOT
// rendered as visible text, since it's a truncated copy of the headline and
// showing both was the "headline/hook duplicated 3x" bug. `datasetLabel` is
// the actual visible identifier line (filename + row/column count).
export interface ReportMetadata {
  title: string;
  datasetLabel: string;
  dataConfidence: number | null;
  question: string | null;
}

/** Builds the visible "Dataset Identifier" line -- filename plus row/column
 * count when available -- deliberately independent of the narrated
 * headline/hook so the header never echoes them. */
export function buildDatasetLabel(
  filename: string,
  rowCount: number | null,
  columnCount: number | null
): string {
  const parts = [filename];
  if (rowCount !== null && columnCount !== null) {
    parts.push(`${rowCount.toLocaleString("en-US")} rows × ${columnCount} columns`);
  }
  return parts.join(" • ");
}

export interface NarrationExportData {
  metadata: ReportMetadata;
  narration: StoryNarrationResult;
  findings: Finding[];
  brand: ExportBrand;
}

export interface PptxExportData {
  metadata: ReportMetadata;
  narration: StoryNarrationResult;
  storyArc: StoryArc;
  theme?: string | null;
  brand: ExportBrand;
}

export const DEFAULT_ACCENT = "#2563eb";

export function accentFor(brand: ExportBrand): string {
  return brand.isBranded && brand.primaryColor ? brand.primaryColor : DEFAULT_ACCENT;
}

export function chartDataUri(findings: Finding[], findingRef: number): string | null {
  const b64 = findings[findingRef]?.extra?.chart_b64;
  return typeof b64 === "string" && b64.length > 0 ? `data:image/png;base64,${b64}` : null;
}

export function chartBase64(finding: Finding): string | null {
  const b64 = finding.extra?.chart_b64;
  return typeof b64 === "string" && b64.length > 0 ? b64 : null;
}

/** Reads width/height straight out of the PNG header (bytes 16-23, right
 * after the 8-byte signature + 4-byte chunk length + "IHDR") so embedded
 * chart images keep their aspect ratio without needing an image library. */
export function pngDimensions(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
