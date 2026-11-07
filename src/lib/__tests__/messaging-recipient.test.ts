import { describe, expect, it } from "vitest";
import { normaliseRecipient, toRef } from "@/lib/messaging/recipient";
import { emailProvider, providerFor } from "@/lib/messaging/providers";

describe("recipient reference", () => {
  it("hashes the same person the same way across formats", () => {
    const a = normaliseRecipient("WHATSAPP", "98765 43210")!;
    const b = normaliseRecipient("WHATSAPP", "+91-9876543210")!;
    expect(a).toBe(b);
    expect(toRef("WHATSAPP", a)).toBe(toRef("WHATSAPP", b));
  });
  it("never contains the raw phone or email", () => {
    const ref = toRef("WHATSAPP", normaliseRecipient("WHATSAPP", "9876543210")!);
    expect(ref).toMatch(/^whatsapp:[0-9a-f]{64}$/);
    expect(ref).not.toContain("9876543210");
    const e = toRef("EMAIL", normaliseRecipient("EMAIL", "Parent@Example.com")!);
    expect(e).toMatch(/^email:[0-9a-f]{64}$/);
    expect(e.toLowerCase()).not.toContain("parent");
  });
  it("rejects unusable addresses", () => {
    expect(normaliseRecipient("EMAIL", "not-an-email")).toBeNull();
    expect(normaliseRecipient("WHATSAPP", "")).toBeNull();
  });
  it("differs by channel", () => {
    expect(toRef("WHATSAPP", "+919876543210")).not.toBe(toRef("SMS", "+919876543210"));
  });
});

describe("providers", () => {
  it("email is disabled and non-retryable", async () => {
    expect(emailProvider.enabled).toBe(false);
    const r = await providerFor("EMAIL").send({ to: "a@b.co", template: "x" });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
  });
  it("WhatsApp without credentials fails without retry", async () => {
    const saved = process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const r = await providerFor("WHATSAPP").send({ to: "+919876543210", template: "fee_reminder" });
    if (saved !== undefined) process.env.WHATSAPP_ACCESS_TOKEN = saved;
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(false);
  });
});
