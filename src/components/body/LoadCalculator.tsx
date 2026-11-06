"use client";

import { useState } from "react";
import { RPE_SCALE, describeWeek, sessionLoad, weeklyLoad, type LoadSession } from "@/lib/body/load";
import { inputCls, labelCls, ghostBtn, primaryBtn } from "@/components/body/ui";

/**
 * Session-RPE calculator. Nothing is saved: values stay on this screen only.
 */
export function LoadCalculator({ today }: { today: string }) {
  const [rows, setRows] = useState<LoadSession[]>([]);
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState(60);
  const [rpe, setRpe] = useState(5);
  const load = sessionLoad(minutes, rpe);
  const weeks = weeklyLoad(rows);

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-2 block space-y-1 sm:col-span-1">
          <span className={labelCls}>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className={labelCls}>Minutes</span>
          <input type="number" inputMode="numeric" min={0} max={300} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className={labelCls}>RPE (0–10)</span>
          <select value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className={inputCls}>
            {RPE_SCALE.map((r) => (
              <option key={r.value} value={r.value}>
                {r.value} · {r.label}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <button type="button" disabled={load === null} onClick={() => load !== null && setRows((r) => [...r, { date, minutes, rpe }])} className={`${primaryBtn} w-full`}>
            Add session{load !== null ? ` (${load})` : ""}
          </button>
        </div>
      </div>

      {weeks.length ? (
        <ul className="space-y-2">
          {weeks
            .slice()
            .reverse()
            .map((w) => (
              <li key={w.weekStart} className="rounded-xl border border-line bg-surface p-3">
                <p className="text-sm font-semibold">Week of {w.weekStart}</p>
                <p className="mt-1 text-sm text-ink-muted">{describeWeek(w)}</p>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">Add a few sessions to see weekly totals.</p>
      )}
      {rows.length ? (
        <button type="button" onClick={() => setRows([])} className={ghostBtn}>
          Clear
        </button>
      ) : null}
    </div>
  );
}
