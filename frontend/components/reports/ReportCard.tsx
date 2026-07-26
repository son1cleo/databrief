"use client";

import Link from "next/link";
import { CalendarDays, FileStack, FileText, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { MetaBox } from "@/components/ui/meta-box";
import { Panel } from "@/components/ui/panel";
import { statusBadgeVariant } from "@/lib/utils";
import type { ReportListItem } from "@/lib/types";

interface ReportCardProps {
  report: ReportListItem;
  onDelete?: (id: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  done: "Ready",
  generating: "Generating",
  failed: "Failed",
};

function formats(report: ReportListItem) {
  const parts: string[] = [];
  if (report.pdf_ready) parts.push("PDF");
  if (report.word_ready) parts.push("DOCX");
  if (report.pptx_ready) parts.push("PPTX");
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function ReportCard({ report, onDelete }: ReportCardProps) {
  return (
    <Panel className="flex flex-col p-4 transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconBadge
            icon={FileText}
            color={report.status === "failed" ? "error" : "brand"}
            size="md"
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {report.title ?? "Untitled report"}
            </h3>
            {report.findings_count != null && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="size-3" />
                {report.findings_count} findings
              </p>
            )}
          </div>
        </div>
        <Badge variant={statusBadgeVariant(report.status)} className="shrink-0">
          {STATUS_LABEL[report.status] ?? report.status}
        </Badge>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <MetaBox icon={FileStack} label="Formats" value={formats(report)} />
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

      {report.hook && (
        <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {report.hook}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/reports/${report.id}`} />}
          nativeButton={false}
          className="flex-1"
        >
          View report
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(report.id)}
            aria-label={`Delete ${report.title ?? "report"}`}
            className="hover:bg-error/10 hover:text-error"
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </Panel>
  );
}
