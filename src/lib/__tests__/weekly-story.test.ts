import { describe, it, expect } from "vitest";
import { buildWeeklyStory, mondayOf, parseWeek, type StoryInput } from "@/lib/story/weekly";
import { guessLang } from "@/lib/voice/speech";

const base: StoryInput = {
  childName: "Aarav Sharma",
  weekStart: "2026-11-09",
  today: "2026-11-12",
  sessions: [],
  skill: { latest: null, previous: null },
  rewards: { xp: 0, points: 0, badges: [] },
  personalBests: [],
  next: { date: "2026-11-13", batchName: "U-12 nets", time: "5:30 PM" },
};
const s = (date: string, attendance: StoryInput["sessions"][number]["attendance"], note: string | null = null, status = "COMPLETED") => ({
  date,
  batchName: "U-12 nets",
  status,
  attendance,
  note,
  recap: null,
});

describe("weekly story", () => {
  it("weeks run Monday to Sunday and never into the future", () => {
    expect(mondayOf("2026-11-15")).toBe("2026-11-09"); // Sunday
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(parseWeek("2026-11-11", "2026-11-12")).toBe("2026-11-09");
    expect(parseWeek("2026-12-01", "2026-11-12")).toBe("2026-11-09");
    expect(parseWeek("nonsense", "2026-11-12")).toBe("2026-11-09");
    expect(parseWeek("2026-11-02", "2026-11-12")).toBe("2026-11-02");
  });

  it("counts held sessions only: cancelled and future days are left out", () => {
    const st = buildWeeklyStory({
      ...base,
      sessions: [s("2026-11-09", "PRESENT"), s("2026-11-10", "LATE"), s("2026-11-11", "ABSENT"), s("2026-11-12", null, null, "CANCELLED"), s("2026-11-14", null)],
    });
    expect(st.held).toBe(3);
    expect(st.attended).toBe(2);
    expect(st.days.map((d) => d.weekday)).toEqual(["Monday", "Tuesday", "Wednesday"]);
  });

  it("leads with effort and personal progress, never a ranking", () => {
    expect(buildWeeklyStory({ ...base, sessions: [s("2026-11-09", "PRESENT"), s("2026-11-11", "PRESENT")] }).highlight).toBe("Aarav came to every session this week.");
    expect(buildWeeklyStory({ ...base, personalBests: [{ label: "30 m sprint", date: "2026-11-10" }] }).highlight).toContain("personal best: 30 m sprint");
    const missed = buildWeeklyStory({ ...base, sessions: [s("2026-11-09", "ABSENT")] }).highlight;
    expect(missed).toContain("fresh start");
    for (const h of [missed]) expect(h).not.toMatch(/rank|top|best in|than other/i);
  });

  it("collects the coach's notes and reads them in the summary", () => {
    const st = buildWeeklyStory({ ...base, sessions: [s("2026-11-10", "PRESENT", "Front-foot drive much better.")] });
    expect(st.notes).toEqual([{ date: "2026-11-10", weekday: "Tuesday", text: "Front-foot drive much better." }]);
    expect(st.summary).toContain("On Tuesday, the coach said: Front-foot drive much better.");
    expect(st.summary).toContain("Next session: Friday at 5:30 PM");
  });

  it("shows a skill change only for this month's report", () => {
    const up = buildWeeklyStory({ ...base, skill: { latest: { month: "2026-11", average: 3.64 }, previous: { month: "2026-10", average: 3.2 } } });
    expect(up.skillChange).toEqual({ from: 3.2, to: 3.6, month: "2026-11" });
    const old = buildWeeklyStory({ ...base, skill: { latest: { month: "2026-10", average: 3.6 }, previous: { month: "2026-09", average: 3.2 } } });
    expect(old.skillChange).toBeNull();
  });

  it("past weeks have no 'next session'", () => {
    expect(buildWeeklyStory({ ...base, weekStart: "2026-11-02" }).next).toBeNull();
  });
});

describe("read-aloud language", () => {
  it("picks Hindi for Devanagari text", () => {
    expect(guessLang("आज बहुत अच्छा खेला")).toBe("hi-IN");
    expect(guessLang("Great footwork today")).toBe("en-IN");
  });
});
