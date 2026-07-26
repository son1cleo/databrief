import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IconBadge } from "@/components/ui/icon-badge";
import { Panel } from "@/components/ui/panel";
import { statusBadgeVariant } from "@/lib/utils";
import type { UploadReportSummary } from "@/lib/types";

interface DatasetReportsListProps {
  reports: UploadReportSummary[];
}

const STATUS_LABEL: Record<string, string> = {
  done: "Ready",
  generating: "Generating",
  failed: "Failed",
};

export function DatasetReportsList({ reports }: DatasetReportsListProps) {
  if (reports.length === 0) {
    return (
      <Panel className="flex flex-col items-center px-6 py-14 text-center">
        <IconBadge icon={FileText} color="muted" size="xl" />
        <p className="mt-4 text-sm font-medium text-foreground">No reports yet</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Generate a report from this dataset to see it here.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="divide-y divide-border-soft overflow-hidden">
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
            <p className="mt-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              {new Date(report.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <Badge variant={statusBadgeVariant(report.status)} className="shrink-0">
            {STATUS_LABEL[report.status] ?? report.status}
          </Badge>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/row:opacity-100" />
        </Link>
      ))}
    </Panel>
  );
}
