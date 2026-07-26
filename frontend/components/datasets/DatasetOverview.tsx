import { CircleCheck, Columns3, Grid2x2, Rows3, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetaBox } from "@/components/ui/meta-box";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ColumnSummary } from "@/lib/datasetAnalysis";
import type { Finding } from "@/lib/analysis";

interface DatasetOverviewProps {
  rowCount: number;
  columnCount: number;
  dataQuality: Finding | null;
  columns: ColumnSummary[];
}

const KIND_VARIANT: Record<ColumnSummary["kind"], "brand" | "warning" | "neutral"> = {
  numeric: "brand",
  datetime: "warning",
  categorical: "neutral",
};

const KIND_LABEL: Record<ColumnSummary["kind"], string> = {
  numeric: "Numeric",
  datetime: "Date",
  categorical: "Categorical",
};

function fmt(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  return Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(2);
}

export function DatasetOverview({ rowCount, columnCount, dataQuality, columns }: DatasetOverviewProps) {
  const completeness = dataQuality ? `${((dataQuality.value ?? 1) * 100).toFixed(0)}%` : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetaBox icon={Rows3} label="Rows" value={rowCount.toLocaleString()} />
        <MetaBox icon={Columns3} label="Columns" value={columnCount.toLocaleString()} />
        <MetaBox icon={CircleCheck} label="Completeness" value={completeness} />
        <MetaBox
          icon={Grid2x2}
          label="Missing cells"
          value={String(dataQuality?.extra.missing_cells ?? 0)}
        />
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader icon={Table2} title="Columns" description={`${columns.length} in this dataset`} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead>Missing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((col) => (
                <TableRow key={col.name}>
                  <TableCell className="font-medium">{col.name}</TableCell>
                  <TableCell>
                    <Badge variant={KIND_VARIANT[col.kind]}>{KIND_LABEL[col.kind]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {col.kind === "numeric" && (
                      <span>
                        mean {fmt(col.mean)} · std {fmt(col.std)} · range {fmt(col.min)}–{fmt(col.max)}
                      </span>
                    )}
                    {col.kind === "datetime" && (
                      <span>
                        {col.minDate ?? "—"} to {col.maxDate ?? "—"}
                      </span>
                    )}
                    {col.kind === "categorical" && (
                      <span>
                        {col.distinctCount ?? 0} distinct{col.topValue ? ` · top: ${col.topValue}` : ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(col.missingPct * 100).toFixed(0)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
