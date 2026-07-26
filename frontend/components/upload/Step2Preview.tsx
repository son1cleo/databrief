import { Columns3, FileSpreadsheet, Rows3, ScanEye, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetaBox } from "@/components/ui/meta-box";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
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
    <Panel>
      <PanelHeader
        icon={ScanEye}
        title="Preview your data"
        description="Make sure this looks right before we generate your story."
      />
      <PanelBody className="space-y-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetaBox
            icon={FileSpreadsheet}
            label="File type"
            value={preview.file_type.toUpperCase()}
          />
          <MetaBox
            icon={Shapes}
            label="Data type"
            value={DATA_TYPE_LABEL[preview.data_type] ?? preview.data_type}
          />
          {preview.row_count != null && (
            <MetaBox icon={Rows3} label="Rows" value={preview.row_count.toLocaleString()} />
          )}
          {preview.column_count != null && (
            <MetaBox icon={Columns3} label="Columns" value={String(preview.column_count)} />
          )}
        </div>

        <div className="overflow-hidden rounded-xl bg-inset">
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
            <p className="max-h-80 overflow-y-auto p-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {preview.text_preview || "No preview available."}
            </p>
          )}
        </div>
      </PanelBody>
      <PanelFooter className="justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue}>Continue</Button>
      </PanelFooter>
    </Panel>
  );
}
