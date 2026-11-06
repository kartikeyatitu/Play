import type { Metadata } from "next";
import { Calendar } from "lucide-react";
import { CoachOsShell } from "@/components/coach/os/CoachOsShell";
import { DayAttendanceGrid } from "@/components/coach/os/DayAttendanceGrid";
import { loadCoachOsContext, loadTodaySessions } from "@/lib/coach/data";

export const metadata: Metadata = { title: "Today · TRIQ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CoachDayPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) || {};
  const ctx = await loadCoachOsContext(typeof sp.scope === "string" ? sp.scope : null);
  const sessions = await loadTodaySessions(ctx);
  const label = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "short" });

  return (
    <CoachOsShell
      section="day"
      title="Today's sessions"
      subtitle={`${label} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
      scope={ctx.scope}
      canViewAll={ctx.canViewAll}
    >
      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <Calendar className="mx-auto h-8 w-8 text-ink-subtle" aria-hidden />
          <p className="mt-2 font-semibold">No sessions today</p>
          <p className="mt-1 text-sm text-ink-muted">Batches scheduled for today show up here with their attendance.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <DayAttendanceGrid key={s.batchId} session={s} />
          ))}
        </div>
      )}
    </CoachOsShell>
  );
}
