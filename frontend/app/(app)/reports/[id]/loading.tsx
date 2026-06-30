import { Skeleton } from "@/components/ui/skeleton";

export default function ReportDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="mb-3 h-10 w-3/4" />
      <Skeleton className="mb-8 h-4 w-1/2" />
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
