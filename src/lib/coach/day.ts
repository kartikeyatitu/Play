// Session day view helpers. Pure and client-safe.

import type { AttendanceStatus } from "@/lib/coach";

/** One of today's sessions as the day view shows it. */
export interface DaySession {
  batchId: string;
  batchName: string;
  sport: string;
  time: string | null;
  cancelled: boolean;
  students: { id: string; name: string; status: AttendanceStatus | null }[];
}

/** "Aarav Kumar Singh" → "AS", "priya" → "PR", "" → "?". */
export function initialsOf(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** One tap cycles unmarked → present → absent → present. */
export function nextQuickStatus(current: AttendanceStatus | null): "PRESENT" | "ABSENT" {
  return current === "PRESENT" || current === "LATE" ? "ABSENT" : "PRESENT";
}

export interface GridCounts {
  total: number;
  present: number;
  absent: number;
  unmarked: number;
}

export function gridCounts(students: { status: AttendanceStatus | null }[]): GridCounts {
  let present = 0;
  let absent = 0;
  let unmarked = 0;
  for (const s of students) {
    if (s.status === "PRESENT" || s.status === "LATE") present++;
    else if (s.status === "ABSENT" || s.status === "EXCUSED") absent++;
    else unmarked++;
  }
  return { total: students.length, present, absent, unmarked };
}
