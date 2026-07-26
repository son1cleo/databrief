"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Database, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { Panel } from "@/components/ui/panel";
import { DatasetCard } from "./DatasetCard";
import { deleteDataset } from "@/app/(app)/datasets/actions";
import type { UploadListItem } from "@/lib/types";

interface DatasetsGridProps {
  initialDatasets: UploadListItem[];
}

export function DatasetsGrid({ initialDatasets }: DatasetsGridProps) {
  const [datasets, setDatasets] = useState(initialDatasets);
  const [, startTransition] = useTransition();

  const handleDelete = (dataset: UploadListItem) => {
    const message =
      dataset.reports_count > 0
        ? `Delete "${dataset.filename}"? This will also delete ${dataset.reports_count} report${
            dataset.reports_count === 1 ? "" : "s"
          } generated from it. This can't be undone.`
        : `Delete "${dataset.filename}"? This can't be undone.`;
    if (!confirm(message)) return;

    setDatasets((prev) => prev.filter((d) => d.id !== dataset.id));
    startTransition(() => {
      deleteDataset(dataset.id);
    });
  };

  if (datasets.length === 0) {
    return (
      <Panel className="flex flex-col items-center px-6 py-16 text-center">
        <IconBadge icon={Database} color="muted" size="xl" />
        <p className="mt-4 text-sm font-medium text-foreground">No datasets yet</p>
        <p className="mt-1 mb-5 max-w-sm text-xs text-muted-foreground">
          Upload a CSV, spreadsheet, or document to get started.
        </p>
        <Button render={<Link href="/upload" />} nativeButton={false} size="sm">
          <Upload />
          Upload dataset
        </Button>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {datasets.length} dataset{datasets.length === 1 ? "" : "s"} · files you&apos;ve uploaded
          and the reports built from them.
        </p>
        <Button render={<Link href="/upload" />} nativeButton={false} size="sm" className="shrink-0">
          <Upload />
          Upload dataset
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {datasets.map((dataset) => (
          <DatasetCard key={dataset.id} dataset={dataset} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
