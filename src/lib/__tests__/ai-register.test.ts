import { describe, expect, it } from "vitest";
import { MAX_REGISTER_ROWS, extractJson, normaliseMobile, parseRegisterReply, registerRowProblem } from "@/lib/ai/register";

describe("normaliseMobile", () => {
  it("accepts common Indian formats", () => {
    expect(normaliseMobile("98765 43210")).toBe("9876543210");
    expect(normaliseMobile("+91-98765-43210")).toBe("9876543210");
    expect(normaliseMobile("09876543210")).toBe("9876543210");
  });
  it("rejects landlines, short numbers and non-mobile prefixes", () => {
    expect(normaliseMobile("12345")).toBe("");
    expect(normaliseMobile("0124 4567890")).toBe("");
    expect(normaliseMobile("5876543210")).toBe("");
    expect(normaliseMobile(undefined)).toBe("");
  });
});

describe("extractJson", () => {
  it("reads JSON wrapped in prose or code fences", () => {
    expect(extractJson('Here you go:\n```json\n{"rows":[]}\n```')).toEqual({ rows: [] });
    expect(extractJson('[{"a":1}]')).toEqual([{ a: 1 }]);
  });
  it("returns null for non-JSON", () => {
    expect(extractJson("I can't read this photo.")).toBeNull();
    expect(extractJson("{ broken")).toBeNull();
  });
});

describe("parseRegisterReply", () => {
  it("normalises rows and flags unreadable phones", () => {
    const reply = JSON.stringify({
      rows: [
        { studentName: "  Aarav   Sharma ", parentName: "Rohit Sharma", parentPhone: "+91 98765 43210", batchName: "U-12 Morning", feeStatus: "paid" },
        { studentName: "Ishita K", parentName: "", parentPhone: "98765 432", batchName: "", feeStatus: "maybe", unclear: false },
        { studentName: "X", parentPhone: "9876543210" },
        "junk",
      ],
    });
    const { rows, truncated } = parseRegisterReply(reply);
    expect(truncated).toBe(false);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ studentName: "Aarav Sharma", parentPhone: "9876543210", feeStatus: "PAID", unclear: false });
    expect(rows[1]).toMatchObject({ studentName: "Ishita K", parentPhone: "98765 432", feeStatus: "", unclear: true });
  });
  it("returns no rows for a non-register reply", () => {
    expect(parseRegisterReply('{"rows":[]}').rows).toEqual([]);
    expect(parseRegisterReply("not json at all").rows).toEqual([]);
  });
  it("caps the number of rows", () => {
    const many = Array.from({ length: MAX_REGISTER_ROWS + 5 }, (_, i) => ({ studentName: `Student ${i}`, parentName: "P", parentPhone: "9876543210" }));
    const { rows, truncated } = parseRegisterReply(JSON.stringify({ rows: many }));
    expect(rows).toHaveLength(MAX_REGISTER_ROWS);
    expect(truncated).toBe(true);
  });
});

describe("registerRowProblem", () => {
  it("mirrors importStudents' required fields", () => {
    expect(registerRowProblem({ studentName: "Aarav", parentName: "Rohit", parentPhone: "9876543210" })).toBeNull();
    expect(registerRowProblem({ studentName: "A", parentName: "Rohit", parentPhone: "9876543210" })).toMatch(/student/);
    expect(registerRowProblem({ studentName: "Aarav", parentName: "", parentPhone: "9876543210" })).toMatch(/parent/);
    expect(registerRowProblem({ studentName: "Aarav", parentName: "Rohit", parentPhone: "12345" })).toMatch(/mobile/);
  });
});
