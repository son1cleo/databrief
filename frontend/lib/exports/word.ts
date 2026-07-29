import "server-only";
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, ShadingType, BorderStyle } from "docx";
import { chartDataUri, pngDimensions, type NarrationExportData } from "./types";
import type { StoryBlock } from "@/lib/llm/schemas";
import { parseInlineMarkdown } from "@/lib/markdown";

/** Narrated text is light Markdown -- split it into docx runs so emphasis
 * renders as formatting instead of literal asterisks. `base` carries the
 * paragraph-level styling each run inherits. */
function runs(text: string, base: { italics?: boolean; bold?: boolean; color?: string; size?: number } = {}): TextRun[] {
  return parseInlineMarkdown(text).map(
    (token) =>
      new TextRun({
        text: token.text,
        bold: token.bold || base.bold,
        italics: token.italic || base.italics,
        strike: token.strike,
        font: token.code ? "Consolas" : undefined,
        color: token.href ? "2563EB" : base.color,
        underline: token.href ? {} : undefined,
        size: base.size,
      })
  );
}

function chartImageParagraph(dataUri: string): Paragraph {
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  const buffer = Buffer.from(base64, "base64");
  const { width, height } = pngDimensions(buffer);
  const displayWidth = 460;
  const displayHeight = width > 0 ? Math.round(displayWidth * (height / width)) : displayWidth;

  return new Paragraph({
    children: [
      new ImageRun({
        type: "png",
        data: buffer,
        transformation: { width: displayWidth, height: displayHeight },
      }),
    ],
  });
}

function blockParagraphs(blocks: StoryBlock[], findings: NarrationExportData["findings"]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  for (const block of blocks) {
    if (block.type === "heading") {
      paragraphs.push(
        new Paragraph({
          children: runs(block.text),
          heading: block.level === 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        })
      );
    } else if (block.type === "paragraph") {
      if (block.text.trim()) paragraphs.push(new Paragraph({ children: runs(block.text) }));
    } else if (block.type === "list") {
      for (const item of block.items) {
        paragraphs.push(new Paragraph({ children: runs(item), bullet: { level: 0 } }));
      }
    } else {
      const uri = chartDataUri(findings, block.findingRef);
      if (uri) paragraphs.push(chartImageParagraph(uri));
    }
  }
  return paragraphs;
}

const CALLOUT_SHADING = { type: ShadingType.SOLID, color: "auto", fill: "F9FAFB" };
const CALLOUT_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "2563EB" };

export async function buildWordDocument({ metadata, narration, findings }: NarrationExportData): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(new Paragraph({ children: [new TextRun({ text: "Executive Data Brief", bold: true, size: 18, color: "6B7280" })] }));
  const metaRun =
    metadata.dataConfidence !== null
      ? `${metadata.datasetLabel}  •  Data Confidence: ${metadata.dataConfidence}%`
      : metadata.datasetLabel;
  children.push(new Paragraph({ children: [new TextRun({ text: metaRun, size: 18, color: "6B7280" })], spacing: { after: 200 } }));

  children.push(new Paragraph({ children: runs(narration.headline), heading: HeadingLevel.TITLE }));
  children.push(new Paragraph({ children: runs(narration.hook, { italics: true }), spacing: { after: 200 } }));

  if (metadata.question && narration.focusQuestionCallout) {
    children.push(
      new Paragraph({
        shading: CALLOUT_SHADING,
        border: { left: CALLOUT_BORDER },
        children: [new TextRun({ text: `Focus Question: ${metadata.question}`, bold: true })],
      })
    );
    children.push(
      new Paragraph({
        shading: CALLOUT_SHADING,
        border: { left: CALLOUT_BORDER },
        children: runs(narration.focusQuestionCallout),
        spacing: { after: 200 },
      })
    );
  }

  for (const chapter of narration.chapters) {
    if (chapter.blocks.length === 0) continue;
    children.push(new Paragraph({ children: runs(chapter.title), heading: HeadingLevel.HEADING_1 }));
    children.push(...blockParagraphs(chapter.blocks, findings));
  }

  if (narration.implication || narration.actions.length > 0) {
    children.push(new Paragraph({ text: "Strategic Actions", heading: HeadingLevel.HEADING_1 }));
    if (narration.implication) {
      children.push(new Paragraph({ children: runs(narration.implication), spacing: { after: 120 } }));
    }
    narration.actions.forEach((action, i) => {
      children.push(
        new Paragraph({
          shading: CALLOUT_SHADING,
          children: [new TextRun({ text: `${i + 1}. `, bold: true }), ...runs(action)],
          spacing: { after: 80 },
        })
      );
    });
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } }, // 22 half-points = 11pt
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
