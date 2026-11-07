import { describe, it, expect } from "vitest";
import { MAX_GUARDIANS_PER_CHILD, canAddGuardian, guardianIdsOf, normaliseRelation, unionStudentIds } from "@/lib/family/rules";
import { familyDiscountTotal, siblingDiscounts } from "@/lib/family/sibling-discount";

describe("guardians", () => {
  it("lists the primary first without duplicates", () => {
    expect(guardianIdsOf("p", [{ userId: "p" }, { userId: "m" }])).toEqual(["p", "m"]);
  });
  it("allows at most two guardians per child", () => {
    expect(MAX_GUARDIANS_PER_CHILD).toBe(2);
    expect(canAddGuardian("p", [], "m")).toEqual({ ok: true });
    expect(canAddGuardian("p", [{ userId: "p" }], "m")).toEqual({ ok: true });
    expect(canAddGuardian("p", [{ userId: "m" }], "x").ok).toBe(false);
    expect(canAddGuardian("p", [], "p").ok).toBe(false);
    expect(canAddGuardian("p", [{ userId: "m" }], "m").ok).toBe(false);
  });
  it("unions primary and linked children in order", () => {
    expect(unionStudentIds(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    expect(unionStudentIds([], ["c"])).toEqual(["c"]);
  });
  it("normalises relations", () => {
    expect(normaliseRelation("mother")).toBe("MOTHER");
    expect(normaliseRelation("uncle")).toBe("GUARDIAN");
    expect(normaliseRelation(undefined)).toBe("GUARDIAN");
  });
});

describe("siblingDiscounts", () => {
  const rule = { secondChildPercent: 10, thirdPlusPercent: 15 };
  it("charges the highest fee in full and discounts the others", () => {
    const r = siblingDiscounts(
      [
        { studentId: "a", fee: 2000 },
        { studentId: "b", fee: 3000 },
        { studentId: "c", fee: 1500 },
      ],
      rule,
    );
    expect(r).toEqual([
      { studentId: "a", fee: 2000, discount: 200, payable: 1800 },
      { studentId: "b", fee: 3000, discount: 0, payable: 3000 },
      { studentId: "c", fee: 1500, discount: 225, payable: 1275 },
    ]);
    expect(familyDiscountTotal([{ studentId: "a", fee: 2000 }, { studentId: "b", fee: 3000 }], rule)).toBe(200);
  });
  it("gives no discount to an only child", () => {
    expect(siblingDiscounts([{ studentId: "a", fee: 2500 }], rule)[0].discount).toBe(0);
  });
  it("uses the second-child percent for later children when no third rate is set", () => {
    const r = siblingDiscounts(
      [
        { studentId: "a", fee: 1000 },
        { studentId: "b", fee: 1000 },
        { studentId: "c", fee: 1000 },
      ],
      { secondChildPercent: 20 },
    );
    expect(r.map((x) => x.discount)).toEqual([0, 200, 200]);
  });
  it("breaks fee ties by input order", () => {
    const r = siblingDiscounts(
      [
        { studentId: "x", fee: 1000 },
        { studentId: "y", fee: 1000 },
      ],
      rule,
    );
    expect(r.map((c) => c.discount)).toEqual([0, 100]);
  });
  it("ignores free children and rounds discounts down", () => {
    const r = siblingDiscounts(
      [
        { studentId: "free", fee: 0 },
        { studentId: "a", fee: 999 },
        { studentId: "b", fee: 333 },
      ],
      { secondChildPercent: 10 },
    );
    expect(r).toEqual([
      { studentId: "free", fee: 0, discount: 0, payable: 0 },
      { studentId: "a", fee: 999, discount: 0, payable: 999 },
      { studentId: "b", fee: 333, discount: 33, payable: 300 },
    ]);
  });
  it("clamps bad percentages", () => {
    const kids = [
      { studentId: "a", fee: 1000 },
      { studentId: "b", fee: 1000 },
    ];
    expect(siblingDiscounts(kids, { secondChildPercent: -5 })[1].discount).toBe(0);
    expect(siblingDiscounts(kids, { secondChildPercent: 250 })[1].payable).toBe(0);
    expect(siblingDiscounts(kids, { secondChildPercent: Number.NaN })[1].discount).toBe(0);
  });
});
