import { describe, expect, it } from "vitest";
import {
  averageScore,
  cleanScores,
  getRubric,
  isValidScore,
  legacyFromScores,
  RUBRIC_IDS,
  RUBRICS,
  rubricIdFor,
  SCALE,
} from "@/lib/skill-rubrics";
import { getSportConfig } from "@/lib/sport-metrics";
import { isSportKey } from "@/lib/sports-visual";

const REQUIRED = ["cricket", "football", "badminton", "tennis", "table_tennis", "basketball", "swimming", "athletics", "hockey", "kabaddi", "karate", "chess", "generic"];

describe("rubric catalogue", () => {
  it("covers every required sport plus a generic fallback", () => {
    expect([...RUBRIC_IDS].sort()).toEqual([...REQUIRED].sort());
  });

  it.each(RUBRIC_IDS)("%s has 5–8 well-formed skills covering all three legacy areas", (id) => {
    const r = RUBRICS[id];
    expect(r.id).toBe(id);
    expect(r.skills.length).toBeGreaterThanOrEqual(5);
    expect(r.skills.length).toBeLessThanOrEqual(8);
    const keys = r.skills.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of r.skills) {
      expect(k.key).toMatch(/^[a-z][a-z_]*$/);
      expect(k.label.length).toBeGreaterThan(0);
      for (const text of [k.look, k.low, k.high]) {
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(60);
      }
    }
    expect(new Set(r.skills.map((k) => k.area))).toEqual(new Set(["technique", "fitness", "discipline"]));
  });

  it("has a 1–5 scale", () => {
    expect(SCALE.map((x) => x.score)).toEqual([1, 2, 3, 4, 5]);
  });

  it("every specific sport id is a SportKey, so SportIcon draws its own icon", () => {
    for (const id of RUBRIC_IDS.filter((x) => x !== "generic")) expect(isSportKey(id)).toBe(true);
  });

  it("reuses sport-metrics keys where that config exists, so older views keep showing scores", () => {
    for (const id of ["cricket", "football", "badminton", "tennis", "swimming", "basketball"] as const) {
      const legacyKeys = new Set(getSportConfig(id).dimensions.map((d) => d.key));
      const shared = RUBRICS[id].skills.filter((k) => legacyKeys.has(k.key));
      expect(shared.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("rubricIdFor", () => {
  it("matches names, aliases and batch-style text", () => {
    expect(rubricIdFor("Cricket")).toBe("cricket");
    expect(rubricIdFor("U-14 Cricket Boys")).toBe("cricket");
    expect(rubricIdFor("soccer")).toBe("football");
    expect(rubricIdFor("Futsal")).toBe("football");
    expect(rubricIdFor("Table Tennis")).toBe("table_tennis");
    expect(rubricIdFor("table_tennis")).toBe("table_tennis");
    expect(rubricIdFor("TT juniors")).toBe("table_tennis");
    expect(rubricIdFor("Lawn tennis")).toBe("tennis");
    expect(rubricIdFor("Field Hockey")).toBe("hockey");
    expect(rubricIdFor("Track & Field")).toBe("athletics");
    expect(rubricIdFor("Swim squad")).toBe("swimming");
    expect(rubricIdFor("Kabaddi")).toBe("kabaddi");
    expect(rubricIdFor("Shotokan Karate")).toBe("karate");
    expect(rubricIdFor("Chess club")).toBe("chess");
  });

  it("falls back to generic", () => {
    expect(rubricIdFor(null)).toBe("generic");
    expect(rubricIdFor("")).toBe("generic");
    expect(rubricIdFor("Yoga")).toBe("generic");
    expect(rubricIdFor("Attitude")).toBe("generic"); // contains "tt" but not as a word
    expect(getRubric("Archery").id).toBe("generic");
  });
});

describe("scores", () => {
  const r = RUBRICS.cricket;
  const all = (v: number) => Object.fromEntries(r.skills.map((k) => [k.key, v]));

  it("validates integer 1–5 only", () => {
    expect(isValidScore(1)).toBe(true);
    expect(isValidScore(5)).toBe(true);
    for (const bad of [0, 6, 2.5, "3", null, undefined, NaN]) expect(isValidScore(bad)).toBe(false);
  });

  it("cleanScores reports missing and unknown keys", () => {
    const res = cleanScores(r, { batting: 4, bowling: 9, made_up: 3 });
    expect(res.scores).toEqual({ batting: 4 });
    expect(res.missing).toContain("bowling");
    expect(res.unknown).toEqual(["made_up"]);
  });

  it("averageScore rounds to one decimal", () => {
    expect(averageScore({ a: 4, b: 3, c: 3 })).toBe(3.3);
    expect(averageScore({})).toBeNull();
  });

  it("legacyFromScores averages each area and stays within 1–5", () => {
    expect(legacyFromScores(r, all(4))).toEqual({ technique: 4, fitness: 4, discipline: 4 });
    const mixed = { ...all(5), fitness: 1 };
    expect(legacyFromScores(r, mixed).fitness).toBe(1);
    expect(legacyFromScores(r, mixed).technique).toBe(5);
    // Areas with no scores fall back to the overall average, then 3.
    expect(legacyFromScores(r, { batting: 2 })).toEqual({ technique: 2, fitness: 2, discipline: 2 });
    expect(legacyFromScores(r, {})).toEqual({ technique: 3, fitness: 3, discipline: 3 });
  });
});
