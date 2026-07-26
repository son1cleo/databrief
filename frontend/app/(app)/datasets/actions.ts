"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { listUploadsForUser, deleteUploadForUser, getUploadForUser } from "@/lib/uploads";
import { buildDatasetInsights, type DatasetInsights } from "@/lib/datasetAnalysis";
import { StorageTimeoutError } from "@/lib/storage";
import { ApiError } from "@/lib/api";
import type { UploadListItem, UploadDetail } from "@/lib/types";

export async function listDatasets(limit = 50, offset = 0): Promise<UploadListItem[]> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return listUploadsForUser(user.id, limit, offset) as Promise<UploadListItem[]>;
}

export interface DatasetDetail {
  upload: UploadDetail;
  insights: DatasetInsights | null;
  /** Set when status is "done" but insights still couldn't be loaded (e.g.
   * the stored file is missing or storage timed out) -- lets the page show a
   * specific reason instead of just silently rendering nothing. */
  insightsError: string | null;
}

function insightsErrorMessage(err: unknown): string {
  if (err instanceof Error && err.name === "NoSuchKey") {
    return "The original file for this dataset is no longer available in storage.";
  }
  if (err instanceof StorageTimeoutError) {
    return "Storage took too long to respond. Try refreshing the page.";
  }
  return "Could not load a preview for this file.";
}

export async function getDataset(uploadId: string): Promise<DatasetDetail> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const upload = await getUploadForUser(user.id, uploadId);
  if (!upload) throw new ApiError(404, "Dataset not found");

  const uploadOut: UploadDetail = {
    id: upload.id,
    filename: upload.filename,
    file_type: upload.fileType,
    data_type: upload.dataType,
    file_size_bytes: upload.fileSizeBytes,
    row_count: upload.rowCount,
    column_count: upload.columnCount,
    status: upload.status,
    error_message: upload.errorMessage,
    created_at: upload.createdAt.toISOString(),
    reports_count: upload.reports.length,
    reports: upload.reports.map((report) => ({
      id: report.id,
      title: report.title,
      status: report.status,
      created_at: report.createdAt.toISOString(),
    })),
  };

  let insights: DatasetInsights | null = null;
  let insightsError: string | null = null;
  if (upload.status === "done") {
    try {
      insights = await buildDatasetInsights(upload);
    } catch (err) {
      insightsError = insightsErrorMessage(err);
    }
  }

  return { upload: uploadOut, insights, insightsError };
}

export async function deleteDataset(uploadId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await deleteUploadForUser(user.id, uploadId);
  revalidatePath("/datasets");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}
