"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Step3Configure, type StepConfig } from "@/components/upload/Step3Configure";
import { createReport } from "@/app/(app)/upload/actions";

interface GenerateReportDialogProps {
  uploadId: string;
  defaultIndustry: string | null;
  hasBrandKit: boolean;
}

export function GenerateReportDialog({ uploadId, defaultIndustry, hasBrandKit }: GenerateReportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleContinue = (config: StepConfig) => {
    setError(null);
    startTransition(async () => {
      const result = await createReport({
        upload_id: uploadId,
        formats: config.formats,
        pptx_theme: config.pptxTheme,
        apply_brand_kit: config.applyBrandKit,
        industry: config.industry,
        question: config.question || undefined,
      });
      if (result.success) {
        router.push(`/reports/${result.data.id}`);
      } else if (result.status === 402) {
        setError("You've reached your report limit for this plan. Upgrade to generate more.");
      } else {
        setError("Could not start report generation. Please try again.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Sparkles />
        Generate report
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate a report from this dataset</DialogTitle>
        </DialogHeader>
        <Step3Configure
          defaultIndustry={defaultIndustry}
          hasBrandKit={hasBrandKit}
          backLabel="Cancel"
          onBack={() => setOpen(false)}
          onContinue={handleContinue}
        />
        {error && <p className="text-sm text-error">{error}</p>}
        {isPending && (
          <p className="text-sm text-muted-foreground">Starting report generation…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
