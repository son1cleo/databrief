import "server-only";
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } from "docx";
import { chartDataUri, type NarrationExportData } from "./types";

/** Reads width/height straight out of the PNG header (bytes 16-23, right
 * after the 8-byte signature + 4-byte chunk length + "IHDR") so embedded
 * chart images keep their aspect ratio without needing an image library. */
function pngDimensions(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
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

export async function buildWordDocument({ blocks, findings }: NarrationExportData): Promise<Buffer> {
  const children: Paragraph[] = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      children.push(
        new Paragraph({ text: block.text, heading: block.level === 1 ? HeadingLevel.TITLE : HeadingLevel.HEADING_2 })
      );
    } else if (block.type === "paragraph") {
      if (block.text.trim()) children.push(new Paragraph({ children: [new TextRun(block.text)] }));
    } else if (block.type === "list") {
      for (const item of block.items) {
        children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
      }
    } else {
      const uri = chartDataUri(findings, block.findingRef);
      if (uri) children.push(chartImageParagraph(uri));
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } }, // 22 half-points = 11pt
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
