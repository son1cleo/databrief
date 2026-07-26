"use client";

import Link from "next/link";
import { Database, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UploadListItem } from "@/lib/types";

interface DatasetCardProps {
  dataset: UploadListItem;
  onDelete?: (dataset: UploadListItem) => void;
}

const STATUS_STYLES: Record<string, string> = {
  done: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  processing: "bg-warning/15 text-warning border-warning/30",
  failed: "bg-error/15 text-error border-error/30",
};

function formatBytes(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DatasetCard({ dataset, onDelete }: DatasetCardProps) {
  const size = formatBytes(dataset.file_size_bytes);

  return (
    <div className="group relative rounded-xl border border-border bg-surface p-5 transition-colors hover:border-text-subtle">
      <Link href={`/datasets/${dataset.id}`} className="block">
        <div className="mb-3 flex items-start justify-between gap-3">
          <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_STYLES[dataset.status])}>
            {dataset.status}
          </Badge>
          <span className="shrink-0 text-xs text-text-muted">
            {new Date(dataset.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <Database className="size-4 shrink-0 text-brand" />
          <h3 className="line-clamp-1 text-sm font-semibold">{dataset.filename}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          {dataset.file_type && <span className="uppercase">{dataset.file_type}</span>}
          {size && <span>{size}</span>}
          {dataset.row_count != null && dataset.column_count != null && (
            <span>
              {dataset.row_count.toLocaleString()} rows &times; {dataset.column_count} cols
            </span>
          )}
        </div>

        <div className="mt-4 text-xs text-text-muted">
          {dataset.reports_count > 0 ? (
            <span>
              {dataset.reports_count} report{dataset.reports_count === 1 ? "" : "s"} generated
            </span>
          ) : (
            <span>No reports yet</span>
          )}
        </div>
      </Link>

      {onDelete && (
        <button
          onClick={() => onDelete(dataset)}
          className="absolute top-4 right-4 text-text-muted opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
          aria-label="Delete dataset"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
