// Retry policy for outbound messages. Pure: no DB, no clock reads (pass `now`).

import type { DeliveryStatus } from "./types";

export const MAX_ATTEMPTS = 5;
/** First retry after 1 minute, then 2, 4, 8 ... capped at 6 hours. */
export const BASE_DELAY_MS = 60_000;
export const MAX_DELAY_MS = 6 * 60 * 60_000;

/** Delay before the next attempt, given how many attempts have already been made (>= 1). */
export function backoffDelayMs(attemptsMade: number): number {
  const n = Math.max(1, Math.floor(attemptsMade || 1));
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (n - 1));
}

export interface AttemptOutcome {
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: Date | null;
}

/**
 * What a delivery row becomes after one attempt.
 * - success -> SENT, no next attempt
 * - non-retryable failure, or MAX_ATTEMPTS reached -> FAILED
 * - otherwise -> RETRYING at now + backoff
 */
export function nextAttempt(prevAttempts: number, ok: boolean, retryable: boolean, now: Date): AttemptOutcome {
  const attempts = Math.max(0, Math.floor(prevAttempts || 0)) + 1;
  if (ok) return { status: "SENT", attempts, nextAttemptAt: null };
  if (!retryable || attempts >= MAX_ATTEMPTS) return { status: "FAILED", attempts, nextAttemptAt: null };
  return { status: "RETRYING", attempts, nextAttemptAt: new Date(now.getTime() + backoffDelayMs(attempts)) };
}

/** True when a row should be picked up by the retry cron now. */
export function isDue(row: { status: string; attempts: number; nextAttemptAt: Date | null }, now: Date): boolean {
  if (row.status !== "RETRYING" && row.status !== "QUEUED") return false;
  if (row.attempts >= MAX_ATTEMPTS) return false;
  return !row.nextAttemptAt || row.nextAttemptAt.getTime() <= now.getTime();
}

const PERMANENT_ERRORS = [/not configured/i, /invalid recipient/i, /missing template/i, /disabled/i, /not available/i, /code 131026/i, /code 132001/i];

/** Classify a provider error message when the provider did not say. Unknown errors are retryable. */
export function isRetryableError(error: string | undefined | null): boolean {
  if (!error) return true;
  return !PERMANENT_ERRORS.some((re) => re.test(error));
}
