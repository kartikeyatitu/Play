// Sentry in the browser. On Next 15.1 withSentryConfig (next.config.ts) injects this file into the
// client entry; from Next 15.3 Next also loads it natively. No Session Replay (no replayIntegration).
//
// Off unless NEXT_PUBLIC_SENTRY_DSN is set at build time. next.config.ts always defines that var
// ("" when unset), so the `process.env.…` checks below are build-time constants and webpack drops
// the Sentry browser SDK from the bundle entirely while it's off. Keep the checks inline (not in a
// variable) or that dead-code elimination stops working.
import * as Sentry from "@sentry/nextjs";
import { commonSentryOptions } from "./lib/sentry-options";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    ...commonSentryOptions,
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Vercel exposes VERCEL_ENV to the browser as NEXT_PUBLIC_VERCEL_ENV (system env vars).
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  });
}

export const onRouterTransitionStart = process.env.NEXT_PUBLIC_SENTRY_DSN ? Sentry.captureRouterTransitionStart : undefined;
