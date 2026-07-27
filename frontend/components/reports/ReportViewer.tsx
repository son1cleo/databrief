interface StoryBlock {
  type: "heading" | "paragraph" | "list" | "chart";
  level?: 1 | 2;
  text?: string;
  items?: string[];
  findingRef?: number;
}

interface Chapter {
  id: string;
  title: string;
  blocks: StoryBlock[];
}

interface Finding {
  extra?: { chart_b64?: string };
}

interface Narration {
  headline?: string;
  hook?: string;
  chapters?: Chapter[];
  focusQuestionCallout?: string | null;
  implication?: string;
  actions?: string[];
}

interface ReportViewerProps {
  narration: Narration;
  findings: Finding[];
  dataConfidence?: number | null;
  question?: string | null;
  rowCount?: number | null;
  columnCount?: number | null;
}

function confidenceColorClass(score: number): string {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-error";
}

function Blocks({ blocks, findings }: { blocks: StoryBlock[]; findings: Finding[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return block.level === 1 ? (
            <h3 key={i} className="mb-3 mt-6 font-display text-xl font-bold text-foreground">
              {block.text}
            </h3>
          ) : (
            <h4 key={i} className="mt-5 mb-2 font-display text-base font-semibold text-brand">
              {block.text}
            </h4>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={i} className="mb-4 text-[15px] leading-relaxed text-muted-foreground">
              {block.text}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="mb-4 list-disc pl-5">
              {(block.items ?? []).map((item, j) => (
                <li key={j} className="mb-2 text-[15px] text-muted-foreground">
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
          <img key={i} src={`data:image/png;base64,${b64}`} alt="" className="mb-4 max-w-full rounded-lg border border-border" />
        ) : null;
      })}
    </>
  );
}

export function ReportViewer({ narration, findings, dataConfidence, question, rowCount, columnCount }: ReportViewerProps) {
  const chapters = narration.chapters ?? [];
  const actions = narration.actions ?? [];
  const hasActions = actions.length > 0 || Boolean(narration.implication);
  const hasDatasetSize = rowCount !== null && rowCount !== undefined && columnCount !== null && columnCount !== undefined;

  return (
    <article className="max-w-none">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">Executive Data Brief</span>
        {hasDatasetSize && (
          <span className="font-mono text-xs text-data-ink">
            {rowCount.toLocaleString("en-US")} rows × {columnCount} columns
          </span>
        )}
        {dataConfidence !== null && dataConfidence !== undefined && (
          <span className={`text-xs font-semibold ${confidenceColorClass(dataConfidence)}`}>
            Data Confidence: {dataConfidence}%
          </span>
        )}
      </div>

      {narration.headline && (
        <h1 className="mb-3 font-display text-3xl font-bold text-foreground">{narration.headline}</h1>
      )}
      {narration.hook && <p className="mb-6 text-base leading-relaxed text-muted-foreground italic">{narration.hook}</p>}

      {question && narration.focusQuestionCallout && (
        <div className="mb-6 rounded-lg border-l-2 border-brand bg-surface p-4">
          <p className="mb-1 text-xs font-semibold tracking-wide text-brand uppercase">Focus Question: {question}</p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{narration.focusQuestionCallout}</p>
        </div>
      )}

      {chapters.map((chapter) =>
        chapter.blocks.length > 0 ? (
          <section key={chapter.id}>
            <h2 className="mt-8 mb-3 font-display text-xl font-bold text-foreground">{chapter.title}</h2>
            <Blocks blocks={chapter.blocks} findings={findings} />
          </section>
        ) : null
      )}

      {hasActions && (
        <div className="mt-8 rounded-lg bg-surface p-5">
          <h2 className="mb-3 font-display text-lg font-bold text-foreground">Strategic Actions</h2>
          {narration.implication && <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">{narration.implication}</p>}
          <ol className="space-y-2">
            {actions.map((action, i) => (
              <li key={i} className="flex gap-3 text-[15px] text-muted-foreground">
                <span className="font-bold text-brand">{i + 1}.</span>
                <span>{action}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
