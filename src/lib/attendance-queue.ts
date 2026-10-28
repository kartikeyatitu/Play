/**
 * Offline attendance queue (coach app). When a mark can't reach the server, it is kept on the phone and sent
 * when the connection returns. markAttendance always writes to *today's* session, so items from an earlier day
 * are never sent (they would land on the wrong date); they are dropped and reported instead.
 * Storage is injected so this stays testable; the app passes window.localStorage.
 */
import type { AttendanceStatus } from "@/lib/coach";

export const QUEUE_KEY = "triq:attendance-queue:v1";

export type QueuedMark = { batchId: string; studentId: string; status: AttendanceStatus; date: string; at: number };
type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readQueue(storage: StorageLike | null): QueuedMark[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(QUEUE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list.filter((x) => x && typeof x.batchId === "string" && typeof x.studentId === "string") as QueuedMark[]) : [];
  } catch {
    return [];
  }
}

function write(storage: StorageLike | null, list: QueuedMark[]) {
  if (!storage) return;
  try {
    storage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: nothing more we can do */
  }
}

/** Add or replace the mark for this student in this batch (the latest tap wins). */
export function enqueueMark(storage: StorageLike | null, mark: QueuedMark): number {
  const list = readQueue(storage).filter((m) => !(m.batchId === mark.batchId && m.studentId === mark.studentId));
  list.push(mark);
  write(storage, list);
  return list.length;
}

export type FlushResult = { sent: number; failed: number; stale: number };

/** Send queued marks for `today`. Earlier days are dropped; failures stay queued for the next try. */
export async function flushQueue(
  storage: StorageLike | null,
  today: string,
  send: (m: QueuedMark) => Promise<{ success: boolean; error?: string }>,
): Promise<FlushResult> {
  const list = readQueue(storage);
  const keep: QueuedMark[] = [];
  let sent = 0;
  let failed = 0;
  let stale = 0;
  for (const m of list) {
    if (m.date !== today) {
      stale++;
      continue;
    }
    try {
      const res = await send(m);
      if (res.success) sent++;
      else failed++; // the server refused (e.g. session cancelled): don't retry forever
    } catch {
      keep.push(m); // network error: try again later
    }
  }
  write(storage, keep);
  return { sent, failed, stale };
}

/** Today's date in India time, YYYY-MM-DD (the coach app runs on IST like the server's session dates). */
export function istToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Next status when a coach taps a face tile: unmarked → present → absent → late → present … */
export function nextTileStatus(current: AttendanceStatus | null): AttendanceStatus {
  if (current === "PRESENT") return "ABSENT";
  if (current === "ABSENT") return "LATE";
  return "PRESENT";
}
