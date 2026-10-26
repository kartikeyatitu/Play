import { describe, expect, it } from "vitest";
import {
  AFA_THRESHOLD_MINOR,
  MANDATE_STATUSES,
  canTransition,
  chargeIdempotencyKey,
  chargeReceipt,
  consentText,
  decideCharge,
  isAutopayWebhookEvent,
  mandateExpiry,
  mandateStatusFromEvent,
  mandateStatusFromProvider,
  nextMandateStatus,
  suggestedMaxAmountMinor,
  validateMaxAmount,
  type ChargeCandidate,
} from "@/lib/autopay";

describe("mandate state machine", () => {
  it("follows CREATED → AUTHENTICATED → ACTIVE → PAUSED → ACTIVE → CANCELLED", () => {
    expect(canTransition("CREATED", "AUTHENTICATED")).toBe(true);
    expect(canTransition("AUTHENTICATED", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "PAUSED")).toBe(true);
    expect(canTransition("PAUSED", "ACTIVE")).toBe(true);
    expect(canTransition("PAUSED", "CANCELLED")).toBe(true);
    expect(canTransition("ACTIVE", "EXPIRED")).toBe(true);
  });

  it("terminal states never move", () => {
    for (const t of ["CANCELLED", "EXPIRED", "FAILED"] as const) {
      for (const s of MANDATE_STATUSES) expect(canTransition(t, s)).toBe(false);
    }
  });

  it("cannot go backwards or skip to PAUSED before activation", () => {
    expect(canTransition("ACTIVE", "AUTHENTICATED")).toBe(false);
    expect(canTransition("ACTIVE", "CREATED")).toBe(false);
    expect(canTransition("CREATED", "PAUSED")).toBe(false);
    expect(canTransition("ACTIVE", "FAILED")).toBe(false);
  });

  it("tolerates token.confirmed arriving before the checkout handler", () => {
    expect(nextMandateStatus("CREATED", "ACTIVE")).toBe("ACTIVE");
  });

  it("ignores duplicates and out-of-order signals", () => {
    expect(nextMandateStatus("ACTIVE", "ACTIVE")).toBeNull();
    expect(nextMandateStatus("ACTIVE", "AUTHENTICATED")).toBeNull(); // late checkout confirm after webhook
    expect(nextMandateStatus("CANCELLED", "ACTIVE")).toBeNull();
    expect(nextMandateStatus("ACTIVE", null)).toBeNull();
  });

  it("maps Razorpay token statuses and webhook events", () => {
    expect(mandateStatusFromProvider("initiated")).toBe("AUTHENTICATED");
    expect(mandateStatusFromProvider("confirmed")).toBe("ACTIVE");
    expect(mandateStatusFromProvider("paused")).toBe("PAUSED");
    expect(mandateStatusFromProvider("rejected")).toBe("FAILED");
    expect(mandateStatusFromProvider("cancellation_initiated")).toBe("CANCELLED");
    expect(mandateStatusFromProvider("expired")).toBe("EXPIRED");
    expect(mandateStatusFromProvider("weird")).toBeNull();
    expect(mandateStatusFromEvent("token.confirmed")).toBe("ACTIVE");
    expect(mandateStatusFromEvent("token.rejected")).toBe("FAILED");
    expect(mandateStatusFromEvent("payment.captured")).toBeNull();
  });

  it("never claims fee payment events", () => {
    expect(isAutopayWebhookEvent("token.paused")).toBe(true);
    expect(isAutopayWebhookEvent("payment.authorized")).toBe(true);
    for (const e of ["payment.captured", "order.paid", "payment.failed", "payment_link.paid", undefined]) {
      expect(isAutopayWebhookEvent(e)).toBe(false);
    }
  });
});

describe("mandate setup", () => {
  it("validates the parent's limit", () => {
    expect(validateMaxAmount(3000, 250000)).toEqual({ ok: true, maxAmountMinor: 300000 });
    expect(validateMaxAmount(2000, 250000).ok).toBe(false); // below the fee
    expect(validateMaxAmount(100000, 0).ok).toBe(false); // above ₹99,999
    expect(validateMaxAmount(10.5, 0).ok).toBe(false);
    expect(validateMaxAmount("x", 0).ok).toBe(false);
  });

  it("suggests the fee rounded up to ₹500", () => {
    expect(suggestedMaxAmountMinor(250000)).toBe(250000);
    expect(suggestedMaxAmountMinor(250100)).toBe(300000);
    expect(suggestedMaxAmountMinor(0)).toBe(50000);
  });

  it("expiry is N years out in unix seconds", () => {
    expect(mandateExpiry(new Date("2026-10-26T00:00:00Z"), 3)).toBe(Date.parse("2029-10-26T00:00:00Z") / 1000);
  });

  it("consent text names the academy, limit and cancellation right", () => {
    const t = consentText({ academyName: "Ace Academy", studentName: "Riya", maxAmountLabel: "₹3,000", authAmountLabel: "₹1" });
    expect(t).toContain("Ace Academy");
    expect(t).toContain("₹3,000");
    expect(t).toContain("pre-debit notification");
    expect(t).toMatch(/cancel/);
  });
});

describe("monthly charge decision", () => {
  const base: ChargeCandidate = {
    mandate: { status: "ACTIVE", maxAmountMinor: 300000, providerTokenId: "token_1", expireAt: new Date("2029-01-01T00:00:00Z") },
    fee: { status: "PENDING", amount: 2500, month: "2026-11" },
    today: "2026-11-03",
    alreadyCharged: false,
    inFlight: false,
  };

  it("charges an active mandate for the current pending fee", () => {
    expect(decideCharge(base)).toEqual({ ok: true, amountMinor: 250000, needsPin: false });
  });

  it("flags debits above ₹15,000 as needing the parent's PIN", () => {
    const r = decideCharge({ ...base, mandate: { ...base.mandate, maxAmountMinor: 9_999_900 }, fee: { ...base.fee, amount: 20000 } });
    expect(r).toEqual({ ok: true, amountMinor: 2_000_000, needsPin: true });
    expect(AFA_THRESHOLD_MINOR).toBe(1_500_000);
  });

  it.each([
    [{ mandate: { ...base.mandate, status: "PAUSED" as const } }, "NOT_ACTIVE"],
    [{ mandate: { ...base.mandate, providerTokenId: null } }, "NO_TOKEN"],
    [{ mandate: { ...base.mandate, expireAt: new Date("2026-11-01T00:00:00Z") } }, "EXPIRED"],
    [{ fee: { ...base.fee, status: "PAID" } }, "FEE_NOT_DUE"],
    [{ fee: { ...base.fee, status: "PENDING_VERIFICATION" } }, "FEE_NOT_DUE"],
    [{ fee: { ...base.fee, amount: 0 } }, "NO_AMOUNT"],
    [{ fee: { ...base.fee, amount: 3000.01 } }, "OVER_LIMIT"],
    [{ alreadyCharged: true }, "ALREADY_CHARGED"],
    [{ inFlight: true }, "IN_FLIGHT"],
    [{ fee: { ...base.fee, month: "2026-10" } }, "WRONG_MONTH"],
    [{ today: "2026-11-30" }, "LAST_DAY"],
  ])("skips %j → %s", (patch, reason) => {
    expect(decideCharge({ ...base, ...(patch as Partial<ChargeCandidate>) })).toEqual({ ok: false, reason });
  });

  it("idempotency key and receipt are stable per mandate+month", () => {
    expect(chargeIdempotencyKey("m1", "2026-11")).toBe("autopay:m1:2026-11");
    expect(chargeReceipt("cmabcdefghijklmnopqrstuvwxyz", "2026-11")).toBe(chargeReceipt("cmabcdefghijklmnopqrstuvwxyz", "2026-11"));
    expect(chargeReceipt("cmabcdefghijklmnopqrstuvwxyz", "2026-11").length).toBeLessThanOrEqual(40);
  });
});
