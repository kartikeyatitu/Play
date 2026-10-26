import { describe, it, expect } from "vitest";
import { checkNewReferral, MAX_PENDING_PER_REFERRER, normaliseRefereePhone, phoneKey, referralToConvert } from "@/lib/referral-rules";

describe("phones", () => {
  it("compares on the last 10 digits", () => {
    expect(phoneKey("+91 98765-43210")).toBe("9876543210");
    expect(phoneKey("919876543210")).toBe("9876543210");
    expect(phoneKey("12345")).toBeNull();
  });
  it("accepts only valid Indian mobiles for referees", () => {
    expect(normaliseRefereePhone("09876543210")).toBe("9876543210");
    expect(normaliseRefereePhone("1234567890")).toBeNull();
    expect(normaliseRefereePhone(9876543210)).toBeNull();
  });
});

describe("checkNewReferral", () => {
  const base = { refereePhone: "9876543210", referrerPhone: "+919999999999", pendingByReferrer: [], refereeAlreadyInAcademy: false };
  it("accepts a fresh referral", () => {
    expect(checkNewReferral(base)).toEqual({ ok: true, phone: "9876543210" });
  });
  it("refuses self, duplicates, existing families and too many open referrals", () => {
    expect(checkNewReferral({ ...base, referrerPhone: "9876543210" }).ok).toBe(false);
    expect(checkNewReferral({ ...base, pendingByReferrer: [{ refereePhone: "+91 98765 43210" }] }).ok).toBe(false);
    expect(checkNewReferral({ ...base, refereeAlreadyInAcademy: true }).ok).toBe(false);
    const many = Array.from({ length: MAX_PENDING_PER_REFERRER }, (_, i) => ({ refereePhone: `90000000${String(i).padStart(2, "0")}` }));
    expect(checkNewReferral({ ...base, pendingByReferrer: many }).ok).toBe(false);
    expect(checkNewReferral({ ...base, refereePhone: "abc" }).ok).toBe(false);
  });
});

describe("referralToConvert", () => {
  const rows = [
    { id: "late", refereePhone: "9876543210", status: "PENDING", createdAt: "2026-10-10" },
    { id: "early", refereePhone: "+91 98765 43210", status: "PENDING", createdAt: "2026-10-01" },
    { id: "done", refereePhone: "9876543210", status: "CONVERTED", createdAt: "2026-09-01" },
    { id: "other", refereePhone: "9123456789", status: "PENDING", createdAt: "2026-09-01" },
  ];
  it("converts the earliest pending referral for that phone", () => {
    expect(referralToConvert(rows, "919876543210")?.id).toBe("early");
  });
  it("returns null without a match", () => {
    expect(referralToConvert(rows, "9000000000")).toBeNull();
    expect(referralToConvert(rows, null)).toBeNull();
  });
});
