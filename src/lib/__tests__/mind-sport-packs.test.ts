import { describe, expect, it } from "vitest";
import { getExercise } from "@/lib/mind/content";
import { SPORT_PACKS, getSportPack } from "@/lib/mind/sport-packs";
import { MOMENT_LABELS } from "@/lib/mind/types";

describe("mind sport packs", () => {
  it("includes the six C1 packs", () => {
    expect(SPORT_PACKS.map((p) => p.id).sort()).toEqual(["athletics", "basketball", "combat", "cricket", "football", "racket"]);
  });

  it("has unique ids and at least four situations per pack", () => {
    for (const p of SPORT_PACKS) {
      expect(p.name && p.intro, p.id).toBeTruthy();
      expect(p.covers.length, p.id).toBeGreaterThan(0);
      expect(p.situations.length, p.id).toBeGreaterThanOrEqual(4);
      const ids = p.situations.map((s) => s.id);
      expect(new Set(ids).size, p.id).toBe(ids.length);
    }
  });

  it("maps every situation to existing exercises with a valid moment and cue", () => {
    for (const p of SPORT_PACKS) {
      for (const s of p.situations) {
        const where = `${p.id}/${s.id}`;
        expect(Object.keys(MOMENT_LABELS), where).toContain(s.moment);
        expect(s.cue.trim().length, where).toBeGreaterThan(3);
        expect(s.exerciseIds.length, where).toBeGreaterThan(0);
        for (const id of s.exerciseIds) expect(getExercise(id), `${where} -> ${id}`).toBeDefined();
      }
    }
  });

  it("covers the named pressure situations", () => {
    const has = (pack: string, situation: string) => getSportPack(pack)?.situations.some((s) => s.id === situation);
    expect(has("racket", "match-point")).toBe(true);
    expect(has("racket", "unforced-error")).toBe(true);
    expect(has("cricket", "batting-pressure")).toBe(true);
    expect(has("basketball", "free-throw")).toBe(true);
    expect(has("athletics", "pre-race-nerves")).toBe(true);
    expect(has("combat", "pre-bout")).toBe(true);
  });

  it("sends combat-sport weight management to qualified professionals", () => {
    const notes = getSportPack("combat")?.notes?.join(" ") ?? "";
    expect(notes).toMatch(/weight/i);
    expect(notes).toMatch(/qualified professionals/i);
  });
});
