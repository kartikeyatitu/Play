import { describe, expect, it } from "vitest";
import {
  buildLiveConfig,
  buildLiveView,
  isDecided,
  liveOutcome,
  parseLiveEvent,
  parseMark,
  playerStatLine,
  readLiveConfig,
  renameInEvent,
  replayLive,
  summaryLine,
  publicName,
  type LiveEvent,
  type LiveMatchRecord,
} from "@/lib/live-match";

const rec = (sport: string, config: unknown, extra: Partial<LiveMatchRecord> = {}): LiveMatchRecord => ({
  id: "m1",
  sport,
  title: "t",
  homeName: "Academy",
  awayName: "DPS",
  venue: null,
  status: "LIVE",
  visibility: "ACADEMY",
  shareToken: "tok",
  version: 3,
  config,
  startedAt: null,
  endedAt: null,
  ...extra,
});

const ball = (striker: string, nonStriker: string, bowler: string, runs: number, more: Record<string, unknown> = {}) => ({
  type: "ball",
  striker,
  nonStriker,
  bowler,
  runs,
  ...more,
});

describe("cricket", () => {
  const cfg = buildLiveConfig("cricket", { overs: 1, battingFirst: "away" })!;
  it("builds config with overs and toss", () => {
    expect(cfg).toMatchObject({ oversPerInnings: 1, battingFirst: "away", ballsPerOver: 6 });
    expect(readLiveConfig("cricket", { oversPerInnings: 5, battingFirst: "home" })).toMatchObject({ oversPerInnings: 5, battingFirst: "home" });
    expect(buildLiveConfig("cricket", { overs: 99 })).toMatchObject({ oversPerInnings: 20 });
  });
  it("validates balls", () => {
    expect(parseLiveEvent("cricket", ball("A", "B", "X", 4)).ok).toBe(true);
    expect(parseLiveEvent("cricket", ball("A", "A", "X", 1)).ok).toBe(false);
    expect(parseLiveEvent("cricket", ball("A", "B", "", 1)).ok).toBe(false);
    expect(parseLiveEvent("cricket", ball("A", "B", "X", 9)).ok).toBe(false);
    expect(parseLiveEvent("cricket", ball("A", "B", "X", 0, { wicket: { kind: "caught", playerOut: "Z" } })).ok).toBe(false);
    expect(parseLiveEvent("cricket", ball("A", "B", "X", 0, { extra: { kind: "wide" }, wicket: { kind: "bowled", playerOut: "A" } })).ok).toBe(false);
    const wide = parseLiveEvent("cricket", ball("A", "B", "X", 3, { extra: { kind: "wide", runs: 1 } }));
    expect(wide.ok && wide.event).toMatchObject({ runs: 0, extra: { kind: "wide", runs: 1 } });
    expect(parseLiveEvent("cricket", { type: "end_innings" }).ok).toBe(true);
  });
  it("replays a 1-over chase, decides it and writes player stats", () => {
    const evs: LiveEvent[] = [];
    // DPS (away) bat first: 6 balls, 10 runs, one caught.
    for (const r of [1, 4, 0, 1, 4, 0]) evs.push(parseLiveEvent("cricket", ball("D1", "D2", "Aarav", r), cfg).ok ? (parseLiveEvent("cricket", ball("D1", "D2", "Aarav", r), cfg) as any).event : null);
    // Academy (home) chase 11: six, six → done.
    evs.push((parseLiveEvent("cricket", ball("Kabir", "Ishaan", "D3", 6), cfg) as any).event);
    evs.push((parseLiveEvent("cricket", ball("Kabir", "Ishaan", "D3", 0, { wicket: { kind: "caught", playerOut: "Kabir", fielder: "D1" } }), cfg) as any).event);
    evs.push((parseLiveEvent("cricket", ball("Ishaan", "Rohan", "D3", 6), cfg) as any).event);
    const st = replayLive("cricket", cfg, evs);
    expect(st.family === "cricket" && st.cricket.innings.map((i) => i.runs)).toEqual([10, 12]);
    expect(liveOutcome(st, "away")).toBe("home");
    expect(isDecided(st, "away")).toBe(true);
    expect(summaryLine(st, cfg, { home: "Academy", away: "DPS" })).toBe("10/0 (1.0) v 12/1 (0.3)");
    if (st.family === "cricket") {
      expect(st.cricket.innings[0].overRuns).toEqual([10]);
      expect(st.cricket.innings[1].fow).toEqual([{ runs: 6, wicket: 1, player: "Kabir", overs: "0.2" }]);
    }
    const kabir = playerStatLine("cricket", st, evs, cfg, "Kabir", "home");
    expect(kabir).toMatchObject({ result: "W", batting: { runs: 6, balls: 2, sixes: 1, out: true } });
    const aarav = playerStatLine("cricket", st, evs, cfg, "Aarav", "home");
    expect(aarav).toMatchObject({ result: "W", batting: null, bowling: { balls: 6, runs: 10, wickets: 0 } });
    const view = buildLiveView(rec("cricket", cfg), evs, { canScore: true, staff: true })!;
    expect(view.detail.family).toBe("cricket");
    expect(view.decided).toBe(true);
    expect(view.outcome).toBe("home");
    if (view.detail.family === "cricket") expect(view.detail.battingSides).toEqual(["away", "home"]);
  });
});

describe("goals", () => {
  const cfg = buildLiveConfig("football", { periodMinutes: 20 })!;
  it("checks score kinds against the sport", () => {
    expect(parseLiveEvent("goals", { type: "score", side: "home", kind: "goal", player: "A", assist: "A" }, cfg)).toEqual({
      ok: true,
      event: { type: "score", side: "home", kind: "goal", player: "A" },
    });
    expect(parseLiveEvent("goals", { type: "score", side: "home", kind: "3pt" }, cfg).ok).toBe(false);
    expect(parseLiveEvent("goals", { type: "card", side: "home", colour: "red" }, cfg).ok).toBe(false);
    expect(cfg).toMatchObject({ periodMinutes: 20, periods: 2 });
  });
  it("finishes after the last period and writes a W/D/L line", () => {
    const evs = [
      { type: "period_start", period: 1 },
      { type: "score", side: "home", kind: "goal", player: "Aarav", assist: "Kabir", minute: 5 },
      { type: "period_end", period: 1 },
      { type: "period_start", period: 2 },
      { type: "score", side: "away", kind: "goal", player: "X" },
      { type: "period_end", period: 2 },
    ].map((e) => (parseLiveEvent("goals", e, cfg) as any).event as LiveEvent);
    const st = replayLive("goals", cfg, evs);
    expect(isDecided(st)).toBe(true);
    expect(liveOutcome(st)).toBe("draw");
    expect(playerStatLine("goals", st, evs, cfg, "Aarav", "home")).toMatchObject({ result: "D", points: 1, teamFor: 1, teamAgainst: 1 });
    expect(playerStatLine("goals", st, evs, cfg, "Kabir", "home")).toMatchObject({ assists: 1 });
  });
});

describe("bouts and chess", () => {
  it("bout point gap and decision on finish", () => {
    const cfg = buildLiveConfig("karate")!;
    const evs = [
      { type: "score", side: "home", points: 3, round: 1 },
      { type: "score", side: "away", points: 1, round: 1 },
    ].map((e) => (parseLiveEvent("bout", e, cfg) as any).event as LiveEvent);
    expect(liveOutcome(replayLive("bout", cfg, evs))).toBeNull();
    const done = replayLive("bout", cfg, evs, true);
    expect(liveOutcome(done)).toBe("home");
    expect(parseLiveEvent("bout", { type: "stoppage", winner: "away", method: "KO" }).ok).toBe(true);
    expect(parseLiveEvent("bout", { type: "stoppage", winner: "away", method: "magic" }).ok).toBe(false);
  });
  it("chess result", () => {
    const cfg = buildLiveConfig("chess")!;
    const ev = (parseLiveEvent("chess", { type: "result", result: "1/2-1/2", moves: 41 }) as any).event;
    const st = replayLive("chess", cfg, [ev]);
    expect(liveOutcome(st)).toBe("draw");
    expect(summaryLine(st, cfg, { home: "a", away: "b" })).toBe("½–½");
    expect(playerStatLine("chess", st, [ev], cfg, "a", "away")).toMatchObject({ result: "D", colour: "black", moves: 41 });
  });
});

describe("performance", () => {
  const cfg = buildLiveConfig("athletics", { eventName: "Long jump", measure: "distance", attempts: 3 })!;
  it("parses marks", () => {
    expect(parseMark("12.45", "time")).toBe(12450);
    expect(parseMark("1:03.45", "time")).toBe(63450);
    expect(parseMark("1:75", "time")).toBeNull();
    expect(parseMark("6.45", "distance")).toBe(645);
    expect(parseMark("6,4", "distance")).toBe(640);
    expect(parseMark("abc", "points")).toBeNull();
  });
  it("ranks best attempts", () => {
    const evs = [
      { type: "result", athlete: "Aarav", value: 512, status: "OK" },
      { type: "result", athlete: "Kabir", value: null, status: "DQ" },
      { type: "result", athlete: "Aarav", value: 530, status: "OK" },
      { type: "result", athlete: "Kabir", value: 540, status: "OK" },
    ].map((e) => (parseLiveEvent("performance", e, cfg) as any).event as LiveEvent);
    const st = replayLive("performance", cfg, evs);
    expect(st.family === "performance" && st.ranked.map((r) => [r.athlete, r.rank, r.best])).toEqual([
      ["Kabir", 1, 540],
      ["Aarav", 2, 530],
    ]);
    expect(summaryLine(st, cfg, { home: "", away: "" })).toBe("Kabir 5.40 m");
    expect(playerStatLine("performance", st, evs, cfg, "Aarav", "field")).toMatchObject({ rank: 2, best: 530, eventName: "Long jump" });
    expect(parseLiveEvent("performance", { type: "result", athlete: "A", value: 0, status: "OK" }).ok).toBe(false);
  });
});

describe("public names", () => {
  it("shortens every person in events and roster, keeps team names", () => {
    const ev = renameInEvent({ type: "ball", striker: "Aarav Sharma", nonStriker: "Kabir Rao", bowler: "Dev Patel", runs: 0, wicket: { kind: "caught", playerOut: "Aarav Sharma", fielder: "Om Jain" } } as LiveEvent, publicName);
    expect(ev).toMatchObject({ striker: "Aarav S.", bowler: "Dev P.", wicket: { playerOut: "Aarav S.", fielder: "Om J." } });
    const cfg = buildLiveConfig("football")!;
    const view = buildLiveView(rec("football", cfg), [], {
      canScore: false,
      staff: false,
      publicNames: true,
      roster: [{ name: "Aarav Sharma", side: "home", academy: true }],
    })!;
    expect(view.home).toBe("Academy");
    expect(view.roster[0].name).toBe("Aarav S.");
    expect(view.shareToken).toBeNull();
  });
});
