"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
      <p className="mb-6 max-w-sm text-sm text-text-muted">
        An unexpected error occurred. Try again, or head back to your dashboard.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => reset()}>
          Try again
        </Button>
        <Button render={<a href="/dashboard" />} nativeButton={false} className="bg-brand hover:bg-brand-hover">
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
