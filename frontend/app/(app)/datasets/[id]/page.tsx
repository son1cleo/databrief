import { notFound } from "next/navigation";
import { CalendarDays, CircleDot, Database, FileSpreadsheet, Grid2x2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BreadcrumbBar } from "@/components/ui/breadcrumb-bar";
import { IconBadge } from "@/components/ui/icon-badge";
import { MetaBox } from "@/components/ui/meta-box";
import { Panel } from "@/components/ui/panel";
import { statusBadgeVariant } from "@/lib/utils";
import { getDataset } from "../actions";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ApiError } from "@/lib/api";
import { DatasetDetailActions } from "@/components/datasets/DatasetDetailActions";
import { DatasetExplorer } from "@/components/datasets/DatasetExplorer";

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

export default async function DatasetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ upload, insights, insightsError }, user] = await Promise.all([
    getDataset(id).catch((err) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    }),
    getCurrentUser(),
  ]);

  const size = formatBytes(upload.file_size_bytes);
  const shape =
    upload.row_count != null && upload.column_count != null
      ? `${upload.row_count.toLocaleString()} × ${upload.column_count}`
      : "—";

  return (
    <div className="space-y-5">
      <BreadcrumbBar
        items={[
          { label: "Datasets", href: "/datasets", icon: Database },
          { label: upload.filename },
        ]}
      />

      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <IconBadge
              icon={Database}
              color={upload.status === "failed" ? "error" : "brand"}
              size="xl"
            />
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-bold tracking-tight text-foreground md:text-2xl">
                {upload.filename}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {upload.reports_count > 0
                  ? `${upload.reports_count} report${upload.reports_count === 1 ? "" : "s"} generated from this dataset`
                  : "No reports generated from this dataset yet"}
              </p>
            </div>
          </div>
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

        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetaBox
            icon={CircleDot}
            label="Status"
            value={
              <Badge variant={statusBadgeVariant(upload.status)}>
                {STATUS_LABEL[upload.status] ?? upload.status}
              </Badge>
            }
          />
          <MetaBox
            icon={FileSpreadsheet}
            label="File"
            value={
              <span className="uppercase">
                {upload.file_type ?? "—"}
                {size ? ` · ${size}` : ""}
              </span>
            }
          />
          <MetaBox icon={Grid2x2} label="Rows × cols" value={shape} />
          <MetaBox
            icon={CalendarDays}
            label="Uploaded"
            value={new Date(upload.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
        </div>
      </Panel>

      {upload.status === "failed" && (
        <Panel className="flex flex-col items-center border-error/25 bg-error/5 px-6 py-12 text-center">
          <IconBadge icon={TriangleAlert} color="error" size="xl" />
          <p className="mt-4 text-base font-semibold text-error">Processing failed</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {upload.error_message ?? "Please try uploading again."}
          </p>
        </Panel>
      )}

      {(upload.status === "pending" || upload.status === "processing") && (
        <Panel className="flex flex-col items-center px-6 py-16 text-center">
          <div className="size-11 animate-spin rounded-full border-2 border-inset border-t-brand" />
          <p className="mt-5 text-base font-semibold text-foreground">
            Still processing this file…
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll show a preview as soon as it&apos;s ready.
          </p>
        </Panel>
      )}

      {upload.status === "done" && insights && (
        <DatasetExplorer insights={insights} reports={upload.reports} />
      )}

      {upload.status === "done" && !insights && (
        <Panel className="flex flex-col items-center border-error/25 bg-error/5 px-6 py-12 text-center">
          <IconBadge icon={TriangleAlert} color="error" size="xl" />
          <p className="mt-4 text-base font-semibold text-error">Preview unavailable</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {insightsError ?? "Could not load a preview for this file."}
          </p>
        </Panel>
      )}
    </div>
  );
}
