import { describe, it, expect } from "vitest";
import {
  assessmentFor,
  buildPassport,
  FORBIDDEN_KEY,
  LEVEL_THRESHOLDS,
  matchLine,
  normalizeSport,
  PASSPORT_KEYS,
  passportHeadline,
  personalBests,
  sportLevel,
  summarizeAttendance,
  type PassportSource,
} from "@/lib/athlete/passport-build";

const NOW = new Date("2026-11-06T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);

function source(over: Partial<PassportSource> = {}): PassportSource {
  return {
    now: NOW,
    student: { id: "kid1", name: "Aarav Sharma" },
    academy: { id: "org1", name: "Noida Cricket Academy" },
    batches: [{ id: "b1", name: "U-14 Cricket", sport: "Cricket", schedule: "Mon/Wed 5 PM", coachName: "Coach Ravi" }],
    attendances: [
      { isPresent: true, status: "PRESENT", date: daysAgo(1), sessionStatus: "COMPLETED" },
      { isPresent: true, status: "LATE", date: daysAgo(3), sessionStatus: "COMPLETED" },
      { isPresent: false, status: "ABSENT", date: daysAgo(5), sessionStatus: "COMPLETED" },
      { isPresent: false, status: "EXCUSED", date: daysAgo(7), sessionStatus: "COMPLETED" },
      { isPresent: false, status: null, date: daysAgo(9), sessionStatus: "CANCELLED" },
      { isPresent: true, status: null, date: daysAgo(60), sessionStatus: "COMPLETED" },
    ],
    matchStats: [
      {
        matchId: "m1",
        sport: "cricket",
        title: "Academy XI vs Sector 62",
        matchStatus: "COMPLETED",
        playedAt: daysAgo(2),
        stats: { family: "cricket", result: "W", batting: { runs: 34, balls: 22, fours: 4, sixes: 1, out: false }, bowling: { balls: 18, runs: 14, wickets: 2, maidens: 0 }, catches: 1, runOuts: 0, stumpings: 0 },
      },
      {
        matchId: "m0",
        sport: "athletics",
        title: "100m trials",
        matchStatus: "COMPLETED",
        playedAt: daysAgo(20),
        stats: { family: "performance", result: "-", rank: 2, best: 12340, status: "OK", measure: "time", eventName: "100m", field: 8 },
      },
    ],
    performanceResults: [
      { sport: "athletics", eventName: "100m", measure: "time", value: 12340, status: "OK", recordedAt: daysAgo(20), matchId: "m0" },
      { sport: "athletics", eventName: "100m", measure: "time", value: 12100, status: "OK", recordedAt: daysAgo(90), matchId: null },
      { sport: "athletics", eventName: "100m", measure: "time", value: 11000, status: "DQ", recordedAt: daysAgo(30), matchId: null },
    ],
    achievements: [
      { id: "a1", kind: "ACHIEVEMENT", title: "District U-14 runner-up", competition: "District Cup", level: "DISTRICT", result: "2nd", eventDate: daysAgo(40), status: "VERIFIED", submittedByRole: "PARENT", verifiedAt: daysAgo(30) },
      { id: "a2", kind: "ACHIEVEMENT", title: "School sports day gold", competition: null, level: "SCHOOL", result: "1st", eventDate: daysAgo(10), status: "SUBMITTED", submittedByRole: "PARENT", verifiedAt: null },
      { id: "a3", kind: "ACHIEVEMENT", title: "Coach reviewed only", competition: null, level: "CLUB", result: null, eventDate: daysAgo(12), status: "REVIEWED", submittedByRole: "COACH", verifiedAt: null },
      { id: "a4", kind: "ACHIEVEMENT", title: "Rejected claim", competition: null, level: "STATE", result: null, eventDate: daysAgo(15), status: "REJECTED", submittedByRole: "PARENT", verifiedAt: null },
    ],
    goals: [
      { id: "g1", title: "Strike rate 120", metric: "strike rate", baseline: 95, target: 120, dueDate: daysAgo(-60), status: "ACTIVE", achievedAt: null },
      { id: "g2", title: "Dropped goal", metric: null, baseline: null, target: null, dueDate: null, status: "DROPPED", achievedAt: null },
    ],
    skillReports: [
      { month: "2026-10", sport: "cricket", technique: 4, fitness: 4, discipline: 5, metrics: { batting: 4, bowling: 3, injuryRisk: 2, note: "x" }, coachName: "Coach Ravi" },
      { month: "2026-09", sport: null, technique: 3, fitness: 4, discipline: 4, metrics: null, coachName: "Coach Ravi" },
    ],
    ...over,
  };
}

function allKeys(v: unknown, path = "", out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x, i) => allKeys(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(k); allKeys(x, `${path}.${k}`, out); }
  return out;
}

describe("passport payload", () => {
  it("has exactly the documented top-level keys", () => {
    expect(Object.keys(buildPassport(source()))).toEqual([...PASSPORT_KEYS]);
  });

  it("never carries a medical, incident, wellbeing, contact or money field anywhere", () => {
    // Even when the source rows are polluted with such fields, nothing leaks through.
    const polluted = source() as PassportSource & Record<string, unknown>;
    (polluted.student as Record<string, unknown>).medicalInfo = "Asthma";
    (polluted.student as Record<string, unknown>).bloodGroup = "O+";
    (polluted as Record<string, unknown>).incidents = [{ description: "Fell" }];
    const p = buildPassport(polluted);
    const keys = allKeys(p);
    expect(keys.length).toBeGreaterThan(50);
    expect(keys.filter((k) => FORBIDDEN_KEY.test(k))).toEqual([]);
    const text = JSON.stringify(p);
    expect(text).not.toMatch(/Asthma|O\+|Fell/);
    expect(text).not.toMatch(/medical|bloodGroup|incident|wellbeing|allerg|emergency/i);
  });

  it("drops non-numeric and sensitive-looking skill metrics", () => {
    expect(buildPassport(source()).latestSkillReport?.metrics).toEqual({ batting: 4, bowling: 3 });
  });

  it("assembles batches, coach, sports, matches and season stats", () => {
    const p = buildPassport(source());
    expect(p.athlete).toEqual({ id: "kid1", name: "Aarav Sharma", firstName: "Aarav" });
    expect(p.batches[0].coachName).toBe("Coach Ravi");
    expect(p.sports.map((s) => s.key)).toEqual(["cricket", "athletics"]);
    expect(p.matches.map((m) => m.matchId)).toEqual(["m1", "m0"]);
    expect(p.matches[0]).toMatchObject({ result: "W", line: "34* (22) · 2/14 · 1 catch", sportLabel: "Cricket" });
    expect(p.seasonStats.map((s) => s.sport).sort()).toEqual(["athletics", "cricket"]);
    expect(p.latestSkillReport).toMatchObject({ month: "2026-10", average: 4.3 });
  });

  it("marks achievements verified only after academy verification, hides rejected ones", () => {
    const p = buildPassport(source());
    const byId = Object.fromEntries(p.achievements.map((a) => [a.id, a]));
    expect(byId.a1.verification).toBe("VERIFIED");
    expect(byId.a2.verification).toBe("SELF_REPORTED");
    expect(byId.a3.verification).toBe("SELF_REPORTED"); // coach-reviewed is not verified
    expect(byId.a4).toBeUndefined();
    expect(passportHeadline(p)).toMatchObject({ verifiedCount: 1, selfReportedCount: 2 });
  });

  it("keeps active and achieved goals only", () => {
    expect(buildPassport(source()).goals.map((g) => g.id)).toEqual(["g1"]);
  });

  it("a finished live match shows up in the passport", () => {
    const empty = buildPassport(source({ matchStats: [] }));
    expect(empty.matches).toEqual([]);
    const after = buildPassport(
      source({
        matchStats: [{ matchId: "new", sport: "football", title: "U-14 vs Rivals", matchStatus: "COMPLETED", playedAt: daysAgo(0), stats: { family: "goals", result: "D", points: 1, assists: 0, teamFor: 2, teamAgainst: 2 } }],
      }),
    );
    expect(after.matches[0]).toMatchObject({ matchId: "new", result: "D", line: "1 goal · team 2–2" });
    expect(after.levels.find((l) => l.sport === "football")?.matches).toBe(1);
    // Abandoned matches are not history.
    const abandoned = buildPassport(source({ matchStats: [{ matchId: "x", sport: "football", title: "t", matchStatus: "ABANDONED", playedAt: daysAgo(0), stats: { family: "goals", result: "W" } }] }));
    expect(abandoned.matches).toEqual([]);
  });

  it("is deterministic for the same input", () => {
    expect(buildPassport(source())).toEqual(buildPassport(source()));
  });
});

describe("attendance summary", () => {
  it("ignores cancelled sessions and excused absences; LATE counts", () => {
    const a = summarizeAttendance(source().attendances, NOW);
    expect(a.sessions).toBe(4);
    expect(a.attended).toBe(3);
    expect(a.rate).toBe(0.75);
    expect(a.last30Days).toEqual({ sessions: 3, attended: 2, rate: 0.667 });
    expect(a.currentStreak).toBe(2);
  });
  it("handles no sessions", () => {
    expect(summarizeAttendance([], NOW)).toMatchObject({ sessions: 0, rate: null, currentStreak: 0, lastAttendedAt: null });
  });
});

describe("level per sport", () => {
  const T = LEVEL_THRESHOLDS;
  it("Foundation with nothing on record", () => {
    expect(sportLevel({ matches: 0, winRate: null, assessment: null, performanceSport: false }).name).toBe("Foundation");
    expect(sportLevel({ matches: T.developing.minMatches - 1, winRate: 1, assessment: 2.9, performanceSport: false }).level).toBe(1);
  });
  it("Developing from matches OR an assessment", () => {
    expect(sportLevel({ matches: T.developing.minMatches, winRate: 0, assessment: null, performanceSport: false }).level).toBe(2);
    expect(sportLevel({ matches: 0, winRate: null, assessment: T.developing.orMinAssessment, performanceSport: false }).level).toBe(2);
  });
  it("Competitive needs matches AND assessment; matches alone stay Developing", () => {
    expect(sportLevel({ matches: 10, winRate: 0.6, assessment: 3.5, performanceSport: false }).level).toBe(3);
    expect(sportLevel({ matches: 100, winRate: 1, assessment: null, performanceSport: false }).level).toBe(2);
    expect(sportLevel({ matches: 9, winRate: 1, assessment: 5, performanceSport: false }).level).toBe(2);
  });
  it("Advanced needs 25 matches, 4.2 assessment and a 50% win rate (not for performance sports)", () => {
    expect(sportLevel({ matches: 25, winRate: 0.5, assessment: 4.2, performanceSport: false })).toEqual({ level: 4, name: "Advanced", next: null });
    expect(sportLevel({ matches: 25, winRate: 0.49, assessment: 4.2, performanceSport: false }).level).toBe(3);
    expect(sportLevel({ matches: 25, winRate: null, assessment: 4.5, performanceSport: true }).level).toBe(4);
    expect(sportLevel({ matches: 25, winRate: 0.4, assessment: 4.2, performanceSport: false }).next).toContain("win rate 50%+");
  });
  it("has no medical input at all", () => {
    // The input type has exactly these fields; levels can't depend on anything else.
    const input = { matches: 12, winRate: 0.5, assessment: 3.8, performanceSport: false };
    expect(Object.keys(input).sort()).toEqual(["assessment", "matches", "performanceSport", "winRate"]);
    expect(sportLevel(input).level).toBe(3);
  });
  it("assessment averages the latest 3 reports for the sport; sport-less reports count for a single-sport athlete", () => {
    const reports = [
      { month: "2026-10", sport: "Cricket", technique: 5, fitness: 5, discipline: 5, metrics: null, coachName: null },
      { month: "2026-09", sport: null, technique: 3, fitness: 3, discipline: 3, metrics: null, coachName: null },
      { month: "2026-08", sport: "football", technique: 1, fitness: 1, discipline: 1, metrics: null, coachName: null },
      { month: "2026-07", sport: "cricket", technique: 4, fitness: 4, discipline: 4, metrics: null, coachName: null },
      { month: "2026-06", sport: "cricket", technique: 1, fitness: 1, discipline: 1, metrics: null, coachName: null },
    ];
    expect(assessmentFor("cricket", reports, "cricket")).toBe(4);
    expect(assessmentFor("cricket", reports, null)).toBe(3.33);
    expect(assessmentFor("chess", reports, null)).toBeNull();
  });
  it("the passport levels use these rules", () => {
    const p = buildPassport(source());
    const cricket = p.levels.find((l) => l.sport === "cricket")!;
    expect(cricket).toMatchObject({ matches: 1, winRate: 1, level: 2, name: "Developing" });
  });
});

describe("personal bests and match lines", () => {
  it("picks the best valid mark (lower time wins, DQ ignored)", () => {
    const pbs = personalBests(source().performanceResults);
    expect(pbs).toHaveLength(1);
    expect(pbs[0]).toMatchObject({ eventName: "100m", value: 12100, display: "12.10", measure: "time" });
  });
  it("higher is better for distance", () => {
    const pbs = personalBests([
      { sport: "Athletics", eventName: "Long jump", measure: "distance", value: 410, status: "OK", recordedAt: daysAgo(5), matchId: null },
      { sport: "athletics", eventName: "long jump ", measure: "distance", value: 455, status: "OK", recordedAt: daysAgo(2), matchId: null },
    ]);
    expect(pbs).toHaveLength(1);
    expect(pbs[0].display).toBe("4.55 m");
  });
  it("describes the athlete's part per family", () => {
    expect(matchLine("badminton", { family: "rally", periodsWon: 2, periodsLost: 1 })).toBe("2–1");
    expect(matchLine("boxing", { family: "bout", result: "W", pointsFor: 30, pointsAgainst: 27, method: "KO" })).toBe("30–27 (KO)");
    expect(matchLine("chess", { family: "chess", colour: "black" })).toBe("as Black");
    expect(matchLine("swimming", { family: "performance", rank: 1, best: 63450, measure: "time", eventName: "100m free", status: "OK" })).toBe("100m free · 1st · 1:03.45");
    expect(matchLine("swimming", { family: "performance", status: "DNF", eventName: "200m" })).toBe("200m · DNF");
    expect(matchLine("basketball", { family: "goals", points: 1, teamFor: 40, teamAgainst: 38 })).toBe("1 pt · team 40–38");
    expect(matchLine("cricket", { family: "cricket", batting: { runs: 0, balls: 3, out: true } })).toBe("0 (3)");
    expect(matchLine("unknown", null)).toBe("Played");
  });
  it("normalises sport names to live-scoring keys", () => {
    expect(normalizeSport("Table Tennis")).toBe("table_tennis");
    expect(normalizeSport(" CRICKET ")).toBe("cricket");
    expect(normalizeSport(null)).toBe("");
  });
});
