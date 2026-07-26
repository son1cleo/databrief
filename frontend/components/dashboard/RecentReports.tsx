import Link from "next/link";
import { ArrowRight, Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { IconBadge } from "@/components/ui/icon-badge";
import { statusBadgeVariant } from "@/lib/utils";
import type { ReportListItem } from "@/lib/types";

interface RecentReportsProps {
  reports: ReportListItem[];
}

const STATUS_LABEL: Record<string, string> = {
  done: "Ready",
  generating: "Generating",
  failed: "Failed",
};

function formatLabel(report: ReportListItem) {
  const parts: string[] = [];
  if (report.pdf_ready) parts.push("PDF");
  if (report.word_ready) parts.push("DOCX");
  if (report.pptx_ready) parts.push("PPTX");
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function RecentReports({ reports }: RecentReportsProps) {
  if (reports.length === 0) {
    return (
      <Panel className="flex flex-col items-center px-6 py-12 text-center">
        <IconBadge icon={FileText} color="muted" size="xl" />
        <p className="mt-4 text-sm font-medium text-foreground">No reports yet</p>
        <p className="mt-1 mb-5 max-w-xs text-xs text-muted-foreground">
          Upload a dataset and DataBrief will turn it into a narrative report.
        </p>
        <Link
          href="/upload"
          className="text-sm font-medium text-brand transition-colors hover:text-brand-hover"
        >
          Generate your first report →
        </Link>
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        icon={Clock}
        title="Recent reports"
        action={
          <Link
            href="/reports"
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
          >
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />

      <div className="divide-y divide-border-soft">
        {reports.map((report) => (
          <Link
            key={report.id}
            href={`/reports/${report.id}`}
            className="group/row flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-2"
          >
            <IconBadge
              icon={FileText}
              color={report.status === "failed" ? "error" : "brand"}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {report.title ?? "Untitled report"}
              </p>
              <p className="mt-0.5 flex items-center gap-2 truncate font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                <span>{formatLabel(report)}</span>
                <span aria-hidden>·</span>
                <span>
                  {new Date(report.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </p>
            </div>
            <Badge variant={statusBadgeVariant(report.status)} className="shrink-0">
              {STATUS_LABEL[report.status] ?? report.status}
            </Badge>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/row:opacity-100" />
          </Link>
        ))}
      </div>
    </Panel>
  );
}
