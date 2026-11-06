import { describe, expect, it } from "vitest";
import { DRILLS, DRILL_SPORTS, DRILL_AGE_GROUPS, DRILL_FOCUS, filterDrills, getLibraryDrill, sportKey } from "@/lib/body/drills";

describe("drill library", () => {
  it("has 60+ drills with unique keys", () => {
    expect(DRILLS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(DRILLS.map((d) => d.key)).size).toBe(DRILLS.length);
  });

  it("has at least 5 drills for each of the 13 sports", () => {
    expect(DRILL_SPORTS.map((s) => s.key)).toEqual([
      "cricket", "football", "badminton", "tennis", "basketball", "swimming", "athletics",
      "hockey", "kabaddi", "table_tennis", "volleyball", "karate", "chess",
    ]);
    for (const s of DRILL_SPORTS) expect(DRILLS.filter((d) => d.sport === s.key).length).toBeGreaterThanOrEqual(5);
  });

  it("every drill is complete", () => {
    for (const d of DRILLS) {
      expect(d.title.length).toBeGreaterThan(3);
      expect(d.description.length).toBeGreaterThan(40);
      expect(d.durationMin).toBeGreaterThan(0);
      expect(d.durationMin).toBeLessThanOrEqual(60);
      expect(d.equipment.length).toBeGreaterThan(0);
      expect(DRILL_AGE_GROUPS).toContain(d.ageGroup);
      expect(d.focus.length).toBeGreaterThan(0);
      for (const f of d.focus) expect(DRILL_FOCUS).toContain(f);
      expect(getLibraryDrill(d.key)).toBe(d);
    }
  });

  it("normalises sport names", () => {
    expect(sportKey("Table Tennis")).toBe("table_tennis");
    expect(sportKey("table-tennis")).toBe("table_tennis");
    expect(sportKey("Soccer")).toBe("football");
    expect(sportKey("Cricket")).toBe("cricket");
    expect(sportKey("Curling")).toBeNull();
    expect(sportKey(null)).toBeNull();
  });

  it("filters by sport, focus, age and text", () => {
    expect(filterDrills(DRILLS, { sport: "chess" }).every((d) => d.sport === "chess")).toBe(true);
    expect(filterDrills(DRILLS, { focus: "footwork" }).every((d) => d.focus.includes("footwork"))).toBe(true);
    const u8 = filterDrills(DRILLS, { age: "U8+" });
    expect(u8.length).toBeGreaterThan(0);
    expect(u8.every((d) => d.ageGroup === "U8+" || d.ageGroup === "All ages")).toBe(true);
    expect(filterDrills(DRILLS, { age: "U12+" }).length).toBeGreaterThan(u8.length);
    expect(filterDrills(DRILLS, { q: "rondo" }).map((d) => d.key)).toEqual(["football.rondo-4v1"]);
  });
});
