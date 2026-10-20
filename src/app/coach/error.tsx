"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function CoachError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/coach] route error", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">The coach app hit an error</h2>
          <p className="mt-1 text-sm text-ink-subtle">
            Try again — your attendance and session data are safe.
          </p>
          {error.digest && (
            <p className="mt-2 text-[11px] text-ink-subtle font-mono">Error ID: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={() => reset()} className="gap-2">
            <RotateCw className="h-4 w-4" /> Try again
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/coach")}>
            Back to today
          </Button>
        </div>
      </div>
    </div>
  );
}
