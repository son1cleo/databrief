"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
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
    return (
      <Panel className="px-6 py-14 text-center">
        <p className="text-sm text-muted-foreground">
          No notable patterns found beyond the column summary.
        </p>
      </Panel>
    );
  }

  const items = findingsByType[activeType] ?? [];
  const current = items[index];

  const selectType = (type: string) => {
    setActiveType(type);
    setIndex(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {sections.map((type) => {
          const active = type === activeType;
          return (
            <button
              key={type}
              type="button"
              onClick={() => selectType(type)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active
                  ? "border-border-soft bg-surface text-foreground shadow-card"
                  : "border-transparent text-muted-foreground hover:bg-surface/60 hover:text-foreground"
              )}
            >
              <span className="font-medium">{SECTION_LABEL[type] ?? type}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                  active ? "bg-brand/15 text-brand" : "bg-inset"
                )}
              >
                {findingsByType[type].length}
              </span>
            </button>
          );
        })}
      </div>

      {current && (
        <Panel>
          <PanelHeader
            icon={Sparkles}
            title={SECTION_LABEL[activeType] ?? activeType}
            description={`Finding ${index + 1} of ${items.length}`}
            action={
              items.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
                    aria-label="Previous finding"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setIndex((i) => (i + 1) % items.length)}
                    aria-label="Next finding"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              )
            }
          />
          <PanelBody className="space-y-4">
            {current.chart && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${current.chart}`}
                alt=""
                className="max-w-full rounded-xl bg-inset"
              />
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {current.finding.description}
            </p>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
