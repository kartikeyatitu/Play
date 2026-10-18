"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ClipboardCheck, Loader2, X, ChevronUp } from "lucide-react";
import { getTodayRoster, markAttendance, markBatchAttendance, type RosterEntry } from "@/app/actions/attendance";
import type { AttendanceStatus } from "@/lib/coach";
import { shellButton } from "@/components/shell/EmptyState";
import { SportGlyph } from "@/components/sport/SportGlyph";
import { CheckMark } from "@/components/ui/status-mark";
import type { SportKind } from "@/components/sport/sport-kind";
import { haptic } from "@/lib/motion";

/**
 * Owner-side attendance for one batch, inline on the Today screen.
 * Loads the roster on demand and saves each tap immediately (no full-page refresh per tap).
 */
export function InlineAttendance({
  batchId,
  batchName,
  subtitle,
  marked,
  defaultOpen = false,
  sport = "multi",
  className = "",
  style,
}: {
  batchId: string;
  batchName: string;
  subtitle: string;
  marked: boolean;
  defaultOpen?: boolean;
  sport?: SportKind;
  className?: string;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<RosterEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // "Session done" moment: shown when the last unmarked student gets a status in this visit
  const [justCompleted, setJustCompleted] = useState(false);
  const wasComplete = useRef<boolean | null>(null);

  async function load() {
    setLoading(true);
    const res = await getTodayRoster(batchId);
    setLoading(false);
    if (!res.success) return toast.error(res.error);
    if (res.cancelled) toast.message("This session was cancelled today.");
    setStudents(res.students);
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !students) await load();
    if (!next) startTransition(() => router.refresh()); // update Today KPIs once, when the owner is done
  }

  // Auto-open (used by "Extra session")
  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function set(studentId: string, status: AttendanceStatus) {
    const prev = students;
    setStudents((s) => s?.map((x) => (x.id === studentId ? { ...x, status } : x)) ?? null);
    setBusy(studentId);
    const res = await markAttendance(batchId, studentId, status);
    setBusy(null);
    if (!res.success) {
      setStudents(prev);
      toast.error(res.error);
    }
  }

  async function allPresent() {
    if (!students?.length) return;
    const prev = students;
    setStudents(students.map((s) => ({ ...s, status: "PRESENT" })));
    setBusy("ALL");
    const res = await markBatchAttendance(batchId, students.map((s) => s.id), "PRESENT");
    setBusy(null);
    if (!res.success) {
      setStudents(prev);
      return toast.error(res.error);
    }
    toast.success(`All ${students.length} marked present`);
  }

  const present = students?.filter((s) => s.status === "PRESENT" || s.status === "LATE").length ?? 0;
  const markedCount = students?.filter((s) => s.status).length ?? 0;
  const complete = !!students && students.length > 0 && markedCount === students.length;

  useEffect(() => {
    if (!students) return;
    if (wasComplete.current === false && complete) {
      setJustCompleted(true);
      haptic([12, 40, 18]);
    }
    if (!complete) setJustCompleted(false);
    wasComplete.current = complete;
  }, [complete, students]);

  const statusLine = students
    ? `${subtitle.split(" · ")[0]} · ${present}/${students.length} present${markedCount < students.length ? ` · ${students.length - markedCount} unmarked` : ""}`
    : subtitle;

  return (
    <div className={`rounded-xl border border-line bg-surface shadow-hairline ${className}`} style={style}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted" aria-hidden>
          <SportGlyph sport={sport} className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate">{batchName}</p>
          <p className="text-[13px] text-ink-subtle truncate tabular-nums mt-0.5">{statusLine}</p>
        </div>
        {marked && !open && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[12px] font-medium text-success shrink-0">
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> Marked
          </span>
        )}
        <button
          type="button"
          onClick={toggleOpen}
          className={(open || marked ? shellButton.quiet : shellButton.primary) + " !px-3 text-[13px] shrink-0"}
          aria-expanded={open}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : open ? <ChevronUp className="w-4 h-4" /> : !marked && <ClipboardCheck className="w-4 h-4" />}
          {open ? "Done" : marked ? "Edit" : "Take attendance"}
        </button>
      </div>

      {open && students && (
        <div className="rise-in border-t border-line px-4 py-3 space-y-2">
          {justCompleted && (
            <div className="fade-in flex items-center gap-3 rounded-lg border border-success/25 bg-success/10 px-3 py-2.5" role="status">
              <CheckMark size={24} />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-ink">Session done</p>
                <p className="text-[13px] text-ink-muted tabular-nums">
                  {present}/{students.length} present. Tap Done to update Today.
                </p>
              </div>
            </div>
          )}
          {students.length === 0 ? (
            <p className="text-sm text-ink-subtle">No students in this batch yet. Add students from the People tab.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={allPresent}
                disabled={busy === "ALL"}
                className={shellButton.primary + " w-full !py-2 text-[13px]"}
              >
                {busy === "ALL" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Mark all present
              </button>
              <ul className="divide-y divide-line">
                {students.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 py-2">
                    <span className="flex-1 min-w-0 truncate text-sm text-ink">{s.name}</span>
                    {busy === s.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-subtle" />}
                    <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label={`Attendance for ${s.name}`}>
                      <button
                        type="button"
                        onClick={() => set(s.id, "PRESENT")}
                        aria-pressed={s.status === "PRESENT"}
                        className={`press min-h-[34px] px-3 rounded-md text-[13px] font-medium inline-flex items-center gap-1 ${
                          s.status === "PRESENT" ? "bg-success/15 text-success" : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {s.status === "PRESENT" && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />} Present
                      </button>
                      <button
                        type="button"
                        onClick={() => set(s.id, "ABSENT")}
                        aria-pressed={s.status === "ABSENT"}
                        className={`press min-h-[34px] px-3 rounded-md text-[13px] font-medium inline-flex items-center gap-1 ${
                          s.status === "ABSENT" ? "bg-danger/10 text-danger" : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {s.status === "ABSENT" && <X className="w-3.5 h-3.5" strokeWidth={2.5} />} Absent
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
