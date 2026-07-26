import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getDataset } from "../actions";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ApiError } from "@/lib/api";
import { DatasetDetailActions } from "@/components/datasets/DatasetDetailActions";
import { DatasetExplorer } from "@/components/datasets/DatasetExplorer";

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

export default async function DatasetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ upload, insights }, user] = await Promise.all([
    getDataset(id).catch((err) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    }),
    getCurrentUser(),
  ]);

  const size = formatBytes(upload.file_size_bytes);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/datasets" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to datasets
        </Link>
        {upload.status === "done" && user && (
          <DatasetDetailActions
            uploadId={upload.id}
            filename={upload.filename}
            reportsCount={upload.reports_count}
            defaultIndustry={user.industry}
            hasBrandKit={Boolean(user.brandLogoUrl)}
          />
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_STYLES[upload.status])}>
            {upload.status}
          </Badge>
          {upload.file_type && <span className="text-xs uppercase text-text-muted">{upload.file_type}</span>}
          {size && <span className="text-xs text-text-muted">{size}</span>}
          <span className="text-xs text-text-muted">{new Date(upload.created_at).toLocaleDateString()}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{upload.filename}</h1>
      </div>

      {upload.status === "failed" && (
        <div className="rounded-xl border border-error/30 bg-error/5 p-8 text-center">
          <p className="mb-1 text-lg font-semibold text-error">Processing failed</p>
          <p className="text-sm text-text-muted">{upload.error_message ?? "Please try uploading again."}</p>
        </div>
      )}

      {(upload.status === "pending" || upload.status === "processing") && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 size-10 animate-spin rounded-full border-2 border-border border-t-brand" />
          <p className="text-sm text-text-muted">Still processing this file...</p>
        </div>
      )}

      {upload.status === "done" && insights && <DatasetExplorer insights={insights} reports={upload.reports} />}
    </div>
  );
}
