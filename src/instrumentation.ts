import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Errors from server components, route handlers and server actions. A no-op while Sentry isn't initialised.
export const onRequestError = Sentry.captureRequestError;
