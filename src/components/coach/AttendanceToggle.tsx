"use client";

import { useEffect, useState } from "react";
import { markAttendance } from "@/app/actions/attendance";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AttendanceStatus } from "@/lib/coach";

const OPTIONS: { value: AttendanceStatus; short: string; label: string; active: string }[] = [
  { value: "PRESENT", short: "P", label: "Present", active: "bg-lime-400 text-zinc-950" },
  { value: "LATE", short: "L", label: "Late", active: "bg-amber-400 text-zinc-950" },
  { value: "ABSENT", short: "A", label: "Absent", active: "bg-rose-500 text-white" },
  { value: "EXCUSED", short: "E", label: "Excused (informed leave)", active: "bg-sky-500 text-white" },
];

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
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<AttendanceStatus | null>(initialStatus);

  // Keep in sync when the server re-renders (e.g. after "Mark All Present")
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  async function handleSelect(next: AttendanceStatus) {
    if (status === next || disabled) return;
    setLoading(true);
    const previous = status;
    setStatus(next); // optimistic
    try {
      const res = await markAttendance(batchId, studentId, next);
      if (!res.success) {
        setStatus(previous);
        toast.error(res.error || "Could not save attendance.");
      }
    } catch {
      setStatus(previous);
      toast.error("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Attendance"
      className={`relative inline-flex items-center gap-0.5 bg-zinc-900/90 border border-zinc-800 rounded-xl p-0.5 ${
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
          onClick={() => handleSelect(o.value)}
          disabled={loading || disabled}
          className={`w-8 h-8 text-xs font-black rounded-lg transition-all active:scale-95 ${
            status === o.value ? `${o.active} shadow-sm` : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          {o.short}
        </button>
      ))}
      {loading && (
        <div className="absolute inset-0 bg-zinc-950/60 flex items-center justify-center rounded-xl">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-lime-400" />
        </div>
      )}
    </div>
  );
}
