// Compact Athlete Passport card for the parent home. Render-only (no hooks), so it can be used from the
// parent's server page or client components. Load the data with getPassport(childId) from
// src/app/actions/passport.ts and pass `result.passport` in; the card links to the full passport.
//
//   const res = await getPassport(child.id);
//   {res.ok && <ChildPassportCard passport={res.passport} />}

import Link from "next/link";
import { ChevronRight, ShieldCheck, UserRound } from "lucide-react";
import { passportHeadline, type Passport } from "@/lib/athlete/passport-build";

const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);

export function ChildPassportCard({ passport: p, href }: { passport: Passport; href?: string }) {
  const h = passportHeadline(p);
  return (
    <Link
      href={href ?? `/athlete/${p.athlete.id}`}
      className="block min-w-0 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2"
      aria-label={`Open ${p.athlete.firstName}'s athlete passport`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">Athlete passport</p>
          <p className="mt-0.5 truncate text-base font-bold text-ink">{p.athlete.name}</p>
          <p className="truncate text-xs text-ink-muted">
            {h.topLevel ? `${h.topLevel.label} · Level ${h.topLevel.level} ${h.topLevel.name}` : p.sports.map((s) => s.label).join(" · ") || "No sport yet"}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-[10px] text-ink-subtle">Attendance</dt>
          <dd className="text-sm font-bold text-ink">{pct(p.attendance.last30Days.rate ?? p.attendance.rate)}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-[10px] text-ink-subtle">Matches</dt>
          <dd className="text-sm font-bold text-ink">{p.levels.reduce((n, l) => n + l.matches, 0)}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-[10px] text-ink-subtle">PBs</dt>
          <dd className="text-sm font-bold text-ink">{p.personalBests.length}</dd>
        </div>
      </dl>

      {(h.verifiedCount > 0 || h.selfReportedCount > 0) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 text-success">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {h.verifiedCount} verified
          </span>
          <span className="inline-flex items-center gap-1 text-ink-muted">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            {h.selfReportedCount} self-reported
          </span>
        </p>
      )}

      {h.lastMatch && (
        <p className="mt-2 truncate text-xs text-ink-muted">
          Last match: {h.lastMatch.title} · {h.lastMatch.line}
        </p>
      )}
    </Link>
  );
}
