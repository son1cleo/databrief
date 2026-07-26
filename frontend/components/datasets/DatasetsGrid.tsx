"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="mb-3 text-sm text-text-muted">No datasets yet.</p>
        <Link href="/upload" className="text-sm text-brand hover:underline">
          Upload your first dataset
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {datasets.map((dataset) => (
        <DatasetCard key={dataset.id} dataset={dataset} onDelete={handleDelete} />
      ))}
    </div>
  );
}
