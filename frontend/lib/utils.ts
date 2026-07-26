import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Maps report/dataset processing statuses onto the shared Badge status variants. */
export function statusBadgeVariant(status: string): "success" | "warning" | "error" {
  if (status === "failed") return "error";
  if (status === "done") return "success";
  return "warning";
}
