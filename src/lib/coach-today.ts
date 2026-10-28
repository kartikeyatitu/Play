import { firstName } from "@/lib/coach";
/**
 * Coach Today — pure helpers. Decides each session's state from the clock and attendance marks, picks the one
 * session that deserves the big card, and builds the "Needs you" list. No I/O.
 */

export type SlotRange = { start: number; end: number }; // minutes since midnight (academy time)

/**
 * Parse a batch schedule's time range: "06:30 - 08:00 AM", "5 - 6:30 PM", "11:00 AM - 1:00 PM", "6 PM".
 * The start inherits the end's AM/PM unless that would make it start after it ends (e.g. "11 - 1 PM" → 11 AM).
 * A single time is treated as a one-hour slot. Unknown → null.
 */
export function scheduleRange(schedule: string | null | undefined): SlotRange | null {
  if (!schedule) return null;
  const range = schedule.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  const toMin = (h: number, m: number, p: string) => (h % 12 + (p.toLowerCase() === "pm" ? 12 : 0)) * 60 + m;
  if (range) {
    const endP = range[6];
    const end = toMin(Number(range[4]), Number(range[5] || 0), endP);
    let start = toMin(Number(range[1]), Number(range[2] || 0), range[3] || endP);
    if (!range[3] && start > end) start = toMin(Number(range[1]), Number(range[2] || 0), endP.toLowerCase() === "pm" ? "am" : "pm");
    return start < end ? { start, end } : null;
  }
  const single = schedule.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!single) return null;
  const start = toMin(Number(single[1]), Number(single[2] || 0), single[3]);
  return { start, end: Math.min(start + 60, 24 * 60) };
}

export type SessionPhase = "cancelled" | "done" | "in_progress" | "now" | "unmarked" | "upcoming";

export function sessionPhase(input: { cancelled: boolean; marked: number; total: number; range: SlotRange | null; nowMinutes: number }): SessionPhase {
  if (input.cancelled) return "cancelled";
  if (input.total > 0 && input.marked >= input.total) return "done";
  if (input.marked > 0) return "in_progress";
  if (input.range && input.nowMinutes >= input.range.end) return "unmarked";
  if (input.range && input.nowMinutes >= input.range.start) return "now";
  return "upcoming";
}

export const PHASE_LABEL: Record<SessionPhase, string> = {
  cancelled: "Cancelled",
  done: "Done",
  in_progress: "In progress",
  now: "Now",
  unmarked: "Not marked yet",
  upcoming: "Later today",
};

export type PhasedSession<T> = { item: T; phase: SessionPhase; range: SlotRange | null };

/**
 * Order the day: the hero is a session happening now (or partly marked), else the next upcoming one,
 * else the most recent unmarked one. Groups keep time order.
 */
export function planToday<T>(sessions: ReadonlyArray<PhasedSession<T>>): {
  hero: PhasedSession<T> | null;
  unmarked: PhasedSession<T>[];
  upcoming: PhasedSession<T>[];
  done: PhasedSession<T>[];
  cancelled: PhasedSession<T>[];
} {
  const byStart = [...sessions].sort((a, b) => (a.range?.start ?? 24 * 60) - (b.range?.start ?? 24 * 60));
  const live = byStart.filter((s) => s.phase === "now" || s.phase === "in_progress");
  const upcoming = byStart.filter((s) => s.phase === "upcoming");
  const unmarked = byStart.filter((s) => s.phase === "unmarked");
  const hero = live[0] ?? upcoming[0] ?? unmarked[unmarked.length - 1] ?? null;
  const notHero = (s: PhasedSession<T>) => s !== hero;
  return {
    hero,
    unmarked: unmarked.filter(notHero),
    upcoming: [...live.slice(1), ...upcoming].filter(notHero),
    done: byStart.filter((s) => s.phase === "done"),
    cancelled: byStart.filter((s) => s.phase === "cancelled"),
  };
}

export type NeedsYouItem = { key: string; label: string; detail: string; href: string; tone: "warn" | "info" };

export function needsYou(input: {
  unmarkedToday: number;
  evaluationsDue: number;
  evaluationsTotal: number;
  dayOfMonth: number;
  atRiskHigh: number;
  atRiskMedium: number;
  parentsNotOnApp: number;
  scopeQuery: string; // e.g. "&scope=all" or ""
}): NeedsYouItem[] {
  const items: NeedsYouItem[] = [];
  const q = input.scopeQuery;
  if (input.unmarkedToday > 0) {
    items.push({ key: "unmarked", label: `${input.unmarkedToday} session${input.unmarkedToday === 1 ? "" : "s"} not marked`, detail: "Mark attendance while you remember who came.", href: `/coach?tab=today${q}#not-marked`, tone: "warn" });
  }
  if (input.atRiskHigh + input.atRiskMedium > 0) {
    const n = input.atRiskHigh + input.atRiskMedium;
    items.push({ key: "risk", label: `${n} athlete${n === 1 ? "" : "s"} may drop out`, detail: input.atRiskHigh > 0 ? `${input.atRiskHigh} high risk. A quick call to the parent helps.` : "Check in with their parents.", href: `/coach?tab=squad${q}#at-risk`, tone: input.atRiskHigh > 0 ? "warn" : "info" });
  }
  // Evaluations: surface from the 15th, or earlier if most are still pending near month end.
  if (input.evaluationsDue > 0 && input.dayOfMonth >= 15) {
    items.push({ key: "evals", label: `${input.evaluationsDue} evaluation${input.evaluationsDue === 1 ? "" : "s"} due`, detail: `${input.evaluationsTotal - input.evaluationsDue} of ${input.evaluationsTotal} done this month.`, href: `/coach?tab=squad${q}`, tone: input.dayOfMonth >= 25 ? "warn" : "info" });
  }
  if (input.parentsNotOnApp > 0) {
    items.push({ key: "parents", label: `${input.parentsNotOnApp} parent${input.parentsNotOnApp === 1 ? "" : "s"} not on TRIQ`, detail: "Invite them so they get your recaps.", href: `/coach?tab=today${q}#invite-parents`, tone: "info" });
  }
  return items;
}

/** Friendly note to the parent of a child marked absent. The coach sends it themselves from WhatsApp. */
export function absentMessage(input: { parentName: string; childName: string; batchName: string; coachName: string }): string {
  const parent = input.parentName.trim().split(/\s+/)[0] || "there";
  const child = input.childName.trim().split(/\s+/)[0] || "your child";
  const coach = firstName(input.coachName) || "";
  return `Hi ${parent}, this is ${coach ? `Coach ${coach}` : "your coach"}. We missed ${child} at ${input.batchName} today. Hope all is well. See you at the next session!`;
}
