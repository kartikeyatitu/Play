"use client";

import { useCallback, useEffect, useState } from "react";
import { markAttendance } from "@/app/actions/attendance";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AttendanceStatus } from "@/lib/coach";
import { enqueueMark, istToday, nextTileStatus } from "@/lib/attendance-queue";

const OPTIONS: { value: AttendanceStatus; short: string; label: string; active: string }[] = [
  { value: "PRESENT", short: "P", label: "Present", active: "bg-lime-400 text-zinc-950" },
  { value: "LATE", short: "L", label: "Late", active: "bg-amber-400 text-zinc-950" },
  { value: "ABSENT", short: "A", label: "Absent", active: "bg-rose-500 text-white" },
  { value: "EXCUSED", short: "E", label: "Excused (informed leave)", active: "bg-sky-500 text-white" },
];

export const QUEUE_EVENT = "triq:attendance-queued";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Save one student's mark with an optimistic update. With no connection the mark is kept on the phone
 * (see src/lib/attendance-queue.ts) and the status stays as tapped; a server refusal reverts it.
 */
export function useAttendanceMark(batchId: string, studentId: string, initialStatus: AttendanceStatus | null) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<AttendanceStatus | null>(initialStatus);
  const [queued, setQueued] = useState(false);

  // Keep in sync when the server re-renders (e.g. after "Mark all present")
  useEffect(() => {
    setStatus(initialStatus);
    setQueued(false);
  }, [initialStatus]);

  const keepOffline = useCallback(
    (next: AttendanceStatus) => {
      enqueueMark(storage(), { batchId, studentId, status: next, date: istToday(), at: Date.now() });
      setQueued(true);
      window.dispatchEvent(new Event(QUEUE_EVENT));
    },
    [batchId, studentId],
  );

  const select = useCallback(
    async (next: AttendanceStatus) => {
      if (status === next && !queued) return;
      const previous = status;
      setStatus(next); // optimistic
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        keepOffline(next);
        return;
      }
      setLoading(true);
      try {
        const res = await markAttendance(batchId, studentId, next);
        if (!res.success) {
          setStatus(previous);
          toast.error(res.error || "Could not save attendance.");
        } else {
          setQueued(false);
        }
      } catch {
        keepOffline(next);
        toast.message("No connection. Saved on this phone; it will sync when you're back online.");
      } finally {
        setLoading(false);
      }
    },
    [batchId, studentId, status, queued, keepOffline],
  );

  return { status, loading, queued, select };
}

export function AttendanceToggle({
  batchId,
  studentId,
  initialStatus,
  disabled = false,
}: {
  batchId: string;
  studentId: string;
  initialStatus: AttendanceStatus | null;
  disabled?: boolean;
}) {
  const { status, loading, queued, select } = useAttendanceMark(batchId, studentId, initialStatus);

  return (
    <div
      role="radiogroup"
      aria-label="Attendance"
      className={`relative inline-flex items-center gap-0.5 bg-surface-2 border border-line rounded-xl p-0.5 ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={status === o.value}
          title={o.label}
          onClick={() => !disabled && select(o.value)}
          disabled={loading || disabled}
          className={`w-9 h-9 text-xs font-black rounded-lg transition-all active:scale-95 ${
            status === o.value ? `${o.active} shadow-sm` : "text-ink-subtle hover:text-ink hover:bg-surface"
          }`}
        >
          {o.short}
        </button>
      ))}
      {queued && <span className="sr-only">Saved on this phone, waiting to sync</span>}
      {queued && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-warn" aria-hidden />}
      {loading && (
        <div className="absolute inset-0 bg-canvas/60 flex items-center justify-center rounded-xl">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-volt" />
        </div>
      )}
    </div>
  );
}

const TILE_STATE: Record<AttendanceStatus, { label: string; cls: string }> = {
  PRESENT: { label: "Present", cls: "border-volt bg-volt/15" },
  LATE: { label: "Late", cls: "border-warn bg-warn/15" },
  ABSENT: { label: "Absent", cls: "border-danger bg-danger/10" },
  EXCUSED: { label: "Excused", cls: "border-line bg-surface-2" },
};

/** Face tile for grid attendance: tap cycles Present → Absent → Late. The status is always written out. */
export function AttendanceTile({
  batchId,
  studentId,
  name,
  initials,
  initialStatus,
  alert,
}: {
  batchId: string;
  studentId: string;
  name: string;
  initials: string;
  initialStatus: AttendanceStatus | null;
  alert?: string | null;
}) {
  const { status, loading, queued, select } = useAttendanceMark(batchId, studentId, initialStatus);
  const state = status ? TILE_STATE[status] : null;
  const first = name.trim().split(/\s+/)[0] || name;
  return (
    <button
      type="button"
      onClick={() => select(nextTileStatus(status))}
      disabled={loading}
      aria-label={`${name}: ${state?.label ?? "not marked"}. Tap to change.`}
      className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2.5 min-h-[104px] transition active:scale-95 ${state ? state.cls : "border-line bg-surface"}`}
    >
      <span className="w-12 h-12 rounded-full bg-surface-2 text-ink flex items-center justify-center text-sm font-bold" aria-hidden>
        {initials}
      </span>
      <span className="w-full truncate text-center text-xs font-semibold text-ink">{first}</span>
      <span className={`text-[11px] font-semibold ${status === "ABSENT" ? "text-danger" : status === "LATE" ? "text-warn" : status ? "text-ink" : "text-ink-subtle"}`}>
        {state?.label ?? "Tap to mark"}
      </span>
      {alert && <span className="absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full bg-amber-400" role="img" aria-label={`To watch: ${alert}`} />}
      {queued && <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-warn" aria-label="Waiting to sync">●</span>}
      {loading && <Loader2 className="absolute top-1.5 right-1.5 w-3 h-3 animate-spin text-ink-subtle" aria-hidden />}
    </button>
  );
}
