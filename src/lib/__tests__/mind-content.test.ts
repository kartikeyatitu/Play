import { describe, expect, it } from "vitest";
import { ALL_EXERCISES, SKILLS, SKILL_IDS, formatMinutes, getExercise, getSkill } from "@/lib/mind/content";
import { MOMENT_LABELS, READING_LEVEL_IDS } from "@/lib/mind/types";

const REQUIRED_SKILLS = ["focus", "confidence", "competitive-anxiety", "emotional-regulation", "resilience", "motivation", "team"];

describe("mind content library", () => {
  it("covers every required skill exactly once", () => {
    expect([...SKILL_IDS].sort()).toEqual([...REQUIRED_SKILLS].sort());
  });

  it("gives every skill 3 to 5 exercises", () => {
    for (const s of SKILLS) {
      expect(s.exercises.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.exercises.length, s.id).toBeLessThanOrEqual(5);
      expect(s.title && s.tagline && s.about, s.id).toBeTruthy();
    }
  });

  it("uses unique exercise ids that point back to their skill", () => {
    const ids = ALL_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SKILLS) for (const e of s.exercises) expect(e.skill, e.id).toBe(s.id);
  });

  it("gives every exercise a duration and valid moments", () => {
    for (const e of ALL_EXERCISES) {
      expect(e.minutes, e.id).toBeGreaterThan(0);
      expect(e.minutes, e.id).toBeLessThanOrEqual(15);
      expect(e.when.length, e.id).toBeGreaterThan(0);
      for (const m of e.when) expect(Object.keys(MOMENT_LABELS), e.id).toContain(m);
      expect(e.title && e.summary, e.id).toBeTruthy();
    }
  });

  it("has all three reading levels for every exercise, with matching step counts", () => {
    expect([...READING_LEVEL_IDS].sort()).toEqual(["adult", "guided", "teen"]);
    for (const e of ALL_EXERCISES) {
      expect(Object.keys(e.levels).sort(), e.id).toEqual(["adult", "guided", "teen"]);
      const counts = READING_LEVEL_IDS.map((l) => e.levels[l].steps.length);
      expect(new Set(counts).size, `${e.id} step counts ${counts.join("/")}`).toBe(1);
      for (const l of READING_LEVEL_IDS) {
        const t = e.levels[l];
        expect(t.intro.trim().length, `${e.id}/${l}`).toBeGreaterThan(10);
        expect(t.steps.length, `${e.id}/${l}`).toBeGreaterThanOrEqual(3);
        for (const step of t.steps) expect(step.trim().length, `${e.id}/${l}`).toBeGreaterThan(5);
      }
    }
  });

  it("gives every guided (under-13) version a note for the grown-up", () => {
    for (const e of ALL_EXERCISES) expect(e.levels.guided.tip, e.id).toBeTruthy();
  });

  it("looks up skills and exercises", () => {
    expect(getSkill("focus")?.title).toBe("Focus and concentration");
    expect(getSkill("nope")).toBeUndefined();
    expect(getExercise("anxiety-long-exhale")?.skill).toBe("competitive-anxiety");
    expect(getExercise("nope")).toBeUndefined();
  });

  it("formats durations", () => {
    expect(formatMinutes(0.5)).toBe("30 sec");
    expect(formatMinutes(4)).toBe("4 min");
  });
});
