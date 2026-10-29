import { describe, expect, it } from "vitest";
import { buildLiveConfig, buildLiveView, liveSport, parseLiveEvent, type LiveEvent, type LiveMatchRecord, type RosterEntry } from "@/lib/live-match";

const HIDDEN = "—";

const PLAYERS = ["Aarav Sharma", "Riya Patel", "Dev Mehta", "Om Jain", "Kabir Rao"];

const roster: RosterEntry[] = [
  { name: "Aarav Sharma", side: "home", academy: true },
  { name: "Riya Patel", side: "home", academy: true },
  { name: "Om Jain", side: "home", academy: true },
  { name: "Dev Mehta", side: "away", academy: false },
  { name: "Kabir Rao", side: "away", academy: false },
];

const rec = (sport: string, config: unknown, extra: Partial<LiveMatchRecord> = {}): LiveMatchRecord => ({
  id: "m1",
  sport,
  title: "Football: Aarav Sharma / Riya Patel vs Dev Mehta",
  homeName: "Academy",
  awayName: "DPS",
  venue: null,
  status: "LIVE",
  visibility: "LINK",
  shareToken: "tok",
  version: 1,
  config,
  startedAt: null,
  endedAt: null,
  ...extra,
});

/** Parses a raw event for the family and fails the test if it is not valid. */
function must(family: "goals" | "cricket", raw: unknown, cfg: unknown): LiveEvent {
  const p = parseLiveEvent(family, raw, cfg as never);
  if (!p.ok) throw new Error(`test event rejected: ${JSON.stringify(raw)}`);
  return p.event;
}

const gcfg = buildLiveConfig("football", { periodMinutes: 20 })!;
const goalEvents = [
  { type: "period_start", period: 1 },
  { type: "score", side: "home", kind: "goal", player: "Aarav Sharma", assist: "Riya Patel", minute: 5 },
  { type: "card", side: "home", colour: "yellow", player: "Om Jain", minute: 9 },
  { type: "score", side: "away", kind: "goal", player: "Dev Mehta", minute: 12 },
].map((e) => must("goals", e, gcfg));

const ccfg = buildLiveConfig("cricket", { overs: 1, battingFirst: "home" })!;
const cricketEvents = [
  must("cricket", { type: "ball", striker: "Aarav Sharma", nonStriker: "Riya Patel", bowler: "Dev Mehta", runs: 4 }, ccfg),
  must("cricket", { type: "ball", striker: "Aarav Sharma", nonStriker: "Kabir Rao", bowler: "Dev Mehta", runs: 0, wicket: { kind: "caught", playerOut: "Kabir Rao", fielder: "Om Jain" } }, ccfg),
];

describe("public share link (outsiders)", () => {
  it("contains no full player name anywhere in the football view, title included", () => {
    const view = buildLiveView(rec("football", gcfg), goalEvents, { canScore: false, staff: false, publicNames: true, roster })!;
    const json = JSON.stringify(view);
    for (const n of PLAYERS) expect(json).not.toContain(n);
    expect(view.title).toBe(liveSport("football")!.label);
    expect(view.roster).toEqual([]);
    expect(view.line).toBe("1–1");
  });

  it("contains no full player name in the cricket view (dismissal text, cards, stat lines)", () => {
    const view = buildLiveView(rec("cricket", ccfg), cricketEvents, { canScore: false, staff: false, publicNames: true, roster })!;
    const json = JSON.stringify(view);
    for (const n of PLAYERS) expect(json).not.toContain(n);
    expect(view.line).toMatch(/^4\/1 /);
  });

  it("masks side labels built from player names (guest pairs) and keeps team names", () => {
    const view = buildLiveView(rec("football", gcfg, { homeName: "Aarav Sharma / Riya Patel" }), goalEvents, { canScore: false, staff: false, publicNames: true, roster })!;
    expect(view.home).toBe("— / —");
    expect(view.away).toBe("DPS");
    expect(JSON.stringify(view)).not.toContain("Aarav Sharma");
  });
});

describe("logged-in parent (ownNames)", () => {
  it("sees only their own child's full name", () => {
    const view = buildLiveView(rec("football", gcfg), goalEvents, { canScore: false, staff: false, ownNames: new Set(["Aarav Sharma"]), roster })!;
    const json = JSON.stringify(view);
    expect(json).toContain("Aarav Sharma");
    for (const n of ["Riya Patel", "Dev Mehta", "Om Jain", "Kabir Rao"]) expect(json).not.toContain(n);
    expect(view.home).toBe("Academy");
    expect(view.roster.find((r) => r.name === "Aarav Sharma")).toBeTruthy();
    expect(view.roster.filter((r) => r.name === HIDDEN).length).toBe(4);
  });

  it("hides the opponents' names from a parent whose child is in the match", () => {
    const view = buildLiveView(rec("cricket", ccfg), cricketEvents, { canScore: false, staff: false, ownNames: new Set(["Riya Patel"]), roster })!;
    const json = JSON.stringify(view);
    expect(json).not.toContain("Aarav Sharma");
    expect(json).not.toContain("Dev Mehta");
    expect(json).not.toContain("Kabir Rao");
  });
});

describe("staff view", () => {
  it("is not masked", () => {
    const view = buildLiveView(rec("football", gcfg), goalEvents, { canScore: true, staff: true, roster })!;
    const json = JSON.stringify(view);
    for (const n of PLAYERS) expect(json).toContain(n);
    expect(view.roster.length).toBe(roster.length);
  });
});
