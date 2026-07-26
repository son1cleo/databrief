"use client";

import Link from "next/link";
import { CalendarDays, Database, FileSpreadsheet, Grid2x2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { MetaBox } from "@/components/ui/meta-box";
import { Panel } from "@/components/ui/panel";
import { statusBadgeVariant } from "@/lib/utils";
import type { UploadListItem } from "@/lib/types";

interface DatasetCardProps {
  dataset: UploadListItem;
  onDelete?: (dataset: UploadListItem) => void;
}

const STATUS_LABEL: Record<string, string> = {
  done: "Ready",
  pending: "Pending",
  processing: "Processing",
  failed: "Failed",
};

function formatBytes(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DatasetCard({ dataset, onDelete }: DatasetCardProps) {
  const size = formatBytes(dataset.file_size_bytes);
  const shape =
    dataset.row_count != null && dataset.column_count != null
      ? `${dataset.row_count.toLocaleString()} × ${dataset.column_count}`
      : "—";

  return (
    <Panel className="flex flex-col p-4 transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconBadge
            icon={Database}
            color={dataset.status === "failed" ? "error" : "brand"}
            size="md"
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{dataset.filename}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {dataset.reports_count > 0
                ? `${dataset.reports_count} report${dataset.reports_count === 1 ? "" : "s"}`
                : "No reports yet"}
            </p>
          </div>
        </div>
        <Badge variant={statusBadgeVariant(dataset.status)} className="shrink-0">
          {STATUS_LABEL[dataset.status] ?? dataset.status}
        </Badge>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <MetaBox
          icon={FileSpreadsheet}
          label="Type"
          value={
            <span className="uppercase">
              {dataset.file_type ?? "—"}
              {size ? ` · ${size}` : ""}
            </span>
          }
        />
        <MetaBox icon={Grid2x2} label="Rows × cols" value={shape} />
      </div>

      <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5" />
        Uploaded{" "}
        {new Date(dataset.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </div>

      <div className="mt-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/datasets/${dataset.id}`} />}
          nativeButton={false}
          className="flex-1"
        >
          Explore dataset
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(dataset)}
            aria-label={`Delete ${dataset.filename}`}
            className="hover:bg-error/10 hover:text-error"
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </Panel>
  );
}
