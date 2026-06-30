"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "./ExportMenu";
import { deleteReport } from "@/app/(app)/reports/actions";

interface ReportDetailActionsProps {
  reportId: string;
  pdfReady: boolean;
  wordReady: boolean;
  pptxReady: boolean;
}

export function ReportDetailActions({ reportId, pdfReady, wordReady, pptxReady }: ReportDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("Delete this report? This can't be undone.")) return;
    startTransition(async () => {
      await deleteReport(reportId);
      router.push("/reports");
    });
  };

  return (
    <div className="flex items-center gap-2">
      <ExportMenu reportId={reportId} pdfReady={pdfReady} wordReady={wordReady} pptxReady={pptxReady} />
      <Button variant="outline" size="icon" onClick={handleDelete} disabled={isPending} aria-label="Delete report">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
