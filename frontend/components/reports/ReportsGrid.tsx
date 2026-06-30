"use client";

import { useState, useTransition } from "react";
import { ReportCard } from "./ReportCard";
import { deleteReport } from "@/app/(app)/reports/actions";
import type { ReportListItem } from "@/lib/types";

interface ReportsGridProps {
  initialReports: ReportListItem[];
}

export function ReportsGrid({ initialReports }: ReportsGridProps) {
  const [reports, setReports] = useState(initialReports);
  const [, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    if (!confirm("Delete this report? This can't be undone.")) return;
    setReports((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => {
      deleteReport(id);
    });
  };

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-muted">No reports yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} onDelete={handleDelete} />
      ))}
    </div>
  );
}
