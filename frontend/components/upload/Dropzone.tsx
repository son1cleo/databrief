"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { CloudUpload, FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
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
      <div className="flex items-center justify-between gap-3 rounded-xl bg-inset p-4">
        <div className="flex min-w-0 items-center gap-3">
          <IconBadge icon={FileText} color="brand" size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={clear} aria-label="Remove file">
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-150",
          isDragActive
            ? "border-brand bg-brand/5"
            : "border-border-soft bg-inset hover:border-brand/40"
        )}
      >
        <input {...getInputProps()} />
        <IconBadge
          icon={CloudUpload}
          color={isDragActive ? "brand" : "muted"}
          size="xl"
          className={isDragActive ? undefined : "bg-surface"}
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            {isDragActive ? "Drop your file here" : "Drag a file here, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Up to 50MB</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
          {FILE_TYPES.map((type) => (
            <Badge key={type} variant="outline" className="uppercase">
              {type}
            </Badge>
          ))}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}
