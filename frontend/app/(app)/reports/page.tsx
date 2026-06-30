import { listReports } from "./actions";
import { ReportsGrid } from "@/components/reports/ReportsGrid";

export default async function ReportsPage() {
  const reports = await listReports();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <ReportsGrid initialReports={reports} />
    </div>
  );
}
