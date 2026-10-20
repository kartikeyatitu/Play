"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Caught: unhandled errors inside the /org admin tree.
 * Keeps a visible frame rather than falling back to the generic root error.
 */
export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vercel captures these; this console line also surfaces in local dev.
    console.error("[/org] route error", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">Something went wrong on this page</h2>
          <p className="mt-1 text-sm text-ink-subtle">
            A page in your admin dashboard failed to load. Your data is safe — the error has been reported.
          </p>
          {error.digest && (
            <p className="mt-2 text-[11px] text-ink-subtle font-mono">Error ID: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={() => reset()} className="gap-2">
            <RotateCw className="h-4 w-4" /> Try again
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/org")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
