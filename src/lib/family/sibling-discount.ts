// Sibling discount: pure calculation, no storage and no default percentage.
// The academy sets the rule; nothing here invents a discount.
//
// How fee generation should apply it (not wired yet, fees code is owned elsewhere):
//  1. Group a month's billable children by family: children who share a guardian (Student.parentId,
//     plus GuardianLink when FEATURES.familyAccounts is on) in the same academy (orgId).
//  2. Resolve each child's fee as today (resolveStudentFee, then concessions via billedAmount).
//  3. Call siblingDiscounts(children, rule) on the concession-adjusted fees and bill fee - discount.
//     Children whose fee is 0 (full scholarship) are ignored, so they never count as the "first child".
//  4. Store the discount on the fee line (or AuditLog) so a receipt can show it; never change past months.

export interface SiblingRule {
  /** Percent off for the 2nd child in a family (0 to 100). */
  secondChildPercent: number;
  /** Percent off for the 3rd and later children (0 to 100). Defaults to secondChildPercent. */
  thirdPlusPercent?: number;
}

export interface SiblingFee {
  studentId: string;
  /** Monthly fee in whole currency units, after concessions. */
  fee: number;
}

const clampPct = (n: unknown) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(100, v);
};

/**
 * Discount per child. The child with the highest fee pays in full; the others are ranked by fee
 * (highest first) and get the 2nd-child, then 3rd-plus, percentage. Ties keep input order.
 * Discounts are rounded down to whole units so the academy is never under-billed by rounding.
 */
export function siblingDiscounts(children: readonly SiblingFee[], rule: SiblingRule): { studentId: string; fee: number; discount: number; payable: number }[] {
  const second = clampPct(rule.secondChildPercent);
  const third = rule.thirdPlusPercent === undefined ? second : clampPct(rule.thirdPlusPercent);
  const billable = children
    .map((c, i) => ({ ...c, fee: Math.max(0, Number(c.fee) || 0), i }))
    .filter((c) => c.fee > 0)
    .sort((a, b) => b.fee - a.fee || a.i - b.i);
  const discountById = new Map<string, number>();
  billable.forEach((c, rank) => {
    const pct = rank === 0 ? 0 : rank === 1 ? second : third;
    discountById.set(c.studentId, Math.floor((c.fee * pct) / 100));
  });
  return children.map((c) => {
    const fee = Math.max(0, Number(c.fee) || 0);
    const discount = discountById.get(c.studentId) ?? 0;
    return { studentId: c.studentId, fee, discount, payable: fee - discount };
  });
}

/** Total discount for the family. */
export function familyDiscountTotal(children: readonly SiblingFee[], rule: SiblingRule): number {
  return siblingDiscounts(children, rule).reduce((s, c) => s + c.discount, 0);
}
