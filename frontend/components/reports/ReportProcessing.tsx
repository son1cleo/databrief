"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 size-12 animate-spin rounded-full border-2 border-border border-t-brand" />
      <p className="text-lg font-semibold">Still generating your story...</p>
      <p className="mt-1 text-sm text-text-muted">This page will update automatically.</p>
    </div>
  );
}
