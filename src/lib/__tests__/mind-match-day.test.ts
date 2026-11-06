import { describe, expect, it } from "vitest";
import { getExercise } from "@/lib/mind/content";
import { BREATHING_PATTERNS, PRE_MATCH_CHECKLIST, REFLECTION_PROMPTS, RESET_CARDS } from "@/lib/mind/match-day";
import { idlePacer, pacerScale, startPacer, tickPacer } from "@/lib/mind/pacer";
import { READING_LEVEL_IDS } from "@/lib/mind/types";

describe("mind match-day templates", () => {
  it("has a checklist with unique item ids", () => {
    const ids = PRE_MATCH_CHECKLIST.flatMap((g) => g.items.map((i) => i.id));
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("links every reset card to a real exercise", () => {
    for (const c of RESET_CARDS) expect(getExercise(c.exerciseId), c.id).toBeDefined();
  });

  it("has reflection prompts phrased as questions at every reading level", () => {
    for (const l of READING_LEVEL_IDS) {
      expect(REFLECTION_PROMPTS[l].length, l).toBeGreaterThanOrEqual(3);
      for (const q of REFLECTION_PROMPTS[l]) expect(q.trim().endsWith("?"), q).toBe(true);
    }
  });

  it("keeps breathing patterns short and gentle", () => {
    for (const p of BREATHING_PATTERNS) {
      expect(p.rounds, p.id).toBeGreaterThan(0);
      for (const ph of p.phases) {
        expect(ph.seconds, p.id).toBeGreaterThanOrEqual(2);
        expect(ph.seconds, p.id).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe("breathing pacer timing", () => {
  const pattern = BREATHING_PATTERNS.find((p) => p.id === "long-out")!;

  it("counts down, moves through phases and stops after the last round", () => {
    let s = startPacer(pattern);
    expect(s).toMatchObject({ running: true, phase: 0, left: 4, round: 1 });
    for (let i = 0; i < 3; i++) s = tickPacer(s, pattern);
    expect(s).toMatchObject({ phase: 0, left: 1 });
    s = tickPacer(s, pattern);
    expect(s).toMatchObject({ phase: 1, left: 6, round: 1 });
    const perRound = pattern.phases.reduce((n, p) => n + p.seconds, 0);
    let ticks = 4;
    while (s.running && ticks < perRound * pattern.rounds + 5) {
      s = tickPacer(s, pattern);
      ticks++;
    }
    expect(ticks).toBe(perRound * pattern.rounds);
    expect(s).toMatchObject({ running: false, finished: true });
  });

  it("does nothing while idle", () => {
    const idle = idlePacer(pattern);
    expect(tickPacer(idle, pattern)).toBe(idle);
  });

  it("keeps the circle size through a hold", () => {
    const square = BREATHING_PATTERNS.find((p) => p.id === "square")!;
    expect(pacerScale(square, 0)).toBe(1);
    expect(pacerScale(square, 1)).toBe(1);
    expect(pacerScale(square, 2)).toBe(0.55);
    expect(pacerScale(square, 3)).toBe(0.55);
  });
});
