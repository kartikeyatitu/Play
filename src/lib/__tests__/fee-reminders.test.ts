import { describe, it, expect } from "vitest";
import { buildFamilyReminderText, familyWaLink, lastRemindedByFamily, pickBulkReminderFamilies } from "@/lib/fee-reminders";

describe("buildFamilyReminderText", () => {
  it("one child: single line with UPI link for the amount", () => {
    const t = buildFamilyReminderText({
      parentName: "Neha",
      lines: [{ studentName: "Aarav", month: "2026-10", amount: 2000 }],
      academyName: "Ace Academy",
      upiId: "ace@okicici",
    });
    expect(t).toContain("Hi Neha, Aarav's Oct 2026 fee of ₹2,000 is pending at Ace Academy.");
    expect(t).toContain("upi://pay?pa=ace%40okicici");
    expect(t).toContain("am=2000");
  });

  it("siblings: one message with a total, falls back to the parent app link", () => {
    const t = buildFamilyReminderText({
      parentName: null,
      lines: [
        { studentName: "Aarav", month: "2026-10", amount: 2000 },
        { studentName: "Ira", month: "2026-10", amount: 1500 },
        { studentName: "Zero", month: "2026-10", amount: 0 },
      ],
      academyName: "Ace",
      parentAppUrl: "https://x.test/parent",
    });
    expect(t.startsWith("Hi, these fees are pending at Ace:")).toBe(true);
    expect(t).toContain("Total: ₹3,500");
    expect(t).not.toContain("Zero");
    expect(t).toContain("https://x.test/parent");
  });

  it("invalid UPI id is not used", () => {
    const t = buildFamilyReminderText({ parentName: "A", lines: [{ studentName: "B", month: "2026-10", amount: 1 }], academyName: "C", upiId: "nope" });
    expect(t).not.toContain("upi://");
  });
});

describe("familyWaLink", () => {
  it("adds the calling code to 10-digit numbers", () => {
    expect(familyWaLink("98765 43210", "hi")).toBe("https://wa.me/919876543210?text=hi");
    expect(familyWaLink("+91 98765 43210", "hi")).toBe("https://wa.me/919876543210?text=hi");
    expect(familyWaLink("5551234567", "hi", "1")).toBe("https://wa.me/15551234567?text=hi");
  });
  it("null without a usable phone", () => {
    expect(familyWaLink(null, "x")).toBeNull();
    expect(familyWaLink("12345", "x")).toBeNull();
  });
});

describe("pickBulkReminderFamilies", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  it("skips no-phone and recently reminded, caps the run, keeps order", () => {
    const fams = [
      { familyId: "a", familyPhone: "9876543210", lastRemindedAt: null },
      { familyId: "b", familyPhone: null },
      { familyId: "c", familyPhone: "9876543211", lastRemindedAt: "2026-11-20T00:00:00Z" }, // 10h ago
      { familyId: "d", familyPhone: "9876543212", lastRemindedAt: "2026-11-19T00:00:00Z" }, // 34h ago
      { familyId: "e", hasPhone: true },
      { familyId: "f", hasPhone: false, familyPhone: "9876543213" },
    ];
    const r = pickBulkReminderFamilies(fams, now, { max: 2 });
    expect(r.send.map((f) => f.familyId)).toEqual(["a", "d"]);
    expect(r.skippedOverLimit.map((f) => f.familyId)).toEqual(["e"]);
    expect(r.skippedNoPhone.map((f) => f.familyId)).toEqual(["b", "f"]);
    expect(r.skippedRecent.map((f) => f.familyId)).toEqual(["c"]);
  });
});

describe("lastRemindedByFamily", () => {
  it("matches by familyId, or by phone for older rows, newest wins", () => {
    const m = lastRemindedByFamily(
      [
        { details: JSON.stringify({ familyId: "p1", to: "9876543210" }), createdAt: "2026-11-10T00:00:00Z" },
        { details: JSON.stringify({ to: "+91 98765 43210" }), createdAt: "2026-11-12T00:00:00Z" },
        { details: "not json", createdAt: "2026-11-15T00:00:00Z" },
        { details: JSON.stringify({ familyId: "p2" }), createdAt: "2026-11-11T00:00:00Z" },
      ],
      [
        { familyId: "p1", familyPhone: "9876543210" },
        { familyId: "p2", familyPhone: null },
        { familyId: "p3", familyPhone: "9000000000" },
      ],
    );
    expect(m.get("p1")).toBe("2026-11-12T00:00:00.000Z");
    expect(m.get("p2")).toBe("2026-11-11T00:00:00.000Z");
    expect(m.has("p3")).toBe(false);
  });
});
