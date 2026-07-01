"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getReport } from "@/app/(app)/upload/actions";
import type { ReportOut } from "@/lib/types";

const PIPELINE = [
  { cmd: "file_service.detect_format()", done: "csv detected" },
  { cmd: "analysis_service.run()", done: "12 findings" },
  { cmd: "insight_service.rank()", done: "top 5 selected" },
  { cmd: "story_service.build_arc()", done: "arc complete" },
  { cmd: "llm_service.narrate()", done: "writing story..." },
];

interface Step4GenerateProps {
  reportId: string;
}

export function Step4Generate({ reportId }: Step4GenerateProps) {
  const router = useRouter();
  const [report, setReport] = useState<ReportOut | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, PIPELINE.length - 1));
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const r = await getReport(reportId);
        if (cancelled) return;
        setReport(r);
        if (r.status !== "done" && r.status !== "failed") {
          setTimeout(poll, 3000);
        }
      } catch {
        if (!cancelled) setError("Something went wrong while checking on your report.");
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (error) {
    return <p className="text-center font-mono text-sm text-error">{error}</p>;
  }

  if (report?.status === "done") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-lg bg-success/15">
          <span className="text-2xl text-success">✓</span>
        </div>
        <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-foreground">
          Your story is ready.
        </h2>
        <p className="mb-8 font-mono text-sm text-muted-foreground">
          {report.title ?? "Untitled Report"}
        </p>
        <Button
          size="lg"
          onClick={() => router.push(`/reports/${report.id}`)}
          className="bg-brand font-mono hover:bg-brand-hover"
        >
          View report
        </Button>
      </div>
    );
  }

  if (report?.status === "failed") {
    return (
      <div className="text-center">
        <p className="mb-2 font-mono text-lg font-semibold text-error">Generation failed</p>
        <p className="font-mono text-sm text-muted-foreground">
          {report.error_message ?? "Please try again."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-center font-display text-2xl font-bold tracking-tight text-foreground">
        Analyzing your data...
      </h2>
      <div className="glow-brand rounded-lg border border-border bg-surface p-5">
        <div className="space-y-2">
          {PIPELINE.map((step, i) => {
            if (i > stepIndex) return null;
            const isCurrent = i === stepIndex;
            return (
              <div
                key={step.cmd}
                className="flex items-center justify-between gap-4 font-mono text-xs"
              >
                <span className="text-data-ink">{`> ${step.cmd}`}</span>
                <span className={isCurrent ? "text-data-ink" : "text-success"}>
                  {isCurrent ? "⟳" : "✓"} {step.done}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
