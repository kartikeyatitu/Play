"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { selfCheckIn, selfCheckOut, type getMyAttendance } from "@/app/actions/team";
import { unwrap } from "@/lib/action-result";
import { track } from "@/lib/analytics";
import { haptic } from "@/lib/motion";
import { CheckMark } from "@/components/ui/status-mark";

type Today = Awaited<ReturnType<typeof getMyAttendance>>["today"];

const time = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "";

/** Compact daily check-in for coaches (the staff app has a full-screen version). */
export function CheckInCard({ initial, subtle = false }: { initial: Today; /** Outlined button, so it doesn't compete with the session's main action. */ subtle?: boolean }) {
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
            haptic(20);
            toast.success(`Checked in at ${time(res.checkInAt)}`);
          } catch (e: any) {
            toast.error(e?.message || "Couldn't check in");
          } finally {
            setBusy(false);
          }
        }}
        className={
          subtle
            ? "press w-full h-11 rounded-xl border border-line bg-surface text-ink font-medium inline-flex items-center justify-center gap-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt/25 disabled:opacity-60"
            : "press w-full h-12 rounded-xl bg-volt text-volt-fg font-medium inline-flex items-center justify-center gap-2 hover:bg-lime-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt/25 disabled:opacity-60"
        }
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Check in for today
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 h-12 text-sm">
      <span className="inline-flex items-center gap-2.5 text-ink tabular-nums" role={justCheckedIn ? "status" : undefined}>
        <CheckMark size={20} fresh={justCheckedIn} />
        In at {time(today.checkInAt)}
        {today.checkOutAt ? <span className="text-ink-subtle"> · Out at {time(today.checkOutAt)}</span> : ""}
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
          className="h-8 px-2.5 rounded-md text-[13px] text-ink-muted hover:text-ink hover:bg-surface-2 font-medium"
        >
          Check out
        </button>
      )}
    </div>
  );
}
