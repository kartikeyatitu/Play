"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, LogIn } from "lucide-react";
import { selfCheckIn, selfCheckOut, type getMyAttendance } from "@/app/actions/team";
import { unwrap } from "@/lib/action-result";
import { track } from "@/lib/analytics";
import { haptic } from "@/lib/motion";
import { SuccessMark } from "@/components/sport/Celebrate";

type Today = Awaited<ReturnType<typeof getMyAttendance>>["today"];

const time = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "";

/** Compact daily check-in for coaches (the staff app has a full-screen version). */
export function CheckInCard({ initial }: { initial: Today }) {
  const [today, setToday] = React.useState<Today>(initial);
  const [busy, setBusy] = React.useState(false);
  const [justCheckedIn, setJustCheckedIn] = React.useState(false);

  if (!today?.checkInAt) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = unwrap(await selfCheckIn());
            track("staff_checked_in", { surface: "coach_card" });
            setToday({ status: "PRESENT", checkInAt: res.checkInAt ?? new Date().toISOString(), checkOutAt: null });
            setJustCheckedIn(true);
            haptic([15, 40, 25]);
            toast.success(`Checked in at ${time(res.checkInAt)}`);
          } catch (e: any) {
            toast.error(e?.message || "Couldn't check in");
          } finally {
            setBusy(false);
          }
        }}
        className="press w-full h-12 rounded-xl border border-volt/40 bg-volt/10 text-volt-ink font-semibold inline-flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Check in for today
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/40 px-4 h-12 text-sm">
      <span className="inline-flex items-center gap-2 text-zinc-300">
        {justCheckedIn ? <SuccessMark size={22} burst={false} /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        In at {time(today.checkInAt)}
        {today.checkOutAt ? ` · Out at ${time(today.checkOutAt)}` : ""}
      </span>
      {!today.checkOutAt && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = unwrap(await selfCheckOut());
              setToday((t) => (t ? { ...t, checkOutAt: res.checkOutAt ?? new Date().toISOString() } : t));
              toast.success("Checked out. Great work today!");
            } catch (e: any) {
              toast.error(e?.message || "Couldn't check out");
            } finally {
              setBusy(false);
            }
          }}
          className="text-ink-muted hover:text-ink font-medium"
        >
          Check out
        </button>
      )}
    </div>
  );
}
