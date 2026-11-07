import { describe, expect, it } from "vitest";
import { isAlwaysOn, preferenceGrid, preferencesFromForm, resolvePreference } from "@/lib/messaging/preferences";

describe("resolvePreference", () => {
  it("defaults to on", () => {
    expect(resolvePreference([], "WHATSAPP", "ATTENDANCE")).toBe(true);
    expect(resolvePreference([], "EMAIL", "ACADEMY_NEWS")).toBe(true);
  });
  it("honours an explicit off", () => {
    const rows = [{ channel: "WHATSAPP", category: "REWARDS", enabled: false }];
    expect(resolvePreference(rows, "WHATSAPP", "REWARDS")).toBe(false);
    expect(resolvePreference(rows, "EMAIL", "REWARDS")).toBe(true);
  });
  it("fees and safety are always on, even with an off row", () => {
    const rows = [
      { channel: "WHATSAPP", category: "FEES", enabled: false },
      { channel: "WHATSAPP", category: "SAFETY", enabled: false },
    ];
    expect(resolvePreference(rows, "WHATSAPP", "FEES")).toBe(true);
    expect(resolvePreference(rows, "WHATSAPP", "SAFETY")).toBe(true);
    expect(isAlwaysOn("FEES")).toBe(true);
    expect(isAlwaysOn("MATCHES")).toBe(false);
  });
});

describe("form round trip", () => {
  it("unchecked boxes become disabled rows; fees are never written", () => {
    const rows = preferencesFromForm(new Set(["pref:WHATSAPP:ATTENDANCE", "pref:EMAIL:PROGRESS"]));
    expect(rows.find((r) => r.category === "FEES")).toBeUndefined();
    expect(rows.find((r) => r.channel === "WHATSAPP" && r.category === "ATTENDANCE")?.enabled).toBe(true);
    expect(rows.find((r) => r.channel === "WHATSAPP" && r.category === "MATCHES")?.enabled).toBe(false);
    const grid = preferenceGrid(rows);
    expect(grid.WHATSAPP.ATTENDANCE).toBe(true);
    expect(grid.WHATSAPP.MATCHES).toBe(false);
    expect(grid.EMAIL.PROGRESS).toBe(true);
    expect(grid.WHATSAPP.FEES).toBe(true);
  });
});
