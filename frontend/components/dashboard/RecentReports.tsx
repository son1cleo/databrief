import Link from "next/link";
import { ReportCard } from "@/components/reports/ReportCard";
import type { ReportListItem } from "@/lib/types";

interface RecentReportsProps {
  reports: ReportListItem[];
}

export function RecentReports({ reports }: RecentReportsProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Reports</h2>
        {reports.length > 0 && (
          <Link href="/reports" className="text-sm text-brand hover:underline">
            View all
          </Link>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="mb-3 text-sm text-text-muted">No reports yet.</p>
          <Link href="/upload" className="text-sm font-medium text-brand hover:underline">
            Generate your first report
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
