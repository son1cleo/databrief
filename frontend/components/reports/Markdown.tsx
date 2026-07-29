import * as React from "react";

import { cn } from "@/lib/utils";
import { parseInlineMarkdown, parseMarkdownBlocks, type InlineToken } from "@/lib/markdown";

/** Wraps a run in its mark elements, innermost first, so `**a _b_**` nests as
 * <strong><em>. Rendered as plain string when the run carries no marks. */
function renderToken(token: InlineToken, key: number): React.ReactNode {
  let node: React.ReactNode = token.text;

  if (token.code) {
    node = (
      <code className="rounded-[5px] border border-border-soft bg-inset px-1.5 py-0.5 font-mono text-[0.85em] text-data-ink">
        {node}
      </code>
    );
  }
  if (token.strike) node = <s className="opacity-60">{node}</s>;
  if (token.italic) node = <em className="italic">{node}</em>;
  if (token.bold) node = <strong className="font-semibold text-foreground">{node}</strong>;
  if (token.href) {
    node = (
      <a
        href={token.href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-brand underline decoration-brand/40 underline-offset-2 transition-colors hover:text-brand-hover hover:decoration-brand"
      >
        {node}
      </a>
    );
  }

  return <React.Fragment key={key}>{node}</React.Fragment>;
}

/** Inline Markdown only (bold/italic/code/strike/links) -- for single-line
 * text that already sits inside a styled element: headings, list items,
 * table cells, the hook. */
export function RichText({ text }: { text: string }) {
  return <>{parseInlineMarkdown(text).map(renderToken)}</>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="my-4 space-y-2 first:mt-0 last:mb-0">
      {items.map((item, i) => (
        <li key={i} className="relative pl-5">
          <span className="absolute top-[0.62em] left-0 size-1.5 rounded-full bg-brand/70" aria-hidden />
          <RichText text={item} />
        </li>
      ))}
    </ul>
  );
}

function Ordered({ items, start }: { items: string[]; start: number }) {
  return (
    <ol className="my-4 space-y-2 first:mt-0 last:mb-0">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 font-mono text-[0.85em] font-semibold text-brand tabular-nums">{start + i}.</span>
          <span>
            <RichText text={item} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function Table({ header, rows }: { header: string[]; rows: string[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-border-soft first:mt-0 last:mb-0">
      <table className="w-full border-collapse text-left text-[0.9em]">
        <thead className="bg-inset">
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="border-b border-border-soft px-3 py-2 font-semibold whitespace-nowrap text-foreground">
                <RichText text={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border-soft/60 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  <RichText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Full Markdown rendering (blocks + inline). The narration schema carries its
 * own heading/list/paragraph blocks, so this handles what the model writes
 * *inside* one of those text fields -- a stray "## " line, a dashed list, a
 * pipe table -- which would otherwise print as raw syntax. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseMarkdownBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className={cn("[&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading": {
            const size = block.level <= 2 ? "text-[1.15em]" : "text-[1.02em]";
            return (
              <p key={i} className={cn("mt-5 mb-2 font-display font-semibold text-foreground", size)}>
                <RichText text={block.text} />
              </p>
            );
          }
          case "bullets":
            return <Bullets key={i} items={block.items} />;
          case "ordered":
            return <Ordered key={i} items={block.items} start={block.start} />;
          case "quote":
            return (
              <blockquote key={i} className="my-4 border-l-2 border-brand/40 pl-4 text-foreground/80 italic">
                <RichText text={block.text} />
              </blockquote>
            );
          case "code":
            return (
              <pre key={i} className="my-4 overflow-x-auto rounded-xl border border-border-soft bg-inset p-4">
                <code className="font-mono text-[0.85em] text-data-ink">{block.text}</code>
              </pre>
            );
          case "divider":
            return <hr key={i} className="my-6 border-border-soft" />;
          case "table":
            return <Table key={i} header={block.header} rows={block.rows} />;
          default:
            return (
              <p key={i} className="mb-4 last:mb-0">
                <RichText text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
