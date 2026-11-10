import { describe, it, expect } from "vitest";
import { signPayToken, verifyPayToken } from "@/lib/pay-token";
import { buildFamilyReminderText } from "@/lib/fee-reminders";

describe("pay links", () => {
  it("round-trips, rejects tampering and expires after 30 days", () => {
    const t = signPayToken("org1", "fam1", Date.UTC(2026, 10, 10));
    expect(verifyPayToken(t, Date.UTC(2026, 10, 20))).toEqual({ orgId: "org1", familyId: "fam1" });
    expect(verifyPayToken(t, Date.UTC(2026, 11, 15))).toBeNull();
    const [p, s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ o: "org1", f: "someone-else", e: 9999999999 })).toString("base64url");
    expect(verifyPayToken(`${forged}.${s}`)).toBeNull();
    expect(verifyPayToken(`${p}.x`)).toBeNull();
    expect(verifyPayToken("junk")).toBeNull();
  });

  it("the reminder carries the tappable https link when the academy has UPI", () => {
    const text = buildFamilyReminderText({
      parentName: "Priya",
      lines: [{ studentName: "Aarav", month: "2026-11", amount: 1500 }],
      academyName: "Ace Academy",
      upiId: "ace@okhdfc",
      payUrl: "https://example.test/pay/abc.def",
    });
    expect(text).toContain("Pay in one tap: https://example.test/pay/abc.def");
    expect(text).not.toContain("upi://");
  });
});
