"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "./Dropzone";

interface Step1UploadProps {
  onUpload: (file: File) => void;
  loading: boolean;
  error: string | null;
}

export function Step1Upload({ onUpload, loading, error }: Step1UploadProps) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold tracking-tight">Upload your data</h2>
      <p className="mb-8 text-text-muted">
        CSV, Excel, XML, PDF, DOCX, TXT, JSON, PNG, or JPG — up to 50MB.
      </p>

      <Dropzone onFileSelected={setFile} />
      {error && <p className="mt-3 text-sm text-error">{error}</p>}

      <div className="mt-8 flex justify-end">
        <Button
          size="lg"
          disabled={!file || loading}
          onClick={() => file && onUpload(file)}
          className="bg-brand hover:bg-brand-hover"
        >
          {loading ? "Uploading..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
