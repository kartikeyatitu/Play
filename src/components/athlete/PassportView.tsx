// Athlete Passport v1: the full passport, phone-first (single column at 390px, two columns from md).
// Render-only (no hooks), so it works from server and client components alike.

import { CalendarCheck, Flag, Medal, Target, Timer, Trophy, Users } from "lucide-react";
import { LEVEL_LABELS, type AchievementLevel } from "@/lib/athlete";
import type { Passport } from "@/lib/athlete/passport-build";
import { headlineStats } from "@/lib/season-stats";
import { VerificationBadge } from "@/components/athlete/VerificationBadge";

const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
const RESULT_STYLE: Record<string, string> = {
  W: "bg-success/15 text-success",
  L: "bg-danger/15 text-danger",
  D: "bg-warn/15 text-warn",
  "-": "bg-surface-2 text-ink-muted",
};

function Section({ title, icon: Icon, children, className = "" }: { title: string; icon: typeof Trophy; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-surface p-4 ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-volt" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-subtle">{children}</p>;
}

export function PassportView({ passport: p }: { passport: Passport }) {
  const verified = p.achievements.filter((a) => a.verification === "VERIFIED");
  const selfReported = p.achievements.filter((a) => a.verification === "SELF_REPORTED");
  const achievementRows = [...verified, ...selfReported];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Header */}
      <header className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">Athlete passport</p>
        <h1 className="mt-1 break-words text-2xl font-bold text-ink">{p.athlete.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {[p.academy?.name, p.sports.map((s) => s.label).join(" · ")].filter(Boolean).join(" — ") || "No sport yet"}
        </p>
        {p.levels.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {p.levels.map((l) => (
              <li key={l.sport} className="rounded-xl border border-line bg-surface-2 px-3 py-2">
                <div className="text-[11px] text-ink-subtle">{l.label}</div>
                <div className="text-sm font-semibold text-ink">
                  L{l.level} · {l.name}
                </div>
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Attendance */}
        <Section title="Attendance" icon={CalendarCheck}>
          {p.attendance.sessions === 0 ? (
            <Empty>No sessions recorded yet.</Empty>
          ) : (
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface-2 p-2">
                <dt className="text-[11px] text-ink-subtle">All time</dt>
                <dd className="text-lg font-bold text-ink">{pct(p.attendance.rate)}</dd>
                <dd className="text-[11px] text-ink-muted">
                  {p.attendance.attended}/{p.attendance.sessions}
                </dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-2">
                <dt className="text-[11px] text-ink-subtle">Last 30 days</dt>
                <dd className="text-lg font-bold text-ink">{pct(p.attendance.last30Days.rate)}</dd>
                <dd className="text-[11px] text-ink-muted">
                  {p.attendance.last30Days.attended}/{p.attendance.last30Days.sessions}
                </dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-2">
                <dt className="text-[11px] text-ink-subtle">Streak</dt>
                <dd className="text-lg font-bold text-ink">{p.attendance.currentStreak}</dd>
                <dd className="text-[11px] text-ink-muted">in a row</dd>
              </div>
            </dl>
          )}
        </Section>

        {/* Batches and coach */}
        <Section title="Training" icon={Users}>
          {p.batches.length === 0 ? (
            <Empty>Not in a batch right now.</Empty>
          ) : (
            <ul className="space-y-2">
              {p.batches.map((b) => (
                <li key={b.id} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-medium text-ink">{b.name}</span>
                    <span className="shrink-0 text-[11px] text-ink-muted">{b.sport}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Coach: {b.coachName || "Unassigned"}
                    {b.schedule ? ` · ${b.schedule}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Levels */}
      {p.levels.length > 0 && (
        <Section title="Level by sport" icon={Flag}>
          <ul className="space-y-2">
            {p.levels.map((l) => (
              <li key={l.sport} className="rounded-xl bg-surface-2 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{l.label}</span>
                  <span className="text-sm font-semibold text-volt">
                    Level {l.level} · {l.name}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {l.matches} match{l.matches === 1 ? "" : "es"}
                  {l.winRate != null ? ` · win ${pct(l.winRate)}` : ""}
                  {l.assessment != null ? ` · coach assessment ${l.assessment}/5` : " · no coach assessment yet"}
                </p>
                {l.next && <p className="mt-0.5 text-[11px] text-ink-subtle">Next — {l.next}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Season stats */}
      {p.seasonStats.length > 0 && (
        <Section title="This season (last 12 months)" icon={Trophy}>
          <div className="space-y-3">
            {p.seasonStats.map((s) => (
              <div key={s.sport}>
                <p className="mb-1.5 text-xs font-medium text-ink-muted">{s.label}</p>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {headlineStats(s).map((t) => (
                    <div key={t.key} className="rounded-xl bg-surface-2 p-2">
                      <dt className="text-[11px] text-ink-subtle">{t.label}</dt>
                      <dd className="text-base font-bold text-ink">{t.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Match history */}
        <Section title="Recent matches" icon={Medal}>
          {p.matches.length === 0 ? (
            <Empty>No scored matches yet. Matches a coach scores live appear here when they finish.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {p.matches.map((m) => (
                <li key={m.matchId} className="flex items-center gap-3 py-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RESULT_STYLE[m.result]}`}>
                    {m.result === "-" ? "·" : m.result}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{m.title}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {m.sportLabel} · {m.line}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-subtle">{day(m.playedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Personal bests */}
        <Section title="Personal bests" icon={Timer}>
          {p.personalBests.length === 0 ? (
            <Empty>No timed or measured results yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {p.personalBests.map((b) => (
                <li key={`${b.sport}-${b.eventName}-${b.measure}`} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{b.eventName}</p>
                    <p className="text-xs text-ink-muted">
                      {b.sportLabel} · {day(b.recordedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-bold text-ink">{b.display}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Achievements */}
      <Section title="Achievements" icon={Trophy}>
        <p className="mb-3 text-xs text-ink-muted">
          <span className="font-semibold text-success">Verified</span> means academy staff checked it. Self-reported entries were added by a
          parent or coach and are not verified yet.
        </p>
        {achievementRows.length === 0 ? (
          <Empty>No achievements yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {achievementRows.map((a) => (
              <li
                key={a.id}
                className={`rounded-xl p-3 ${a.verification === "VERIFIED" ? "border border-success/30 bg-success/5" : "border border-dashed border-line bg-surface-2"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-medium text-ink">{a.title}</p>
                  <VerificationBadge verification={a.verification} />
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {[LEVEL_LABELS[a.level as AchievementLevel] ?? a.level, a.competition, a.result, day(a.eventDate)].filter(Boolean).join(" · ")}
                </p>
                {a.verification === "SELF_REPORTED" && <p className="mt-0.5 text-[11px] text-ink-subtle">Added by {a.addedBy.toLowerCase()}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Goals */}
        <Section title="Goals" icon={Target}>
          {p.goals.length === 0 ? (
            <Empty>No goals set yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {p.goals.map((g) => (
                <li key={g.id} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 break-words text-sm text-ink">{g.title}</p>
                    <span className={`shrink-0 text-[11px] font-semibold ${g.status === "ACHIEVED" ? "text-success" : "text-ink-muted"}`}>
                      {g.status === "ACHIEVED" ? "Achieved" : "Active"}
                    </span>
                  </div>
                  {(g.metric || g.target != null || g.dueDate) && (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {[
                        g.metric,
                        g.baseline != null || g.target != null ? `${g.baseline ?? "–"} → ${g.target ?? "–"}` : null,
                        g.dueDate ? `by ${day(g.dueDate)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Latest skill report */}
        <Section title="Latest coach assessment" icon={CalendarCheck}>
          {!p.latestSkillReport ? (
            <Empty>No assessment yet.</Empty>
          ) : (
            <div>
              <p className="text-xs text-ink-muted">
                {p.latestSkillReport.month}
                {p.latestSkillReport.coachName ? ` · ${p.latestSkillReport.coachName}` : ""}
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["Technique", p.latestSkillReport.technique],
                    ["Fitness", p.latestSkillReport.fitness],
                    ["Discipline", p.latestSkillReport.discipline],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="rounded-xl bg-surface-2 p-2">
                    <dt className="text-[11px] text-ink-subtle">{label}</dt>
                    <dd className="text-lg font-bold text-ink">{v}/5</dd>
                  </div>
                ))}
              </dl>
              {Object.keys(p.latestSkillReport.metrics).length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(p.latestSkillReport.metrics).map(([k, v]) => (
                    <li key={k} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted">
                      {k.replace(/_/g, " ")}: {v}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
