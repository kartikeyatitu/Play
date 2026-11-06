// Coach roster: one row per athlete across the coach's batches. Pure and client-safe.
// No medical fields here on purpose: the roster never needs them.

export const ATTENDANCE_WINDOW_DAYS = 30;

export interface RosterRow {
  studentId: string;
  name: string;
  batches: { id: string; name: string; sport: string }[];
  /** 0–100, or null when nothing was marked in the window. */
  attendanceRate: number | null;
  attended: number;
  marked: number;
  /** "YYYY-MM" of the latest SkillReport, or null. */
  lastAssessedMonth: string | null;
}

type Mark = { studentId: string; status: string | null; isPresent: boolean };

/**
 * Attendance rate per student: (present + late) / (present + late + absent). Excused marks are left out
 * of both sides so an excused absence doesn't lower the rate.
 */
export function attendanceRates(marks: Mark[]): Map<string, { attended: number; marked: number; rate: number | null }> {
  const acc = new Map<string, { attended: number; marked: number }>();
  for (const m of marks) {
    const status = m.status ?? (m.isPresent ? "PRESENT" : "ABSENT");
    if (status === "EXCUSED") continue;
    const cur = acc.get(m.studentId) ?? { attended: 0, marked: 0 };
    cur.marked += 1;
    if (status === "PRESENT" || status === "LATE") cur.attended += 1;
    acc.set(m.studentId, cur);
  }
  const out = new Map<string, { attended: number; marked: number; rate: number | null }>();
  for (const [id, v] of acc) out.set(id, { ...v, rate: v.marked ? Math.round((v.attended / v.marked) * 100) : null });
  return out;
}

/** Build roster rows from batches (with enrolled students), attendance marks and latest report months. */
export function buildRoster(
  batches: { id: string; name: string; sport: string; students: { id: string; name: string }[] }[],
  marks: Mark[],
  latestMonthByStudent: Map<string, string>,
): RosterRow[] {
  const rates = attendanceRates(marks);
  const rows = new Map<string, RosterRow>();
  for (const b of batches) {
    for (const st of b.students) {
      let row = rows.get(st.id);
      if (!row) {
        const r = rates.get(st.id);
        row = {
          studentId: st.id,
          name: st.name,
          batches: [],
          attendanceRate: r?.rate ?? null,
          attended: r?.attended ?? 0,
          marked: r?.marked ?? 0,
          lastAssessedMonth: latestMonthByStudent.get(st.id) ?? null,
        };
        rows.set(st.id, row);
      }
      if (!row.batches.some((x) => x.id === b.id)) row.batches.push({ id: b.id, name: b.name, sport: b.sport });
    }
  }
  return sortRoster([...rows.values()], "name", "asc");
}

export type RosterSortKey = "name" | "attendance" | "assessed" | "batch";
export type SortDir = "asc" | "desc";

/**
 * Sort a copy of the roster. Missing values (no attendance marked, never assessed) always go last,
 * whichever direction, so the athletes with no data don't hide at the top. Ties fall back to name.
 */
export function sortRoster(rows: RosterRow[], key: RosterSortKey, dir: SortDir = "asc"): RosterRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const byName = (a: RosterRow, b: RosterRow) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  const val = (r: RosterRow): string | number | null => {
    switch (key) {
      case "attendance":
        return r.attendanceRate;
      case "assessed":
        return r.lastAssessedMonth;
      case "batch":
        return r.batches[0]?.name.toLowerCase() ?? null;
      default:
        return r.name.toLowerCase();
    }
  };
  return [...rows].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va == null && vb == null) return byName(a, b);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (key === "name") return sign * byName(a, b);
    const c = va < vb ? -1 : va > vb ? 1 : 0;
    return c !== 0 ? sign * c : byName(a, b);
  });
}

/** True when the athlete has no assessment this month or last (shown as "due"). */
export function assessmentDue(lastMonth: string | null, currentMonth: string): boolean {
  if (!lastMonth) return true;
  const [y, m] = currentMonth.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  return lastMonth < prev;
}
