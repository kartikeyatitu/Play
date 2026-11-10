// The weekly story: one private page per child per week (Monday to Sunday, academy-local).
// Pure: callers load the rows and pass `today`. Nothing here compares a child with other children.

export type StorySession = {
  date: string; // YYYY-MM-DD (academy-local)
  batchName: string;
  status: string; // session status
  attendance: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "INJURED" | null;
  note: string | null; // coach's note about this child
  recap: string | null; // coach's recap for the whole batch
};

export type StoryInput = {
  childName: string;
  weekStart: string; // Monday
  today: string;
  sessions: StorySession[];
  skill: { latest: { month: string; average: number } | null; previous: { month: string; average: number } | null };
  rewards: { xp: number; points: number; badges: string[] };
  personalBests: { label: string; date: string }[];
  next: { date: string; batchName: string; time: string | null } | null;
};

export type WeeklyStory = {
  firstName: string;
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
  attended: number;
  held: number;
  days: (StorySession & { weekday: string })[];
  notes: { date: string; weekday: string; text: string }[];
  skillChange: { from: number; to: number; month: string } | null;
  rewards: StoryInput["rewards"];
  personalBests: StoryInput["personalBests"];
  next: StoryInput["next"];
  highlight: string;
  summary: string; // plain sentences, for reading aloud
};

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
export function weekdayName(ymd: string): string {
  return WEEKDAYS[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
}
/** Monday of the week containing `ymd`. */
export function mondayOf(ymd: string): string {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return addDays(ymd, -(dow === 0 ? 6 : dow - 1));
}
/** A valid ?w= value, or the current week's Monday. Never a future week. */
export function parseWeek(w: unknown, today: string): string {
  const current = mondayOf(today);
  if (typeof w !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(w) || Number.isNaN(Date.parse(`${w}T00:00:00Z`))) return current;
  const m = mondayOf(w);
  return m > current ? current : m;
}

const attendedStatus = (a: StorySession["attendance"]) => a === "PRESENT" || a === "LATE";
const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildWeeklyStory(input: StoryInput): WeeklyStory {
  const weekEnd = addDays(input.weekStart, 6);
  const isCurrentWeek = input.today >= input.weekStart && input.today <= weekEnd;
  const firstName = input.childName.trim().split(/\s+/)[0] || input.childName;

  const days = input.sessions
    .filter((s) => s.date >= input.weekStart && s.date <= weekEnd && s.date <= input.today && s.status !== "CANCELLED")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ ...s, weekday: weekdayName(s.date) }));
  const held = days.length;
  const attended = days.filter((d) => attendedStatus(d.attendance)).length;
  const notes = days.filter((d) => d.note?.trim()).map((d) => ({ date: d.date, weekday: d.weekday, text: d.note!.trim() }));

  const { latest, previous } = input.skill;
  const skillChange =
    latest && previous && latest.month >= input.weekStart.slice(0, 7) && round1(latest.average) !== round1(previous.average)
      ? { from: round1(previous.average), to: round1(latest.average), month: latest.month }
      : null;

  // One line that leads the page. Effort and progress first; never a comparison with other children.
  let highlight: string;
  if (input.personalBests.length) highlight = `${firstName} set a new personal best: ${input.personalBests[0].label}.`;
  else if (skillChange && skillChange.to > skillChange.from) highlight = `${firstName}'s skills went up this month, from ${skillChange.from} to ${skillChange.to} out of 5.`;
  else if (held > 0 && attended === held) highlight = `${firstName} came to every session this week.`;
  else if (input.rewards.badges.length) highlight = `${firstName} earned a new badge: ${input.rewards.badges[0]}.`;
  else if (attended > 0) highlight = `${firstName} came to ${attended} of ${held} sessions this week.`;
  else if (held > 0) highlight = `${firstName} missed this week's sessions. Every week is a fresh start.`;
  else highlight = isCurrentWeek ? `No sessions for ${firstName} yet this week.` : `There were no sessions for ${firstName} this week.`;

  const parts: string[] = [highlight];
  if (held > 0 && !highlight.includes(`${attended} of ${held}`) && !(attended === held && highlight.includes("every session")))
    parts.push(`${firstName} came to ${attended} of ${held} session${held === 1 ? "" : "s"}.`);
  for (const n of notes) parts.push(`On ${n.weekday}, the coach said: ${n.text}`);
  if (input.rewards.points > 0) parts.push(`${firstName} earned ${input.rewards.points} reward points.`);
  if (input.next) parts.push(`Next session: ${weekdayName(input.next.date)}${input.next.time ? ` at ${input.next.time}` : ""}, ${input.next.batchName}.`);

  return {
    firstName,
    weekStart: input.weekStart,
    weekEnd,
    isCurrentWeek,
    attended,
    held,
    days,
    notes,
    skillChange,
    rewards: input.rewards,
    personalBests: input.personalBests,
    next: isCurrentWeek ? input.next : null,
    highlight,
    summary: parts.join(" "),
  };
}
