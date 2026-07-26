import { listDatasets } from "./actions";
import { DatasetsGrid } from "@/components/datasets/DatasetsGrid";

export default async function DatasetsPage() {
  const datasets = await listDatasets();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
        <p className="mt-1 text-sm text-text-muted">Files you&apos;ve uploaded, and the reports generated from them.</p>
      </div>
      <DatasetsGrid initialDatasets={datasets} />
    </div>
  );
}
