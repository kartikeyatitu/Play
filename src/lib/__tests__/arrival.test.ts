import { describe, it, expect } from "vitest";
import { arrivalTime } from "@/lib/arrival";

describe("arrivalTime", () => {
  it("formats in the academy's time zone", () => {
    const t = arrivalTime(new Date("2026-11-10T11:05:00Z"), "Asia/Kolkata");
    expect(t.toLowerCase().replace(/\s/g, " ")).toMatch(/4:35\s?pm/);
  });
});
