import { listDatasets } from "./actions";
import { DatasetsGrid } from "@/components/datasets/DatasetsGrid";

export default async function DatasetsPage() {
  const datasets = await listDatasets();

  return <DatasetsGrid initialDatasets={datasets} />;
}
