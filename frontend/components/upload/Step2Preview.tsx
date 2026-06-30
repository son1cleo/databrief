import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UploadPreview } from "@/lib/types";

interface Step2PreviewProps {
  preview: UploadPreview;
  onBack: () => void;
  onContinue: () => void;
}

const DATA_TYPE_LABEL: Record<string, string> = {
  structured: "Structured",
  semi_structured: "Semi-structured",
  unstructured: "Unstructured",
};

export function Step2Preview({ preview, onBack, onContinue }: Step2PreviewProps) {
  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold tracking-tight">Preview your data</h2>
      <p className="mb-6 text-text-muted">Make sure this looks right before we generate your story.</p>

      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
        <Stat label="File Type" value={preview.file_type.toUpperCase()} />
        <Stat label="Data Type" value={DATA_TYPE_LABEL[preview.data_type] ?? preview.data_type} />
        {preview.row_count != null && <Stat label="Rows" value={String(preview.row_count)} />}
        {preview.column_count != null && <Stat label="Columns" value={String(preview.column_count)} />}
      </div>

      <div className="mb-8 rounded-xl border border-border bg-surface p-4">
        {preview.columns.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row, i) => (
                  <TableRow key={i}>
                    {preview.columns.map((col) => (
                      <TableCell key={col}>{row[col]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-text-muted">
            {preview.text_preview || "No preview available."}
          </p>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={onContinue} className="bg-brand hover:bg-brand-hover">
          Continue
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
