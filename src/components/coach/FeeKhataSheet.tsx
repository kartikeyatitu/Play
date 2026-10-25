"use client";

import { useState } from "react";
import { ChevronRight, IndianRupee, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CoachFeeKhata, type CoachStudentFee } from "@/components/coach/CoachFeeKhata";
import { useFormatMoney } from "@/lib/org-locale-context";

/** Compact Fee Khata summary row that opens the full CoachFeeKhata in a dialog. */
export function FeeKhataSheet({
  coachName,
  academyName,
  upiId,
  students,
  currentMonth,
}: {
  coachName: string;
  academyName: string;
  upiId?: string | null;
  students: CoachStudentFee[];
  currentMonth: string;
}) {
  const [open, setOpen] = useState(false);
  if (!students || students.length === 0) return null;

  const inr = useFormatMoney();
  const due = students.filter((s) => s.feeStatus === "PENDING");
  const totalDue = due.reduce((n, s) => n + s.monthlyFee, 0);
  const totalBilled = students.reduce((n, s) => n + s.monthlyFee, 0);
  const collected = totalBilled - totalDue;
  const rate = totalBilled > 0 ? Math.round((collected / totalBilled) * 100) : 0;
  const dueParents = new Set(due.map((s) => s.parentPhone || `${s.parentName}::${s.studentId}`)).size;
  const allClear = due.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-3xl bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-900 p-4 flex items-center gap-3 text-left min-w-0 transition-colors"
      >
        <span
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
            allClear ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {allClear ? <CheckCircle2 className="w-5 h-5" /> : <IndianRupee className="w-5 h-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white leading-tight">
            {allClear ? (
              "All fees collected"
            ) : (
              <>
                <span className="text-amber-400">{inr(totalDue)}</span> pending · {dueParents} {dueParents === 1 ? "parent" : "parents"}
              </>
            )}
          </span>
          <span className="flex items-center gap-2 mt-1.5 min-w-0">
            <span className="text-[11px] text-zinc-500 shrink-0">Fee Khata · {rate}% collected</span>
            <span className="h-1.5 flex-1 min-w-[24px] max-w-[120px] rounded-full bg-zinc-800 overflow-hidden">
              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
            </span>
          </span>
        </span>
        <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="sm:max-w-2xl p-3 sm:p-4 gap-3 bg-zinc-950">
          <DialogTitle className="text-base font-bold text-white px-1 pt-1 pr-10">Fee Khata</DialogTitle>
          <div className="min-w-0">
            <CoachFeeKhata
              coachName={coachName}
              academyName={academyName}
              upiId={upiId}
              students={students}
              currentMonth={currentMonth}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
