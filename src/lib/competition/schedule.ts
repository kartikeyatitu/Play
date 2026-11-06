// Assigns dates, times and courts to fixtures. Pure, deterministic, client-safe.
import { isKnockoutPhaseRound } from "./phase";

export type ScheduleFixture = {
  id: string;
  round: number;
  slot: number;
  homeEntryId: string | null;
  awayEntryId: string | null;
};

export type ScheduleOptions = {
  /** First match day, YYYY-MM-DD. */
  startDate: string;
  /** Weekdays matches may be played on (0 = Sunday … 6 = Saturday). Empty or omitted = every day. */
  weekdays?: number[];
  /** Most match days available. Omitted = as many as needed. */
  days?: number;
  /** Time slots per match day. */
  slotsPerDay: number;
  /** Start of the first slot, HH:mm (academy local time). */
  firstSlotTime: string;
  /** Minutes between slot starts. */
  slotMinutes: number;
  /** Courts, pitches or tables playing at the same time. */
  courts: number;
  /** Optional court names; defaults to "Court 1", "Court 2"… */
  courtNames?: string[];
  /**
   * Fixtures whose sides come from earlier results (knockout rounds) wait until every fixture of
   * the round before is over. Defaults to true for knockout rounds; round-robin rounds always pack.
   */
  knockout?: boolean;
};

export type ScheduledSlot = {
  fixtureId: string;
  /** 0-based match day. */
  day: number;
  date: string;
  time: string;
  /** 1-based court number. */
  court: number;
  courtName: string;
};

export type ScheduleResult = { ok: true; slots: ScheduledSlot[]; matchDays: number; lastDate: string | null } | { ok: false; error: string };

const MAX_SLOTS = 50_000;

function parseHm(v: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmtHm = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

/** Calendar dates of the first `count` match days from `start` on the allowed weekdays. */
export function matchDates(start: string, count: number, weekdays?: number[]): string[] {
  const allowed = new Set(weekdays && weekdays.length ? weekdays : [0, 1, 2, 3, 4, 5, 6]);
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let guard = 0; out.length < count && guard < count * 7 + 7; guard++) {
    if (allowed.has(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function validateScheduleOptions(o: ScheduleOptions): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.startDate) || Number.isNaN(new Date(`${o.startDate}T00:00:00Z`).getTime())) return "Pick a valid start date.";
  if (o.weekdays && o.weekdays.some((w) => !Number.isInteger(w) || w < 0 || w > 6)) return "Weekdays must be 0 (Sunday) to 6 (Saturday).";
  if (o.days !== undefined && (!Number.isInteger(o.days) || o.days < 1 || o.days > 365)) return "Match days must be between 1 and 365.";
  if (!Number.isInteger(o.slotsPerDay) || o.slotsPerDay < 1 || o.slotsPerDay > 48) return "Slots per day must be between 1 and 48.";
  if (!Number.isInteger(o.courts) || o.courts < 1 || o.courts > 32) return "Courts must be between 1 and 32.";
  if (!Number.isInteger(o.slotMinutes) || o.slotMinutes < 5 || o.slotMinutes > 600) return "Slot length must be between 5 and 600 minutes.";
  const first = parseHm(o.firstSlotTime);
  if (first === null) return "First slot time must be HH:mm.";
  if (first + (o.slotsPerDay - 1) * o.slotMinutes >= 24 * 60) return "The last slot would start after midnight.";
  return null;
}

/**
 * Greedy, in round order (then slot). Each fixture takes the earliest time slot with a free court
 * where:
 *  • neither entry is already playing in that slot, and each entry's fixtures stay in round order;
 *  • for knockout rounds, every fixture of the previous round (and, after a group stage, every group
 *    fixture) is already over, because the sides depend on those results.
 * Courts are filled in order (Court 1 first). Same input → same timetable.
 */
export function scheduleFixtures(fixtures: ScheduleFixture[], o: ScheduleOptions): ScheduleResult {
  const bad = validateScheduleOptions(o);
  if (bad) return { ok: false, error: bad };
  if (fixtures.length === 0) return { ok: true, slots: [], matchDays: 0, lastDate: null };

  const sorted = [...fixtures].sort((a, b) => a.round - b.round || a.slot - b.slot || (a.id < b.id ? -1 : 1));
  const dependent = (f: ScheduleFixture) => isKnockoutPhaseRound(f.round) || o.knockout === true;
  const lastSlotOf = new Map<string, number>(); // entry → last global slot used
  const lastSlotOfRound = new Map<number, number>(); // round → last global slot used by that round
  const used = new Map<number, number>(); // global slot → courts taken
  const busy = new Map<number, Set<string>>(); // global slot → entries playing
  const placed: { f: ScheduleFixture; slot: number; court: number }[] = [];

  for (const f of sorted) {
    let earliest = 0;
    for (const e of [f.homeEntryId, f.awayEntryId]) if (e && lastSlotOf.has(e)) earliest = Math.max(earliest, lastSlotOf.get(e)! + 1);
    if (dependent(f)) {
      for (const [r, s] of lastSlotOfRound) if (r < f.round) earliest = Math.max(earliest, s + 1);
    }
    let s = earliest;
    for (; s < MAX_SLOTS; s++) {
      if ((used.get(s) ?? 0) >= o.courts) continue;
      const b = busy.get(s);
      if (b && ((f.homeEntryId && b.has(f.homeEntryId)) || (f.awayEntryId && b.has(f.awayEntryId)))) continue;
      break;
    }
    if (s >= MAX_SLOTS) return { ok: false, error: "Too many fixtures to schedule." };
    const court = (used.get(s) ?? 0) + 1;
    used.set(s, court);
    const set = busy.get(s) ?? new Set<string>();
    for (const e of [f.homeEntryId, f.awayEntryId]) if (e) (set.add(e), lastSlotOf.set(e, Math.max(lastSlotOf.get(e) ?? -1, s)));
    busy.set(s, set);
    lastSlotOfRound.set(f.round, Math.max(lastSlotOfRound.get(f.round) ?? -1, s));
    placed.push({ f, slot: s, court });
  }

  const matchDays = Math.floor(Math.max(...placed.map((p) => p.slot)) / o.slotsPerDay) + 1;
  if (o.days !== undefined && matchDays > o.days) {
    return { ok: false, error: `These fixtures need ${matchDays} match days with this setup, but only ${o.days} are available. Add slots, courts or days.` };
  }
  const dates = matchDates(o.startDate, matchDays, o.weekdays);
  const first = parseHm(o.firstSlotTime)!;
  const slots = placed.map(({ f, slot, court }) => {
    const day = Math.floor(slot / o.slotsPerDay);
    const t = slot % o.slotsPerDay;
    return {
      fixtureId: f.id,
      day,
      date: dates[day],
      time: fmtHm(first + t * o.slotMinutes),
      court,
      courtName: o.courtNames?.[court - 1]?.trim() || `Court ${court}`,
    };
  });
  return { ok: true, slots, matchDays, lastDate: dates[matchDays - 1] ?? null };
}
