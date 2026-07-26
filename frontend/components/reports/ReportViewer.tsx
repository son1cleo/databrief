interface StoryBlock {
  type: "heading" | "paragraph" | "list" | "chart";
  level?: 1 | 2;
  text?: string;
  items?: string[];
  findingRef?: number;
}

interface Finding {
  extra?: { chart_b64?: string };
}

interface ReportViewerProps {
  blocks: StoryBlock[];
  findings: Finding[];
}

export function ReportViewer({ blocks, findings }: ReportViewerProps) {
  return (
    <article className="max-w-none">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return block.level === 1 ? (
            <h1 key={i} className="mb-4 text-3xl font-bold text-foreground">
              {block.text}
            </h1>
          ) : (
            <h2 key={i} className="mt-8 mb-3 text-xl font-semibold text-brand">
              {block.text}
            </h2>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={i} className="mb-4 text-[15px] leading-relaxed text-zinc-300">
              {block.text}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="mb-4 list-disc pl-5">
              {(block.items ?? []).map((item, j) => (
                <li key={j} className="mb-2 text-[15px] text-zinc-300">
                  {item}
                </li>
              ))}
            </ul>
          );
        }
        // chart
        const b64 = findings[block.findingRef ?? -1]?.extra?.chart_b64;
        return b64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={`data:image/png;base64,${b64}`} alt="" className="mb-4 max-w-full rounded" />
        ) : null;
      })}
    </article>
  );
}
