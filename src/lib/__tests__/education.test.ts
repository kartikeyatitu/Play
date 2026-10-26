import { describe, it, expect } from "vitest";
import {
  computeProgramMetrics,
  parseInstitutionProfile,
  parseParticipationInput,
  parseProgramInput,
  parseTeamInput,
} from "@/lib/education";

const today = new Date("2026-10-26T00:00:00.000Z");
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("input parsing", () => {
  it("validates the institution profile", () => {
    expect(parseInstitutionProfile({ kind: "SCHOOL", affiliation: "CBSE" }).ok).toBe(true);
    expect(parseInstitutionProfile({ kind: "ACADEMY" }).ok).toBe(false);
    expect(parseInstitutionProfile({ kind: "COLLEGE", website: "ftp://x" }).ok).toBe(false);
  });
  it("validates programs and teams", () => {
    expect(parseProgramInput({ name: "Football", sport: "Football" }).ok).toBe(true);
    expect(parseProgramInput({ name: "F", sport: "Football" }).ok).toBe(false);
    expect(parseTeamInput({ batchId: "b1" })).toEqual({ ok: true, value: { batchId: "b1", squadType: "TEAM", ageGroup: null, gender: null } });
    expect(parseTeamInput({ batchId: "b1", gender: "ALL" }).ok).toBe(false);
    expect(parseTeamInput({}).ok).toBe(false);
  });
  it("validates participation records", () => {
    const ok = parseParticipationInput({ studentId: "s1", kind: "COMPETITION", title: "Inter-school final", date: "2026-10-20", role: "Captain" }, today);
    expect(ok.ok).toBe(true);
    expect(parseParticipationInput({ studentId: "s1", kind: "COMPETITION", title: "Final", date: "2026-10-27" }, today).ok).toBe(false);
    expect(parseParticipationInput({ studentId: "s1", kind: "PARTY", title: "Final", date: "2026-10-20" }, today).ok).toBe(false);
    expect(parseParticipationInput({ kind: "EVENT", title: "Final", date: "2026-10-20" }, today).ok).toBe(false);
  });
});

describe("computeProgramMetrics", () => {
  it("uses marked rows for the rate and reports unmarked / cancelled sessions separately", () => {
    const m = computeProgramMetrics({
      teamCount: 2,
      enrolledStudentIds: ["a", "b", "a", "c"],
      sessions: [
        { id: "s1", date: d("2026-10-01"), status: "COMPLETED" },
        { id: "s2", date: d("2026-10-03"), status: "COMPLETED" }, // unmarked
        { id: "s3", date: d("2026-10-05"), status: "CANCELLED" },
        { id: "s4", date: d("2026-07-01"), status: "COMPLETED" }, // outside window
        { id: "s5", date: d("2026-10-30"), status: "SCHEDULED" }, // future
      ],
      attendances: [
        { sessionId: "s1", isPresent: true, status: "PRESENT" },
        { sessionId: "s1", isPresent: true, status: "LATE" },
        { sessionId: "s1", isPresent: false, status: "ABSENT" },
        { sessionId: "s1", isPresent: false, status: "EXCUSED" },
        { sessionId: "s3", isPresent: true, status: "PRESENT" }, // cancelled session ignored
        { sessionId: "s4", isPresent: true, status: "PRESENT" },
      ],
      records: [
        { kind: "COMPETITION", date: d("2026-10-10") },
        { kind: "COMPETITION", date: d("2026-10-12") },
        { kind: "SELECTION", date: d("2026-10-15") },
        { kind: "EVENT", date: d("2026-01-01") },
      ],
      from: d("2026-07-28"),
      today,
    });
    expect(m).toEqual({
      teams: 2,
      students: 3,
      sessionsHeld: 2,
      unmarkedSessions: 1,
      marked: 4,
      attended: 2,
      attendanceRate: 50,
      records: { COMPETITION: 2, SELECTION: 1 },
    });
  });

  it("returns a null rate when nothing was marked", () => {
    const m = computeProgramMetrics({ teamCount: 0, enrolledStudentIds: [], sessions: [], attendances: [], records: [], from: d("2026-07-28"), today });
    expect(m.attendanceRate).toBeNull();
    expect(m.sessionsHeld).toBe(0);
  });
});
