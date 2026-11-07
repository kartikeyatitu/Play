import { describe, it, expect } from "vitest";
import {
  badgeStats,
  badgesToAward,
  bestAttendanceStreak,
  canCoachAwardBadge,
  COACH_BADGE_KEYS,
  GLOBAL_BADGES,
  parseBadgeRule,
  parseTagsNote,
  tagsNote,
  termOf,
  type AttendanceRow,
} from "@/lib/rewards/badges";

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));
const P = (n: number): AttendanceRow => ({ isPresent: true, status: "PRESENT", date: day(n) });
const A = (n: number): AttendanceRow => ({ isPresent: false, status: "ABSENT", date: day(n) });
const X = (n: number): AttendanceRow => ({ isPresent: false, status: "EXCUSED", date: day(n) });
const C = (n: number): AttendanceRow => ({ isPresent: false, status: null, date: day(n), sessionStatus: "CANCELLED" });

const xp = (trigger: string, note: string | null = null) => ({ delta: 10, reasonCode: `${trigger}@football`, note });

describe("badge library", () => {
  it("has the spec badges with fixed keys, names and icons", () => {
    const keys = GLOBAL_BADGES.map((b) => b.key);
    expect(keys).toEqual(["first-session", "ten-in-a-row", "fifty-sessions", "first-win", "personal-best", "clean-sheet", "all-round", "team-player", "most-improved"]);
    for (const b of GLOBAL_BADGES) {
      expect(b.name).toBeTruthy();
      expect(b.icon).toBeTruthy();
      if (b.rule) expect(parseBadgeRule(b.rule)).toEqual(b.rule);
    }
    expect(COACH_BADGE_KEYS).toEqual(["team-player", "most-improved"]);
  });

  it("rejects malformed rules", () => {
    expect(parseBadgeRule({ type: "SESSIONS_TOTAL", count: 0 })).toBeNull();
    expect(parseBadgeRule({ type: "WELLBEING", count: 1 })).toBeNull();
    expect(parseBadgeRule({ type: "TAG", tag: "MOOD", count: 1 })).toBeNull();
    expect(parseBadgeRule(null)).toBeNull();
  });
});

describe("streak", () => {
  it("finds the best run; excused and cancelled sessions are neutral", () => {
    expect(bestAttendanceStreak([P(0), P(1), A(2), P(3)])).toBe(2);
    expect(bestAttendanceStreak([P(0), X(1), P(2), C(3), P(4)])).toBe(3);
    expect(bestAttendanceStreak([P(3), P(1), P(2)])).toBe(3); // order-independent input
    expect(bestAttendanceStreak([])).toBe(0);
  });
});

describe("auto badges", () => {
  const defs = GLOBAL_BADGES.map((b) => ({ ...b, id: b.key }));

  it("awards from the ledger", () => {
    const stats = badgeStats([xp("SESSION_ATTENDED"), xp("MATCH_WON"), xp("MATCH_PLAYED", "tags=CLEAN_SHEET")], [P(0)]);
    expect(stats).toMatchObject({ sessions: 1, wins: 1, personalBests: 0, tags: { CLEAN_SHEET: 1, ALL_ROUND: 0 } });
    expect(badgesToAward(defs, stats, new Set()).map((d) => d.key)).toEqual(["first-session", "first-win", "clean-sheet"]);
  });

  it("10 in a row needs a real run of 10", () => {
    const att = Array.from({ length: 10 }, (_, i) => P(i));
    const s = badgeStats([], att);
    expect(badgesToAward(defs, s, new Set()).map((d) => d.key)).toContain("ten-in-a-row");
    const broken = [...att.slice(0, 5), A(5), ...att.slice(6)];
    expect(badgesToAward(defs, badgeStats([], broken), new Set()).map((d) => d.key)).not.toContain("ten-in-a-row");
  });

  it("skips held badges and never auto-awards coach badges", () => {
    const s = badgeStats(Array.from({ length: 60 }, () => xp("SESSION_ATTENDED")), []);
    const keys = badgesToAward(defs, s, new Set(["first-session"])).map((d) => d.key);
    expect(keys).toEqual(["fifty-sessions"]);
    expect(keys).not.toContain("team-player");
  });

  it("ignores negative XP rows", () => {
    expect(badgeStats([{ delta: -10, reasonCode: "SESSION_ATTENDED@x", note: null }], []).sessions).toBe(0);
  });
});

describe("tags note", () => {
  it("round-trips only known tags", () => {
    expect(tagsNote(["CLEAN_SHEET", "MOOD", "CLEAN_SHEET"])).toBe("tags=CLEAN_SHEET");
    expect(tagsNote([])).toBeNull();
    expect(parseTagsNote("tags=CLEAN_SHEET,ALL_ROUND")).toEqual(["CLEAN_SHEET", "ALL_ROUND"]);
    expect(parseTagsNote("Great game")).toEqual([]);
  });
});

describe("coach badges", () => {
  const ok = { badgeKey: "team-player", reason: "Helped the juniors all term", coachAwardedThisTerm: 0, alreadyHeld: false };
  it("allows one per child per term, with a reason", () => {
    expect(canCoachAwardBadge(ok).ok).toBe(true);
    expect(canCoachAwardBadge({ ...ok, coachAwardedThisTerm: 1 }).ok).toBe(false);
    expect(canCoachAwardBadge({ ...ok, reason: " " }).ok).toBe(false);
    expect(canCoachAwardBadge({ ...ok, badgeKey: "first-win" }).ok).toBe(false);
    expect(canCoachAwardBadge({ ...ok, alreadyHeld: true }).ok).toBe(false);
  });

  it("terms are calendar thirds", () => {
    expect(termOf(new Date(Date.UTC(2026, 0, 5))).key).toBe("2026-T1");
    expect(termOf(new Date(Date.UTC(2026, 4, 1))).key).toBe("2026-T2");
    const t3 = termOf(new Date(Date.UTC(2026, 11, 31)));
    expect(t3.key).toBe("2026-T3");
    expect(t3.start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(t3.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
