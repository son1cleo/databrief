import { listReports } from "./actions";
import { ReportsGrid } from "@/components/reports/ReportsGrid";

export default async function ReportsPage() {
  const reports = await listReports();

  return <ReportsGrid initialReports={reports} />;
}
