"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { markAttendance, markBatchAttendance } from "@/app/actions/attendance";
import { SportIcon } from "@/components/sport/SportIcon";
import { rubricIdFor } from "@/lib/skill-rubrics";
import { gridCounts, initialsOf, nextQuickStatus, type DaySession } from "@/lib/coach/day";
import type { AttendanceStatus } from "@/lib/coach";

const TONE: Record<string, string> = {
  PRESENT: "border-success bg-success/15 text-success",
  LATE: "border-warn bg-warn/15 text-warn",
  ABSENT: "border-danger bg-danger/10 text-danger",
  EXCUSED: "border-line bg-surface-2 text-ink-muted",
  NONE: "border-line bg-canvas text-ink-muted",
};

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "present",
  LATE: "late",
  ABSENT: "absent",
  EXCUSED: "excused",
  NONE: "not marked",
};

/** One session: header with sport icon and time, then a tap grid (tap = present, tap again = absent). */
export function DayAttendanceGrid({ session }: { session: DaySession }) {
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | null>>(() =>
    Object.fromEntries(session.students.map((s) => [s.id, s.status])),
  );
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [pendingAll, startAll] = useTransition();
  const counts = gridCounts(session.students.map((s) => ({ status: marks[s.id] ?? null })));
  const sportKey = rubricIdFor(session.sport);

  const tap = async (studentId: string) => {
    if (session.cancelled || busy.has(studentId)) return;
    const prev = marks[studentId] ?? null;
    const next = nextQuickStatus(prev);
    setMarks((m) => ({ ...m, [studentId]: next }));
    setBusy((b) => new Set(b).add(studentId));
    try {
      const res = await markAttendance(session.batchId, studentId, next);
      if (!res.success) {
        setMarks((m) => ({ ...m, [studentId]: prev }));
        toast.error(res.error);
      }
    } catch {
      setMarks((m) => ({ ...m, [studentId]: prev }));
      toast.error("Could not save. Check your connection and try again.");
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(studentId);
        return n;
      });
    }
  };

  const markRestPresent = () => {
    const ids = session.students.filter((s) => !marks[s.id]).map((s) => s.id);
    if (!ids.length) return;
    const before = marks;
    setMarks((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, "PRESENT" as const])) }));
    startAll(async () => {
      try {
        const res = await markBatchAttendance(session.batchId, ids, "PRESENT");
        if (!res.success) {
          setMarks(before);
          toast.error(res.error);
        }
      } catch {
        setMarks(before);
        toast.error("Could not save. Check your connection and try again.");
      }
    });
  };

  return (
    <section aria-labelledby={`day-${session.batchId}`} className="rounded-2xl border border-line bg-surface p-4">
      <header className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2">
          <SportIcon sport={sportKey} className="h-5 w-5" title={session.sport || "Sport"} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`day-${session.batchId}`} className="truncate text-sm font-semibold">
            {session.batchName}
          </h2>
          <p className="truncate text-xs text-ink-muted">
            {session.time || "Time not set"} · {session.sport}
          </p>
        </div>
        <p className="shrink-0 text-right text-xs text-ink-muted" aria-live="polite">
          <span className="font-semibold text-ink">{counts.present}</span>/{counts.total} in
          {counts.absent > 0 && <span className="block">{counts.absent} out</span>}
        </p>
      </header>

      {session.cancelled ? (
        <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-ink-muted">Cancelled today. Restore it from the coach home to take attendance.</p>
      ) : session.students.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">No athletes enrolled in this batch.</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-ink-subtle">Tap once for present, again for absent.</p>
          <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {session.students.map((st) => {
              const status = marks[st.id] ?? null;
              const key = status ?? "NONE";
              return (
                <li key={st.id}>
                  <button
                    type="button"
                    onClick={() => tap(st.id)}
                    disabled={busy.has(st.id)}
                    aria-label={`${st.name}, ${STATUS_LABEL[key]}. Tap to mark ${nextQuickStatus(status).toLowerCase()}.`}
                    className="flex w-full flex-col items-center gap-1 rounded-xl p-1 disabled:opacity-60"
                  >
                    <span className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-sm font-bold ${TONE[key]}`} aria-hidden>
                      {initialsOf(st.name)}
                    </span>
                    <span className="w-full truncate text-center text-[11px] text-ink-muted" aria-hidden>
                      {st.name.split(/\s+/)[0]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {counts.unmarked > 0 && (
            <button
              type="button"
              onClick={markRestPresent}
              disabled={pendingAll}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold disabled:opacity-50"
            >
              <CheckCheck className="h-4 w-4" aria-hidden />
              Mark the other {counts.unmarked} present
            </button>
          )}
        </>
      )}
    </section>
  );
}
