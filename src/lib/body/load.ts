/**
 * TRIQ Body: training load (session RPE × minutes). Pure helpers.
 *
 * This is decision support for coaches and families: a simple record of how hard and how long an
 * athlete trained each week. It does NOT predict injury, it is not a medical measure, and a number on
 * its own never tells anyone to train more or less. Coaches use it alongside what they see and what the
 * athlete says.
 */

export const LOAD_EXPLAINER = [
  "Training load here is a simple number: how hard a session felt (RPE, 1 to 10, as rated by the athlete) multiplied by how many minutes it lasted.",
  "Adding up a week's sessions shows how much training the athlete did that week compared with other weeks.",
  "It is decision support, not a prediction. It does not say whether someone will get injured, and it is not a medical measure.",
  "Use it with what you see in training and what the athlete tells you. If an athlete reports pain, feels unwell, or something seems wrong, talk to them and, where needed, a qualified professional.",
];

/** Plain-language anchors for the 0-10 RPE scale (session rating of perceived exertion). */
export const RPE_SCALE: { value: number; label: string }[] = [
  { value: 0, label: "Rest" },
  { value: 1, label: "Very, very easy" },
  { value: 2, label: "Easy" },
  { value: 3, label: "Moderate" },
  { value: 4, label: "Somewhat hard" },
  { value: 5, label: "Hard" },
  { value: 6, label: "Hard" },
  { value: 7, label: "Very hard" },
  { value: 8, label: "Very hard" },
  { value: 9, label: "Very, very hard" },
  { value: 10, label: "Maximal" },
];

export type LoadSession = { date: string; minutes: number; rpe: number };

export const MAX_SESSION_MINUTES = 300;

/** Load of one session, or null for invalid input. */
export function sessionLoad(minutes: number, rpe: number): number | null {
  if (!Number.isFinite(minutes) || !Number.isFinite(rpe)) return null;
  if (minutes < 0 || minutes > MAX_SESSION_MINUTES || rpe < 0 || rpe > 10) return null;
  return Math.round(minutes * rpe);
}

/** Monday (YYYY-MM-DD) of the week containing a YYYY-MM-DD date. Null for a bad date. */
export function weekStart(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export type WeeklyLoad = {
  weekStart: string;
  sessions: number;
  minutes: number;
  load: number;
  /** Percentage change from the previous listed week, or null when there is none. */
  changePct: number | null;
};

/** Weekly totals for one athlete, oldest week first. Invalid sessions are skipped. */
export function weeklyLoad(sessions: LoadSession[]): WeeklyLoad[] {
  const byWeek = new Map<string, { sessions: number; minutes: number; load: number }>();
  for (const s of sessions) {
    const wk = weekStart(s.date);
    const l = sessionLoad(s.minutes, s.rpe);
    if (!wk || l === null) continue;
    const cur = byWeek.get(wk) ?? { sessions: 0, minutes: 0, load: 0 };
    cur.sessions += 1;
    cur.minutes += Math.round(s.minutes);
    cur.load += l;
    byWeek.set(wk, cur);
  }
  const weeks = [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return weeks.map(([wk, v], i) => {
    const prev = i > 0 ? weeks[i - 1][1].load : null;
    const changePct = prev === null || prev === 0 ? null : Math.round(((v.load - prev) / prev) * 100);
    return { weekStart: wk, ...v, changePct };
  });
}

/**
 * A neutral description of a week. Describes what happened; never predicts or prescribes.
 */
export function describeWeek(w: WeeklyLoad): string {
  const base = `${w.sessions} session${w.sessions === 1 ? "" : "s"}, ${w.minutes} min, load ${w.load}.`;
  if (w.changePct === null) return base;
  if (w.changePct === 0) return `${base} Same as the week before.`;
  const dir = w.changePct > 0 ? "higher" : "lower";
  return `${base} ${Math.abs(w.changePct)}% ${dir} than the week before. Worth a conversation if this is not what you planned.`;
}
