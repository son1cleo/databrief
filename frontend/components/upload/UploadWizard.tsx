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

// Above this size, upload via multipart instead of one PUT: several parts in
// parallel use available bandwidth better than a single stream, and a failed
// part only retries that part instead of restarting the whole transfer.
const MULTIPART_THRESHOLD_BYTES = 20 * 1024 * 1024;
const PART_SIZE_BYTES = 10 * 1024 * 1024;
const PART_CONCURRENCY = 5;
const PART_MAX_RETRIES = 3;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface CompletedPart {
  partNumber: number;
  etag: string;
}

/** Single-shot presign + PUT, unchanged from before -- used for files under
 * the multipart threshold. */
async function uploadFileSingle(file: File): Promise<{ objectKey: string }> {
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
    throw new Error(body?.error ?? "Could not start upload.");
  }
  const { uploadUrl, objectKey } = await presignRes.json();

  const putRes = await fetchWithTimeout(
    uploadUrl,
    { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file },
    STORAGE_PUT_TIMEOUT_MS
  );
  if (!putRes.ok) throw new Error("Upload to storage failed. Try again.");

  return { objectKey };
}

/** Multipart upload for large files: init -> upload parts with bounded
 * concurrency and per-part retry -> complete. All part/ETag bookkeeping
 * lives here in memory for the duration of the upload only -- storage
 * itself tracks the in-progress UploadId, so nothing is persisted server
 * side beyond that until the object is fully assembled. */
async function uploadFileMultipart(file: File): Promise<{ objectKey: string }> {
  const initRes = await fetchWithTimeout(
    "/api/uploads/multipart/init",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    },
    PRESIGN_TIMEOUT_MS
  );
  if (!initRes.ok) {
    const body = await initRes.json().catch(() => ({}));
    throw new Error(body?.error ?? "Could not start upload.");
  }
  const { uploadId, objectKey }: { uploadId: string; objectKey: string } = await initRes.json();

  const totalParts = Math.ceil(file.size / PART_SIZE_BYTES);
  const completedParts: CompletedPart[] = new Array(totalParts);

  const uploadPart = async (partNumber: number): Promise<void> => {
    const start = (partNumber - 1) * PART_SIZE_BYTES;
    const end = Math.min(start + PART_SIZE_BYTES, file.size);
    const blob = file.slice(start, end);

    let lastError: unknown;
    for (let attempt = 1; attempt <= PART_MAX_RETRIES; attempt++) {
      try {
        const signRes = await fetchWithTimeout(
          "/api/uploads/multipart/sign-part",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ objectKey, uploadId, partNumber }),
          },
          PRESIGN_TIMEOUT_MS
        );
        if (!signRes.ok) throw new Error(`Could not get an upload URL for part ${partNumber}.`);
        const { url }: { url: string } = await signRes.json();

        const putRes = await fetchWithTimeout(url, { method: "PUT", body: blob }, STORAGE_PUT_TIMEOUT_MS);
        if (!putRes.ok) throw new Error(`Part ${partNumber} failed to upload.`);
        // Requires the storage bucket's CORS config to expose the ETag
        // header to the browser (ExposeHeaders including "ETag") -- without
        // it this comes back null even though the PUT itself succeeded.
        const etag = putRes.headers.get("ETag");
        if (!etag) throw new Error(`Part ${partNumber} completed but no ETag was returned.`);
        completedParts[partNumber - 1] = { partNumber, etag };
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Part ${partNumber} failed after ${PART_MAX_RETRIES} attempts.`);
  };

  const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
  let cursor = 0;
  const worker = async () => {
    while (cursor < partNumbers.length) {
      await uploadPart(partNumbers[cursor++]);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, totalParts) }, worker));
  } catch (err) {
    // Best-effort cleanup so storage doesn't keep an orphaned incomplete
    // upload -- the original error is what the user needs to see, not
    // whether cleanup itself succeeded.
    fetch("/api/uploads/multipart/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectKey, uploadId }),
    }).catch(() => {});
    throw err;
  }

  const completeRes = await fetchWithTimeout(
    "/api/uploads/multipart/complete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectKey, uploadId, parts: completedParts }),
    },
    PRESIGN_TIMEOUT_MS
  );
  if (!completeRes.ok) {
    const body = await completeRes.json().catch(() => ({}));
    throw new Error(body?.error ?? "Could not finish upload.");
  }

  return { objectKey };
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
      // 1. Upload the raw bytes straight to storage -- single PUT for small
      // files, multipart (parallel parts, per-part retry) above the
      // threshold -- keeping file bytes off our own serverless functions
      // entirely either way (avoids Vercel's body-size limit).
      const { objectKey } =
        file.size > MULTIPART_THRESHOLD_BYTES ? await uploadFileMultipart(file) : await uploadFileSingle(file);

      // 2. Ask the server to parse it and create the Upload record.
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
      if (err instanceof DOMException && err.name === "AbortError") {
        setUploadError("This is taking longer than expected. Please try again.");
      } else if (err instanceof Error && err.message) {
        setUploadError(err.message);
      } else {
        setUploadError("Upload failed. Check your connection and try again.");
      }
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
      questions: config.questions,
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
