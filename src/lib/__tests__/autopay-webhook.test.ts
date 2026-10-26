import { beforeEach, describe, expect, it, vi } from "vitest";

// The webhook module is tested with its DB and service dependencies mocked: no database, no Razorpay.
const flags = vi.hoisted(() => ({ upiAutopay: true }));
const findFirst = vi.hoisted(() => vi.fn());
const applyMandateStatus = vi.hoisted(() => vi.fn());
const revokeOrphanToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/features", () => ({ FEATURES: flags }));
vi.mock("@/lib/db", () => ({ db: { feeMandate: { findFirst } } }));
vi.mock("@/lib/autopay-service", () => ({ applyMandateStatus, revokeOrphanToken }));

import { handleAutopayWebhook } from "@/lib/autopay-webhook";

const mandate = { id: "m1", orgId: "o1", parentId: "p1", status: "AUTHENTICATED", providerCustomerId: "cust_1" };

describe("handleAutopayWebhook", () => {
  beforeEach(() => {
    flags.upiAutopay = true;
    findFirst.mockReset();
    applyMandateStatus.mockReset();
    revokeOrphanToken.mockReset();
  });

  it("returns null (existing route logic runs) when the flag is off", async () => {
    flags.upiAutopay = false;
    expect(await handleAutopayWebhook("o1", "token.confirmed", {})).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("never claims fee or turf payment events", async () => {
    for (const e of ["payment.captured", "order.paid", "payment.failed", "payment_link.paid", "payment_link.expired", undefined]) {
      expect(await handleAutopayWebhook("o1", e, { payload: { payment: { entity: { order_id: "order_1" } } } })).toBeNull();
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("leaves payment.authorized for ordinary orders to the existing handler", async () => {
    findFirst.mockResolvedValue(null);
    expect(await handleAutopayWebhook("o1", "payment.authorized", { payload: { payment: { entity: { id: "pay_1", order_id: "order_x" } } } })).toBeNull();
    expect(findFirst).toHaveBeenCalledWith({ where: { orgId: "o1", authOrderId: "order_x" } });
  });

  it("stores the token on a mandate authorisation", async () => {
    findFirst.mockResolvedValue({ ...mandate, status: "CREATED" });
    const r = await handleAutopayWebhook("o1", "payment.authorized", { payload: { payment: { entity: { id: "pay_1", order_id: "order_m", token_id: "token_9" } } } });
    expect(r).toEqual({ status: 200, body: { status: "ok" } });
    expect(applyMandateStatus).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }), "AUTHENTICATED", expect.objectContaining({ tokenId: "token_9", authPaymentId: "pay_1" }));
  });

  it("revokes a token authorised for a mandate we already closed", async () => {
    findFirst.mockResolvedValue({ ...mandate, status: "EXPIRED" });
    await handleAutopayWebhook("o1", "payment.authorized", { payload: { payment: { entity: { id: "pay_1", order_id: "order_m", token_id: "token_9" } } } });
    expect(revokeOrphanToken).toHaveBeenCalledWith("o1", "cust_1", "token_9");
    expect(applyMandateStatus).not.toHaveBeenCalled();
  });

  it("maps token events, scoped to the academy", async () => {
    findFirst.mockResolvedValue(mandate);
    const r = await handleAutopayWebhook("o1", "token.confirmed", { payload: { token: { entity: { id: "token_9", recurring_details: { status: "confirmed" } } } } });
    expect(r?.status).toBe(200);
    expect(findFirst).toHaveBeenCalledWith({ where: { orgId: "o1", providerTokenId: "token_9" } });
    expect(applyMandateStatus).toHaveBeenCalledWith(mandate, "ACTIVE", expect.objectContaining({ providerStatus: "confirmed" }));
  });

  it("acknowledges unknown tokens without changing anything", async () => {
    findFirst.mockResolvedValue(null);
    expect(await handleAutopayWebhook("o1", "token.paused", { payload: { token: { entity: { id: "token_x" } } } })).toEqual({ status: 200, body: { status: "ignored" } });
    expect(applyMandateStatus).not.toHaveBeenCalled();
  });

  it("asks Razorpay to retry on database errors", async () => {
    findFirst.mockRejectedValue(new Error("db down"));
    expect((await handleAutopayWebhook("o1", "token.cancelled", { payload: { token: { entity: { id: "token_9" } } } }))?.status).toBe(500);
  });
});
