import { notFound } from "next/navigation";
import { CalendarDays, CircleDot, FileStack, FileText, Sparkles } from "lucide-react";
import { getReport } from "@/app/(app)/upload/actions";
import { ApiError } from "@/lib/api";
import { statusBadgeVariant } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BreadcrumbBar } from "@/components/ui/breadcrumb-bar";
import { IconBadge } from "@/components/ui/icon-badge";
import { MetaBox } from "@/components/ui/meta-box";
import { Panel } from "@/components/ui/panel";
import { ReportViewer } from "@/components/reports/ReportViewer";
import { ReportProcessing } from "@/components/reports/ReportProcessing";
import { ReportDetailActions } from "@/components/reports/ReportDetailActions";

const STATUS_LABEL: Record<string, string> = {
  done: "Ready",
  generating: "Generating",
  failed: "Failed",
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  const availableFormats = [
    report.pdf_ready && "PDF",
    report.word_ready && "DOCX",
    report.pptx_ready && "PPTX",
  ].filter(Boolean) as string[];

  const storyJson = report.story_json as {
    findings?: unknown[];
    dataConfidence?: number | null;
    question?: string | null;
    rowCount?: number | null;
    columnCount?: number | null;
  } | null;
  const findingsCount = storyJson?.findings?.length;

  return (
    <div className="space-y-5">
      <BreadcrumbBar
        items={[
          { label: "Reports", href: "/reports", icon: FileText },
          { label: report.title ?? "Untitled report" },
        ]}
      />

      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <IconBadge
              icon={FileText}
              color={report.status === "failed" ? "error" : "brand"}
              size="xl"
            />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold tracking-tight text-foreground md:text-2xl">
                {report.title ?? "Untitled report"}
              </h2>
              {report.hook && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {report.hook}
                </p>
              )}
            </div>
          </div>
          {report.status === "done" && (
            <ReportDetailActions
              reportId={report.id}
              pdfReady={report.pdf_ready}
              wordReady={report.word_ready}
              pptxReady={report.pptx_ready}
            />
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetaBox
            icon={CircleDot}
            label="Status"
            value={
              <Badge variant={statusBadgeVariant(report.status)}>
                {STATUS_LABEL[report.status] ?? report.status}
              </Badge>
            }
          />
          <MetaBox
            icon={FileStack}
            label="Formats"
            value={availableFormats.length > 0 ? availableFormats.join(" · ") : "—"}
          />
          <MetaBox
            icon={Sparkles}
            label="Findings"
            value={findingsCount != null ? String(findingsCount) : "—"}
          />
          <MetaBox
            icon={CalendarDays}
            label="Created"
            value={new Date(report.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
        </div>
      </Panel>

      {report.status === "generating" && <ReportProcessing reportId={report.id} />}

      {report.status === "failed" && (
        <Panel className="flex flex-col items-center border-error/25 bg-error/5 px-6 py-12 text-center">
          <IconBadge icon={CircleDot} color="error" size="xl" />
          <p className="mt-4 text-base font-semibold text-error">Generation failed</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {report.error_message ?? "Please try again."}
          </p>
        </Panel>
      )}

      {report.status === "done" && (
        <ReportViewer
          narration={(report.story_blocks as never) ?? {}}
          findings={(storyJson?.findings as never[]) ?? []}
          dataConfidence={storyJson?.dataConfidence ?? null}
          question={storyJson?.question ?? null}
          rowCount={storyJson?.rowCount ?? null}
          columnCount={storyJson?.columnCount ?? null}
        />
      )}
    </div>
  );
}
