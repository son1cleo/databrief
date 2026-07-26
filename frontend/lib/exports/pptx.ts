import "server-only";
import PptxGenJS from "pptxgenjs";
import type { Finding } from "@/lib/analysis";
import type { PptxExportData } from "./types";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

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
    slide.addText(text, {
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

  titleSlide(hook: string): void {
    const slide = this.newSlide();
    this.addText(slide, hook, { x: 1, y: 2.6, w: 11.3, h: 2.5, size: 40, bold: true, font: this.fontHeading });
    this.addText(slide, "A DataBrief Story", { x: 1, y: 5.4, w: 6, h: 0.5, size: 14, color: this.accent });
  }

  aboutDataSlide(context: string): void {
    const slide = this.newSlide();
    this.addText(slide, "About This Data", { x: 1, y: 0.7, w: 10, h: 0.8, size: 28, bold: true, color: this.accent, font: this.fontHeading });
    this.addText(slide, context, { x: 1, y: 2, w: 11, h: 3, size: 18 });
  }

  findingSlide(index: number, finding: Finding): void {
    const slide = this.newSlide();
    this.addText(slide, `Finding ${index}`, { x: 1, y: 0.6, w: 6, h: 0.6, size: 14, color: this.accent });
    this.addText(slide, finding.description, { x: 1, y: 1.4, w: 7, h: 3, size: 22, bold: true, font: this.fontHeading });
    if (finding.value !== null && finding.value !== undefined) {
      const text = typeof finding.value === "number" ? finding.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(finding.value);
      this.addText(slide, text, { x: 8.5, y: 2.2, w: 3.5, h: 1.5, size: 48, bold: true, color: this.accent, align: "center" });
    }
  }

  statementSlide(eyebrow: string, statement: string, big = false): void {
    const slide = this.newSlide();
    this.addText(slide, eyebrow, { x: 1, y: 0.7, w: 10, h: 0.6, size: 14, color: this.accent });
    this.addText(slide, statement, {
      x: 1,
      y: 2.4,
      w: 11.3,
      h: 3,
      size: big ? 44 : 24,
      bold: big,
      font: this.fontHeading,
      align: big ? "center" : "left",
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

export async function buildPptx({ storyArc, theme, brand }: PptxExportData): Promise<Buffer> {
  const themeKey = theme && THEMES[theme] ? theme : "boardroom";
  const resolvedTheme = THEMES[themeKey];

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "DATABRIEF", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "DATABRIEF";

  const builder = new SlideBuilder(pptx, resolvedTheme, brand);

  builder.titleSlide(storyArc.hook || "Your Data Story");
  builder.aboutDataSlide(storyArc.context || "");

  const findings = storyArc.findings || [];
  findings.slice(0, 5).forEach((finding, i) => builder.findingSlide(i + 1, finding));

  if (storyArc.climax) {
    builder.statementSlide("THE MAIN INSIGHT", storyArc.climax.description, true);
  }
  if (storyArc.implication) builder.statementSlide("WHAT THIS MEANS", storyArc.implication);
  if (storyArc.action) builder.statementSlide("WHAT TO DO NEXT", storyArc.action);
  if (storyArc.open_question) builder.statementSlide("THE QUESTION TO INVESTIGATE", storyArc.open_question);

  if (findings.length > 0) builder.appendixSlide(findings);

  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(out as Uint8Array);
}
