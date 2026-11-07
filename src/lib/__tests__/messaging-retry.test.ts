import { describe, expect, it } from "vitest";
import { BASE_DELAY_MS, MAX_ATTEMPTS, MAX_DELAY_MS, backoffDelayMs, isDue, isRetryableError, nextAttempt } from "@/lib/messaging/retry";

const now = new Date("2026-11-07T10:00:00Z");

describe("backoffDelayMs", () => {
  it("doubles from one minute", () => {
    expect(backoffDelayMs(1)).toBe(BASE_DELAY_MS);
    expect(backoffDelayMs(2)).toBe(2 * BASE_DELAY_MS);
    expect(backoffDelayMs(3)).toBe(4 * BASE_DELAY_MS);
    expect(backoffDelayMs(4)).toBe(8 * BASE_DELAY_MS);
  });
  it("is capped", () => {
    expect(backoffDelayMs(50)).toBe(MAX_DELAY_MS);
  });
});

describe("nextAttempt", () => {
  it("success -> SENT", () => {
    expect(nextAttempt(0, true, false, now)).toEqual({ status: "SENT", attempts: 1, nextAttemptAt: null });
  });
  it("retryable failure -> RETRYING with backoff", () => {
    const r = nextAttempt(0, false, true, now);
    expect(r.status).toBe("RETRYING");
    expect(r.attempts).toBe(1);
    expect(r.nextAttemptAt!.getTime() - now.getTime()).toBe(BASE_DELAY_MS);
    const r2 = nextAttempt(2, false, true, now);
    expect(r2.nextAttemptAt!.getTime() - now.getTime()).toBe(4 * BASE_DELAY_MS);
  });
  it("non-retryable failure -> FAILED at once", () => {
    expect(nextAttempt(0, false, false, now)).toEqual({ status: "FAILED", attempts: 1, nextAttemptAt: null });
  });
  it(`gives up after ${MAX_ATTEMPTS} attempts`, () => {
    let attempts = 0;
    let status = "";
    for (let i = 0; i < 10 && status !== "FAILED"; i++) {
      const r = nextAttempt(attempts, false, true, now);
      attempts = r.attempts;
      status = r.status;
    }
    expect(status).toBe("FAILED");
    expect(attempts).toBe(MAX_ATTEMPTS);
  });
});

describe("isDue", () => {
  it("picks RETRYING rows whose time has come", () => {
    expect(isDue({ status: "RETRYING", attempts: 1, nextAttemptAt: new Date(now.getTime() - 1) }, now)).toBe(true);
    expect(isDue({ status: "RETRYING", attempts: 1, nextAttemptAt: new Date(now.getTime() + 1) }, now)).toBe(false);
    expect(isDue({ status: "QUEUED", attempts: 0, nextAttemptAt: null }, now)).toBe(true);
  });
  it("skips finished or exhausted rows", () => {
    expect(isDue({ status: "SENT", attempts: 1, nextAttemptAt: null }, now)).toBe(false);
    expect(isDue({ status: "FAILED", attempts: 5, nextAttemptAt: null }, now)).toBe(false);
    expect(isDue({ status: "RETRYING", attempts: MAX_ATTEMPTS, nextAttemptAt: null }, now)).toBe(false);
  });
});

describe("isRetryableError", () => {
  it("treats configuration and bad-recipient errors as permanent", () => {
    expect(isRetryableError("WhatsApp is not configured")).toBe(false);
    expect(isRetryableError("Invalid recipient phone number")).toBe(false);
    expect(isRetryableError("Email sending is disabled (no email vendor approved yet).")).toBe(false);
  });
  it("retries timeouts and server errors", () => {
    expect(isRetryableError("WhatsApp API timed out")).toBe(true);
    expect(isRetryableError("WhatsApp API error (HTTP 503)")).toBe(true);
  });
});
