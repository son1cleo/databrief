"use client";

import { useState } from "react";
import { Step1Upload } from "./Step1Upload";
import { Step2Preview } from "./Step2Preview";
import { Step3Configure, type StepConfig } from "./Step3Configure";
import { Step4Generate } from "./Step4Generate";
import { createReport } from "@/app/(app)/upload/actions";
import type { UploadPreview } from "@/lib/types";

interface UploadWizardProps {
  defaultIndustry: string | null;
  hasBrandKit: boolean;
}

const TOTAL_STEPS = 4;
const STEP_NAMES = ["UPLOAD FILE", "PREVIEW DATA", "CONFIGURE REPORT", "GENERATE"];

export function UploadWizard({ defaultIndustry, hasBrandKit }: UploadWizardProps) {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploadLoading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setUploadError(body?.detail ?? "Could not process that file. Try a different one.");
        return;
      }
      const data: UploadPreview = await res.json();
      setPreview(data);
      setStep(2);
    } catch {
      setUploadError("Upload failed. Check your connection and try again.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleConfigure = async (config: StepConfig) => {
    if (!preview) return;
    setGenerateError(null);
    const result = await createReport({
      upload_id: preview.upload_id,
      formats: config.formats,
      pptx_theme: config.pptxTheme,
      apply_brand_kit: config.applyBrandKit,
      industry: config.industry,
      question: config.question || undefined,
    });
    if (result.success) {
      setReportId(result.data.id);
      setStep(4);
    } else if (result.status === 402) {
      setGenerateError("You've reached your report limit for this plan. Upgrade to generate more.");
    } else {
      setGenerateError("Could not start report generation. Please try again.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-4">
      <div className="mb-10">
        <div className="mb-2 flex items-center justify-between font-mono text-xs">
          <span className="text-muted-foreground">
            STEP {step} OF {TOTAL_STEPS}
          </span>
          <span className="text-data-ink">{STEP_NAMES[step - 1]}</span>
        </div>
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {step === 1 && (
        <Step1Upload onUpload={handleUpload} loading={uploadLoading} error={uploadError} />
      )}
      {step === 2 && preview && (
        <Step2Preview preview={preview} onBack={() => setStep(1)} onContinue={() => setStep(3)} />
      )}
      {step === 3 && (
        <div>
          <Step3Configure
            defaultIndustry={defaultIndustry}
            hasBrandKit={hasBrandKit}
            onBack={() => setStep(2)}
            onContinue={handleConfigure}
          />
          {generateError && <p className="mt-4 text-center text-sm text-error">{generateError}</p>}
        </div>
      )}
      {step === 4 && reportId && <Step4Generate reportId={reportId} />}
    </div>
  );
}
