import { describe, expect, it } from "vitest";
import { ASK_INTENTS, askSystemPrompt, intentTitle, parseAskRoute } from "@/lib/ask";

describe("parseAskRoute", () => {
  it("accepts a known intent and month", () => {
    expect(parseAskRoute('{"intent":"unpaid_by_batch","month":"2026-09"}', "2026-10")).toEqual({ intent: "unpaid_by_batch", month: "2026-09" });
  });
  it("tolerates prose or code fences around the JSON", () => {
    expect(parseAskRoute('Sure:\n```json\n{"intent":"batch_fill","month":null}\n```', "2026-10")).toEqual({ intent: "batch_fill", month: "2026-10" });
  });
  it("replaces future or malformed months with the current month", () => {
    expect(parseAskRoute('{"intent":"attendance_by_batch","month":"2027-01"}', "2026-10")).toMatchObject({ month: "2026-10" });
    expect(parseAskRoute('{"intent":"attendance_by_batch","month":"Sept"}', "2026-10")).toMatchObject({ month: "2026-10" });
  });
  it("rejects unknown intents, injections and non-JSON", () => {
    expect(parseAskRoute('{"intent":"drop_tables"}', "2026-10")).toEqual({ intent: "unsupported" });
    expect(parseAskRoute('{"intent":"__proto__"}', "2026-10")).toEqual({ intent: "unsupported" });
    expect(parseAskRoute("I think you should raise fees.", "2026-10")).toEqual({ intent: "unsupported" });
    expect(parseAskRoute('{"intent": "unsupported"}', "2026-10")).toEqual({ intent: "unsupported" });
  });
});

describe("prompt and titles", () => {
  it("lists every intent and the current month", () => {
    const p = askSystemPrompt("2026-10");
    for (const k of Object.keys(ASK_INTENTS)) expect(p).toContain(k);
    expect(p).toContain("2026-10");
  });
  it("titles month-specific answers with the month", () => {
    expect(intentTitle({ intent: "unpaid_by_batch", month: "2026-09" })).toBe("Unpaid fees by batch · Sep 26");
  });
});
