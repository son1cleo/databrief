"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  return (
    <Tabs defaultValue={insights.kind === "structured" ? "overview" : "text"}>
      <TabsList>
        {insights.kind === "structured" && <TabsTrigger value="overview">Overview</TabsTrigger>}
        {insights.kind === "structured" && <TabsTrigger value="findings">Findings</TabsTrigger>}
        {insights.kind === "structured" && <TabsTrigger value="data">Data</TabsTrigger>}
        {insights.kind === "text" && <TabsTrigger value="text">Extracted text</TabsTrigger>}
        <TabsTrigger value="reports">Reports{reports.length > 0 ? ` (${reports.length})` : ""}</TabsTrigger>
      </TabsList>

      {insights.kind === "structured" && (
        <>
          <TabsContent value="overview">
            <DatasetOverview
              rowCount={insights.rowCount}
              columnCount={insights.columnCount}
              dataQuality={insights.dataQuality}
              columns={insights.columns}
            />
          </TabsContent>
          <TabsContent value="findings">
            <DatasetFindingsExplorer findingsByType={insights.findingsByType} />
          </TabsContent>
          <TabsContent value="data">
            <DataPreviewTable columns={insights.preview.columns} rows={insights.preview.rows} />
          </TabsContent>
        </>
      )}

      {insights.kind === "text" && (
        <TabsContent value="text">
          <DatasetTextPreview
            charCount={insights.charCount}
            wordCount={insights.wordCount}
            preview={insights.preview}
          />
        </TabsContent>
      )}

      <TabsContent value="reports">
        <DatasetReportsList reports={reports} />
      </TabsContent>
    </Tabs>
  );
}
