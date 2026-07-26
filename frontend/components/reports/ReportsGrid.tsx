"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck, CircleSlash, LayoutGrid, Loader, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPills, type FilterPillOption } from "@/components/ui/filter-pills";
import { IconBadge } from "@/components/ui/icon-badge";
import { Panel } from "@/components/ui/panel";
import { ReportCard } from "./ReportCard";
import { deleteReport } from "@/app/(app)/reports/actions";
import type { ReportListItem } from "@/lib/types";

interface ReportsGridProps {
  initialReports: ReportListItem[];
}

type Filter = "all" | "done" | "generating" | "failed";

export function ReportsGrid({ initialReports }: ReportsGridProps) {
  const [reports, setReports] = useState(initialReports);
  const [filter, setFilter] = useState<Filter>("all");
  const [, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    if (!confirm("Delete this report? This can't be undone.")) return;
    setReports((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => {
      deleteReport(id);
    });
  };

  const options: FilterPillOption<Filter>[] = useMemo(
    () => [
      { value: "all", label: "All reports", icon: LayoutGrid, count: reports.length },
      {
        value: "done",
        label: "Ready",
        icon: CircleCheck,
        count: reports.filter((r) => r.status === "done").length,
      },
      {
        value: "generating",
        label: "Generating",
        icon: Loader,
        count: reports.filter((r) => r.status === "generating").length,
      },
      {
        value: "failed",
        label: "Failed",
        icon: CircleSlash,
        count: reports.filter((r) => r.status === "failed").length,
      },
    ],
    [reports]
  );

  const visible = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  if (reports.length === 0) {
    return (
      <Panel className="flex flex-col items-center px-6 py-16 text-center">
        <IconBadge icon={LayoutGrid} color="muted" size="xl" />
        <p className="mt-4 text-sm font-medium text-foreground">No reports yet</p>
        <p className="mt-1 mb-5 max-w-sm text-xs text-muted-foreground">
          Upload a dataset and DataBrief will find the story in it for you.
        </p>
        <Button render={<Link href="/upload" />} nativeButton={false} size="sm">
          <Plus />
          New report
        </Button>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills options={options} value={filter} onValueChange={setFilter} />
        <Button render={<Link href="/upload" />} nativeButton={false} size="sm" className="shrink-0">
          <Plus />
          New report
        </Button>
      </div>

      {visible.length === 0 ? (
        <Panel className="px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">No reports match this filter.</p>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((report) => (
            <ReportCard key={report.id} report={report} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
