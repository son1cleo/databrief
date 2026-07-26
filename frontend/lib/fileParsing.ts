import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import { getDocumentProxy, extractText } from "unpdf";
import { recognize } from "tesseract.js";

const STRUCTURED_EXTENSIONS: Record<string, string> = { ".csv": "csv", ".xlsx": "excel", ".xls": "excel" };
const SEMI_STRUCTURED_EXTENSIONS: Record<string, string> = { ".xml": "xml", ".json": "json" };
const UNSTRUCTURED_EXTENSIONS: Record<string, string> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
};
const ALL_EXTENSIONS: Record<string, string> = {
  ...STRUCTURED_EXTENSIONS,
  ...SEMI_STRUCTURED_EXTENSIONS,
  ...UNSTRUCTURED_EXTENSIONS,
};

const DATAFRAME_FILE_TYPES = new Set(["csv", "excel", "json", "xml"]);
const TEXT_FILE_TYPES = new Set(["txt", "pdf", "docx", "image"]);

export class UnsupportedFileTypeError extends Error {}

function extOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

export function detectFileType(filename: string): string {
  const fileType = ALL_EXTENSIONS[extOf(filename)];
  if (!fileType) throw new UnsupportedFileTypeError(`Unsupported file extension: ${extOf(filename)}`);
  return fileType;
}

export function detectDataType(fileType: string): string {
  if (fileType === "csv" || fileType === "excel") return "structured";
  if (fileType === "xml" || fileType === "json") return "semi_structured";
  return "unstructured";
}

export interface TabularData {
  columns: string[];
  rows: Record<string, unknown>[];
}

function readCsv(buffer: Buffer): TabularData {
  const result = Papa.parse<Record<string, unknown>>(buffer.toString("utf-8"), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return { columns: result.meta.fields ?? [], rows: result.data };
}

function readExcel(buffer: Buffer): TabularData {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : headerRow.map(String);
  return { columns, rows };
}

function readJson(buffer: Buffer): TabularData {
  const data = JSON.parse(buffer.toString("utf-8"));
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [data];
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r ?? {}))));
  return { columns, rows };
}

function readXml(buffer: Buffer): TabularData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    parseAttributeValue: true,
    ignoreDeclaration: true,
    ignorePiTags: true,
  });
  const parsed = parser.parse(buffer.toString("utf-8"));
  const root = parsed[Object.keys(parsed)[0]] ?? {};
  // Mirrors pandas.read_xml's common case: rows are the first repeated
  // (array-valued) element found under the document root.
  const arrayField = Object.values(root).find((v) => Array.isArray(v));
  const rowsRaw = arrayField ?? (Array.isArray(root) ? root : [root]);
  const rows = (Array.isArray(rowsRaw) ? rowsRaw : [rowsRaw]).map((r) =>
    typeof r === "object" && r !== null ? (r as Record<string, unknown>) : { value: r }
  );
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return { columns, rows };
}

export function parseTabular(buffer: Buffer, fileType: string): TabularData {
  if (fileType === "csv") return readCsv(buffer);
  if (fileType === "excel") return readExcel(buffer);
  if (fileType === "json") return readJson(buffer);
  if (fileType === "xml") return readXml(buffer);
  throw new UnsupportedFileTypeError(`${fileType} is not a tabular file type`);
}

async function readPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function readDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function readImageText(buffer: Buffer): Promise<string> {
  try {
    const { data } = await recognize(buffer, "eng");
    return data.text;
  } catch {
    // OCR is best-effort — a slow/unavailable language-data fetch shouldn't
    // fail the whole upload, matching the old pytesseract fallback.
    return "";
  }
}

export async function parseText(buffer: Buffer, fileType: string): Promise<string> {
  if (fileType === "txt") return buffer.toString("utf-8");
  if (fileType === "pdf") return readPdfText(buffer);
  if (fileType === "docx") return readDocxText(buffer);
  if (fileType === "image") return readImageText(buffer);
  throw new UnsupportedFileTypeError(`${fileType} is not a text-extractable file type`);
}

export interface ParsedPreview {
  columns: string[];
  rows: Record<string, string>[];
  textPreview: string | null;
  rowCount: number | null;
  columnCount: number | null;
}

function stringifyRow(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? "" : String(v)]));
}

/** Drops everything after the last newline, so a byte-range read that stopped
 * mid-record doesn't hand Papa.parse a half-written final line. */
function trimToLastNewline(buffer: Buffer): Buffer {
  const idx = buffer.lastIndexOf("\n");
  return idx === -1 ? buffer : buffer.subarray(0, idx);
}

export interface ParsePreviewOptions {
  /** True when `buffer` is only the head of a larger file (a Range read).
   * Only meaningful for line-oriented formats -- the total row count can't be
   * known from a partial read, so it comes back null rather than reporting
   * the sampled count as if it were the whole file. */
  truncated?: boolean;
}

export async function parsePreview(
  buffer: Buffer,
  fileType: string,
  options: ParsePreviewOptions = {}
): Promise<ParsedPreview> {
  if (DATAFRAME_FILE_TYPES.has(fileType)) {
    const { columns, rows } = parseTabular(options.truncated ? trimToLastNewline(buffer) : buffer, fileType);
    return {
      columns,
      rows: rows.slice(0, 10).map(stringifyRow),
      textPreview: null,
      rowCount: options.truncated ? null : rows.length,
      columnCount: columns.length,
    };
  }
  if (TEXT_FILE_TYPES.has(fileType)) {
    const text = await parseText(buffer, fileType);
    return { columns: [], rows: [], textPreview: text.slice(0, 500), rowCount: null, columnCount: null };
  }
  throw new UnsupportedFileTypeError(`No parser for file type: ${fileType}`);
}
