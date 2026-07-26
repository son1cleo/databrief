import "server-only";
import { prisma } from "@/lib/db";
import { deleteObject, deletePrefix } from "@/lib/storage";
import type { Upload } from "@/lib/generated/prisma/client";

type UploadWithReportCount = Upload & { _count: { reports: number } };

export type UploadWithReports = Upload & {
  reports: { id: string; title: string | null; status: string; createdAt: Date }[];
};

export async function getUploadForUser(userId: string, uploadId: string): Promise<UploadWithReports | null> {
  return prisma.upload.findFirst({
    where: { id: uploadId, userId },
    include: {
      reports: {
        select: { id: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export function toUploadListItem(upload: UploadWithReportCount) {
  return {
    id: upload.id,
    filename: upload.filename,
    file_type: upload.fileType,
    data_type: upload.dataType,
    file_size_bytes: upload.fileSizeBytes,
    row_count: upload.rowCount,
    column_count: upload.columnCount,
    status: upload.status,
    created_at: upload.createdAt.toISOString(),
    reports_count: upload._count.reports,
  };
}

export async function listUploadsForUser(userId: string, limit = 50, offset = 0) {
  const uploads = await prisma.upload.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    skip: offset,
    include: { _count: { select: { reports: true } } },
  });
  return uploads.map(toUploadListItem);
}

/** Deletes the upload's own file plus every dependent report's exported
 * files from storage, then deletes the Upload row — Postgres cascades the
 * Report rows themselves, but cascade delete only removes database rows, it
 * never touches the actual PDF/Word/PPTX objects sitting in object storage,
 * so those have to be cleaned up explicitly here first. */
export async function deleteUploadForUser(userId: string, uploadId: string): Promise<boolean> {
  const upload = await prisma.upload.findFirst({
    where: { id: uploadId, userId },
    include: { reports: { select: { id: true } } },
  });
  if (!upload) return false;

  await Promise.all(upload.reports.map((report) => deletePrefix(`reports/${report.id}/`)));
  await deleteObject(upload.storagePath).catch(() => {});

  await prisma.upload.delete({ where: { id: upload.id } });
  return true;
}
