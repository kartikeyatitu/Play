import { describe, it, expect } from "vitest";
import { maskStudentName } from "@/lib/receipt-privacy";

describe("maskStudentName", () => {
  it("keeps the first name and only the last initial", () => {
    expect(maskStudentName("Aarav Kumar Sharma")).toBe("Aarav S.");
    expect(maskStudentName("  priya   patel ")).toBe("priya P.");
  });

  it("returns a single-word name unchanged", () => {
    expect(maskStudentName("Aarav")).toBe("Aarav");
  });

  it("falls back to a generic label when the name is empty", () => {
    expect(maskStudentName("")).toBe("Student");
    expect(maskStudentName(null)).toBe("Student");
  });
});
