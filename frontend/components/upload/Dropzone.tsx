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
const FILE_TYPES = ["csv", "xlsx", "xml", "pdf", "docx", "json", "png", "jpg"];

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
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <FileText className="size-5 shrink-0 text-brand" />
          <div>
            <p className="font-mono text-sm text-foreground">{file.name}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
        </div>
        <button onClick={clear} className="text-muted-foreground hover:text-foreground">
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
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          isDragActive
            ? "glow-brand border-brand bg-brand/5"
            : "border-border bg-surface hover:border-foreground/30"
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className={cn("size-8", isDragActive ? "text-brand" : "text-muted-foreground")} />
        <p className="font-mono text-sm text-muted-foreground">
          drag_file_here.{"{csv,xlsx,pdf}"}
        </p>
        <p className="font-mono text-xs text-muted-foreground">or click to browse</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {FILE_TYPES.map((type) => (
            <span
              key={type}
              className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {type}
            </span>
          ))}
        </div>
      </div>
      {error && <p className="mt-2 font-mono text-xs text-error">{error}</p>}
    </div>
  );
}
