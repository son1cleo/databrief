import "server-only";
import PptxGenJS from "pptxgenjs";
import type { Finding } from "@/lib/analysis";
import type { Chapter, ChapterId } from "@/lib/llm/schemas";
import { chartBase64, pngDimensions, type PptxExportData } from "./types";
import { parseInlineMarkdown } from "@/lib/markdown";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

// pptxgenjs's `data` field wants "image/png;base64,..." -- NOT the standard
// web `data:image/png;base64,...` URI scheme chartDataUri() produces for
// react-pdf/docx (see lib/exports/types.ts DataOrPathProps docs).
function pptxImageData(b64: string): string {
  return `image/png;base64,${b64}`;
}

/** Narrated text is light Markdown, and pptxgenjs styles text per run -- so
 * each mark becomes its own run rather than printing literal asterisks on a
 * slide. Options are only set when a mark is actually present, since a key
 * explicitly set to undefined would shadow the slide-level defaults these
 * runs are rendered with. Line breaks must be explicit runs (pptxgenjs
 * ignores "\n" inside a run). */
function pptxRuns(text: string): PptxGenJS.TextProps[] {
  const lines = text.split("\n");
  const runs: PptxGenJS.TextProps[] = [];

  lines.forEach((line, lineIndex) => {
    const isLastLine = lineIndex === lines.length - 1;
    const tokens = parseInlineMarkdown(line);
    if (tokens.length === 0) {
      runs.push({ text: "", options: isLastLine ? {} : { breakLine: true } });
      return;
    }
    tokens.forEach((token, i) => {
      const options: PptxGenJS.TextPropsOptions = {};
      if (token.bold) options.bold = true;
      if (token.italic) options.italic = true;
      if (token.strike) options.strike = "sngStrike";
      if (token.code) options.fontFace = "Consolas";
      if (token.href) options.hyperlink = { url: token.href };
      if (!isLastLine && i === tokens.length - 1) options.breakLine = true;
      runs.push({ text: token.text, options });
    });
  });

  return runs;
}

/** Fits an image into a bounding box without distorting its aspect ratio
 * (contain-fit), centered within the box. */
function containFit(
  imgW: number,
  imgH: number,
  box: { x: number; y: number; w: number; h: number }
): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(box.w / imgW, box.h / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

function chapterEyebrow(id: ChapterId): string {
  switch (id) {
    case "macro_trend":
      return "CHAPTER I — THE MACRO TREND";
    case "anomalies":
      return "CHAPTER II — ANOMALIES & OUTLIERS";
    case "correlated_drivers":
      return "CHAPTER III — CORRELATED DRIVERS";
  }
}

interface Theme {
  key: string;
  background: string;
  accent: string;
  fontHeading: string;
  fontBody: string;
}

const THEMES: Record<string, Theme> = {
  boardroom: { key: "boardroom", background: "#0a0f1e", accent: "#2563eb", fontHeading: "Arial", fontBody: "Arial" },
  consulting: { key: "consulting", background: "#ffffff", accent: "#1a1a2e", fontHeading: "Calibri", fontBody: "Calibri" },
  startup: { key: "startup", background: "#0a0a0a", accent: "#f97316", fontHeading: "Calibri", fontBody: "Calibri" },
  editorial: { key: "editorial", background: "#fafaf8", accent: "#7c3aed", fontHeading: "Georgia", fontBody: "Georgia" },
  academic: { key: "academic", background: "#ffffff", accent: "#374151", fontHeading: "Times New Roman", fontBody: "Times New Roman" },
};

function stripHash(hex: string): string {
  return hex.replace(/^#/, "");
}

function textColorForBg(hex: string): string {
  const h = stripHash(hex);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "111111" : "FFFFFF";
}

interface AddTextOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  bold?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
  font?: string;
}

class SlideBuilder {
  private accent: string;
  private fontHeading: string;
  private textColor: string;

  constructor(
    private pptx: PptxGenJS,
    private theme: Theme,
    private brand: PptxExportData["brand"]
  ) {
    this.accent = brand.isBranded && brand.primaryColor ? stripHash(brand.primaryColor) : stripHash(theme.accent);
    this.fontHeading = (brand.isBranded && brand.font) || theme.fontHeading;
    this.textColor = textColorForBg(theme.background);
  }

  private newSlide(): PptxGenJS.Slide {
    const slide = this.pptx.addSlide();
    slide.background = { color: stripHash(this.theme.background) };
    if (this.brand.isBranded && this.brand.logoUrl) {
      // Real logo bytes aren't fetched here (brand_logo_url is a remote URL)
      // — reserve the corner with the brand name as a stand-in, same as the
      // Python original.
      slide.addText("BRANDED", {
        x: SLIDE_W - 2.2,
        y: 0.2,
        w: 2,
        h: 0.4,
        fontSize: 9,
        color: this.accent,
      });
    }
    return slide;
  }

  private addText(slide: PptxGenJS.Slide, text: string, opts: AddTextOpts): void {
    slide.addText(pptxRuns(text), {
      x: opts.x,
      y: opts.y,
      w: opts.w,
      h: opts.h,
      fontSize: opts.size,
      bold: opts.bold ?? false,
      fontFace: opts.font ?? this.theme.fontBody,
      color: opts.color ?? this.textColor,
      align: opts.align ?? "left",
      wrap: true,
    });
  }

  /** Embeds a chart image contain-fit within `box`, preserving its native
   * aspect ratio (charts.ts produces different aspect ratios per chart
   * type) rather than stretching it to fill the slot. */
  private addChartImage(slide: PptxGenJS.Slide, b64: string, box: { x: number; y: number; w: number; h: number }): void {
    const buffer = Buffer.from(b64, "base64");
    const { width, height } = pngDimensions(buffer);
    const fitted = width > 0 && height > 0 ? containFit(width, height, box) : box;
    slide.addImage({ data: pptxImageData(b64), x: fitted.x, y: fitted.y, w: fitted.w, h: fitted.h });
  }

  titleSlide(headline: string): void {
    const slide = this.newSlide();
    this.addText(slide, headline, { x: 1, y: 2.6, w: 11.3, h: 2.5, size: 40, bold: true, font: this.fontHeading });
    this.addText(slide, "A DataBrief Story", { x: 1, y: 5.4, w: 6, h: 0.5, size: 14, color: this.accent });
  }

  aboutDataSlide(datasetLabel: string, context: string, dataConfidence: number | null): void {
    const slide = this.newSlide();
    this.addText(slide, "About This Data", { x: 1, y: 0.7, w: 10, h: 0.8, size: 28, bold: true, color: this.accent, font: this.fontHeading });
    this.addText(slide, datasetLabel, { x: 1, y: 1.6, w: 11, h: 0.5, size: 13, color: this.accent });
    this.addText(slide, context, { x: 1, y: 2.3, w: 11, h: 2.2, size: 18 });
    if (dataConfidence !== null) {
      this.addText(slide, `Data Confidence: ${dataConfidence}%`, { x: 1, y: 4.8, w: 6, h: 0.5, size: 14, bold: true, color: this.accent });
    }
  }

  focusQuestionSlide(question: string, answer: string): void {
    const slide = this.newSlide();
    this.addText(slide, "FOCUS QUESTION", { x: 1, y: 0.7, w: 10, h: 0.5, size: 14, color: this.accent });
    this.addText(slide, question, { x: 1, y: 1.3, w: 11.3, h: 1.2, size: 24, bold: true, font: this.fontHeading });
    this.addText(slide, answer, { x: 1, y: 2.8, w: 11.3, h: 3.7, size: 16 });
  }

  /** One slide per chapter -- the chapter's paragraph/list content collapses
   * into a text digest (a slide can't hold full report prose), shown
   * alongside the first chart the chapter references, if any. */
  chapterSlide(chapter: Chapter, findings: Finding[]): void {
    const slide = this.newSlide();
    this.addText(slide, chapterEyebrow(chapter.id), { x: 1, y: 0.5, w: 10, h: 0.5, size: 12, color: this.accent });
    this.addText(slide, chapter.title, { x: 1, y: 0.95, w: 11.3, h: 0.8, size: 24, bold: true, font: this.fontHeading });

    const textLines: string[] = [];
    let chart: string | null = null;
    for (const b of chapter.blocks) {
      if (b.type === "paragraph" && b.text.trim()) textLines.push(b.text);
      else if (b.type === "list") textLines.push(...b.items.map((item) => `• ${item}`));
      else if (b.type === "chart" && !chart) {
        const referenced = findings[b.findingRef];
        if (referenced) chart = chartBase64(referenced);
      }
    }
    const bodyText = textLines.slice(0, 4).join("\n\n");

    if (chart) {
      this.addText(slide, bodyText, { x: 1, y: 1.9, w: 5.6, h: 4.7, size: 14 });
      this.addChartImage(slide, chart, { x: 6.9, y: 1.9, w: 5.4, h: 4.7 });
    } else {
      this.addText(slide, bodyText, { x: 1, y: 1.9, w: 11.3, h: 4.7, size: 16 });
    }
  }

  /** Like a normal statement slide, but for the climax finding specifically
   * -- embeds its chart (if one rendered) below the headline statement,
   * since this is the single most visually important slide in the deck. */
  climaxSlide(eyebrow: string, finding: Finding): void {
    const slide = this.newSlide();
    this.addText(slide, eyebrow, { x: 1, y: 0.6, w: 10, h: 0.6, size: 14, color: this.accent });

    const chart = chartBase64(finding);
    if (chart) {
      this.addText(slide, finding.description, {
        x: 1,
        y: 1.2,
        w: 11.3,
        h: 1.1,
        size: 26,
        bold: true,
        font: this.fontHeading,
        align: "center",
      });
      this.addChartImage(slide, chart, { x: 1, y: 2.4, w: 11.3, h: 4.5 });
    } else {
      this.addText(slide, finding.description, {
        x: 1,
        y: 2.4,
        w: 11.3,
        h: 3,
        size: 44,
        bold: true,
        font: this.fontHeading,
        align: "center",
      });
    }
  }

  actionsSlide(implication: string, actions: string[]): void {
    const slide = this.newSlide();
    this.addText(slide, "STRATEGIC ACTIONS", { x: 1, y: 0.6, w: 10, h: 0.6, size: 14, color: this.accent });
    let y = 1.3;
    if (implication) {
      this.addText(slide, implication, { x: 1, y, w: 11.3, h: 1.2, size: 16 });
      y += 1.5;
    }
    actions.forEach((action, i) => {
      this.addText(slide, `${i + 1}`, { x: 1, y, w: 0.6, h: 0.6, size: 28, bold: true, color: this.accent });
      this.addText(slide, action, { x: 1.8, y, w: 10.5, h: 1.2, size: 16 });
      y += 1.4;
    });
  }

  appendixSlide(findings: Finding[]): void {
    const slide = this.newSlide();
    this.addText(slide, "Appendix — Raw Stats", { x: 1, y: 0.6, w: 10, h: 0.6, size: 24, bold: true, color: this.accent, font: this.fontHeading });
    let y = 1.5;
    for (const f of findings) {
      this.addText(slide, `[${f.type}] ${f.description}`, { x: 1, y, w: 11, h: 0.5, size: 12 });
      y += 0.5;
    }
  }
}

export async function buildPptx({ metadata, narration, storyArc, theme, brand }: PptxExportData): Promise<Buffer> {
  const themeKey = theme && THEMES[theme] ? theme : "boardroom";
  const resolvedTheme = THEMES[themeKey];

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "DATABRIEF", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "DATABRIEF";

  const builder = new SlideBuilder(pptx, resolvedTheme, brand);
  const findings = storyArc.findings || [];

  builder.titleSlide(narration.headline || storyArc.hook || "Your Data Story");
  builder.aboutDataSlide(metadata.datasetLabel, storyArc.context || "", metadata.dataConfidence);

  if (metadata.question && narration.focusQuestionCallout) {
    builder.focusQuestionSlide(metadata.question, narration.focusQuestionCallout);
  }

  for (const chapter of narration.chapters) {
    if (chapter.blocks.length > 0) builder.chapterSlide(chapter, findings);
  }

  if (storyArc.climax) {
    builder.climaxSlide("THE MAIN INSIGHT", storyArc.climax);
  }

  if (narration.implication || narration.actions.length > 0) {
    builder.actionsSlide(narration.implication, narration.actions);
  }

  // findings is the full ranked list (the LLM picks the climax from all of
  // it), not just a pre-capped top 5 -- cap the appendix slide separately so
  // it doesn't overflow with dozens of rows.
  if (findings.length > 0) builder.appendixSlide(findings.slice(0, 15));

  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(out as Uint8Array);
}
