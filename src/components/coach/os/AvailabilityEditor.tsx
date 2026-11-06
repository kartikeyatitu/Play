"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  AVAILABILITY_SAVE_ENABLED,
  formatTime,
  formatTime12,
  normalizeSlots,
  parseTime,
  slotError,
  validateWeek,
  weeklyMinutes,
  WEEKDAYS,
  type AvailabilitySlot,
  type Weekday,
} from "@/lib/coach/availability";

/**
 * Weekly availability editor. Saving is switched off until there is somewhere to store it
 * (see AVAILABILITY_FIELD_NEEDED); edits stay on this screen only.
 */
export function AvailabilityEditor({ initial = [] }: { initial?: AvailabilitySlot[] }) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>(initial);
  const [day, setDay] = useState<Weekday>("Mon");
  const [start, setStart] = useState("16:00");
  const [end, setEnd] = useState("19:00");
  const [error, setError] = useState<string | null>(null);

  const week = useMemo(() => normalizeSlots(slots), [slots]);
  const hours = Math.round((weeklyMinutes(slots) / 60) * 10) / 10;

  const add = () => {
    const s = parseTime(start);
    const e = parseTime(end);
    if (s == null || e == null) return setError("Enter times as HH:MM.");
    const slot = { day, start: s, end: e };
    const err = slotError(slot);
    if (err) return setError(err);
    const res = validateWeek([...slots, slot]);
    if (!res.ok) return setError(res.error);
    setError(null);
    setSlots(res.slots);
  };

  return (
    <div className="space-y-4">
      {!AVAILABILITY_SAVE_ENABLED && (
        <p role="note" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-ink">
          Saving availability isn&apos;t switched on yet. You can plan your week here, but it won&apos;t be kept or shared with the academy.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Add a time slot</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="text-xs text-ink-muted">
            Day
            <select value={day} onChange={(e) => setDay(e.target.value as Weekday)} className="mt-1 h-11 w-full rounded-xl border border-line bg-canvas px-2 text-sm text-ink">
              {WEEKDAYS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-muted">
            From
            <input type="time" step={1800} value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-canvas px-2 text-sm text-ink" />
          </label>
          <label className="text-xs text-ink-muted">
            To
            <input type="time" step={1800} value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-canvas px-2 text-sm text-ink" />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
        <button type="button" onClick={add} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold">
          <Plus className="h-4 w-4" aria-hidden /> Add slot
        </button>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Your week</h2>
          <p className="text-xs text-ink-muted">{hours} h available</p>
        </div>
        <ul className="mt-2 divide-y divide-line">
          {WEEKDAYS.map((d) => {
            const daySlots = week.filter((s) => s.day === d);
            return (
              <li key={d} className="flex min-h-12 items-center gap-3 py-2">
                <span className="w-10 shrink-0 text-sm font-semibold">{d}</span>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {daySlots.length === 0 ? (
                    <span className="text-xs text-ink-subtle">Not available</span>
                  ) : (
                    daySlots.map((s) => (
                      <span key={`${s.day}-${s.start}`} className="inline-flex h-9 items-center gap-1 rounded-full bg-surface-2 pl-3 pr-1 text-xs">
                        <time dateTime={formatTime(s.start)}>{formatTime12(s.start)}</time>–<time dateTime={formatTime(s.end)}>{formatTime12(s.end)}</time>
                        <button
                          type="button"
                          onClick={() => setSlots((cur) => normalizeSlots(cur).filter((x) => !(x.day === s.day && x.start === s.start)))}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:text-danger"
                          aria-label={`Remove ${d} ${formatTime12(s.start)} to ${formatTime12(s.end)}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <button
        type="button"
        disabled={!AVAILABILITY_SAVE_ENABLED}
        title={AVAILABILITY_SAVE_ENABLED ? undefined : "Coming soon"}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-volt text-sm font-semibold text-volt-fg disabled:opacity-50"
      >
        {AVAILABILITY_SAVE_ENABLED ? "Save availability" : "Save (coming soon)"}
      </button>
    </div>
  );
}
