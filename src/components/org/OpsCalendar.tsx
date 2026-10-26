"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getOpsCalendar } from "@/app/actions/ops-calendar";
import { weekStart, type CalendarDay, type CalendarItem } from "@/lib/ops-calendar";
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
};

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
  } else {
    title = item.facilityName;
    meta = `${formatHour(item.startHour)} – ${formatHour(item.endHour)}${item.batchName ? ` · ${item.batchName}` : ""}`;
  }
  const time = item.kind === "ALLOCATION" ? "" : timeLabel(item.timeMinutes);
  return (
    <li className={`rounded-md border border-line border-l-4 ${KIND_STYLE[item.kind]} bg-surface px-3 py-2`}>
      <p className="text-sm font-medium text-ink truncate">
        {time && <span className="text-ink-subtle mr-1.5">{time}</span>}
        {title}
      </p>
      <p className="text-xs text-ink-subtle truncate">{meta}</p>
    </li>
  );
}

/** V1 Business: week view of sessions, planned batches, trials, holidays and court allocations. */
export function OpsCalendar() {
  const [start, setStart] = useState(() => weekStart(todayIstStr()));
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [unscheduled, setUnscheduled] = useState<{ id: string; name: string; schedule: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <button type="button" onClick={() => setStart(weekStart(today))} className="px-3 py-1.5 text-xs rounded-md border border-line text-ink-muted hover:text-ink">
            This week
          </button>
        </div>
        <ul className="flex flex-wrap gap-3 text-xs text-ink-subtle">
          <li><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Session</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-sky-500 mr-1" />Planned</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Trial</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-1" />Court</li>
        </ul>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-ink-subtle"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((d) => (
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
