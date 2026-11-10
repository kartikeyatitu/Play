import { describe, it, expect } from "vitest";
import { addMonths, breakLine, currentBreaks, onBreak, openMakeups, validateBreak } from "@/lib/breaks";

const row = (d: object) => ({ details: JSON.stringify(d) });

describe("breaks", () => {
  it("adds months across the year end", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("accepts 1 to 3 months starting this month or later", () => {
    const ok = validateBreak({ studentId: "s1", fromMonth: "2026-12", months: 2, reason: "EXAMS" }, "2026-11");
    expect(ok).toEqual({ ok: true, value: { studentId: "s1", fromMonth: "2026-12", toMonth: "2027-01", reason: "EXAMS" } });
    expect(validateBreak({ studentId: "s1", fromMonth: "2026-10", months: 1 }, "2026-11").ok).toBe(false);
    expect(validateBreak({ studentId: "s1", fromMonth: "2026-11", months: 4 }, "2026-11").ok).toBe(false);
    expect(validateBreak({ studentId: "", fromMonth: "2026-11", months: 1 }, "2026-11").ok).toBe(false);
  });

  it("uses each child's latest entry; ending a break hides older ones; past breaks drop out", () => {
    const rows = [
      row({ studentId: "a", fromMonth: null, toMonth: null, ended: true }),
      row({ studentId: "a", fromMonth: "2026-11", toMonth: "2026-12", reason: "EXAMS" }),
      row({ studentId: "b", fromMonth: "2026-11", toMonth: "2026-12", reason: "HOLIDAY" }),
      row({ studentId: "c", fromMonth: "2026-08", toMonth: "2026-09", reason: "EXAMS" }),
      { details: "not json" },
    ];
    const m = currentBreaks(rows, "2026-11");
    expect([...m.keys()]).toEqual(["b"]);
    expect(onBreak(m.get("b"), "2026-12")).toBe(true);
    expect(onBreak(m.get("b"), "2027-01")).toBe(false);
    expect(breakLine(m.get("b")!)).toBe("On a break for holiday until Dec 2026");
  });

  it("make-ups disappear once marked given", () => {
    const credits = [
      { id: "c1", details: JSON.stringify({ studentId: "a", date: "2026-11-10", batchName: "U-12" }) },
      { id: "c2", details: JSON.stringify({ studentId: "b", date: "2026-11-10", batchName: "U-12" }) },
    ];
    expect(openMakeups(credits, [row({ creditId: "c1" })]).map((c) => c.id)).toEqual(["c2"]);
  });
});
