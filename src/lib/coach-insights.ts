/**
 * Coach insights (analytics step 5) — pure. One row per coach for the current month:
 * students in their batches, sessions held up to today, how many were marked, attendance in those sessions,
 * and monthly evaluations done. Replaces "sessions per student", which mixed all-time sessions with current rosters.
 */
export type CoachBatchInput = { id: string; coachId: string; coachName: string; studentIds: string[] };
export type CoachSessionInput = { batchId: string; date: string; marked: number; present: number };
export type CoachRow = {
  coachId: string;
  name: string;
  batches: number;
  students: number;
  sessionsHeld: number;
  sessionsMarked: number;
  markedRate: number | null;
  attendanceRate: number | null;
  evaluated: number;
  evaluatedRate: number | null;
};

export function buildCoachInsights(input: {
  batches: ReadonlyArray<CoachBatchInput>;
  sessions: ReadonlyArray<CoachSessionInput>; // this month, not cancelled
  evaluatedStudentIds: ReadonlySet<string>; // skill reports this month
  today: string; // YYYY-MM-DD
}): CoachRow[] {
  const byCoach = new Map<string, { name: string; batchIds: Set<string>; students: Set<string> }>();
  const coachOfBatch = new Map<string, string>();
  for (const b of input.batches) {
    coachOfBatch.set(b.id, b.coachId);
    const c = byCoach.get(b.coachId) ?? { name: b.coachName, batchIds: new Set<string>(), students: new Set<string>() };
    c.batchIds.add(b.id);
    for (const s of b.studentIds) c.students.add(s);
    byCoach.set(b.coachId, c);
  }
  const agg = new Map<string, { held: number; markedSessions: number; marked: number; present: number }>();
  for (const s of input.sessions) {
    if (s.date > input.today) continue; // future sessions aren't "held" yet
    const coachId = coachOfBatch.get(s.batchId);
    if (!coachId) continue;
    const a = agg.get(coachId) ?? { held: 0, markedSessions: 0, marked: 0, present: 0 };
    a.held++;
    if (s.marked > 0) a.markedSessions++;
    a.marked += s.marked;
    a.present += s.present;
    agg.set(coachId, a);
  }
  const rows: CoachRow[] = [];
  for (const [coachId, c] of byCoach) {
    const a = agg.get(coachId) ?? { held: 0, markedSessions: 0, marked: 0, present: 0 };
    const evaluated = [...c.students].filter((id) => input.evaluatedStudentIds.has(id)).length;
    rows.push({
      coachId,
      name: c.name,
      batches: c.batchIds.size,
      students: c.students.size,
      sessionsHeld: a.held,
      sessionsMarked: a.markedSessions,
      markedRate: a.held > 0 ? a.markedSessions / a.held : null,
      attendanceRate: a.marked > 0 ? a.present / a.marked : null,
      evaluated,
      evaluatedRate: c.students.size > 0 ? evaluated / c.students.size : null,
    });
  }
  return rows.sort((x, y) => y.students - x.students || x.name.localeCompare(y.name));
}
