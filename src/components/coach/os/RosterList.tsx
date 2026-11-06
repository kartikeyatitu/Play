"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, Search } from "lucide-react";
import { AttendanceAvatar } from "@/components/coach/squad/AttendanceAvatar";
import { SportIcon } from "@/components/sport/SportIcon";
import { rubricIdFor } from "@/lib/skill-rubrics";
import { assessmentDue, sortRoster, type RosterRow, type RosterSortKey, type SortDir } from "@/lib/coach/roster";
import { monthLabel } from "@/lib/coach/assessment";

const SORTS: { key: RosterSortKey; label: string; dir: SortDir }[] = [
  { key: "name", label: "Name", dir: "asc" },
  { key: "attendance", label: "Attendance", dir: "asc" },
  { key: "assessed", label: "Last assessed", dir: "asc" },
  { key: "batch", label: "Batch", dir: "asc" },
];

export function RosterList({ rows, currentMonth, scopeQuery = "" }: { rows: RosterRow[]; currentMonth: string; scopeQuery?: string }) {
  const [sort, setSort] = useState<RosterSortKey>("name");
  const [dir, setDir] = useState<SortDir>("asc");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.batches.some((b) => b.name.toLowerCase().includes(q))) : rows;
    return sortRoster(filtered, sort, dir);
  }, [rows, sort, dir, query]);

  const pick = (key: RosterSortKey) => {
    if (key === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(SORTS.find((x) => x.key === key)?.dir ?? "asc");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold">No athletes yet</p>
        <p className="mt-1 text-sm text-ink-muted">Athletes show up here once they are enrolled in a batch you coach.</p>
      </div>
    );
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
          placeholder="Search name or batch"
          className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-ink-subtle"
        />
      </label>

      <div role="group" aria-label="Sort roster" className="flex gap-1.5 overflow-x-auto pb-1">
        {SORTS.map((s) => {
          const active = s.key === sort;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => pick(s.key)}
              aria-pressed={active}
              className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold ${
                active ? "border-ink bg-ink text-canvas" : "border-line text-ink-muted"
              }`}
            >
              {s.label}
              {active && <span aria-label={dir === "asc" ? "ascending" : "descending"}>{dir === "asc" ? "↑" : "↓"}</span>}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink-subtle" aria-live="polite">
        {shown.length} of {rows.length} athletes · attendance over the last 30 days
      </p>

      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {shown.map((r) => {
          const due = assessmentDue(r.lastAssessedMonth, currentMonth);
          return (
            <li key={r.studentId} className="flex items-center gap-3 px-3 py-3">
              <AttendanceAvatar name={r.name} pct={r.attendanceRate} size={44} />
              <Link href={`/athlete/${r.studentId}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-ink-muted">
                  <SportIcon sport={rubricIdFor(r.batches[0]?.sport)} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{r.batches.map((b) => b.name).join(", ")}</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {r.attendanceRate == null ? "No attendance marked" : `${r.attendanceRate}% · ${r.attended}/${r.marked} sessions`}
                  {" · "}
                  {r.lastAssessedMonth ? `Assessed ${monthLabel(r.lastAssessedMonth)}` : "Never assessed"}
                </p>
              </Link>
              <Link
                href={`/coach/assess?student=${encodeURIComponent(r.studentId)}${scopeQuery}`}
                className={`inline-flex h-10 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold ${
                  due ? "bg-volt text-volt-fg" : "border border-line text-ink-muted"
                }`}
                aria-label={`Assess ${r.name}${due ? " (due)" : ""}`}
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden />
                {due ? "Due" : "Assess"}
              </Link>
              <Link href={`/athlete/${r.studentId}`} className="hidden h-10 w-6 items-center justify-center text-ink-subtle sm:inline-flex" aria-label={`Open ${r.name}'s athlete page`}>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
