"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { getReport } from "@/app/(app)/upload/actions";

interface ReportProcessingProps {
  reportId: string;
}

export function ReportProcessing({ reportId }: ReportProcessingProps) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const report = await getReport(reportId);
      if (cancelled) return;
      if (report.status === "done" || report.status === "failed") {
        router.refresh();
        return;
      }
      setTimeout(poll, 3000);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [reportId, router]);

  return (
    <Panel className="flex flex-col items-center px-6 py-16 text-center">
      <div className="size-11 animate-spin rounded-full border-2 border-inset border-t-brand" />
      <p className="mt-5 text-base font-semibold text-foreground">
        Still generating your story…
      </p>
      <p className="mt-1 text-sm text-muted-foreground">This page will update automatically.</p>
    </Panel>
  );
}
