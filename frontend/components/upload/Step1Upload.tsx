"use client";

import { useState } from "react";
import { CloudUpload, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { Dropzone } from "./Dropzone";

type UploadPhase = "idle" | "uploading" | "processing";

interface Step1UploadProps {
  onUpload: (file: File) => void;
  phase: UploadPhase;
  error: string | null;
}

const PHASE_LABEL: Record<UploadPhase, string> = {
  idle: "Continue",
  uploading: "Uploading…",
  processing: "Processing…",
};

export function Step1Upload({ onUpload, phase, error }: Step1UploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const loading = phase !== "idle";

  return (
    <Panel>
      <PanelHeader
        icon={CloudUpload}
        title="Upload your data"
        description="CSV, Excel, XML, PDF, DOCX, TXT, JSON, PNG, or JPG — up to 50MB."
      />
      <PanelBody className="space-y-3">
        <Dropzone onFileSelected={setFile} />
        {error && (
          <p className="flex items-start gap-2 text-sm text-error">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
      </PanelBody>
      <PanelFooter className="justify-end">
        <Button disabled={!file || loading} onClick={() => file && onUpload(file)}>
          {PHASE_LABEL[phase]}
        </Button>
      </PanelFooter>
    </Panel>
  );
}
