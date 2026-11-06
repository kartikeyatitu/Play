import { describe, expect, it } from "vitest";
import {
  FITNESS_TESTS,
  ageBandOn,
  cohortMedian,
  formatFitnessValue,
  getFitnessTest,
  isBetter,
  latestChange,
  parseFitnessValue,
  personalBest,
  personalBestIds,
  protocolKey,
  seriesFor,
  wouldBePersonalBest,
  type CohortResult,
} from "@/lib/body/tests";
import { trendGeometry } from "@/lib/body/chart";

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const r = (id: string, testKey: string, value: number, date: string, unit?: string) => ({
  id,
  testKey,
  value,
  unit: unit ?? getFitnessTest(testKey)!.unit,
  recordedAt: day(date),
});

describe("fitness test catalogue", () => {
  it("has the nine required tests with unique keys and complete fields", () => {
    const keys = FITNESS_TESTS.map((t) => t.key);
    expect(keys).toEqual(
      expect.arrayContaining(["sprint_30m", "shuttle_5105", "beep_test", "vertical_jump", "standing_long_jump", "sit_reach", "plank_hold", "run_1km", "pushups_60s"]),
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of FITNESS_TESTS) {
      expect(t.protocolSteps.length).toBeGreaterThanOrEqual(3);
      expect(t.ageNotes.length).toBeGreaterThan(20);
      expect(["lower", "higher"]).toContain(t.better);
      expect(t.min).toBeLessThan(t.max);
      expect(t.minAge).toBeGreaterThan(0);
    }
  });

  it("uses the right better-direction", () => {
    expect(getFitnessTest("sprint_30m")!.better).toBe("lower");
    expect(getFitnessTest("run_1km")!.better).toBe("lower");
    expect(getFitnessTest("beep_test")!.better).toBe("higher");
    expect(getFitnessTest("plank_hold")!.better).toBe("higher");
    expect(isBetter(getFitnessTest("sprint_30m")!, 5.1, 5.3)).toBe(true);
    expect(isBetter(getFitnessTest("vertical_jump")!, 30, 30)).toBe(false);
  });

  it("makes no medical claims", () => {
    const text = FITNESS_TESTS.map((t) => `${t.measures} ${t.ageNotes} ${t.protocolSteps.join(" ")}`).join(" ").toLowerCase();
    for (const w of ["diagnos", "injury risk", "predict", "cure", "treat"]) expect(text).not.toContain(w);
  });
});

describe("parse and format values", () => {
  const sprint = getFitnessTest("sprint_30m")!;
  const run = getFitnessTest("run_1km")!;
  const reach = getFitnessTest("sit_reach")!;
  it("parses decimals, commas and m:ss", () => {
    expect(parseFitnessValue(sprint, "5.42")).toBe(5.42);
    expect(parseFitnessValue(sprint, "5,42")).toBe(5.42);
    expect(parseFitnessValue(run, "4:30")).toBe(270);
    expect(parseFitnessValue(reach, "-3.5")).toBe(-3.5);
  });
  it("rejects junk and out-of-range values", () => {
    expect(parseFitnessValue(sprint, "")).toBeNull();
    expect(parseFitnessValue(sprint, "fast")).toBeNull();
    expect(parseFitnessValue(sprint, "54")).toBeNull();
    expect(parseFitnessValue(getFitnessTest("beep_test")!, "1:30")).toBeNull();
  });
  it("formats times and levels", () => {
    expect(formatFitnessValue(run, 270)).toBe("4:30");
    expect(formatFitnessValue(sprint, 5.4)).toBe("5.40 s");
    expect(formatFitnessValue(getFitnessTest("beep_test")!, 7.5)).toBe("level 7.5");
  });
});

describe("age bands", () => {
  it("computes the band at the test date", () => {
    const dob = day("2014-06-15");
    expect(ageBandOn(dob, day("2026-06-14"))).toBe("U12");
    expect(ageBandOn(dob, day("2026-06-15"))).toBe("U14");
    expect(ageBandOn(null, day("2026-06-15"))).toBe("Unknown");
    expect(ageBandOn(day("2000-01-01"), day("2026-01-01"))).toBe("18+");
  });
});

describe("personal bests and trends", () => {
  const results = [r("a", "sprint_30m", 5.6, "2026-01-01"), r("b", "sprint_30m", 5.4, "2026-02-01"), r("c", "sprint_30m", 5.5, "2026-03-01"), r("d", "beep_test", 6.2, "2026-01-01")];

  it("finds the best result for lower-is-better tests", () => {
    expect(personalBest(results, "sprint_30m")!.id).toBe("b");
    expect([...personalBestIds(results, "sprint_30m")]).toEqual(["a", "b"]);
  });

  it("detects a new PB before saving", () => {
    expect(wouldBePersonalBest(results, "sprint_30m", 5.3)).toBe(true);
    expect(wouldBePersonalBest(results, "sprint_30m", 5.4)).toBe(false);
    expect(wouldBePersonalBest([], "plank_hold", 30)).toBe(true);
  });

  it("describes the latest change honestly", () => {
    expect(latestChange(results, "sprint_30m").direction).toBe("declined");
    expect(latestChange(results, "beep_test").direction).toBe("none");
    expect(latestChange([...results, r("e", "beep_test", 7, "2026-02-01")], "beep_test").direction).toBe("improved");
  });

  it("excludes results recorded under a different unit/protocol", () => {
    const mixed = [...results, r("x", "sprint_30m", 4.0, "2026-04-01", "cm")];
    expect(protocolKey(mixed[4])).not.toBe(protocolKey(mixed[0]));
    expect(seriesFor(mixed, "sprint_30m").map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(personalBest(mixed, "sprint_30m")!.id).toBe("b");
  });
});

describe("cohort comparison", () => {
  const mk = (student: string, value: number, band: CohortResult["ageBand"], testKey = "vertical_jump", unit = "cm"): CohortResult => ({
    id: `${student}-${value}-${testKey}`,
    studentId: student,
    testKey,
    unit,
    value,
    recordedAt: day("2026-01-01"),
    ageBand: band,
  });

  it("needs at least five athletes in the same band", () => {
    const rows = [mk("1", 20, "U12"), mk("2", 22, "U12"), mk("3", 24, "U12"), mk("4", 26, "U12")];
    expect(cohortMedian(rows, "vertical_jump", "U12")).toBeNull();
    expect(cohortMedian([...rows, mk("5", 28, "U12")], "vertical_jump", "U12")).toEqual({ median: 24, athletes: 5, ageBand: "U12" });
  });

  it("never mixes age bands, tests, protocols or unknown ages", () => {
    const rows = [
      mk("1", 20, "U12"), mk("2", 22, "U12"), mk("3", 24, "U12"), mk("4", 26, "U12"),
      mk("5", 60, "U16"), mk("6", 40, "U12", "standing_long_jump"), mk("7", 50, "U12", "vertical_jump", "m"),
    ];
    expect(cohortMedian(rows, "vertical_jump", "U12")).toBeNull();
    expect(cohortMedian(rows, "vertical_jump", "Unknown")).toBeNull();
  });

  it("uses each athlete's best result once", () => {
    const rows = [mk("1", 20, "U12"), mk("1", 35, "U12"), mk("2", 22, "U12"), mk("3", 24, "U12"), mk("4", 26, "U12"), mk("5", 28, "U12")];
    expect(cohortMedian(rows, "vertical_jump", "U12")!.median).toBe(26);
  });
});

describe("trend chart geometry", () => {
  it("returns null with no data and a path for a series", () => {
    expect(trendGeometry([])).toBeNull();
    const g = trendGeometry([{ value: 5.6, label: "a" }, { value: 5.4, label: "b", pb: true }])!;
    expect(g.path.startsWith("M")).toBe(true);
    expect(g.points).toHaveLength(2);
    expect(g.points[1].pb).toBe(true);
    // Lower value sits lower on the chart (natural axis).
    expect(g.points[1].y).toBeGreaterThan(g.points[0].y);
  });
  it("handles a single point and flat series", () => {
    const g = trendGeometry([{ value: 10, label: "a" }, { value: 10, label: "b" }])!;
    expect(Number.isFinite(g.points[0].y)).toBe(true);
    expect(trendGeometry([{ value: 3, label: "x" }])!.points[0].x).toBeGreaterThan(0);
  });
});
