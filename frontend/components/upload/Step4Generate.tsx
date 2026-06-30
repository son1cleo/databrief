"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getReport } from "@/app/(app)/upload/actions";
import type { ReportOut } from "@/lib/types";

const STATUS_MESSAGES = [
  "Detecting data structure...",
  "Finding patterns...",
  "Ranking insights by surprise...",
  "Writing your story...",
  "Building your report...",
];

interface Step4GenerateProps {
  reportId: string;
}

export function Step4Generate({ reportId }: Step4GenerateProps) {
  const router = useRouter();
  const [report, setReport] = useState<ReportOut | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, 2200);
    return () => clearInterval(messageTimer);
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
    return <p className="text-center text-sm text-error">{error}</p>;
  }

  if (report?.status === "done") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-success/15">
          <span className="text-2xl">✓</span>
        </div>
        <h2 className="mb-2 text-2xl font-semibold tracking-tight">Your story is ready.</h2>
        <p className="mb-8 text-text-muted">{report.title ?? "Untitled Report"}</p>
        <Button
          size="lg"
          onClick={() => router.push(`/reports/${report.id}`)}
          className="bg-brand hover:bg-brand-hover"
        >
          View report
        </Button>
      </div>
    );
  }

  if (report?.status === "failed") {
    return (
      <div className="text-center">
        <p className="mb-2 text-lg font-semibold text-error">Generation failed</p>
        <p className="text-text-muted">{report.error_message ?? "Please try again."}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-8 size-12 animate-spin rounded-full border-2 border-border border-t-brand" />
      <h2 className="mb-2 text-2xl font-semibold tracking-tight">Analyzing your data...</h2>
      <p className="text-text-muted">{STATUS_MESSAGES[messageIndex]}</p>
    </div>
  );
}
