import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

/** Origin of a URL-like env var (e.g. a Sentry DSN), or null when unset/invalid. */
function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

// Observability endpoints are only allowed by the CSP when the matching env var is set.
const sentryOrigin = originOf(process.env.NEXT_PUBLIC_SENTRY_DSN); // e.g. https://o123.ingest.us.sentry.io
// PostHog only needs connect-src: src/lib/analytics.ts disables its external script loading.
const posthogOrigin = process.env.NEXT_PUBLIC_POSTHOG_KEY ? originOf(process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com") : null;
const observabilityConnect = [sentryOrigin, posthogOrigin]
  .filter(Boolean)
  .map((o) => ` ${o}`)
  .join("");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Performance: don't advertise the framework, keep gzip on for self-hosted/dev
  // (Vercel's edge also compresses with brotli), serve modern image formats.
  poweredByHeader: false,
  compress: true,
  // Always define these ("" when unset) so client checks on them are build-time constants and the
  // Sentry browser SDK is dropped from the bundle while it's switched off (src/instrumentation-client.ts).
  env: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://accounts.google.com/gsi/client" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://accounts.google.com" + observabilityConnect,
      "frame-src https://api.razorpay.com https://checkout.razorpay.com https://accounts.google.com",
      "media-src 'self' blob:",
      "worker-src 'self'",
      "form-action 'self' https://api.razorpay.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com"), clipboard-write=(self), web-share=(self)' },
        ],
      },
    ];
  },
};

// Source maps are uploaded to Sentry only when all three build-time vars are present. Without them
// (local builds, Vercel before Sentry is set up) nothing is generated or uploaded, no release is
// created, and plugin errors are logged instead of failing the build.
const sentryUpload = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !sentryUpload },
  release: { create: sentryUpload, finalize: sentryUpload },
  widenClientFileUpload: sentryUpload,
  errorHandler: (err) => {
    console.warn("[sentry] build plugin error (ignored):", err.message);
  },
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
