// V10 TRIQ Education: institution profile, sports programs, teams mapped onto batches, and student
// participation records. Pure and client-safe: validation and report metrics only.

import { safeHttpUrl } from "@/lib/safe-url";
import { attendanceStatusOf, statusIsPresent } from "@/lib/coach";
import { parseDay, type Parsed } from "@/lib/athlete";

export const INSTITUTION_KINDS = ["SCHOOL", "COLLEGE", "UNIVERSITY"] as const;
export type InstitutionKind = (typeof INSTITUTION_KINDS)[number];
export const INSTITUTION_KIND_LABELS: Record<InstitutionKind, string> = { SCHOOL: "School", COLLEGE: "College", UNIVERSITY: "University" };

export const SQUAD_TYPES = ["TEAM", "SQUAD", "CLUB"] as const;
export type SquadType = (typeof SQUAD_TYPES)[number];
export const TEAM_GENDERS = ["BOYS", "GIRLS", "MIXED"] as const;

export const PARTICIPATION_KINDS = ["TRAINING", "EVENT", "COMPETITION", "SELECTION", "ACHIEVEMENT"] as const;
export type ParticipationKind = (typeof PARTICIPATION_KINDS)[number];
export const PARTICIPATION_KIND_LABELS: Record<ParticipationKind, string> = {
  TRAINING: "Training", EVENT: "Event", COMPETITION: "Competition", SELECTION: "Selection", ACHIEVEMENT: "Achievement",
};

export const PROGRAM_STATUSES = ["ACTIVE", "ARCHIVED"] as const;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
function opt(v: unknown, max: number, label: string): Parsed<string | null> {
  const s = str(v);
  if (!s) return { ok: true, value: null };
  return s.length > max ? { ok: false, error: `${label} must be at most ${max} characters.` } : { ok: true, value: s };
}

export function parseInstitutionProfile(raw: Record<string, unknown>): Parsed<{ kind: InstitutionKind; affiliation: string | null; levels: string | null; website: string | null }> {
  if (!oneOf(INSTITUTION_KINDS, raw.kind)) return { ok: false, error: "Choose school, college or university." };
  const affiliation = opt(raw.affiliation, 80, "Affiliation");
  if (!affiliation.ok) return affiliation;
  const levels = opt(raw.levels, 80, "Levels");
  if (!levels.ok) return levels;
  let website: string | null = null;
  if (str(raw.website)) {
    website = safeHttpUrl(str(raw.website));
    if (!website) return { ok: false, error: "Website must be an http(s) URL." };
  }
  return { ok: true, value: { kind: raw.kind, affiliation: affiliation.value, levels: levels.value, website } };
}

export function parseProgramInput(raw: Record<string, unknown>): Parsed<{ name: string; sport: string; description: string | null }> {
  const name = str(raw.name);
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Program name must be 2–80 characters." };
  const sport = str(raw.sport);
  if (sport.length < 2 || sport.length > 40) return { ok: false, error: "Sport must be 2–40 characters." };
  const description = opt(raw.description, 500, "Description");
  if (!description.ok) return description;
  return { ok: true, value: { name, sport, description: description.value } };
}

export function parseTeamInput(raw: Record<string, unknown>): Parsed<{ batchId: string; squadType: SquadType; ageGroup: string | null; gender: string | null }> {
  const batchId = str(raw.batchId);
  if (!batchId) return { ok: false, error: "Choose a batch." };
  const squadType = str(raw.squadType) || "TEAM";
  if (!oneOf(SQUAD_TYPES, squadType)) return { ok: false, error: "Choose team, squad or club." };
  const ageGroup = opt(raw.ageGroup, 20, "Age group");
  if (!ageGroup.ok) return ageGroup;
  const gender = str(raw.gender) || null;
  if (gender && !oneOf(TEAM_GENDERS, gender)) return { ok: false, error: "Choose boys, girls or mixed." };
  return { ok: true, value: { batchId, squadType, ageGroup: ageGroup.value, gender } };
}

export interface ParticipationInput {
  studentId: string;
  teamId: string | null;
  kind: ParticipationKind;
  title: string;
  date: Date;
  role: string | null;
  result: string | null;
  notes: string | null;
}

export function parseParticipationInput(raw: Record<string, unknown>, today: Date): Parsed<ParticipationInput> {
  const studentId = str(raw.studentId);
  if (!studentId) return { ok: false, error: "Choose a student." };
  if (!oneOf(PARTICIPATION_KINDS, raw.kind)) return { ok: false, error: "Choose a valid type." };
  const title = str(raw.title);
  if (title.length < 3 || title.length > 120) return { ok: false, error: "Title must be 3–120 characters." };
  const date = parseDay(raw.date);
  if (!date) return { ok: false, error: "Enter a valid date." };
  if (date.getTime() > today.getTime()) return { ok: false, error: "The date cannot be in the future." };
  const role = opt(raw.role, 60, "Role");
  if (!role.ok) return role;
  const result = opt(raw.result, 80, "Result");
  if (!result.ok) return result;
  const notes = opt(raw.notes, 500, "Notes");
  if (!notes.ok) return notes;
  return { ok: true, value: { studentId, teamId: str(raw.teamId) || null, kind: raw.kind, title, date, role: role.value, result: result.value, notes: notes.value } };
}

export interface ProgramMetrics {
  teams: number;
  students: number;
  sessionsHeld: number;
  unmarkedSessions: number;
  marked: number;
  attended: number;
  /** attended ÷ marked attendance rows, rounded %; null when nothing was marked. */
  attendanceRate: number | null;
  records: Partial<Record<ParticipationKind, number>>;
}

/**
 * Metrics for one program over a window. Sessions: non-cancelled, dated within [from, today].
 * Attendance rate uses marked rows only; sessions with no marks are reported, not counted as absent.
 */
export function computeProgramMetrics(input: {
  teamCount: number;
  enrolledStudentIds: string[];
  sessions: { id: string; date: Date | string; status: string }[];
  attendances: { sessionId: string; isPresent: boolean; status?: string | null }[];
  records: { kind: string; date: Date | string }[];
  from: Date;
  today: Date;
}): ProgramMetrics {
  const inWindow = (d: Date | string) => {
    const t = new Date(d).getTime();
    return t >= input.from.getTime() && t <= input.today.getTime();
  };
  const held = input.sessions.filter((s) => s.status !== "CANCELLED" && inWindow(s.date));
  const heldIds = new Set(held.map((s) => s.id));
  const markedSessions = new Set<string>();
  let marked = 0;
  let attended = 0;
  for (const a of input.attendances) {
    if (!heldIds.has(a.sessionId)) continue;
    markedSessions.add(a.sessionId);
    marked++;
    const st = attendanceStatusOf(a);
    if (st && statusIsPresent(st)) attended++;
  }
  const records: Partial<Record<ParticipationKind, number>> = {};
  for (const r of input.records) {
    if (!inWindow(r.date) || !oneOf(PARTICIPATION_KINDS, r.kind)) continue;
    records[r.kind] = (records[r.kind] ?? 0) + 1;
  }
  return {
    teams: input.teamCount,
    students: new Set(input.enrolledStudentIds).size,
    sessionsHeld: held.length,
    unmarkedSessions: held.length - markedSessions.size,
    marked,
    attended,
    attendanceRate: marked > 0 ? Math.round((attended / marked) * 100) : null,
    records,
  };
}
