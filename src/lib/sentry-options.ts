// Sentry options shared by the browser, Node and edge inits (src/instrumentation-client.ts,
// sentry.server.config.ts, sentry.edge.config.ts). Client-safe: no runtime imports.
// Sentry stays completely off unless a DSN env var is set; see .env.example.

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Phone numbers (various formats with optional country prefix) — scrubbed from error reports.
// No lookbehind: older iOS WebViews can't parse it and the whole client chunk would fail.
const PHONE = /(?:\+|\b)(?:91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d[\d\s-]{6,12}\d\b/g;

// Structural fields that never carry user data (and where a false positive would break grouping).
const SKIP_KEYS = new Set([
  "event_id", "trace_id", "span_id", "parent_span_id", "release", "dist", "sdk",
  "debug_meta", "stacktrace", "timestamp", "start_timestamp", "fingerprint",
]);

export function scrubText(s: string): string {
  return s.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

function scrubDeep(value: unknown, depth: number): unknown {
  if (typeof value === "string") return scrubText(value);
  if (!value || typeof value !== "object" || depth > 10) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = scrubDeep(value[i], depth + 1);
    return value;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!SKIP_KEYS.has(key)) obj[key] = scrubDeep(obj[key], depth + 1);
  }
  return obj;
}

/** Mask emails and phone numbers anywhere in an outgoing Sentry event (messages, breadcrumbs, URLs, extras). */
export function scrubEvent<T>(event: T): T {
  try {
    return scrubDeep(event, 0) as T;
  } catch {
    return event;
  }
}

export const commonSentryOptions = {
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
};
