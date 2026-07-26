"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FindingWithChart } from "@/lib/datasetAnalysis";

interface DatasetFindingsExplorerProps {
  findingsByType: Record<string, FindingWithChart[]>;
}

const SECTION_ORDER = ["correlation", "trend", "outlier", "distribution", "ranking", "dose_response", "comparison"];

const SECTION_LABEL: Record<string, string> = {
  correlation: "Correlations",
  trend: "Trends",
  outlier: "Outliers",
  distribution: "Distributions",
  ranking: "Rankings",
  dose_response: "Dose-response",
  comparison: "Comparisons",
};

export function DatasetFindingsExplorer({ findingsByType }: DatasetFindingsExplorerProps) {
  const sections = SECTION_ORDER.filter((type) => (findingsByType[type]?.length ?? 0) > 0);
  const [activeType, setActiveType] = useState<string | null>(sections[0] ?? null);
  const [index, setIndex] = useState(0);

  if (sections.length === 0 || !activeType) {
    return <p className="text-sm text-text-muted">No notable patterns found beyond the column summary.</p>;
  }

  const items = findingsByType[activeType] ?? [];
  const current = items[index];

  const selectType = (type: string) => {
    setActiveType(type);
    setIndex(0);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {sections.map((type) => (
          <Button
            key={type}
            variant={type === activeType ? "default" : "outline"}
            size="sm"
            onClick={() => selectType(type)}
            className={cn(type === activeType && "bg-brand hover:bg-brand-hover")}
          >
            {SECTION_LABEL[type] ?? type}
            <span className="ml-1 text-xs opacity-70">{findingsByType[type].length}</span>
          </Button>
        ))}
      </div>

      {current && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {index + 1} of {items.length}
            </span>
            {items.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
                  aria-label="Previous finding"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setIndex((i) => (i + 1) % items.length)}
                  aria-label="Next finding"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {current.chart && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${current.chart}`}
              alt=""
              className="mb-4 max-w-full rounded border border-border"
            />
          )}
          <p className="text-sm text-text-muted">{current.finding.description}</p>
        </div>
      )}
    </div>
  );
}
