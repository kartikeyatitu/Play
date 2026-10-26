import { describe, it, expect } from "vitest";
import { parseBranchInput } from "@/lib/branch-input";

describe("parseBranchInput", () => {
  it("trims and collapses whitespace", () => {
    const r = parseBranchInput({ name: "  Sector  45 ", address: " Plot 3 ", city: "" });
    expect(r).toEqual({ ok: true, data: { name: "Sector 45", address: "Plot 3", city: null } });
  });

  it("rejects missing or too-short names", () => {
    expect(parseBranchInput({ name: "" }).ok).toBe(false);
    expect(parseBranchInput({ name: "A" }).ok).toBe(false);
    expect(parseBranchInput({ name: 42 }).ok).toBe(false);
  });

  it("rejects overly long fields", () => {
    expect(parseBranchInput({ name: "x".repeat(81) }).ok).toBe(false);
    expect(parseBranchInput({ name: "Main", address: "x".repeat(241) }).ok).toBe(false);
  });
});
