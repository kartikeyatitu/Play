"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getOpsCalendar } from "@/app/actions/ops-calendar";
import {
  filterCalendar,
  weekStart,
  type CalendarDay,
  type CalendarFilterOptions,
  type CalendarFilters,
  type CalendarItem,
} from "@/lib/ops-calendar";
import { addDaysStr, formatHour, todayIstStr } from "@/lib/turf";

function timeLabel(min: number | null): string {
  if (min === null) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
}

const KIND_STYLE: Record<CalendarItem["kind"], string> = {
  SESSION: "border-l-emerald-500",
  PLANNED: "border-l-sky-500",
  TRIAL: "border-l-amber-500",
  ALLOCATION: "border-l-violet-500",
  BOOKING: "border-l-zinc-400",
};

const BOOKING_STYLE = { BOOKING: "border-l-orange-500", LEASE: "border-l-fuchsia-500", BLOCK: "border-l-zinc-500" } as const;
const BOOKING_LABEL = { BOOKING: "Booking", LEASE: "Lease", BLOCK: "Blocked" } as const;

const EMPTY_FILTERS: CalendarFilterOptions = { coaches: [], sports: [], branches: [], facilities: [] };

function Item({ item }: { item: CalendarItem }) {
  let title = "";
  let meta = "";
  if (item.kind === "SESSION") {
    title = item.batchName;
    const att = item.marked ? ` · ${item.present}/${item.marked} present` : "";
    meta = `Session ${item.status.toLowerCase()}${att}${item.coachName ? ` · ${item.coachName}` : ""}${item.branchName ? ` · ${item.branchName}` : ""}`;
  } else if (item.kind === "PLANNED") {
    title = item.batchName;
    meta = `${item.onHoliday ? "Planned (holiday)" : "Planned"}${item.coachName ? ` · ${item.coachName}` : ""}${item.branchName ? ` · ${item.branchName}` : ""}`;
  } else if (item.kind === "TRIAL") {
    title = `Trial: ${item.childFirstName}`;
    meta = `${item.batchName} · ${item.status.toLowerCase()}`;
  } else if (item.kind === "ALLOCATION") {
    title = item.facilityName;
    meta = `${formatHour(item.startHour)} – ${formatHour(item.endHour)}${item.batchName ? ` · ${item.batchName}` : ""}`;
  } else {
    title = `${BOOKING_LABEL[item.bookingKind]}: ${item.facilityName}`;
    meta = `${timeLabel(item.startMinutes)} – ${timeLabel(item.endMinutes)}${item.customerFirstName ? ` · ${item.customerFirstName}` : ""} · ${item.status.toLowerCase().replace("_", " ")}`;
  }
  const time = item.kind === "ALLOCATION" || item.kind === "BOOKING" ? "" : timeLabel(item.timeMinutes);
  const border = item.kind === "BOOKING" ? BOOKING_STYLE[item.bookingKind] : KIND_STYLE[item.kind];
  const clash = item.conflicts.length > 0;
  return (
    <li className={`rounded-md border border-l-4 ${border} ${clash ? "border-red-500 ring-1 ring-red-500/40" : "border-line"} bg-surface px-3 py-2`}>
      <p className="text-sm font-medium text-ink truncate">
        {time && <span className="text-ink-subtle mr-1.5">{time}</span>}
        {title}
      </p>
      <p className="text-xs text-ink-subtle truncate">{meta}</p>
      {item.conflicts.map((c) => (
        <p key={c.label} className="mt-0.5 flex items-center gap-1 text-xs text-red-500">
          <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden /> <span className="truncate">{c.label}</span>
        </p>
      ))}
    </li>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  if (options.length === 0) return null;
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-subtle min-w-0">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink">
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * V1 Business: unified operations calendar — sessions, planned batches, trials, holidays, court allocations,
 * bookings, leases and blocked slots, with day/week views, filters and coach/court conflict highlighting.
 */
export function OpsCalendar() {
  const [start, setStart] = useState(() => weekStart(todayIstStr()));
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [unscheduled, setUnscheduled] = useState<{ id: string; name: string; schedule: string | null }[]>([]);
  const [options, setOptions] = useState<CalendarFilterOptions>(EMPTY_FILTERS);
  const [conflictCount, setConflictCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Phones get the day view by default; the week grid needs a wide screen.
  const [view, setView] = useState<"day" | "week">("day");
  useEffect(() => {
    if (window.matchMedia?.("(min-width: 1024px)").matches) setView("week");
  }, []);
  const [selectedDay, setSelectedDay] = useState(() => todayIstStr());
  const [filters, setFilters] = useState<CalendarFilters>({});

  const load = useCallback(async (s: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOpsCalendar(s, 7);
      if (!res.success) {
        setError(res.error);
        setDays([]);
      } else {
        setDays(res.days);
        setUnscheduled(res.unscheduledBatches);
        setOptions(res.filters);
        setConflictCount(res.conflictCount);
      }
    } catch {
      setError("Couldn't load the calendar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(start);
  }, [start, load]);

  const today = todayIstStr();
  const visible = useMemo(() => filterCalendar(days, filters), [days, filters]);
  const shown = view === "day" ? visible.filter((d) => d.date === selectedDay) : visible;
  const setFilter = (k: keyof CalendarFilters) => (v: string) => setFilters((f) => ({ ...f, [k]: v || null }));

  useEffect(() => {
    // Keep the selected day inside the loaded week.
    if (selectedDay < start || selectedDay > addDaysStr(start, 6)) setSelectedDay(start);
  }, [start, selectedDay]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous week" onClick={() => setStart(addDaysStr(start, -7))} className="p-2 rounded-md border border-line text-ink-muted hover:text-ink">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="text-sm font-semibold text-ink min-w-[10rem] text-center">
            {dayLabel(start)} – {dayLabel(addDaysStr(start, 6))}
          </p>
          <button type="button" aria-label="Next week" onClick={() => setStart(addDaysStr(start, 7))} className="p-2 rounded-md border border-line text-ink-muted hover:text-ink">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setStart(weekStart(today));
              setSelectedDay(today);
            }}
            className="px-3 py-1.5 text-xs rounded-md border border-line text-ink-muted hover:text-ink"
          >
            Today
          </button>
          <div role="group" aria-label="View" className="flex rounded-md border border-line overflow-hidden text-xs">
            {(["day", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 ${view === v ? "bg-ink text-surface" : "text-ink-muted hover:text-ink"}`}
              >
                {v === "day" ? "Day" : "Week"}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex flex-wrap gap-3 text-xs text-ink-subtle">
          <li><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Session</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-sky-500 mr-1" />Planned</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Trial</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-1" />Court</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1" />Booking</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-fuchsia-500 mr-1" />Lease</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-zinc-500 mr-1" />Blocked</li>
        </ul>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <FilterSelect label="Branch" value={filters.branch ?? ""} onChange={setFilter("branch")} options={options.branches.map((b) => ({ value: b, label: b }))} />
        <FilterSelect label="Coach" value={filters.coachId ?? ""} onChange={setFilter("coachId")} options={options.coaches.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect label="Court" value={filters.facilityId ?? ""} onChange={setFilter("facilityId")} options={options.facilities.map((f) => ({ value: f.id, label: f.name }))} />
        <FilterSelect label="Sport" value={filters.sport ?? ""} onChange={setFilter("sport")} options={options.sports.map((s) => ({ value: s, label: s }))} />
      </div>

      {conflictCount > 0 && (
        <p className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-500">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
          {conflictCount} item{conflictCount === 1 ? "" : "s"} this week clash with another coach or court booking.
        </p>
      )}

      {view === "day" && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {visible.map((d) => {
            const clash = d.items.some((i) => i.conflicts.length > 0);
            return (
              <button
                key={d.date}
                type="button"
                aria-pressed={d.date === selectedDay}
                onClick={() => setSelectedDay(d.date)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs ${d.date === selectedDay ? "border-lime-500 text-ink" : "border-line text-ink-muted"}`}
              >
                <span className="block font-semibold">{d.weekday}</span>
                <span className="block">{dayLabel(d.date)}</span>
                {clash && <span className="block text-red-500">clash</span>}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-ink-subtle"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : (
        <div className={`grid gap-3 grid-cols-1 ${view === "week" ? "sm:grid-cols-2 lg:grid-cols-7" : ""}`}>
          {shown.map((d) => (
            <div key={d.date} className={`rounded-xl border p-3 min-w-0 ${d.date === today ? "border-lime-500/60" : "border-line"} bg-surface shadow-hairline`}>
              <p className="text-xs font-semibold uppercase text-ink-muted">
                {d.weekday} <span className="text-ink">{dayLabel(d.date)}</span>
              </p>
              {d.holidays.map((h) => (
                <p key={h} className="mt-1 text-xs text-rose-500 truncate">Holiday: {h}</p>
              ))}
              {d.items.length === 0 ? (
                <p className="mt-2 text-xs text-ink-subtle">Nothing scheduled</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {d.items.map((it, i) => (
                    <Item key={`${it.kind}-${i}`} item={it} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {unscheduled.length > 0 && (
        <p className="text-xs text-ink-subtle">
          Not placed on the calendar (schedule has no recognisable days): {unscheduled.map((b) => `${b.name}${b.schedule ? ` (“${b.schedule}”)` : ""}`).join(", ")}. Edit the batch schedule, e.g. “Mon/Wed/Fri 5 PM”.
        </p>
      )}
    </section>
  );
}
