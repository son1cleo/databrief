import type { Finding } from "@/lib/analysis";
import type { StoryBlock } from "@/lib/llm/schemas";
import type { StoryArc } from "@/lib/story";

export interface ExportBrand {
  isBranded: boolean;
  primaryColor?: string | null;
  logoUrl?: string | null;
  font?: string | null;
}

export interface NarrationExportData {
  title: string;
  blocks: StoryBlock[];
  findings: Finding[];
  brand: ExportBrand;
}

export interface PptxExportData {
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
