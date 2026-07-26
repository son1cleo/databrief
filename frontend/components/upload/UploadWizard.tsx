"use client";

import { useState } from "react";
import { Step1Upload } from "./Step1Upload";
import { Step2Preview } from "./Step2Preview";
import { Step3Configure, type StepConfig } from "./Step3Configure";
import { Step4Generate } from "./Step4Generate";
import { WizardSteps } from "./WizardSteps";
import { createReport } from "@/app/(app)/upload/actions";
import type { UploadPreview } from "@/lib/types";

interface UploadWizardProps {
  defaultIndustry: string | null;
  hasBrandKit: boolean;
}

const STEP_NAMES = ["Upload file", "Preview data", "Configure", "Generate"];

// Every step here talks to a network dependency (our API, then storage, then
// our API again) that can stall without erroring -- an unbounded fetch just
// leaves the UI on "Uploading..." forever with no way out. These cap how
// long we wait before giving up and showing a retryable error.
const PRESIGN_TIMEOUT_MS = 15_000;
const STORAGE_PUT_TIMEOUT_MS = 5 * 60_000;
const PARSE_TIMEOUT_MS = 3 * 60_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function UploadWizard({ defaultIndustry, hasBrandKit }: UploadWizardProps) {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploadPhase("uploading");
    setUploadError(null);
    try {
      // 1. Get a presigned R2 upload URL — keeps file bytes off our own
      // serverless functions entirely (avoids Vercel's body-size limit).
      const presignRes = await fetchWithTimeout(
        "/api/uploads/presign",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        },
        PRESIGN_TIMEOUT_MS
      );
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({}));
        setUploadError(body?.error ?? "Could not start upload.");
        return;
      }
      const { uploadUrl, objectKey } = await presignRes.json();

      // 2. Upload the raw bytes straight to R2.
      const putRes = await fetchWithTimeout(
        uploadUrl,
        {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        },
        STORAGE_PUT_TIMEOUT_MS
      );
      if (!putRes.ok) {
        setUploadError("Upload to storage failed. Try again.");
        return;
      }

      // 3. Ask the server to parse it and create the Upload record.
      setUploadPhase("processing");
      const parseRes = await fetchWithTimeout(
        "/api/uploads",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectKey, filename: file.name }),
        },
        PARSE_TIMEOUT_MS
      );
      if (!parseRes.ok) {
        const body = await parseRes.json().catch(() => ({}));
        setUploadError(body?.error ?? "Could not process that file. Try a different one.");
        return;
      }
      const data: UploadPreview = await parseRes.json();
      setPreview(data);
      setStep(2);
    } catch (err) {
      setUploadError(
        err instanceof DOMException && err.name === "AbortError"
          ? "This is taking longer than expected. Please try again."
          : "Upload failed. Check your connection and try again."
      );
    } finally {
      setUploadPhase("idle");
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
    <div className="mx-auto max-w-3xl space-y-5">
      <WizardSteps step={step} labels={STEP_NAMES} />

      {step === 1 && (
        <Step1Upload onUpload={handleUpload} phase={uploadPhase} error={uploadError} />
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
