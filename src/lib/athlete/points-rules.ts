// Recognition points: the pure rules. No DB access, safe on server and client.
//
// Rules (sprint 1, item 10):
//   +10 for each session attended (PRESENT or LATE)
//   +5  streak bonus for each attended session from the 3rd in a row onward
//   +15 for a skill report averaging 4 or more (technique, fitness, discipline; 1–5 scale)
//   +5  for a skill report averaging 3 or more (and under 4)
//
// Missing a session NEVER reduces points. There is no deduction for an absence, and an absence does
// not reset the streak either: it only pauses it (the next attended session continues the run). That
// way back-filling an old absence can never lower a recalculated total.
//
// Excused absences and cancelled sessions are neutral in the same way.

export const POINTS_RULES = {
  attended: 10,
  streakBonus: 5,
  streakFrom: 3,
  skillGreat: 15,
  skillGreatAvg: 4,
  skillGood: 5,
  skillGoodAvg: 3,
} as const;

export type PointsAttendance = {
  /** Legacy flag; used when `status` is missing. */
  isPresent: boolean;
  /** PRESENT | LATE | ABSENT | EXCUSED (null on legacy rows). */
  status?: string | null;
  /** Session date, used to order the history for streaks. */
  date?: Date | string | null;
};

export type PointsSkillReport = { technique: number; fitness: number; discipline: number };

export type PointsBreakdown = {
  total: number;
  attendancePoints: number;
  streakBonus: number;
  skillBonus: number;
  sessionsAttended: number;
  sessionsMissed: number;
  averageSkill: number;
};

/** True when the attendance row counts as attended (LATE counts; EXCUSED and ABSENT don't). */
export function attendedSession(a: PointsAttendance): boolean {
  if (a.status === "PRESENT" || a.status === "LATE") return true;
  if (a.status === "ABSENT" || a.status === "EXCUSED") return false;
  return a.isPresent === true;
}

const finite = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
const t = (d: PointsAttendance["date"]) => {
  if (d == null) return 0;
  const x = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(x) ? x : 0;
};

export function skillAverage(r: PointsSkillReport): number {
  return (finite(r.technique) + finite(r.fitness) + finite(r.discipline)) / 3;
}

export function skillReportBonus(r: PointsSkillReport): number {
  const avg = skillAverage(r);
  if (avg >= POINTS_RULES.skillGreatAvg) return POINTS_RULES.skillGreat;
  if (avg >= POINTS_RULES.skillGoodAvg) return POINTS_RULES.skillGood;
  return 0;
}

/** Points for an athlete's attendance history and skill reports. Never negative. */
export function calculatePoints(
  attendances: ReadonlyArray<PointsAttendance>,
  skillReports: ReadonlyArray<PointsSkillReport>,
): PointsBreakdown {
  // Oldest first so streaks follow the real order of sessions (stable for equal/missing dates).
  const ordered = attendances.map((a, i) => ({ a, i })).sort((x, y) => t(x.a.date) - t(y.a.date) || x.i - y.i);
  let attended = 0;
  let missed = 0;
  let streak = 0;
  let streakBonus = 0;
  for (const { a } of ordered) {
    if (attendedSession(a)) {
      attended++;
      streak++;
      if (streak >= POINTS_RULES.streakFrom) streakBonus += POINTS_RULES.streakBonus;
    } else {
      // Absence: no deduction and the streak is only paused, never reset.
      missed++;
    }
  }
  const attendancePoints = attended * POINTS_RULES.attended;
  const skillBonus = skillReports.reduce((sum, r) => sum + skillReportBonus(r), 0);
  const averageSkill = skillReports.length ? skillReports.reduce((s, r) => s + skillAverage(r), 0) / skillReports.length : 0;
  return {
    total: Math.max(0, attendancePoints + streakBonus + skillBonus),
    attendancePoints,
    streakBonus,
    skillBonus,
    sessionsAttended: attended,
    sessionsMissed: missed,
    averageSkill: Math.round(averageSkill * 10) / 10,
  };
}

/** A manual award from a coach: a positive whole number of points (awards never deduct). */
export function validAward(points: unknown): number | null {
  if (typeof points !== "number" || !Number.isFinite(points)) return null;
  const n = Math.trunc(points);
  return n > 0 && n <= 1000 ? n : null;
}
