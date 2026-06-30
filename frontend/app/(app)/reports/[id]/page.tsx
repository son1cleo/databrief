import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getReport } from "@/app/(app)/upload/actions";
import { ApiError } from "@/lib/api";
import { ReportViewer } from "@/components/reports/ReportViewer";
import { ReportProcessing } from "@/components/reports/ReportProcessing";
import { ReportDetailActions } from "@/components/reports/ReportDetailActions";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to reports
        </Link>
        {report.status === "done" && (
          <ReportDetailActions
            reportId={report.id}
            pdfReady={report.pdf_ready}
            wordReady={report.word_ready}
            pptxReady={report.pptx_ready}
          />
        )}
      </div>

      {report.status === "generating" && <ReportProcessing reportId={report.id} />}

      {report.status === "failed" && (
        <div className="rounded-xl border border-error/30 bg-error/5 p-8 text-center">
          <p className="mb-1 text-lg font-semibold text-error">Generation failed</p>
          <p className="text-sm text-text-muted">{report.error_message ?? "Please try again."}</p>
        </div>
      )}

      {report.status === "done" && <ReportViewer html={report.story_html ?? ""} />}
    </div>
  );
}
