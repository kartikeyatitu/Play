"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, LogIn, LogOut } from "lucide-react";
import { selfCheckIn, selfCheckOut, type getMyAttendance } from "@/app/actions/team";
import { ATTENDANCE_LABELS, isStaffAttendanceStatus, roleLabel } from "@/lib/team";
import { AcademySwitcher } from "@/components/team/AcademySwitcher";

type Data = Awaited<ReturnType<typeof getMyAttendance>>;

const time = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "";

const DOT: Record<string, string> = {
  PRESENT: "bg-emerald-400",
  HALF_DAY: "bg-amber-400",
  LEAVE: "bg-sky-400",
  ABSENT: "bg-rose-400",
};

export function StaffHome({ name, data, logoutAction }: { name: string; data: Data; logoutAction: () => void }) {
  const [today, setToday] = React.useState(data.today);
  const [busy, setBusy] = React.useState(false);
  const firstName = name.split(" ")[0] || name;

  async function checkIn() {
    setBusy(true);
    try {
      const res = await selfCheckIn();
      setToday({ status: "PRESENT", checkInAt: res.checkInAt ?? new Date().toISOString(), checkOutAt: null });
      if ("vibrate" in navigator) navigator.vibrate?.(15);
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
      const res = await selfCheckOut();
      setToday((t) => (t ? { ...t, checkOutAt: res.checkOutAt ?? new Date().toISOString() } : t));
      toast.success("Checked out. See you tomorrow!");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't check out");
    } finally {
      setBusy(false);
    }
  }

  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-md px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{roleLabel(data.role, data.staffRole)}</p>
            <h1 className="font-heading text-lg font-bold truncate">{data.academyName}</h1>
          </div>
          <form action={logoutAction}>
            <button className="h-11 px-4 rounded-xl border border-zinc-800 text-sm text-zinc-300 hover:text-white">Sign out</button>
          </form>
        </header>

        <AcademySwitcher className="mt-4 w-full" />

        <section className="mt-8">
          <p className="text-zinc-400">{greeting},</p>
          <h2 className="font-heading text-4xl font-black tracking-tight">
            <span className="text-lime-300">{firstName}</span>
          </h2>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          {!today?.checkInAt ? (
            <>
              <p className="text-sm text-zinc-400">You haven't checked in today.</p>
              <button
                type="button"
                onClick={checkIn}
                disabled={busy}
                className="mt-4 w-full h-16 rounded-2xl bg-lime-400 text-zinc-950 font-heading text-xl font-black uppercase tracking-wide inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6" />} Check in
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <div>
                  <p className="font-semibold">Checked in at {time(today.checkInAt)}</p>
                  <p className="text-sm text-zinc-400">{today.checkOutAt ? `Checked out at ${time(today.checkOutAt)}` : "Remember to check out when you leave."}</p>
                </div>
              </div>
              {!today.checkOutAt && (
                <button
                  type="button"
                  onClick={checkOut}
                  disabled={busy}
                  className="mt-4 w-full h-12 rounded-xl border border-zinc-700 text-zinc-200 font-semibold inline-flex items-center justify-center gap-2 hover:border-zinc-500 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} Check out
                </button>
              )}
            </>
          )}
        </section>

        <section className="mt-6">
          <div className="flex items-baseline justify-between">
            <h3 className="font-heading text-lg font-bold">This month</h3>
            <p className="text-sm text-zinc-400">
              <span className="font-heading text-2xl font-bold text-white tabular-nums">{data.presentDays}</span> days present
            </p>
          </div>
          {data.month.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Your attendance will show here after your first check-in.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-800/70 rounded-xl border border-zinc-800/70">
              {data.month.map((d) => (
                <li key={d.date} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-zinc-300">
                    {new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d.date))}
                  </span>
                  <span className="inline-flex items-center gap-2 text-zinc-400">
                    <span className={`w-2 h-2 rounded-full ${DOT[d.status] || "bg-zinc-500"}`} />
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
