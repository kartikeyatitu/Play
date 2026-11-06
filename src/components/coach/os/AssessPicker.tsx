"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { initialsOf } from "@/lib/coach/day";
import { assessmentDue, sortRoster, type RosterRow } from "@/lib/coach/roster";
import { monthLabel } from "@/lib/coach/assessment";

/** Pick an athlete to assess. Athletes due an assessment are listed first. */
export function AssessPicker({ rows, currentMonth, scopeQuery = "" }: { rows: RosterRow[]; currentMonth: string; scopeQuery?: string }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
    const sorted = sortRoster(list, "name", "asc");
    return [...sorted.filter((r) => assessmentDue(r.lastAssessedMonth, currentMonth)), ...sorted.filter((r) => !assessmentDue(r.lastAssessedMonth, currentMonth))];
  }, [rows, query, currentMonth]);

  if (!rows.length) {
    return <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-ink-muted">No athletes in your batches yet.</p>;
  }

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Search athletes</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search athletes"
          className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-ink-subtle"
        />
      </label>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {shown.map((r) => {
          const due = assessmentDue(r.lastAssessedMonth, currentMonth);
          return (
            <li key={r.studentId}>
              <Link href={`/coach/assess?student=${encodeURIComponent(r.studentId)}${scopeQuery}`} className="flex min-h-14 items-center gap-3 px-3 py-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-ink-muted" aria-hidden>
                  {initialsOf(r.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="block truncate text-xs text-ink-muted">{r.batches.map((b) => b.name).join(", ")}</span>
                </span>
                <span className={`shrink-0 text-xs font-semibold ${due ? "text-warn" : "text-ink-subtle"}`}>
                  {r.lastAssessedMonth ? monthLabel(r.lastAssessedMonth) : "Never"}
                  {due && <span className="sr-only"> (due)</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
