/** Minimal Markdown support for LLM-written report prose.
 *
 * The narrator writes light Markdown inside otherwise plain-text fields
 * (bolded key figures, backticked column names, the occasional bullet list),
 * and the exact same strings feed four renderers -- the web viewer, react-pdf,
 * docx and pptxgenjs. None of them understand Markdown, so without a parser
 * the reader sees literal `**` in every format.
 *
 * Deliberately dependency-free and inline-first rather than react-markdown:
 * a React-only renderer can't be reused by the PDF/DOCX/PPTX exporters, which
 * is exactly where raw asterisks are most damaging. Both layers below emit a
 * neutral token/block tree that each renderer styles in its own primitives.
 */

export interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  /** Link target, already narrowed to a safe scheme. */
  href?: string;
}

type Marks = Omit<InlineToken, "text">;

// Alternation order matters: longer delimiters must be tried first, or
// `***a***` parses as a strong span wrapping a stray asterisk.
const INLINE_RE =
  /`([^`\n]+)`|(\*\*\*|___)(?=\S)([\s\S]*?\S)\2|(\*\*|__)(?=\S)([\s\S]*?\S)\4|([*_])(?=\S)([\s\S]*?\S)\6|~~(?=\S)([\s\S]*?\S)~~|\[([^\]\n]*)\]\(\s*([^)\s]+)\s*\)/;

const WORD_CHAR = /[\p{L}\p{N}]/u;
const SAFE_HREF = /^(https?:\/\/|mailto:|\/|#)/i;
/** Guards against pathological nesting like `***_~~a~~_***` recursing forever. */
const MAX_DEPTH = 6;

function unescape(text: string): string {
  return text.replace(/\\([\\`*_~[\]()>#+\-.!])/g, "$1");
}

/** Underscore emphasis must not fire inside a word -- raw column names reach
 * the narrator as snake_case, so `skill_retention_score` would otherwise
 * render as "skillretentionscore" with a stray italic run in the middle. */
function isIntraword(text: string, start: number, end: number): boolean {
  return WORD_CHAR.test(text[start - 1] ?? "") || WORD_CHAR.test(text[end] ?? "");
}

function sameMarks(a: Marks, b: Marks): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.code === b.code && a.strike === b.strike && a.href === b.href;
}

function pushText(tokens: InlineToken[], text: string, marks: Marks): void {
  if (!text) return;
  const last = tokens[tokens.length - 1];
  if (last && sameMarks(last, marks)) last.text += text;
  else tokens.push({ text, ...marks });
}

function parse(text: string, marks: Marks, depth: number): InlineToken[] {
  const tokens: InlineToken[] = [];
  if (!text) return tokens;
  if (depth >= MAX_DEPTH) {
    pushText(tokens, unescape(text), marks);
    return tokens;
  }

  const re = new RegExp(INLINE_RE.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const end = match.index + match[0].length;
    const escaped = text[match.index - 1] === "\\";
    const underscore = match[2] === "___" || match[4] === "__" || match[6] === "_";
    if (escaped || (underscore && isIntraword(text, match.index, end))) {
      // Not a real delimiter here -- resume scanning one character in so a
      // later, valid pair in the same run still matches.
      re.lastIndex = match.index + 1;
      continue;
    }

    pushText(tokens, unescape(text.slice(cursor, match.index)), marks);

    if (match[1] !== undefined) {
      // Code spans are literal: no nested marks, no escape processing.
      pushText(tokens, match[1], { ...marks, code: true });
    } else if (match[3] !== undefined) {
      tokens.push(...parse(match[3], { ...marks, bold: true, italic: true }, depth + 1));
    } else if (match[5] !== undefined) {
      tokens.push(...parse(match[5], { ...marks, bold: true }, depth + 1));
    } else if (match[7] !== undefined) {
      tokens.push(...parse(match[7], { ...marks, italic: true }, depth + 1));
    } else if (match[8] !== undefined) {
      tokens.push(...parse(match[8], { ...marks, strike: true }, depth + 1));
    } else {
      const href = match[10];
      const label = match[9] || href;
      const safe = SAFE_HREF.test(href);
      tokens.push(...parse(label, safe ? { ...marks, href } : marks, depth + 1));
    }

    cursor = end;
    re.lastIndex = end;
  }

  pushText(tokens, unescape(text.slice(cursor)), marks);
  return tokens;
}

/** Splits one line of prose into styled runs. Returns a single unstyled token
 * for plain text, so callers can render the common case without branching. */
export function parseInlineMarkdown(text: string): InlineToken[] {
  return parse(text, {}, 0);
}

/** Markdown reduced to its plain text, for contexts that can't style anything
 * (image alt text, document titles, list previews). */
export function stripMarkdown(text: string): string {
  return parseInlineMarkdown(stripBlockMarkers(text))
    .map((token) => token.text)
    .join("");
}

function stripBlockMarkers(text: string): string {
  return text
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/^\s*```.*$/gm, "")
    .trim();
}

/* ── Block level ──────────────────────────────────────────────────────
 * The narration schema already carries structure (heading/paragraph/list
 * blocks), so this exists for what the model writes *inside* one of those
 * text fields anyway -- a stray "## " line, a dashed list, a pipe table.
 * Rendering those literally is what makes a report look unpolished. */

export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "ordered"; start: number; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "divider" }
  | { type: "table"; header: string[]; rows: string[][] };

const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*)$/;
const BULLET_RE = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED_RE = /^\s{0,3}(\d{1,3})[.)]\s+(.*)$/;
const QUOTE_RE = /^\s{0,3}>\s?(.*)$/;
const DIVIDER_RE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;
const TABLE_DIVIDER_RE = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** Parses a text field into renderable blocks. Text with no Markdown block
 * syntax comes back as a single paragraph, which is the usual case. */
export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1][0].repeat(3))) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or end of input)
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }

    if (DIVIDER_RE.test(line)) {
      blocks.push({ type: "divider" });
      i += 1;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (startsTable(lines, i)) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const parts: string[] = [];
      while (i < lines.length) {
        const quoted = lines[i].match(QUOTE_RE);
        if (!quoted) break;
        parts.push(quoted[1].trim());
        i += 1;
      }
      blocks.push({ type: "quote", text: parts.join(" ").trim() });
      continue;
    }

    if (BULLET_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const bullet = lines[i].match(BULLET_RE);
        if (bullet) items.push(bullet[1].trim());
        else if (items.length > 0 && /^\s{2,}\S/.test(lines[i])) items[items.length - 1] += ` ${lines[i].trim()}`;
        else break;
        i += 1;
      }
      blocks.push({ type: "bullets", items });
      continue;
    }

    const firstOrdered = line.match(ORDERED_RE);
    if (firstOrdered) {
      const items: string[] = [];
      while (i < lines.length) {
        const ordered = lines[i].match(ORDERED_RE);
        if (ordered) items.push(ordered[2].trim());
        else if (items.length > 0 && /^\s{2,}\S/.test(lines[i])) items[items.length - 1] += ` ${lines[i].trim()}`;
        else break;
        i += 1;
      }
      blocks.push({ type: "ordered", start: Number(firstOrdered[1]) || 1, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i]) && !startsTable(lines, i)) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    if (paragraph.length === 0) {
      // Defensive: a line that looks like a block start but fell through every
      // branch above would otherwise spin here forever.
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

/** A pipe row is only a table if the very next line is its `| --- |` divider. */
function startsTable(lines: string[], i: number): boolean {
  return lines[i].includes("|") && i + 1 < lines.length && TABLE_DIVIDER_RE.test(lines[i + 1]);
}

function isBlockStart(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    BULLET_RE.test(line) ||
    ORDERED_RE.test(line) ||
    QUOTE_RE.test(line) ||
    DIVIDER_RE.test(line) ||
    FENCE_RE.test(line)
  );
}
