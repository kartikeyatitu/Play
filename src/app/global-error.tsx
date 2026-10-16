"use client";

// Last-resort error boundary: replaces the root layout when it (or anything above a nested
// error boundary) throws while rendering. Reports to Sentry when it's configured.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Build-time constant (see src/instrumentation-client.ts): Sentry is tree-shaken out when off.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#09090b", color: "#fafafa", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#a1a1aa", margin: 0, maxWidth: 360 }}>Please try again. If it keeps happening, reload the app.</p>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "#a3e635", color: "#09090b", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid #3f3f46", background: "transparent", color: "#fafafa", fontWeight: 600, cursor: "pointer" }}
            >
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
