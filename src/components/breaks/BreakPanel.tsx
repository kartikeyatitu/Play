"use client";
// Owner: put a child on a break for exams, holidays or injury. No fee for those months, not on the
// coach's roster, nothing counted as missed. Ends on its own; can be ended early.
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { PauseCircle, Loader2 } from "lucide-react";
import { endStudentBreak, getStudentBreak, setStudentBreak } from "@/app/actions/breaks";
import { BREAK_REASONS, BREAK_REASON_LABEL, addMonths, breakLine, monthLabel, type BreakReason, type StudentBreak } from "@/lib/breaks";

export function BreakPanel({ studentId, firstName }: { studentId: string; firstName: string }) {
  const [value, setValue] = useState<StudentBreak | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<BreakReason>("EXAMS");
  const [startOffset, setStartOffset] = useState(0);
  const [months, setMonths] = useState(1);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    getStudentBreak(studentId).then((r) => {
      if (!live || !r.success) return;
      setValue(r.value);
      setMonth(r.currentMonth);
    });
    return () => {
      live = false;
    };
  }, [studentId]);

  if (!month) return null;
  const from = addMonths(month, startOffset);
  const to = addMonths(from, months - 1);

  const save = () =>
    start(async () => {
      const r = await setStudentBreak({ studentId, fromMonth: from, months, reason });
      if (!r.success) return void toast.error(r.error);
      setValue(r.value);
      setOpen(false);
      toast.success(`${firstName} is on a break: no fees ${from === to ? `for ${monthLabel(from)}` : `from ${monthLabel(from)} to ${monthLabel(to)}`}.`);
    });
  const end = () =>
    start(async () => {
      const r = await endStudentBreak(studentId);
      if (!r.success) return void toast.error(r.error);
      setValue(null);
      toast.success(`${firstName} is back on the roster.`);
    });

  const chip = "rounded-full border px-3 py-1.5 text-xs font-semibold";
  const on = "border-lime-400 bg-lime-400/15 text-lime-300";
  const off = "border-zinc-700 text-zinc-300 hover:bg-zinc-800";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <PauseCircle className="h-4 w-4 text-amber-400" aria-hidden /> Break for exams or holidays
        </p>
        {value ? (
          <button type="button" onClick={end} disabled={pending} className="text-xs font-semibold text-amber-300 hover:underline disabled:opacity-50">
            End break
          </button>
        ) : (
          !open && (
            <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-lime-400 hover:underline">
              Start a break
            </button>
          )
        )}
      </div>
      {value && <p className="mt-1.5 text-xs text-amber-200">{breakLine(value)}. No fees and not on the roster until then.</p>}
      {!value && !open && <p className="mt-1.5 text-xs text-zinc-500">No fees and not counted as absent while away. Ends on its own.</p>}
      {!value && open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
            {BREAK_REASONS.map((r) => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={`${chip} ${reason === r ? on : off}`}>
                {BREAK_REASON_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Starts">
            {[0, 1].map((o) => (
              <button key={o} type="button" aria-pressed={startOffset === o} onClick={() => setStartOffset(o)} className={`${chip} ${startOffset === o ? on : off}`}>
                From {monthLabel(addMonths(month, o))}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="How long">
            {[1, 2, 3].map((m) => (
              <button key={m} type="button" aria-pressed={months === m} onClick={() => setMonths(m)} className={`${chip} ${months === m ? on : off}`}>
                {m} month{m > 1 ? "s" : ""}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-lime-400 text-sm font-bold text-zinc-950 disabled:opacity-50">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Start break until {monthLabel(to)}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg px-3 text-sm text-zinc-400 hover:text-zinc-200">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
