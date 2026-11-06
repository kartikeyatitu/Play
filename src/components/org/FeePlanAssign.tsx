"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignFeePlan, getPlanTargets, previewPlanAssignment, type PlanAssignmentRow } from "@/app/actions/fee-plans";
import { useFormatMoney } from "@/lib/org-locale-context";
import { planKindLabel } from "@/lib/fee-plan-schedule";

function nextMonth(): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

const field = "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink";

/**
 * Assign a fee plan to one student or a whole batch for a period: preview the dues (proration for
 * mid-period joins, instalments), then create the fee records.
 */
export function FeePlanAssign({ plan }: { plan: { id: string; name: string; duration: number; amount: number } }) {
  const fmt = useFormatMoney();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<{ batches: { id: string; name: string; students: number }[]; students: { id: string; name: string }[] } | null>(null);
  const [type, setType] = useState<"batch" | "student">("batch");
  const [targetId, setTargetId] = useState("");
  const [startMonth, setStartMonth] = useState(nextMonth());
  const [instalments, setInstalments] = useState(1);
  const [joinDate, setJoinDate] = useState("");
  const [preview, setPreview] = useState<PlanAssignmentRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || targets) return;
    getPlanTargets().then((r) => {
      if (r.success) setTargets({ batches: r.batches, students: r.students });
      else toast.error(r.error);
    });
  }, [open, targets]);

  useEffect(() => setPreview(null), [type, targetId, startMonth, instalments, joinDate]);

  const input = () => ({
    planId: plan.id,
    target: { type, id: targetId },
    startMonth,
    instalments,
    joinDate: type === "student" && joinDate ? joinDate : null,
  });

  const doPreview = async () => {
    if (!targetId) return toast.error(type === "batch" ? "Choose a batch." : "Choose a student.");
    setBusy(true);
    try {
      const r = await previewPlanAssignment(input());
      if (r.success) setPreview(r.rows);
      else toast.error(r.error);
    } finally {
      setBusy(false);
    }
  };

  const doAssign = async () => {
    setBusy(true);
    try {
      const r = await assignFeePlan(input());
      if (!r.success) return toast.error(r.error);
      toast.success(
        `${r.created} due${r.created === 1 ? "" : "s"} created (${fmt(r.billed)}) for ${r.students} student${r.students === 1 ? "" : "s"}` +
          (r.conflicts ? ` · ${r.conflicts} month${r.conflicts === 1 ? "" : "s"} already billed, left as is` : ""),
      );
      setOpen(false);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const conflicts = preview?.reduce((s, r) => s + r.lines.filter((l) => l.conflict).length, 0) ?? 0;
  const total = preview?.reduce((s, r) => s + r.lines.filter((l) => !l.conflict).reduce((t, l) => t + l.amount, 0), 0) ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-ink-muted hover:text-ink"
      >
        <CalendarPlus className="h-3 w-3" /> Assign &amp; bill
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-line bg-surface text-ink sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Assign “{plan.name}”</DialogTitle>
            <DialogDescription className="text-xs text-ink-muted">
              {planKindLabel(plan.duration)} · {fmt(plan.amount)}. Students who join mid-period pay for the days left (rounded to the rupee).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["batch", "student"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    setTargetId("");
                  }}
                  className={`h-10 rounded-md border text-sm ${type === t ? "border-volt bg-surface-2 text-ink" : "border-line text-ink-muted"}`}
                >
                  {t === "batch" ? "Whole batch" : "One student"}
                </button>
              ))}
            </div>
            <select aria-label={type === "batch" ? "Batch" : "Student"} value={targetId} onChange={(e) => setTargetId(e.target.value)} className={field}>
              <option value="">{targets ? (type === "batch" ? "Choose a batch" : "Choose a student") : "Loading…"}</option>
              {type === "batch"
                ? targets?.batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.students})
                    </option>
                  ))
                : targets?.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs text-ink-muted">
                Period starts
                <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className={field} />
              </label>
              <label className="space-y-1 text-xs text-ink-muted">
                Instalments
                <select value={instalments} onChange={(e) => setInstalments(Number(e.target.value))} className={field} disabled={plan.duration === 1}>
                  {Array.from({ length: plan.duration }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "Pay in full" : `${n} dues`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {type === "student" && (
              <label className="block space-y-1 text-xs text-ink-muted">
                Joined on (optional, defaults to enrolment date)
                <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className={field} />
              </label>
            )}

            {preview && (
              <div className="rounded-lg border border-line">
                <div className="flex items-center justify-between border-b border-line px-3 py-2 text-sm">
                  <span className="text-ink-muted">{preview.length} student{preview.length === 1 ? "" : "s"}</span>
                  <span className="font-semibold text-ink">{fmt(total)}</span>
                </div>
                <ul className="max-h-60 divide-y divide-line overflow-y-auto text-xs">
                  {preview.map((r) => (
                    <li key={r.studentId} className="px-3 py-2">
                      <div className="flex justify-between gap-2">
                        <span className="truncate text-ink">{r.studentName}</span>
                        <span className="text-ink-muted">{r.prorated ? `prorated from ${r.joinDate}` : "full"}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.lines.map((l) => (
                          <span
                            key={l.month}
                            className={`rounded px-1.5 py-0.5 ${l.conflict ? "bg-warn/15 text-warn line-through" : l.kind === "DUE" ? "bg-surface-2 text-ink" : "text-ink-subtle"}`}
                          >
                            {monthLabel(l.month)} {l.kind === "DUE" ? fmt(l.amount) : "covered"}
                          </span>
                        ))}
                        {r.lines.length === 0 && <span className="text-ink-subtle">Joins after this period: nothing to bill</span>}
                      </div>
                    </li>
                  ))}
                </ul>
                {conflicts > 0 && (
                  <p className="border-t border-line px-3 py-2 text-xs text-warn">
                    {conflicts} month{conflicts === 1 ? " is" : "s are"} already billed and will be left as is.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={doPreview} disabled={busy} className="h-10 flex-1 rounded-md border border-line text-sm text-ink disabled:opacity-50">
                {busy && !preview ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Preview"}
              </button>
              <button
                type="button"
                onClick={doAssign}
                disabled={busy || !preview}
                className="h-10 flex-1 rounded-md bg-volt text-sm font-medium text-volt-fg disabled:opacity-50"
              >
                {busy && preview ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Create dues"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
