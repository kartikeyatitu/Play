import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = { messageDelivery: false };
const store: any[] = [];
const dbMock = {
  messageDelivery: {
    findUnique: vi.fn(async ({ where }: any) => store.find((r) => r.idempotencyKey === where.idempotencyKey) ?? null),
    create: vi.fn(async ({ data }: any) => {
      const row = { id: `d${store.length + 1}`, attempts: 0, ...data };
      store.push(row);
      return { id: row.id };
    }),
    update: vi.fn(async ({ where, data }: any) => Object.assign(store.find((r) => r.id === where.id), data)),
    findMany: vi.fn(async () => []),
  },
  notificationPreference: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
};
const sendMock = vi.fn(async (_: any) => ({ ok: false, error: "WhatsApp API timed out" }) as { ok: boolean; id?: string; error?: string });

vi.mock("@/lib/features", () => ({ FEATURES: flags }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppTemplate: (a: any) => sendMock(a) }));

const { sendMessage, retryDueDeliveries } = await import("@/lib/messaging/send");
const base = { channel: "WHATSAPP" as const, category: "ATTENDANCE" as const, to: "9876543210", template: "attendance_alert", orgId: "o1" };
const now = new Date("2026-11-07T10:00:00Z");

beforeEach(() => {
  store.length = 0;
  vi.clearAllMocks();
});

describe("sendMessage", () => {
  it("flag off: sends, never touches the delivery tables", async () => {
    flags.messageDelivery = false;
    sendMock.mockResolvedValueOnce({ ok: true, id: "wamid.1" });
    const r = await sendMessage(base, now);
    expect(r).toEqual({ ok: true, status: "SENT" });
    expect(dbMock.messageDelivery.create).not.toHaveBeenCalled();
    expect(dbMock.notificationPreference.findUnique).not.toHaveBeenCalled();
  });

  it("flag on: logs hashed recipient and schedules a retry on a transient failure", async () => {
    flags.messageDelivery = true;
    const r = await sendMessage({ ...base, idempotencyKey: "k1" }, now);
    expect(r.status).toBe("RETRYING");
    const row = store[0];
    expect(row.toRef).toMatch(/^whatsapp:[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain("9876543210");
    expect(row.attempts).toBe(1);
    expect(row.nextAttemptAt.getTime()).toBe(now.getTime() + 60_000);
  });

  it("idempotency key: second call does not send again", async () => {
    flags.messageDelivery = true;
    sendMock.mockResolvedValueOnce({ ok: true, id: "wamid.2" });
    await sendMessage({ ...base, idempotencyKey: "k2" }, now);
    const again = await sendMessage({ ...base, idempotencyKey: "k2" }, now);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(again.status).toBe("SENT");
  });

  it("respects an opted-out category", async () => {
    flags.messageDelivery = true;
    dbMock.notificationPreference.findUnique.mockResolvedValueOnce({ channel: "WHATSAPP", category: "ATTENDANCE", enabled: false } as any);
    const r = await sendMessage({ ...base, userId: "u1" }, now);
    expect(r.status).toBe("SKIPPED");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("fees ignore opt-out", async () => {
    flags.messageDelivery = true;
    sendMock.mockResolvedValueOnce({ ok: true, id: "wamid.3" });
    const r = await sendMessage({ ...base, category: "FEES", userId: "u1" }, now);
    expect(r.status).toBe("SENT");
    expect(dbMock.notificationPreference.findUnique).not.toHaveBeenCalled();
  });
});

describe("retryDueDeliveries", () => {
  it("is a no-op while the flag is off", async () => {
    flags.messageDelivery = false;
    const r = await retryDueDeliveries(now);
    expect(r.picked).toBe(0);
    expect(dbMock.messageDelivery.findMany).not.toHaveBeenCalled();
  });
});
