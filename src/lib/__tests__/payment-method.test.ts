import { describe, it, expect } from "vitest";
import { isPaymentMethod, isVerifiedOnline, paymentMethodLabel } from "@/lib/payment-method";

describe("payment-method", () => {
  it("accepts only known methods", () => {
    expect(isPaymentMethod("ONLINE_VERIFIED")).toBe(true);
    expect(isPaymentMethod("CASH")).toBe(false);
    expect(isPaymentMethod(null)).toBe(false);
  });

  it("treats only gateway-verified payments as verified online", () => {
    expect(isVerifiedOnline("ONLINE_VERIFIED")).toBe(true);
    expect(isVerifiedOnline("ADMIN_CONFIRMED_UPI")).toBe(false);
    expect(isVerifiedOnline("OFFLINE_RECORDED")).toBe(false);
    expect(isVerifiedOnline(null)).toBe(false);
  });

  it("labels legacy rows with no method as not recorded", () => {
    expect(paymentMethodLabel(null)).toBe("Not recorded");
    expect(paymentMethodLabel("ONLINE_VERIFIED")).toBe("Verified online");
  });
});
