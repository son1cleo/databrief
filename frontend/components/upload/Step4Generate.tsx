"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { getReport } from "@/app/(app)/upload/actions";
import type { ReportOut } from "@/lib/types";

const PIPELINE = [
  { cmd: "Detecting file format", done: "format detected" },
  { cmd: "Running analysis", done: "findings extracted" },
  { cmd: "Ranking insights", done: "top insights selected" },
  { cmd: "Building the story arc", done: "arc complete" },
  { cmd: "Writing the narrative", done: "writing…" },
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
    return (
      <Panel className="flex flex-col items-center border-error/25 bg-error/5 px-6 py-12 text-center">
        <IconBadge icon={TriangleAlert} color="error" size="xl" />
        <p className="mt-4 text-sm text-error">{error}</p>
      </Panel>
    );
  }

  if (report?.status === "done") {
    return (
      <Panel className="flex flex-col items-center px-6 py-14 text-center">
        <IconBadge icon={Check} color="success" size="xl" />
        <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground">
          Your story is ready.
        </h2>
        <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
          {report.title ?? "Untitled report"}
        </p>
        <Button size="lg" onClick={() => router.push(`/reports/${report.id}`)}>
          View report
        </Button>
      </Panel>
    );
  }

  if (report?.status === "failed") {
    return (
      <Panel className="flex flex-col items-center border-error/25 bg-error/5 px-6 py-12 text-center">
        <IconBadge icon={TriangleAlert} color="error" size="xl" />
        <p className="mt-4 text-base font-semibold text-error">Generation failed</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {report.error_message ?? "Please try again."}
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader
        icon={Sparkles}
        title="Analyzing your data…"
        description="This usually takes under a minute."
      />
      <PanelBody className="space-y-2">
        {PIPELINE.map((step, i) => {
          if (i > stepIndex) return null;
          const isCurrent = i === stepIndex;
          return (
            <div
              key={step.cmd}
              className="flex items-center justify-between gap-4 rounded-xl bg-inset px-3.5 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2.5 text-sm text-foreground">
                {isCurrent ? (
                  <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
                ) : (
                  <Check className="size-4 shrink-0 text-success" />
                )}
                <span className="truncate">{step.cmd}</span>
              </span>
              <span
                className={`shrink-0 font-mono text-[10px] tracking-wide uppercase ${
                  isCurrent ? "text-brand" : "text-success"
                }`}
              >
                {step.done}
              </span>
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}
