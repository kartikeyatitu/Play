// Sentry for the Node.js runtime (server components, route handlers, server actions).
// Loaded from src/instrumentation.ts. Does nothing unless SENTRY_DSN is set.
import * as Sentry from "@sentry/nextjs";
import { commonSentryOptions } from "./src/lib/sentry-options";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    ...commonSentryOptions,
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
}
