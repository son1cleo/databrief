import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ColumnSummary } from "@/lib/datasetAnalysis";
import type { Finding } from "@/lib/analysis";

interface DatasetOverviewProps {
  rowCount: number;
  columnCount: number;
  dataQuality: Finding | null;
  columns: ColumnSummary[];
}

const KIND_STYLES: Record<ColumnSummary["kind"], string> = {
  numeric: "bg-brand/10 text-data-ink border-brand/30",
  datetime: "bg-warning/15 text-warning border-warning/30",
  categorical: "border-border bg-transparent text-text-muted",
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

export function DatasetOverview({ rowCount, columnCount, dataQuality, columns }: DatasetOverviewProps) {
  const completeness = dataQuality ? `${((dataQuality.value ?? 1) * 100).toFixed(0)}%` : "—";

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rows" value={rowCount.toLocaleString()} />
        <Stat label="Columns" value={columnCount.toLocaleString()} />
        <Stat label="Completeness" value={completeness} />
        <Stat label="Missing cells" value={String(dataQuality?.extra.missing_cells ?? 0)} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
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
                  <Badge variant="outline" className={KIND_STYLES[col.kind]}>
                    {KIND_LABEL[col.kind]}
                  </Badge>
                </TableCell>
                <TableCell className="text-text-muted">
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
                <TableCell className="text-text-muted">{(col.missingPct * 100).toFixed(0)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
