/**
 * TRIQ Body: session plan helpers. Pure (no database), shared by the builder UI and server actions.
 */

export const MAX_PLAN_ITEMS = 30;
export const MAX_ITEM_MINUTES = 180;
export const MIN_SESSION_MINUTES = 10;
export const MAX_SESSION_MINUTES = 300;
export const DEFAULT_SESSION_MINUTES = 60;

export type PlanItemInput = {
  /** Academy custom drill id (Drill table) or null. */
  drillId?: string | null;
  /** Library drill key (TS constant) when the item came from the TRIQ library; not stored in the DB. */
  libraryKey?: string | null;
  title: string;
  durationMin: number;
  notes?: string | null;
};

export type CleanPlanItem = { drillId: string | null; title: string; durationMin: number; notes: string | null; order: number };

export function clampText(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/**
 * Validate and normalise plan items from untrusted input (a JSON string from a form). Items without a
 * title are dropped; durations are whole minutes between 1 and MAX_ITEM_MINUTES; order is 0..n-1.
 */
export function cleanPlanItems(raw: unknown): { items: CleanPlanItem[]; error?: string } {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return { items: [], error: "The plan could not be read. Please try again." };
    }
  }
  if (!Array.isArray(arr)) return { items: [], error: "The plan could not be read. Please try again." };
  if (arr.length > MAX_PLAN_ITEMS) return { items: [], error: `A plan can have at most ${MAX_PLAN_ITEMS} items.` };
  const items: CleanPlanItem[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const title = clampText(o.title, 120);
    if (!title) continue;
    const mins = Math.round(Number(o.durationMin));
    if (!Number.isFinite(mins) || mins < 1 || mins > MAX_ITEM_MINUTES) {
      return { items: [], error: `"${title}" needs a duration between 1 and ${MAX_ITEM_MINUTES} minutes.` };
    }
    const drillId = typeof o.drillId === "string" && /^[a-z0-9]{10,40}$/i.test(o.drillId) ? o.drillId : null;
    const notes = clampText(o.notes, 300) || null;
    items.push({ drillId, title, durationMin: mins, notes, order: items.length });
  }
  return { items };
}

export function totalMinutes(items: { durationMin: number | null | undefined }[]): number {
  return items.reduce((sum, i) => sum + (Number.isFinite(i.durationMin) ? Math.max(0, Number(i.durationMin)) : 0), 0);
}

export type TimeCheck = { total: number; sessionMinutes: number; diff: number; status: "under" | "fits" | "over"; text: string };

/**
 * Compare a plan's total time with the session length. Up to 5 minutes spare counts as "fits"
 * (time for water and moving between drills).
 */
export function checkPlanTime(items: { durationMin: number | null | undefined }[], sessionMinutes: number): TimeCheck {
  const total = totalMinutes(items);
  const diff = total - sessionMinutes;
  if (diff > 0) return { total, sessionMinutes, diff, status: "over", text: `${diff} min over the ${sessionMinutes}-minute session. Shorten or remove an item.` };
  if (diff < -5) return { total, sessionMinutes, diff, status: "under", text: `${-diff} min left to plan in the ${sessionMinutes}-minute session.` };
  return { total, sessionMinutes, diff, status: "fits", text: `Fits the ${sessionMinutes}-minute session${diff ? ` with ${-diff} min spare` : ""}.` };
}

/** Move an item up (-1) or down (+1); returns a new array with order renumbered. */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return items;
  const next = items.slice();
  const [it] = next.splice(index, 1);
  next.splice(to, 0, it);
  return next;
}

// ---- Session length lives in the plan notes (SessionPlan has no length column) ----------------

const LENGTH_RE = /^\[length:(\d{1,3})\]\s?/;

/** Split stored notes into the session length tag and the coach's free text. */
export function parsePlanNotes(notes: string | null | undefined): { sessionMinutes: number; text: string } {
  const s = notes ?? "";
  const m = LENGTH_RE.exec(s);
  const mins = m ? Number(m[1]) : NaN;
  return {
    sessionMinutes: Number.isFinite(mins) && mins >= MIN_SESSION_MINUTES && mins <= MAX_SESSION_MINUTES ? mins : DEFAULT_SESSION_MINUTES,
    text: m ? s.slice(m[0].length) : s,
  };
}

export function buildPlanNotes(sessionMinutes: number, text: string): string {
  const mins = Math.min(MAX_SESSION_MINUTES, Math.max(MIN_SESSION_MINUTES, Math.round(sessionMinutes) || DEFAULT_SESSION_MINUTES));
  const t = clampText(text, 1000);
  return `[length:${mins}]${t ? ` ${t}` : ""}`;
}

// ---- Copy last week's plan ---------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD → Date at UTC midnight, or null. */
export function parseDay(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

/**
 * The plan to copy into `target`: among plans dated in the 7 days before `target` (target-7 .. target-1),
 * prefer the same weekday (exactly 7 days before), otherwise the most recent. Undated plans are ignored.
 */
export function pickLastWeekPlan<T extends { date: Date | null; updatedAt?: Date }>(plans: T[], target: Date): T | null {
  const from = addDays(target, -7).getTime();
  const to = addDays(target, -1).getTime();
  const inWindow = plans.filter((p) => p.date && p.date.getTime() >= from && p.date.getTime() <= to);
  if (!inWindow.length) return null;
  const sameDay = inWindow.filter((p) => p.date!.getTime() === from);
  const pool = sameDay.length ? sameDay : inWindow;
  return pool.slice().sort((a, b) => {
    const d = b.date!.getTime() - a.date!.getTime();
    return d || (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
  })[0];
}
