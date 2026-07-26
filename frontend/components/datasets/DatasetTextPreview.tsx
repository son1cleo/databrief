import { FileText, Hash, Type } from "lucide-react";
import { MetaBox } from "@/components/ui/meta-box";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

interface DatasetTextPreviewProps {
  charCount: number;
  wordCount: number;
  preview: string;
}

export function DatasetTextPreview({ charCount, wordCount, preview }: DatasetTextPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <MetaBox icon={Type} label="Words" value={wordCount.toLocaleString()} />
        <MetaBox icon={Hash} label="Characters" value={charCount.toLocaleString()} />
      </div>

      <Panel>
        <PanelHeader icon={FileText} title="Extracted text" description="First portion of the document" />
        <PanelBody>
          <p className="max-h-128 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {preview || "No preview available."}
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
