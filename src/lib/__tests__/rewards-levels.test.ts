import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIER_NAMES,
  eloUpdate,
  levelsBySport,
  parseXpReason,
  sanitizeTierNames,
  tierName,
  topXpLevel,
  XP_LEVEL_THRESHOLDS,
  xpBySport,
  xpLevel,
  xpReasonCode,
} from "@/lib/rewards/levels";
import { LEVEL_NAMES } from "@/lib/athlete/passport-build";

describe("XP levels", () => {
  it("Level 1 at 0, Level 2 at 100, Level 3 at 250, then rising", () => {
    expect(XP_LEVEL_THRESHOLDS.slice(0, 3)).toEqual([0, 100, 250]);
    for (let i = 1; i < XP_LEVEL_THRESHOLDS.length; i++) {
      const gap = XP_LEVEL_THRESHOLDS[i] - XP_LEVEL_THRESHOLDS[i - 1];
      if (i > 1) expect(gap).toBeGreaterThanOrEqual(XP_LEVEL_THRESHOLDS[i - 1] - XP_LEVEL_THRESHOLDS[i - 2]);
    }
    expect(xpLevel(0).level).toBe(1);
    expect(xpLevel(99).level).toBe(1);
    expect(xpLevel(100).level).toBe(2);
    expect(xpLevel(250).level).toBe(3);
    expect(xpLevel(1_000_000)).toMatchObject({ level: 10, nextAt: null, progress: 1 });
  });

  it("reports progress to the next level", () => {
    expect(xpLevel(175)).toMatchObject({ level: 2, floor: 100, nextAt: 250, progress: 0.5 });
    expect(xpLevel(-50).level).toBe(1);
    expect(xpLevel(NaN).xp).toBe(0);
  });

  it("names tiers, repeating the last name above the list", () => {
    expect(tierName(1)).toBe("Rookie");
    expect(tierName(5)).toBe("Captain");
    expect(tierName(9)).toBe("Captain");
    expect(tierName(2, ["A", "B"])).toBe("B");
    expect(tierName(1, [])).toBe("Rookie");
  });

  it("tier names never reuse passport level names (two different measures)", () => {
    const passport = new Set(LEVEL_NAMES.map((x) => x.toLowerCase()));
    for (const n of DEFAULT_TIER_NAMES) expect(passport.has(n.toLowerCase())).toBe(false);
    expect(sanitizeTierNames(["Advanced", "Stars", "  Super   stars "])).toEqual(["Stars", "Super stars"]);
    expect(sanitizeTierNames(["Foundation"])).toEqual([...DEFAULT_TIER_NAMES]);
    expect(sanitizeTierNames("x")).toEqual([...DEFAULT_TIER_NAMES]);
    expect(sanitizeTierNames(Array.from({ length: 20 }, (_, i) => `T${i}`))).toHaveLength(10);
  });
});

describe("XP per sport", () => {
  it("stores the sport in reasonCode and reads it back", () => {
    expect(xpReasonCode("SESSION_ATTENDED", "Table Tennis")).toBe("SESSION_ATTENDED@table_tennis");
    expect(xpReasonCode("SESSION_ATTENDED", null)).toBe("SESSION_ATTENDED@general");
    expect(parseXpReason("MATCH_WON@football")).toEqual({ trigger: "MATCH_WON", sport: "football" });
    expect(parseXpReason("LEGACY")).toEqual({ trigger: "LEGACY", sport: "general" });
  });

  it("sums per sport and picks the top level", () => {
    const rows = [
      { delta: 150, reasonCode: "SESSION_ATTENDED@football" },
      { delta: 120, reasonCode: "MATCH_WON@football" },
      { delta: 40, reasonCode: "SESSION_ATTENDED@chess" },
    ];
    expect(xpBySport(rows)).toEqual({ football: 270, chess: 40 });
    expect(topXpLevel(rows)).toBe(3);
    expect(topXpLevel(rows, "chess")).toBe(1);
    expect(topXpLevel(rows, "Football")).toBe(3);
    expect(topXpLevel([])).toBe(1);
    const lv = levelsBySport(rows, ["Cub", "Wolf", "Alpha"]);
    expect(lv[0]).toMatchObject({ sport: "football", level: 3, tier: "Alpha" });
  });
});

describe("Elo", () => {
  it("moves ratings symmetrically", () => {
    const r = eloUpdate(1000, 1000, 1);
    expect(r).toEqual({ a: 1012, b: 988 });
    expect(eloUpdate(1000, 1000, 0.5)).toEqual({ a: 1000, b: 1000 });
    const upset = eloUpdate(900, 1300, 1);
    expect(upset.a - 900).toBeGreaterThan(12);
  });
});
