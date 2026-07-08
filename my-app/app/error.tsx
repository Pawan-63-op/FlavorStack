"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getReporter } from "@/lib/observability/reporter";

/**
 * Root route error boundary (Phase 12, Batch 12.4). Catches unhandled render
 * errors anywhere in the segment tree and routes them through the
 * vendor-agnostic observability reporter so production render failures are
 * observable alongside API failures. `digest` is Next's server-error hash,
 * attached as context for correlation.
 */
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    getReporter().captureError(error, {
      source: "render",
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-sm">
        An unexpected error occurred. You can try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
