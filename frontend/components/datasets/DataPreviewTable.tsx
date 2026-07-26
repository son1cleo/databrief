import { Table2 } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Row } from "@/lib/analysis";

interface DataPreviewTableProps {
  columns: string[];
  rows: Row[];
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function DataPreviewTable({ columns, rows }: DataPreviewTableProps) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        icon={Table2}
        title="Data preview"
        description={`First ${rows.length} row${rows.length === 1 ? "" : "s"}`}
      />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col}>{formatCell(row[col])}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
