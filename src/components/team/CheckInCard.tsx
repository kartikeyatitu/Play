"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, LogIn } from "lucide-react";
import { selfCheckIn, selfCheckOut, type getMyAttendance } from "@/app/actions/team";
import { unwrap } from "@/lib/action-result";
import { track } from "@/lib/analytics";

type Today = Awaited<ReturnType<typeof getMyAttendance>>["today"];

const time = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "";

/** Compact daily check-in for coaches (the staff app has a full-screen version). */
export function CheckInCard({ initial }: { initial: Today }) {
  const [today, setToday] = React.useState<Today>(initial);
  const [busy, setBusy] = React.useState(false);

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
            if ("vibrate" in navigator) navigator.vibrate?.(15);
            toast.success(`Checked in at ${time(res.checkInAt)}`);
          } catch (e: any) {
            toast.error(e?.message || "Couldn't check in");
          } finally {
            setBusy(false);
          }
        }}
        className="w-full h-12 rounded-xl border border-lime-400/40 bg-lime-400/10 text-lime-300 font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Check in for today
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 h-12 text-sm">
      <span className="inline-flex items-center gap-2 text-zinc-300">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
          className="text-zinc-400 hover:text-white font-medium"
        >
          Check out
        </button>
      )}
    </div>
  );
}
