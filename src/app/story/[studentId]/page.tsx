import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, MessageSquareQuote, Sparkles, Star, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getGuardianStudentIds } from "@/lib/family/guardians";
import { studentAccessFilter } from "@/lib/athlete-access";
import { localDateString } from "@/lib/fee-aging";
import { addDays, mondayOf, parseWeek } from "@/lib/story/weekly";
import { loadWeeklyStory } from "@/lib/story/weekly-server";
import { ReadAloudButton } from "@/components/voice/ReadAloudButton";

export const dynamic = "force-dynamic";
// The title never carries the child's name.
export const metadata: Metadata = { title: "This week | TRIQ", robots: { index: false, follow: false } };

const STATUS: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: "Came", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
  LATE: { label: "Came (late)", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
  ABSENT: { label: "Missed", cls: "bg-surface-2 text-ink-muted" },
  EXCUSED: { label: "Excused", cls: "bg-surface-2 text-ink-muted" },
  INJURED: { label: "Resting (injury)", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
};

const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

export default async function WeeklyStoryPage(props: { params: Promise<{ studentId: string }>; searchParams: Promise<{ w?: string }> }) {
  const session = await requireAuth(["PARENT", "ADMIN", "COACH"]);
  const { studentId } = await props.params;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(studentId)) notFound();

  // Who may see it: the child's guardians, the academy's admins, and the child's own coaches.
  const guardianOf = session.role === "PARENT" ? await getGuardianStudentIds(session.id) : undefined;
  const allowed = await db.student.findFirst({
    where: { AND: [{ id: studentId }, session.role === "PARENT" ? { id: { in: guardianOf ?? [] } } : studentAccessFilter(session)] },
    select: { id: true, org: { select: { timezone: true } } },
  });
  if (!allowed) notFound();

  const today = localDateString(new Date(), allowed.org?.timezone || "Asia/Kolkata");
  const week = parseWeek((await props.searchParams).w, today);
  const loaded = await loadWeeklyStory(studentId, week);
  if (!loaded) notFound();
  const { story, academy } = loaded;
  const prev = addDays(week, -7);
  const next = addDays(week, 7);
  const hasNext = next <= mondayOf(today);
  const range = `${fmt(story.weekStart, { day: "numeric", month: "short" })} to ${fmt(story.weekEnd, { day: "numeric", month: "short" })}`;
  const back = session.role === "PARENT" ? "/parent" : session.role === "COACH" ? "/coach" : "/org";

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-4">
        <div className="flex items-center justify-between">
          <Link href={back} className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Link>
          <nav aria-label="Other weeks" className="flex items-center gap-1">
            <Link href={`?w=${prev}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Previous week">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            {hasNext ? (
              <Link href={`?w=${next}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Next week">
                <ChevronRight className="h-5 w-5" />
              </Link>
            ) : (
              <span className="inline-flex h-10 w-10" aria-hidden />
            )}
          </nav>
        </div>

        <header className="mt-4">
          <p className="text-sm text-ink-muted">{story.isCurrentWeek ? "This week" : range}{academy ? `, ${academy}` : ""}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{story.firstName}&rsquo;s week</h1>
          {story.isCurrentWeek && <p className="text-sm text-ink-subtle">{range}</p>}
        </header>

        <section className="mt-6 rounded-2xl p-5" style={{ background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}>
          <p className="flex items-start gap-2 text-lg font-semibold leading-snug">
            <Sparkles className="mt-1 h-5 w-5 shrink-0 brand-text" aria-hidden />
            {story.highlight}
          </p>
          <ReadAloudButton text={story.summary} label="Listen to this week" className="mt-4" />
        </section>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-line bg-surface p-3">
            <dt className="text-xs text-ink-muted">Sessions</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">
              {story.attended}<span className="text-base font-semibold text-ink-subtle">/{story.held}</span>
            </dd>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-3">
            <dt className="text-xs text-ink-muted">Points earned</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{story.rewards.points}</dd>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-3">
            <dt className="text-xs text-ink-muted">New badges</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{story.rewards.badges.length}</dd>
          </div>
        </dl>

        {(story.skillChange || story.personalBests.length > 0 || story.rewards.badges.length > 0) && (
          <section className="mt-4 space-y-2">
            {story.skillChange && (
              <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
                <TrendingUp className="h-4 w-4 shrink-0 brand-text" aria-hidden />
                Skills {story.skillChange.to > story.skillChange.from ? "up" : "now"}: {story.skillChange.from} to {story.skillChange.to} out of 5
              </p>
            )}
            {story.personalBests.map((p) => (
              <p key={`${p.label}${p.date}`} className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
                <Star className="h-4 w-4 shrink-0 text-amber-500" aria-hidden /> New personal best: {p.label}
              </p>
            ))}
            {story.rewards.badges.map((b) => (
              <p key={b} className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
                <Star className="h-4 w-4 shrink-0 text-amber-500" aria-hidden /> Badge earned: {b}
              </p>
            ))}
          </section>
        )}

        <section className="mt-8" aria-labelledby="days-title">
          <h2 id="days-title" className="text-lg font-semibold">Day by day</h2>
          {story.days.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-muted">No sessions {story.isCurrentWeek ? "yet this week" : "this week"}.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {story.days.map((d) => {
                const st = d.attendance ? STATUS[d.attendance] : null;
                return (
                  <li key={`${d.date}${d.batchName}`} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{d.weekday}</p>
                        <p className="text-xs text-ink-muted">{d.batchName}</p>
                      </div>
                      {st ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                      ) : (
                        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-muted">Not marked</span>
                      )}
                    </div>
                    {d.note?.trim() && (
                      <blockquote className="mt-3 flex gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[15px] leading-relaxed">
                        <MessageSquareQuote className="mt-1 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
                        <span>
                          {d.note.trim()}
                          <span className="mt-1 block text-xs text-ink-subtle">Coach&rsquo;s note about {story.firstName}</span>
                        </span>
                      </blockquote>
                    )}
                    {d.recap?.trim() && (d.attendance === "PRESENT" || d.attendance === "LATE") && (
                      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                        <span className="font-medium text-ink">In the session: </span>
                        {d.recap.trim()}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {story.next && (
          <section className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <CalendarDays className="h-5 w-5 shrink-0 brand-text" aria-hidden />
            <p className="text-sm">
              <span className="font-semibold">Next session: </span>
              {fmt(story.next.date, { weekday: "long", day: "numeric", month: "short" })}
              {story.next.time ? `, ${story.next.time}` : ""} ({story.next.batchName})
            </p>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-ink-subtle">Only {story.firstName}&rsquo;s family and academy can see this page.</p>
      </div>
    </main>
  );
}
