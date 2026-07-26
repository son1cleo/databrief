"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenerateReportDialog } from "./GenerateReportDialog";
import { deleteDataset } from "@/app/(app)/datasets/actions";

interface DatasetDetailActionsProps {
  uploadId: string;
  filename: string;
  reportsCount: number;
  defaultIndustry: string | null;
  hasBrandKit: boolean;
}

export function DatasetDetailActions({
  uploadId,
  filename,
  reportsCount,
  defaultIndustry,
  hasBrandKit,
}: DatasetDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const message =
      reportsCount > 0
        ? `Delete "${filename}"? This will also delete ${reportsCount} report${
            reportsCount === 1 ? "" : "s"
          } generated from it. This can't be undone.`
        : `Delete "${filename}"? This can't be undone.`;
    if (!confirm(message)) return;

    startTransition(async () => {
      await deleteDataset(uploadId);
      router.push("/datasets");
    });
  };

  return (
    <div className="flex items-center gap-2">
      <GenerateReportDialog uploadId={uploadId} defaultIndustry={defaultIndustry} hasBrandKit={hasBrandKit} />
      <Button
        variant="outline"
        size="icon"
        nativeButton={false}
        render={<a href={`/api/uploads/${uploadId}/download`} />}
        aria-label="Download original file"
      >
        <Download className="size-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={handleDelete} disabled={isPending} aria-label="Delete dataset">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
