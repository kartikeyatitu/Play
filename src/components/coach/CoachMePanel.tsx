import { logout } from "@/app/actions/auth";
import { CoachVerificationBanner } from "@/components/coach/CoachVerificationBanner";
import { CoachShareProfileButton } from "@/components/coach/CoachShareProfileButton";
import { FeeKhataSheet } from "@/components/coach/FeeKhataSheet";
import type { CoachStudentFee } from "@/components/coach/CoachFeeKhata";
import { scheduleRunsOn } from "@/lib/fees";
import { shortStart } from "@/lib/coach";
import { FEATURES } from "@/lib/features";
import { BadgeCheck, LogOut, Users, Layers, ArrowLeft } from "lucide-react";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const brandTint = (pct: number) => `color-mix(in srgb, var(--brand) ${pct}%, transparent)`;

export interface CoachMePanelProps {
  coach: { id: string; name: string; phone: string | null; verified: boolean; verificationData: string | null };
  isAdmin: boolean;
  orgName: string;
  /** Unique athletes across the coach's batches */
  totalStudents: number;
  batches: { id: string; name: string; schedule: string | null }[];
  /** Today's IST weekday short name, e.g. "Mon" (istWeekday()) */
  weekday: string;
  fees: {
    students: CoachStudentFee[];
    upiId: string | null;
    currentMonth: string;
  };
}

function initials(name: string) {
  return (
    name
      .replace(/^(coach|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, "")
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "C"
  );
}

function batchWhen(schedule: string | null): string {
  if (!schedule) return "Schedule not set";
  const days = WEEK.filter((d) => scheduleRunsOn(schedule, d) === true);
  const t = shortStart(schedule);
  const dayPart = days.length === 7 ? "Daily" : days.join(" ");
  const parts = [dayPart, t ? `${t.time} ${t.period}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : schedule;
}

export function CoachMePanel({ coach, isAdmin, orgName, totalStudents, batches, weekday, fees }: CoachMePanelProps) {
  const dayCounts = WEEK.map((d) => ({
    day: d,
    count: batches.filter((b) => scheduleRunsOn(b.schedule, d) === true).length,
  }));
  const weeklySessions = dayCounts.reduce((n, d) => n + d.count, 0);

  return (
    <div className="space-y-4 min-w-0">
      {/* Profile hero */}
      <section className="rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 p-4 sm:p-5 space-y-4 min-w-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--brand)] to-emerald-500 flex items-center justify-center text-zinc-950 font-black text-xl shrink-0">
            {initials(coach.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-lg font-bold text-white leading-tight truncate">{coach.name}</h2>
              {coach.verified && <BadgeCheck className="w-[18px] h-[18px] text-emerald-400 shrink-0" aria-label="Verified coach" />}
            </div>
            <p className="text-xs text-zinc-400 truncate mt-0.5">
              {isAdmin ? "Owner" : "Coach"} · {orgName}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span className="text-zinc-300 font-semibold">{totalStudents}</span> athletes
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span className="text-zinc-300 font-semibold">{batches.length}</span> {batches.length === 1 ? "batch" : "batches"}
              </span>
            </div>
          </div>
        </div>
        {FEATURES.coachOS && <CoachShareProfileButton coachId={coach.id} coachName={coach.name} academyName={orgName} />}
      </section>

      {/* Verification — only while not verified */}
      {!coach.verified && (
        <CoachVerificationBanner coachId={coach.id} verified={coach.verified} verificationData={coach.verificationData} />
      )}

      {/* This week */}
      <section className="rounded-3xl bg-zinc-900/60 border border-zinc-800/80 p-4 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-white">This week</h3>
          <span className="text-[11px] text-zinc-500">
            {weeklySessions} {weeklySessions === 1 ? "session" : "sessions"}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1 mt-3">
          {dayCounts.map(({ day, count }) => {
            const isToday = day === weekday;
            return (
              <div
                key={day}
                className={`min-w-0 rounded-xl py-2 flex flex-col items-center gap-1.5 border ${isToday ? "" : "border-transparent"}`}
                style={isToday ? { backgroundColor: brandTint(12), borderColor: brandTint(40) } : undefined}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? "text-[var(--brand)]" : "text-zinc-500"}`}>
                  {day}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${count ? (isToday ? "bg-[var(--brand)]" : "bg-zinc-300") : "bg-zinc-800"}`}
                />
                <span className={`text-xs font-bold leading-none ${count ? "text-zinc-100" : "text-zinc-600"}`}>{count || "–"}</span>
              </div>
            );
          })}
        </div>

        {batches.length > 0 ? (
          <ul className="mt-3 pt-1 divide-y divide-zinc-800/70">
            {batches.map((b) => {
              const runsToday = scheduleRunsOn(b.schedule, weekday) === true;
              return (
                <li key={b.id} className="py-2.5 flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${runsToday ? "bg-[var(--brand)]" : "bg-zinc-700"}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 font-medium truncate">{b.name}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{batchWhen(b.schedule)}</p>
                  </div>
                  {runsToday && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--brand)]">Today</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">No batches assigned yet.</p>
        )}
      </section>

      {/* Fee Khata summary → full khata in a dialog */}
      <FeeKhataSheet
        coachName={coach.name}
        academyName={orgName}
        upiId={fees.upiId}
        students={fees.students}
        currentMonth={fees.currentMonth}
      />

      {/* Account */}
      <div className="flex flex-col sm:flex-row gap-2">
        {isAdmin && (
          <a
            href="/org"
            className="flex-1 h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Academy dashboard
          </a>
        )}
        <form action={logout} className="flex-1">
          <button
            type="submit"
            className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
