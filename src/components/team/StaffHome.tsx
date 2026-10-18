"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { selfCheckIn, selfCheckOut, type getMyAttendance } from "@/app/actions/team";
import { unwrap } from "@/lib/action-result";
import { track } from "@/lib/analytics";
import { ATTENDANCE_LABELS, isStaffAttendanceStatus, roleLabel } from "@/lib/team";
import { AcademySwitcher } from "@/components/team/AcademySwitcher";
import { haptic } from "@/lib/motion";
import { CheckMark } from "@/components/ui/status-mark";

type Data = Awaited<ReturnType<typeof getMyAttendance>>;

const time = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "";

const DOT: Record<string, string> = {
  PRESENT: "bg-success",
  HALF_DAY: "bg-warn",
  LEAVE: "bg-sky-400",
  ABSENT: "bg-danger",
};

export function StaffHome({ name, data, logoutAction }: { name: string; data: Data; logoutAction: () => void }) {
  const [today, setToday] = React.useState(data.today);
  const [busy, setBusy] = React.useState(false);
  // True right after this person taps Check in: the confirmation fades in once
  const [justCheckedIn, setJustCheckedIn] = React.useState(false);
  const firstName = name.split(" ")[0] || name;

  async function checkIn() {
    setBusy(true);
    try {
      const res = unwrap(await selfCheckIn());
      track("staff_checked_in", { surface: "staff_home" });
      setToday({ status: "PRESENT", checkInAt: res.checkInAt ?? new Date().toISOString(), checkOutAt: null });
      setJustCheckedIn(true);
      haptic(20);
      toast.success(`Checked in at ${time(res.checkInAt ?? null)}. Have a great day, ${firstName}!`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't check in");
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    setBusy(true);
    try {
      const res = unwrap(await selfCheckOut());
      setToday((t) => (t ? { ...t, checkOutAt: res.checkOutAt ?? new Date().toISOString() } : t));
      toast.success("Checked out. See you tomorrow!");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't check out");
    } finally {
      setBusy(false);
    }
  }

  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = (() => {
    const parts = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).formatToParts(now);
    const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
    return `${get("weekday")}, ${get("day")} ${get("month")}`;
  })();

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-md px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-ink-subtle">{roleLabel(data.role, data.staffRole)}</p>
            <h1 className="text-base font-semibold tracking-[-0.01em] truncate">{data.academyName}</h1>
          </div>
          <form action={logoutAction}>
            <button className="h-10 px-3.5 rounded-lg border border-line bg-surface text-[13px] font-medium text-ink-muted hover:text-ink hover:bg-surface-2">Sign out</button>
          </form>
        </header>

        <AcademySwitcher className="mt-4 w-full" />

        <section className="mt-8">
          <p className="text-[13px] text-ink-subtle" suppressHydrationWarning>{dateLabel}</p>
          <h2 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.025em] truncate" suppressHydrationWarning>
            {greeting}, {firstName}
          </h2>
        </section>

        <section className="mt-6 rounded-xl border border-line bg-surface shadow-hairline p-5">
          {!today?.checkInAt ? (
            <>
              <p className="text-sm text-ink-muted">You haven't checked in today.</p>
              <button
                type="button"
                onClick={checkIn}
                disabled={busy}
                className="press mt-4 w-full h-14 rounded-xl bg-volt text-volt-fg text-[17px] font-semibold tracking-[-0.01em] inline-flex items-center justify-center gap-2 hover:bg-lime-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt/25 disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />} Check in
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3" role={justCheckedIn ? "status" : undefined}>
                <CheckMark size={36} fresh={justCheckedIn} />
                <div className={justCheckedIn ? "fade-in min-w-0" : "min-w-0"}>
                  <p className="text-lg font-semibold leading-tight tabular-nums">Checked in at {time(today.checkInAt)}</p>
                  <p className="mt-0.5 text-[13px] text-ink-muted tabular-nums">
                    {today.checkOutAt ? `Checked out at ${time(today.checkOutAt)}` : "Remember to check out when you leave."}
                  </p>
                </div>
              </div>
              {!today.checkOutAt && (
                <button
                  type="button"
                  onClick={checkOut}
                  disabled={busy}
                  className="press mt-4 w-full h-12 rounded-xl border border-line bg-surface text-ink font-medium inline-flex items-center justify-center gap-2 hover:bg-surface-2 hover:border-zinc-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4 text-ink-subtle" />} Check out
                </button>
              )}
            </>
          )}
        </section>

        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold tracking-[-0.01em]">This month</h3>
            <p className="text-[13px] text-ink-muted">
              <span className="num text-xl font-semibold text-ink">{data.presentDays}</span> days present
            </p>
          </div>
          {data.month.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-subtle">Your attendance will show here after your first check-in.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface shadow-hairline">
              {data.month.map((d) => (
                <li key={d.date} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-ink tabular-nums">
                    {(() => {
                      const parts = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).formatToParts(new Date(d.date));
                      const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
                      return `${get("weekday")}, ${get("day")} ${get("month")}`;
                    })()}
                  </span>
                  <span className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
                    <span className={`w-2 h-2 rounded-full ${DOT[d.status] || "bg-zinc-600"}`} />
                    {isStaffAttendanceStatus(d.status) ? ATTENDANCE_LABELS[d.status] : d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
