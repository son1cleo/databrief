import { Panel } from "@/components/ui/panel";
import { Markdown, RichText } from "./Markdown";
import { InteractiveChart } from "./InteractiveChart";
import type { ChartData } from "@/lib/chartData";

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
  extra?: { chart_b64?: string; chart_data?: ChartData };
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

function confidenceClasses(score: number): string {
  if (score >= 75) return "border-success/30 bg-success/10 text-success";
  if (score >= 50) return "border-warning/30 bg-warning/10 text-warning";
  return "border-error/30 bg-error/10 text-error";
}

function Blocks({ blocks, findings }: { blocks: StoryBlock[]; findings: Finding[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return block.level === 1 ? (
            <h3 key={i} className="mt-8 mb-3 font-display text-xl font-bold tracking-tight text-balance text-foreground">
              <RichText text={block.text ?? ""} />
            </h3>
          ) : (
            <h4 key={i} className="mt-6 mb-2 font-display text-base font-semibold tracking-tight text-brand">
              <RichText text={block.text ?? ""} />
            </h4>
          );
        }
        if (block.type === "paragraph") {
          return (
            <Markdown
              key={i}
              text={block.text ?? ""}
              className="mb-5 text-[15px] leading-7 text-pretty text-muted-foreground"
            />
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="mb-5 space-y-2.5">
              {(block.items ?? []).map((item, j) => (
                <li key={j} className="relative pl-5 text-[15px] leading-7 text-pretty text-muted-foreground">
                  <span className="absolute top-[0.7em] left-0 size-1.5 rounded-full bg-brand/70" aria-hidden />
                  <RichText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        // chart
        const finding = findings[block.findingRef ?? -1];
        const chartData = finding?.extra?.chart_data;
        if (chartData) {
          return (
            <figure key={i} className="my-6 overflow-hidden rounded-xl border border-border-soft bg-inset p-3">
              <InteractiveChart data={chartData} />
            </figure>
          );
        }
        const b64 = finding?.extra?.chart_b64;
        return b64 ? (
          <figure key={i} className="my-6 overflow-hidden rounded-xl border border-border-soft bg-inset p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/png;base64,${b64}`} alt="" className="mx-auto max-w-full rounded-lg" />
          </figure>
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
    // No `overflow-hidden` here: clipping would make this panel the meta
    // strip's scroll container and silently kill its sticky positioning, so
    // the strip rounds its own top corners instead.
    <Panel>
      {/* Pins directly beneath the breadcrumb once it reaches it, keeping the
          dataset's shape and confidence readable while scrolling the brief.
          Opaque, since report content passes underneath it. */}
      <div className="sticky top-(--crumb-bar-h) z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-2xl border-b border-border-soft bg-inset px-6 py-3.5 md:px-10">
        <span className="font-mono text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Executive Data Brief
        </span>
        {hasDatasetSize && (
          <span className="font-mono text-[11px] text-data-ink">
            {rowCount.toLocaleString("en-US")} rows × {columnCount} columns
          </span>
        )}
        {dataConfidence !== null && dataConfidence !== undefined && (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${confidenceClasses(dataConfidence)}`}
          >
            Data Confidence: {dataConfidence}%
          </span>
        )}
      </div>

      {/* Measure is set in ch so it tracks the reading line length, not the
          viewport -- ~86ch of prose, with charts centering inside it. */}
      <article className="mx-auto w-full max-w-[86ch] px-6 py-8 md:px-10 md:py-12">
        {narration.headline && (
          <h1 className="font-display text-3xl leading-tight font-bold tracking-tight text-balance text-foreground md:text-[2.5rem]">
            <RichText text={narration.headline} />
          </h1>
        )}
        {narration.hook && (
          <p className="mt-4 border-l-2 border-brand/40 pl-4 text-[17px] leading-8 text-pretty text-foreground/85 italic">
            <RichText text={narration.hook} />
          </p>
        )}

        {question && narration.focusQuestionCallout && (
          <div className="mt-8 rounded-xl border border-border-soft bg-inset p-5">
            <p className="mb-2 font-mono text-[11px] font-semibold tracking-[0.12em] text-brand uppercase">
              Focus Question
            </p>
            <p className="mb-3 text-[15px] leading-7 font-medium text-foreground">{question}</p>
            <Markdown
              text={narration.focusQuestionCallout}
              className="text-[15px] leading-7 text-pretty text-muted-foreground"
            />
          </div>
        )}

        {chapters.map((chapter) =>
          chapter.blocks.length > 0 ? (
            <section key={chapter.id} className="mt-12 border-t border-border-soft pt-8">
              <h2 className="mb-4 font-display text-2xl font-bold tracking-tight text-balance text-foreground">
                <RichText text={chapter.title} />
              </h2>
              <Blocks blocks={chapter.blocks} findings={findings} />
            </section>
          ) : null
        )}

        {hasActions && (
          <div className="mt-12 rounded-xl border border-brand/20 bg-brand/5 p-6">
            <h2 className="mb-3 font-display text-lg font-bold tracking-tight text-foreground">Strategic Actions</h2>
            {narration.implication && (
              <Markdown
                text={narration.implication}
                className="mb-5 text-[15px] leading-7 text-pretty text-muted-foreground"
              />
            )}
            <ol className="space-y-3">
              {actions.map((action, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-7 text-pretty text-muted-foreground">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 font-mono text-xs font-bold text-brand tabular-nums">
                    {i + 1}
                  </span>
                  <span>
                    <RichText text={action} />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </article>
    </Panel>
  );
}
