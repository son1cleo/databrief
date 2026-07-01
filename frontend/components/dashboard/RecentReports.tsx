import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReportListItem } from "@/lib/types";

interface RecentReportsProps {
  reports: ReportListItem[];
}

const STATUS_DOT: Record<string, string> = {
  done: "bg-success",
  generating: "bg-warning",
  failed: "bg-error",
};

const STATUS_LABEL: Record<string, string> = {
  done: "ready",
  generating: "generating",
  failed: "failed",
};

function formatLabel(report: ReportListItem) {
  const parts: string[] = [];
  if (report.pdf_ready) parts.push("PDF");
  if (report.word_ready) parts.push("DOCX");
  if (report.pptx_ready) parts.push("PPTX");
  return parts.length > 0 ? parts.join("+") : "—";
}

export function RecentReports({ reports }: RecentReportsProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">Recent Reports</h2>
        {reports.length > 0 && (
          <Link href="/reports" className="font-mono text-xs text-data-ink hover:underline">
            VIEW ALL →
          </Link>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
          <p className="mb-3 font-mono text-sm text-muted-foreground">No reports yet.</p>
          <Link href="/upload" className="font-mono text-sm text-brand hover:underline">
            Generate your first report
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {/* Desktop table header — hidden on mobile */}
          <div className="hidden sm:grid grid-cols-[90px_1fr_110px_90px_70px] gap-4 border-b border-border px-5 py-2.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            <span>Status</span>
            <span>Title</span>
            <span>Format</span>
            <span>Date</span>
            <span />
          </div>
          {reports.map((report) => (
            <Link
              key={report.id}
              href={`/reports/${report.id}`}
              className="group block border-b border-border transition-colors last:border-b-0 hover:bg-surface-2"
            >
              {/* Mobile card layout */}
              <div className="flex items-start justify-between gap-3 px-4 py-3 sm:hidden">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {report.title ?? "Untitled Report"}
                  </p>
                  <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[report.status])} />
                      {STATUS_LABEL[report.status] ?? report.status}
                    </span>
                    <span>{formatLabel(report)}</span>
                    <span>
                      {new Date(report.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs text-data-ink shrink-0">→</span>
              </div>
              {/* Desktop row layout */}
              <div className="hidden sm:grid grid-cols-[90px_1fr_110px_90px_70px] items-center gap-4 px-5 py-3">
                <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[report.status])} />
                  {STATUS_LABEL[report.status] ?? report.status}
                </span>
                <span className="truncate text-sm text-foreground">
                  {report.title ?? "Untitled Report"}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{formatLabel(report)}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(report.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-right font-mono text-xs text-data-ink opacity-0 transition-opacity group-hover:opacity-100">
                  View →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
