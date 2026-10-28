import { describe, expect, it } from "vitest";
import {
  athleteStatForSide,
  buildLiveConfig,
  canViewMatch,
  momentum,
  parseLiveEvent,
  publicName,
  rallyPressure,
  readLiveConfig,
  replayLive,
  scoreboard,
  scoreLine,
  type LiveEvent,
} from "@/lib/live-match";
import type { RallyConfig } from "@/lib/scoring/rally";

const pts = (seq: string): LiveEvent[] => [...seq].map((c) => ({ type: "point", side: c === "h" ? "home" : "away" }));

describe("config", () => {
  it("defaults per sport and applies best-of", () => {
    expect(buildLiveConfig("badminton")).toMatchObject({ pointsToWin: 21, setsToWin: 2 });
    expect(buildLiveConfig("table_tennis", 5)).toMatchObject({ pointsToWin: 11, setsToWin: 3 });
    expect(buildLiveConfig("badminton", 1)).toMatchObject({ setsToWin: 1 });
    expect(buildLiveConfig("badminton", 4)).toMatchObject({ setsToWin: 2 });
    expect(buildLiveConfig("cricket")).toBeNull();
  });
  it("reads stored config defensively", () => {
    expect(readLiveConfig("badminton", { setsToWin: 1, pointsToWin: "x", evil: 5 })).toMatchObject({ setsToWin: 1, pointsToWin: 21 });
    expect(readLiveConfig("badminton", null)).toMatchObject({ setsToWin: 2 });
    expect(readLiveConfig("badminton", { setsToWin: -3 })).toMatchObject({ setsToWin: 2 });
  });
});

describe("parseLiveEvent", () => {
  it("accepts points and strips unknown fields", () => {
    expect(parseLiveEvent("rally", { type: "point", side: "home", hack: 1 })).toEqual({ ok: true, event: { type: "point", side: "home" } });
    expect(parseLiveEvent("rally", { type: "point", side: "away", player: "p1" })).toEqual({ ok: true, event: { type: "point", side: "away", player: "p1" } });
    expect(parseLiveEvent("tennis", { type: "point", side: "away", player: "p1" })).toEqual({ ok: true, event: { type: "point", side: "away" } });
  });
  it("rejects bad input", () => {
    expect(parseLiveEvent("rally", { type: "point", side: "left" }).ok).toBe(false);
    expect(parseLiveEvent("rally", { type: "goal", side: "home" }).ok).toBe(false);
    expect(parseLiveEvent("rally", null).ok).toBe(false);
  });
});

describe("replay and scoreboard", () => {
  const tt = buildLiveConfig("table_tennis", 3)!;
  it("table tennis best of 3", () => {
    const events = [...pts("h".repeat(11)), ...pts("a".repeat(11)), ...pts("hhhhh")];
    const board = scoreboard(replayLive("rally", tt, events));
    expect(board.periods).toEqual([{ home: 11, away: 0 }, { home: 0, away: 11 }]);
    expect(board.current).toEqual({ home: "5", away: "0" });
    expect(scoreLine(board)).toBe("11–0 · 0–11 · 5–0");
  });
  it("tennis calls deuce and advantage", () => {
    const cfg = buildLiveConfig("tennis")!;
    expect(scoreboard(replayLive("tennis", cfg, pts("hhaa"))).current).toEqual({ home: "30", away: "30" });
    expect(scoreboard(replayLive("tennis", cfg, pts("hhhaaa"))).current).toEqual({ home: "40", away: "40" });
    expect(scoreboard(replayLive("tennis", cfg, pts("hhhaaah"))).current).toEqual({ home: "AD", away: "40" });
    const oneGame = scoreboard(replayLive("tennis", cfg, pts("hhhh")));
    expect(oneGame.games).toEqual({ home: 1, away: 0 });
    expect(scoreLine(oneGame)).toBe("1–0");
  });
});

describe("rallyPressure", () => {
  const cfg = buildLiveConfig("badminton") as RallyConfig;
  it("calls game point, then match point", () => {
    const s1 = replayLive("rally", cfg, pts("h".repeat(20)));
    expect(s1.family === "rally" && rallyPressure(s1.rally, cfg)).toEqual({ side: "home", kind: "game" });
    const s2 = replayLive("rally", cfg, pts("h".repeat(21) + "h".repeat(20)));
    expect(s2.family === "rally" && rallyPressure(s2.rally, cfg)).toEqual({ side: "home", kind: "match" });
  });
  it("no call at 20-20, call at 29-29 for both via cap", () => {
    const s = replayLive("rally", cfg, pts("ha".repeat(20)));
    expect(s.family === "rally" && rallyPressure(s.rally, cfg)).toBeNull();
    const capped = replayLive("rally", cfg, pts("ha".repeat(29)));
    expect(capped.family === "rally" && rallyPressure(capped.rally, cfg)).toEqual({ side: "home", kind: "game" });
  });
});

describe("momentum and stats", () => {
  it("tracks runs and point difference", () => {
    const m = momentum(pts("hhhaahhhha"));
    expect(m.longestRun).toEqual({ home: 4, away: 2 });
    expect(m.currentRun).toEqual({ side: "away", length: 1 });
    expect(m.pointsWon).toEqual({ home: 7, away: 3 });
    expect(m.diff.at(-1)).toBe(4);
  });
  it("writes a W/L line per side", () => {
    const cfg = buildLiveConfig("table_tennis", 1)!;
    const events = pts("h".repeat(11));
    const state = replayLive("rally", cfg, events);
    expect(athleteStatForSide(state, events, "home")).toEqual({ result: "W", periodsWon: 1, periodsLost: 0, pointsWon: 11, pointsLost: 0, longestRun: 11 });
    expect(athleteStatForSide(state, events, "away").result).toBe("L");
  });
});

describe("privacy", () => {
  const m = { orgId: "o", visibility: "ACADEMY", shareToken: "tok" };
  it("staff always, parents of players on ACADEMY, link only with token", () => {
    expect(canViewMatch(m, { staffOfOrg: true, parentOfPlayer: false })).toBe(true);
    expect(canViewMatch(m, { staffOfOrg: false, parentOfPlayer: true })).toBe(true);
    expect(canViewMatch(m, { staffOfOrg: false, parentOfPlayer: false, token: "tok" })).toBe(false);
    expect(canViewMatch({ ...m, visibility: "LINK" }, { staffOfOrg: false, parentOfPlayer: false, token: "tok" })).toBe(true);
    expect(canViewMatch({ ...m, visibility: "LINK" }, { staffOfOrg: false, parentOfPlayer: false, token: "bad" })).toBe(false);
    expect(canViewMatch({ ...m, visibility: "PRIVATE" }, { staffOfOrg: false, parentOfPlayer: true })).toBe(false);
  });
  it("shortens names for public links", () => {
    expect(publicName("Aarav Kumar Sharma")).toBe("Aarav S.");
    expect(publicName("Aarav")).toBe("Aarav");
  });
});
