"use client";

import Link from "next/link";
import { FileText, FileType, Presentation, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReportListItem } from "@/lib/types";

interface ReportCardProps {
  report: ReportListItem;
  onDelete?: (id: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  done: "bg-success/15 text-success border-success/30",
  generating: "bg-warning/15 text-warning border-warning/30",
  failed: "bg-error/15 text-error border-error/30",
};

export function ReportCard({ report, onDelete }: ReportCardProps) {
  return (
    <div className="group relative rounded-xl border border-border bg-surface p-5 transition-colors hover:border-text-subtle">
      <Link href={`/reports/${report.id}`} className="block">
        <div className="mb-3 flex items-start justify-between gap-3">
          <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_STYLES[report.status])}>
            {report.status}
          </Badge>
          <span className="text-xs text-text-muted shrink-0">
            {new Date(report.created_at).toLocaleDateString()}
          </span>
        </div>
        <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold">
          {report.title ?? "Untitled Report"}
        </h3>
        <p className="mb-4 line-clamp-2 text-xs text-text-muted">{report.hook}</p>
        <div className="flex items-center gap-3 text-text-muted">
          <FileText className={cn("size-4", report.pdf_ready && "text-brand")} />
          <FileType className={cn("size-4", report.word_ready && "text-brand")} />
          <Presentation className={cn("size-4", report.pptx_ready && "text-brand")} />
          {report.findings_count != null && (
            <span className="ml-auto text-xs">{report.findings_count} findings</span>
          )}
        </div>
      </Link>
      {onDelete && (
        <button
          onClick={() => onDelete(report.id)}
          className="absolute top-4 right-4 text-text-muted opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
          aria-label="Delete report"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
