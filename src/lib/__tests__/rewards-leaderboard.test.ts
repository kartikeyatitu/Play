import { describe, it, expect } from "vitest";
import { ageGroup, buildLeaderboard, leaderboardName, type LeaderboardEntry } from "@/lib/rewards/leaderboard";

const now = new Date(Date.UTC(2026, 10, 7));
const born = (y: number, m = 1, d = 1) => new Date(Date.UTC(y, m - 1, d));
const e = (studentId: string, name: string, dob: Date | null, xp: number, optedIn = true, streak = 0): LeaderboardEntry => ({ studentId, name, dob, optedIn, xp, streak });

describe("names", () => {
  it("first name and last initial only", () => {
    expect(leaderboardName("Aarav Kumar Sharma")).toBe("Aarav S.");
    expect(leaderboardName("  diya   patel ")).toBe("diya P.");
    expect(leaderboardName("Kabir")).toBe("Kabir");
    expect(leaderboardName("")).toBe("Player");
  });
});

describe("age groups", () => {
  it("bands by age on the day", () => {
    expect(ageGroup(born(2019, 1, 1), now)).toBe("U8"); // 7
    expect(ageGroup(born(2018, 11, 8), now)).toBe("U8"); // turns 8 tomorrow
    expect(ageGroup(born(2018, 11, 7), now)).toBe("U10"); // 8 today
    expect(ageGroup(born(2013, 1, 1), now)).toBe("U14"); // 13
    expect(ageGroup(born(2009, 1, 1), now)).toBe("U18"); // 17
    expect(ageGroup(born(2008, 1, 1), now)).toBe("18+");
    expect(ageGroup(null, now)).toBeNull();
    expect(ageGroup(born(2030), now)).toBeNull();
  });
});

describe("leaderboard", () => {
  const entries = [
    e("a", "Aarav Sharma", born(2014, 3, 1), 300, true, 4), // 12 → U14
    e("b", "Diya Patel", born(2014, 6, 1), 500, true, 2), // 12 → U14
    e("c", "Kabir Singh", born(2014, 2, 1), 900, false, 9), // not opted in
    e("d", "Meera Rao", born(2017, 1, 1), 100, true, 1), // 9 → U10
    e("f", "Ishaan Gupta", null, 999, true, 9), // no dob → not ranked
  ];

  it("only opted-in children, grouped by age, never across ages", () => {
    const g = buildLeaderboard(entries, now, null);
    expect(g.map((x) => x.ageGroup)).toEqual(["U10", "U14"]);
    const u14 = g.find((x) => x.ageGroup === "U14")!;
    expect(u14.rows.map((r) => r.name)).toEqual(["Diya P.", "Aarav S."]);
    expect(JSON.stringify(g)).not.toMatch(/Kabir|Ishaan|Sharma/);
  });

  it("rows carry rank, name, XP and streak only (no ids, points, photos or wellbeing)", () => {
    const g = buildLeaderboard(entries, now, new Set(["a"]));
    for (const grp of g) for (const r of grp.rows) expect(Object.keys(r).sort()).toEqual(["mine", "name", "rank", "streak", "xp"]);
  });

  it("a parent sees only their own child's age group, with their row marked", () => {
    const g = buildLeaderboard(entries, now, new Set(["a"]));
    expect(g.map((x) => x.ageGroup)).toEqual(["U14"]);
    expect(g[0].rows.find((r) => r.mine)?.name).toBe("Aarav S.");
    expect(buildLeaderboard(entries, now, new Set(["c"]))).toEqual([]); // own child not opted in
  });

  it("ties share a rank", () => {
    const g = buildLeaderboard([e("a", "A X", born(2014), 100), e("b", "B Y", born(2014), 100), e("c", "C Z", born(2014), 50)], now, null);
    expect(g[0].rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});
