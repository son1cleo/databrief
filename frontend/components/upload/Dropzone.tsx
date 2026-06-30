"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = {
  "text/csv": [".csv"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/xml": [".xml"],
  "text/xml": [".xml"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
  "application/json": [".json"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

const MAX_SIZE_BYTES = 50 * 1024 * 1024;

interface DropzoneProps {
  onFileSelected: (file: File | null) => void;
}

export function Dropzone({ onFileSelected }: DropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        setError(rejected[0].errors[0]?.message ?? "File rejected");
        setFile(null);
        onFileSelected(null);
        return;
      }
      const picked = accepted[0] ?? null;
      setError(null);
      setFile(picked);
      onFileSelected(picked);
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_SIZE_BYTES,
    multiple: false,
  });

  const clear = () => {
    setFile(null);
    setError(null);
    onFileSelected(null);
  };

  if (file) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-brand shrink-0" />
          <div>
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-text-muted">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        </div>
        <button onClick={clear} className="text-text-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer",
          isDragActive ? "border-brand bg-brand/5 glow-accent" : "border-border bg-surface hover:border-text-subtle"
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className={cn("size-8", isDragActive ? "text-brand" : "text-text-muted")} />
        <p className="text-sm font-medium">Drag & drop a file, or click to browse</p>
        <p className="text-xs text-text-muted">CSV, Excel, XML, PDF, DOCX, TXT, JSON, PNG, JPG — up to 50MB</p>
      </div>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}
