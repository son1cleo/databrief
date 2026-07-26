"use client";

import { FileText, LayoutDashboard, Sparkles, Table2 } from "lucide-react";
import {
  FolderTab,
  FolderTabPanel,
  FolderTabs,
  FolderTabsList,
} from "@/components/ui/folder-tabs";
import { DatasetOverview } from "./DatasetOverview";
import { DatasetFindingsExplorer } from "./DatasetFindingsExplorer";
import { DataPreviewTable } from "./DataPreviewTable";
import { DatasetTextPreview } from "./DatasetTextPreview";
import { DatasetReportsList } from "./DatasetReportsList";
import type { DatasetInsights } from "@/lib/datasetAnalysis";
import type { UploadReportSummary } from "@/lib/types";

interface DatasetExplorerProps {
  insights: DatasetInsights;
  reports: UploadReportSummary[];
}

export function DatasetExplorer({ insights, reports }: DatasetExplorerProps) {
  const structured = insights.kind === "structured";
  const findingsCount = structured
    ? Object.values(insights.findingsByType).reduce((sum, list) => sum + list.length, 0)
    : 0;

  return (
    <FolderTabs defaultValue={structured ? "overview" : "text"}>
      <FolderTabsList>
        {structured && (
          <FolderTab value="overview" icon={LayoutDashboard}>
            Overview
          </FolderTab>
        )}
        {structured && (
          <FolderTab value="findings" icon={Sparkles} count={findingsCount || undefined}>
            Findings
          </FolderTab>
        )}
        {structured && (
          <FolderTab value="data" icon={Table2}>
            Data
          </FolderTab>
        )}
        {!structured && (
          <FolderTab value="text" icon={FileText}>
            Extracted text
          </FolderTab>
        )}
        <FolderTab value="reports" icon={FileText} count={reports.length || undefined}>
          Reports
        </FolderTab>
      </FolderTabsList>

      {insights.kind === "structured" && (
        <>
          <FolderTabPanel value="overview">
            <DatasetOverview
              rowCount={insights.rowCount}
              columnCount={insights.columnCount}
              dataQuality={insights.dataQuality}
              columns={insights.columns}
            />
          </FolderTabPanel>
          <FolderTabPanel value="findings">
            <DatasetFindingsExplorer findingsByType={insights.findingsByType} />
          </FolderTabPanel>
          <FolderTabPanel value="data">
            <DataPreviewTable columns={insights.preview.columns} rows={insights.preview.rows} />
          </FolderTabPanel>
        </>
      )}

      {insights.kind === "text" && (
        <FolderTabPanel value="text">
          <DatasetTextPreview
            charCount={insights.charCount}
            wordCount={insights.wordCount}
            preview={insights.preview}
          />
        </FolderTabPanel>
      )}

      <FolderTabPanel value="reports">
        <DatasetReportsList reports={reports} />
      </FolderTabPanel>
    </FolderTabs>
  );
}
