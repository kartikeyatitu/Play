import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  resolvers: new Map<string, (id: string) => Promise<unknown>>(),
  fees: [] as any[],
  sendMessage: vi.fn(async () => ({ ok: true, status: "SENT", deliveryId: "d1" })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    organization: { findUnique: vi.fn(async () => ({ name: "Ace Academy", currency: "INR", locale: "en-IN", country: "IN", phoneCountry: "91" })) },
    feeRecord: { findMany: vi.fn(async () => h.fees) },
  },
}));
vi.mock("@/lib/messaging", () => ({
  registerRetryResolver: (type: string, fn: (id: string) => Promise<unknown>) => h.resolvers.set(type, fn),
  sendMessage: h.sendMessage,
}));
vi.mock("@/lib/messaging/providers", () => ({ whatsappProvider: { enabled: true } }));

import { FEE_REMINDER_RELATED, sendFeeReminderNow } from "@/lib/fee-reminder-send";

const due = [
  { id: "f1", amount: 1500, student: { parent: { id: "p1", name: "Priya Shah", phone: "9876543210" } } },
  { id: "f2", amount: 1000, student: { parent: { id: "p1", name: "Priya Shah", phone: "9876543210" } } },
];

beforeEach(() => {
  h.fees = [];
  h.sendMessage.mockClear();
});

describe("fee reminders through the WhatsApp API", () => {
  it("registers a retry rebuilder that stops once the family has paid", async () => {
    const resolve = h.resolvers.get(FEE_REMINDER_RELATED)!;
    expect(resolve).toBeTypeOf("function");
    h.fees = due;
    const p = (await resolve("org1:p1")) as any;
    expect(p.params[0]).toBe("Priya");
    expect(p.params[2]).toBe("Ace Academy");
    expect(p.category).toBe("FEES");
    h.fees = [];
    expect(await resolve("org1:p1")).toBeNull();
    expect(await resolve("garbage")).toBeNull();
  });

  it("sends once per family per day, with the total due", async () => {
    h.fees = due;
    const r = await sendFeeReminderNow("org1", "p1", "2026-11-10");
    expect(r.ok && r.amount).toBe(2500);
    expect(h.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "WHATSAPP", category: "FEES", relatedType: FEE_REMINDER_RELATED, relatedId: "org1:p1", idempotencyKey: "fee-reminder:org1:p1:2026-11-10" }),
    );
  });

  it("refuses when nothing is due", async () => {
    const r = await sendFeeReminderNow("org1", "p1", "2026-11-10");
    expect(r.ok).toBe(false);
    expect(h.sendMessage).not.toHaveBeenCalled();
  });
});
