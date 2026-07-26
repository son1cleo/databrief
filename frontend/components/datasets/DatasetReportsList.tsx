import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UploadReportSummary } from "@/lib/types";

interface DatasetReportsListProps {
  reports: UploadReportSummary[];
}

const STATUS_STYLES: Record<string, string> = {
  done: "bg-success/15 text-success border-success/30",
  generating: "bg-warning/15 text-warning border-warning/30",
  failed: "bg-error/15 text-error border-error/30",
};

export function DatasetReportsList({ reports }: DatasetReportsListProps) {
  if (reports.length === 0) {
    return <p className="text-sm text-text-muted">No reports generated from this dataset yet.</p>;
  }

  return (
    <div className="space-y-2">
      {reports.map((report) => (
        <Link
          key={report.id}
          href={`/reports/${report.id}`}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-text-subtle"
        >
          <FileText className="size-4 shrink-0 text-brand" />
          <span className="flex-1 truncate text-sm font-medium">{report.title ?? "Untitled Report"}</span>
          <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_STYLES[report.status])}>
            {report.status}
          </Badge>
          <span className="shrink-0 text-xs text-text-muted">{new Date(report.created_at).toLocaleDateString()}</span>
        </Link>
      ))}
    </div>
  );
}
