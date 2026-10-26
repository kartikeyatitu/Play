import { describe, it, expect } from "vitest";
import {
  activeConcession,
  applyConcession,
  billedAmount,
  concessionsByStudent,
  coversMonth,
  describeConcession,
  foregoneForMonth,
  validateConcessionInput,
} from "@/lib/concessions";

const c = (o: Partial<Parameters<typeof coversMonth>[0]> = {}) => ({
  percentOff: 50,
  amountOff: null,
  startMonth: "2026-11",
  endMonth: null,
  revokedAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  ...o,
});

describe("concession window", () => {
  it("covers start, end and open-ended months", () => {
    expect(coversMonth(c(), "2026-10")).toBe(false);
    expect(coversMonth(c(), "2026-11")).toBe(true);
    expect(coversMonth(c(), "2030-01")).toBe(true);
    expect(coversMonth(c({ endMonth: "2027-03" }), "2027-03")).toBe(true);
    expect(coversMonth(c({ endMonth: "2027-03" }), "2027-04")).toBe(false);
  });
  it("ignores revoked", () => {
    expect(coversMonth(c({ revokedAt: new Date() }), "2026-12")).toBe(false);
  });
  it("latest created wins", () => {
    const a = c({ id: "a", createdAt: "2026-10-01T00:00:00Z" });
    const b = c({ id: "b", percentOff: 100, createdAt: "2026-10-05T00:00:00Z" });
    expect(activeConcession([a, b], "2026-12")?.id).toBe("b");
    expect(activeConcession([a, { ...b, revokedAt: "2026-10-06" }], "2026-12")?.id).toBe("a");
    expect(activeConcession([a], "2026-01")).toBe(null);
  });
});

describe("applying", () => {
  it("percent and full waiver", () => {
    expect(applyConcession(2000, { percentOff: 50, amountOff: null })).toBe(1000);
    expect(applyConcession(2000, { percentOff: 100, amountOff: null })).toBe(0);
    expect(applyConcession(1999, { percentOff: 33, amountOff: null })).toBe(1339);
  });
  it("fixed amount floors at zero", () => {
    expect(applyConcession(2000, { percentOff: null, amountOff: 500 })).toBe(1500);
    expect(applyConcession(2000, { percentOff: null, amountOff: 5000 })).toBe(0);
  });
  it("no concession or unset fee leaves amount unchanged", () => {
    expect(applyConcession(2000, null)).toBe(2000);
    expect(applyConcession(0, { percentOff: 50, amountOff: null })).toBe(0);
    expect(billedAmount(2000, undefined, "2026-11")).toBe(2000);
    expect(billedAmount(2000, [], "2026-11")).toBe(2000);
  });
  it("billed amount respects the month", () => {
    expect(billedAmount(2000, [c()], "2026-10")).toBe(2000);
    expect(billedAmount(2000, [c()], "2026-11")).toBe(1000);
    expect(billedAmount(2000, [c({ percentOff: 100 })], "2026-11")).toBe(0);
  });
  it("groups and sums foregone", () => {
    const m = concessionsByStudent([{ ...c(), studentId: "s1" }, { ...c(), studentId: "s1" }, { ...c(), studentId: "s2" }]);
    expect(m.get("s1")?.length).toBe(2);
    expect(foregoneForMonth([{ base: 2000, concessions: [c()] }, { base: 1500, concessions: [c({ percentOff: 100 })] }, { base: 900, concessions: [] }], "2026-11")).toBe(2500);
  });
  it("describes", () => {
    expect(describeConcession({ percentOff: 100, amountOff: null })).toBe("Full waiver");
    expect(describeConcession({ percentOff: 25, amountOff: null })).toBe("25% off");
    expect(describeConcession({ percentOff: null, amountOff: 500 })).toBe("₹500 off / month");
  });
});

describe("validation", () => {
  const base = { studentId: "s1", category: "SCHOLARSHIP", startMonth: "2026-11" };
  it("full, percent and amount", () => {
    const full = validateConcessionInput({ ...base, mode: "FULL" });
    expect(full.ok && full.value.percentOff).toBe(100);
    const pct = validateConcessionInput({ ...base, mode: "PERCENT", value: "40" });
    expect(pct.ok && pct.value.percentOff).toBe(40);
    const amt = validateConcessionInput({ ...base, mode: "AMOUNT", value: 500 });
    expect(amt.ok && amt.value.amountOff).toBe(500);
    expect(amt.ok && amt.value.percentOff).toBe(null);
  });
  it("rejects bad input", () => {
    expect(validateConcessionInput({ ...base, mode: "PERCENT", value: 0 }).ok).toBe(false);
    expect(validateConcessionInput({ ...base, mode: "PERCENT", value: 101 }).ok).toBe(false);
    expect(validateConcessionInput({ ...base, mode: "PERCENT", value: 12.5 }).ok).toBe(false);
    expect(validateConcessionInput({ ...base, mode: "AMOUNT", value: -10 }).ok).toBe(false);
    expect(validateConcessionInput({ ...base, mode: "BOGO" }).ok).toBe(false);
    expect(validateConcessionInput({ ...base, mode: "FULL", startMonth: "2026-13" }).ok).toBe(false);
    expect(validateConcessionInput({ ...base, mode: "FULL", endMonth: "2026-10" }).ok).toBe(false);
    expect(validateConcessionInput({ ...base, mode: "FULL", category: "CASTE" }).ok).toBe(false);
    expect(validateConcessionInput({ ...base, studentId: "", mode: "FULL" }).ok).toBe(false);
    expect(validateConcessionInput({ ...base, mode: "FULL", reason: "x".repeat(301) }).ok).toBe(false);
  });
});
