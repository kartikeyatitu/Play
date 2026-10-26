import { describe, it, expect } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  canTransition,
  canActorTransition,
  isTerminal,
  restockQuantity,
  priceSnapshot,
  refundAmountPaise,
  validateQuantity,
  validateProductInput,
  checkStock,
  formatPaise,
  toPaise,
  ORDER_FILTERS,
} from "@/lib/store";

describe("store order state machine", () => {
  const allowed: Array<[string, string]> = [
    ["PLACED", "CONFIRMED"],
    ["PLACED", "CANCELLED"],
    ["CONFIRMED", "FULFILLED"],
    ["CONFIRMED", "CANCELLED"],
    ["FULFILLED", "REFUND_REQUESTED"],
    ["REFUND_REQUESTED", "REFUNDED"],
    ["REFUND_REQUESTED", "FULFILLED"],
  ];

  it("allows exactly the documented transitions", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const expected = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from}->${to}`).toBe(expected);
      }
    }
  });

  it("rejects unknown and legacy statuses", () => {
    expect(canTransition("PENDING", "DELIVERED")).toBe(false);
    expect(canTransition("PENDING", "CONFIRMED")).toBe(false);
    expect(canTransition("PLACED", "PAID")).toBe(false);
  });

  it("treats CANCELLED and REFUNDED as terminal", () => {
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("REFUNDED")).toBe(true);
    expect(isTerminal("FULFILLED")).toBe(false);
    expect(ORDER_TRANSITIONS.PLACED.length).toBe(2);
  });

  it("limits parents to cancel-before-confirm and refund requests", () => {
    expect(canActorTransition("PARENT", "PLACED", "CANCELLED")).toBe(true);
    expect(canActorTransition("PARENT", "FULFILLED", "REFUND_REQUESTED")).toBe(true);
    expect(canActorTransition("PARENT", "CONFIRMED", "CANCELLED")).toBe(false);
    expect(canActorTransition("PARENT", "PLACED", "CONFIRMED")).toBe(false);
    expect(canActorTransition("PARENT", "REFUND_REQUESTED", "REFUNDED")).toBe(false);
    expect(canActorTransition("SELLER", "CONFIRMED", "CANCELLED")).toBe(true);
    expect(canActorTransition("SELLER", "CANCELLED", "PLACED")).toBe(false);
  });
});

describe("stock", () => {
  it("restocks on cancel always, on refund only when returned", () => {
    expect(restockQuantity("CANCELLED", 3, false)).toBe(3);
    expect(restockQuantity("REFUNDED", 3, true)).toBe(3);
    expect(restockQuantity("REFUNDED", 3, false)).toBe(0);
    expect(restockQuantity("FULFILLED", 3, true)).toBe(0);
  });

  it("never reserves more than is in stock", () => {
    expect(checkStock(5, 2)).toEqual({ ok: true, value: 3 });
    expect(checkStock(2, 2)).toEqual({ ok: true, value: 0 });
    expect(checkStock(1, 2)).toEqual({ ok: false, error: "Only 1 left" });
    expect(checkStock(0, 1)).toEqual({ ok: false, error: "Out of stock" });
  });

  it("serialised reservations for the last unit give one success", () => {
    // Models the DB guarantee: each conditional decrement sees the previous committed stock.
    let stock = 1;
    const results = [1, 1].map((q) => {
      const r = checkStock(stock, q);
      if (r.ok) stock = r.value;
      return r.ok;
    });
    expect(results).toEqual([true, false]);
    expect(stock).toBe(0);
  });
});

describe("money", () => {
  it("snapshots price in integer paise", () => {
    expect(priceSnapshot(599, 2)).toEqual({ unitPricePaise: 59900, amountPaise: 119800 });
    expect(priceSnapshot(19.99, 3)).toEqual({ unitPricePaise: 1999, amountPaise: 5997 });
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });

  it("refunds only what was collected", () => {
    expect(refundAmountPaise(5000, "PAID_AT_ACADEMY")).toBe(5000);
    expect(refundAmountPaise(5000, "UNPAID")).toBe(0);
  });

  it("formats paise", () => {
    expect(formatPaise(59900)).toBe("₹599");
    expect(formatPaise(1999)).toBe("₹19.99");
  });
});

describe("validation", () => {
  it("validates quantity 1..10", () => {
    expect(validateQuantity(1).ok).toBe(true);
    expect(validateQuantity("3")).toEqual({ ok: true, value: 3 });
    expect(validateQuantity(0).ok).toBe(false);
    expect(validateQuantity(11).ok).toBe(false);
    expect(validateQuantity(1.5).ok).toBe(false);
    expect(validateQuantity("abc").ok).toBe(false);
  });

  it("validates products", () => {
    expect(validateProductInput({ name: " Jersey ", price: "599", stock: "20", description: "" })).toEqual({
      ok: true,
      value: { name: "Jersey", price: 599, stock: 20, description: null },
    });
    expect(validateProductInput({ name: "", price: 1, stock: 1 }).ok).toBe(false);
    expect(validateProductInput({ name: "x".repeat(121), price: 1, stock: 1 }).ok).toBe(false);
    expect(validateProductInput({ name: "A", price: NaN, stock: 1 }).ok).toBe(false);
    expect(validateProductInput({ name: "A", price: -5, stock: 1 }).ok).toBe(false);
    expect(validateProductInput({ name: "A", price: 0, stock: 1 }).ok).toBe(false);
    expect(validateProductInput({ name: "A", price: 1.234, stock: 1 }).ok).toBe(false);
    expect(validateProductInput({ name: "A", price: 19.99, stock: 1 }).ok).toBe(true);
    expect(validateProductInput({ name: "A", price: 1, stock: -1 }).ok).toBe(false);
    expect(validateProductInput({ name: "A", price: 1, stock: 2.5 }).ok).toBe(false);
  });

  it("filter buckets cover every status exactly once outside ALL", () => {
    const seen = [...ORDER_FILTERS.OPEN, ...ORDER_FILTERS.REFUNDS, ...ORDER_FILTERS.DONE].sort();
    expect(seen).toEqual([...ORDER_STATUSES].sort());
  });
});
