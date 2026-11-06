"use client";

import { useMemo, useState } from "react";
import { DRILLS, DRILL_SPORTS, sportKey, sportLabel } from "@/lib/body/drills";
import { checkPlanTime, moveItem, MAX_PLAN_ITEMS, MAX_SESSION_MINUTES, MIN_SESSION_MINUTES } from "@/lib/body/plans";
import { saveSessionPlan } from "@/app/actions/body";
import { inputCls, labelCls, primaryBtn, ghostBtn } from "@/components/body/ui";

export type BuilderItem = { uid: string; drillId: string | null; libraryKey: string | null; title: string; durationMin: number; notes: string };
export type BuilderCustomDrill = { id: string; sport: string; title: string; durationMin: number | null };

let seq = 0;
const uid = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

export function PlanBuilder({
  enabled,
  planId,
  initial,
  batches,
  customDrills,
}: {
  enabled: boolean;
  planId?: string;
  initial: { title: string; batchId: string; date: string; sessionMinutes: number; notes: string; sport: string; items: Omit<BuilderItem, "uid">[] };
  batches: { id: string; name: string; sport: string }[];
  customDrills: BuilderCustomDrill[];
}) {
  const [title, setTitle] = useState(initial.title);
  const [batchId, setBatchId] = useState(initial.batchId);
  const [date, setDate] = useState(initial.date);
  const [sessionMinutes, setSessionMinutes] = useState(initial.sessionMinutes);
  const [notes, setNotes] = useState(initial.notes);
  const [items, setItems] = useState<BuilderItem[]>(() => initial.items.map((i) => ({ ...i, uid: uid() })));
  const batchSport = sportKey(batches.find((b) => b.id === batchId)?.sport);
  const [pickSport, setPickSport] = useState<string>(sportKey(initial.sport) ?? batchSport ?? "cricket");
  const [freeText, setFreeText] = useState("");

  const time = checkPlanTime(items, sessionMinutes);
  const pickable = useMemo(
    () => [
      ...customDrills.filter((d) => d.sport === pickSport).map((d) => ({ id: d.id, key: null as string | null, title: d.title, mins: d.durationMin ?? 10, custom: true })),
      ...DRILLS.filter((d) => d.sport === pickSport).map((d) => ({ id: null as string | null, key: d.key, title: d.title, mins: d.durationMin, custom: false })),
    ],
    [customDrills, pickSport],
  );

  const full = items.length >= MAX_PLAN_ITEMS;
  const add = (it: Omit<BuilderItem, "uid">) => !full && setItems((xs) => [...xs, { ...it, uid: uid() }]);
  const update = (i: number, patch: Partial<BuilderItem>) => setItems((xs) => xs.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const payload = JSON.stringify(items.map(({ drillId, libraryKey, title, durationMin, notes }) => ({ drillId, libraryKey, title, durationMin, notes })));
  const timeTone = time.status === "over" ? "border-danger/40 bg-danger/10" : time.status === "fits" ? "border-success/40 bg-success/10" : "border-line bg-surface-2";

  return (
    <form action={saveSessionPlan} className="mt-6 space-y-6">
      {planId ? <input type="hidden" name="planId" value={planId} /> : null}
      <input type="hidden" name="items" value={payload} />
      <input type="hidden" name="sport" value={batchSport ?? pickSport} />

      <div className="grid gap-3 sm:grid-cols-2 print:hidden">
        <label className="block space-y-1 sm:col-span-2">
          <span className={labelCls}>Plan title</span>
          <input name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Tuesday U-12 batting" />
        </label>
        <label className="block space-y-1">
          <span className={labelCls}>Batch</span>
          <select name="batchId" value={batchId} onChange={(e) => setBatchId(e.target.value)} className={inputCls}>
            <option value="">No batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className={labelCls}>Date</span>
          <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className={labelCls}>Session length (minutes)</span>
          <input
            type="number"
            name="sessionMinutes"
            inputMode="numeric"
            min={MIN_SESSION_MINUTES}
            max={MAX_SESSION_MINUTES}
            value={sessionMinutes}
            onChange={(e) => setSessionMinutes(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className={labelCls}>Notes for the session</span>
          <textarea name="notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
        </label>
      </div>

      {/* Print-only header (used by "Print draft" when the plan cannot be saved yet) */}
      <div className="hidden print:block">
        <h2 className="text-xl font-semibold">{title || "Session plan"}</h2>
        <p className="text-sm">
          {date || "No date"} · {sessionMinutes} min session
        </p>
        {notes ? <p className="mt-1 text-sm">{notes}</p> : null}
      </div>

      <section>
        <div className={`sticky top-0 z-10 rounded-lg border px-3 py-2 text-sm ${timeTone} print:static`} aria-live="polite">
          <strong className="font-semibold">{time.total} min planned.</strong> {time.text}
        </div>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No items yet. Add drills from the library below, or a free-text item.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {items.map((it, i) => (
              <li key={it.uid} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-6 shrink-0 text-sm font-semibold text-ink-subtle">{i + 1}.</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      aria-label={`Item ${i + 1} title`}
                      value={it.title}
                      maxLength={120}
                      onChange={(e) => update(i, { title: e.target.value })}
                      className={`${inputCls} print:border-0 print:p-0 print:font-semibold`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-ink-muted">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={180}
                          aria-label={`Item ${i + 1} minutes`}
                          value={it.durationMin}
                          onChange={(e) => update(i, { durationMin: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                          className={`${inputCls} w-20`}
                        />
                        min
                      </label>
                      {it.drillId ? <span className="text-xs text-ink-subtle">Academy drill</span> : it.libraryKey ? <span className="text-xs text-ink-subtle">TRIQ library</span> : null}
                    </div>
                    <input
                      aria-label={`Item ${i + 1} notes`}
                      placeholder="Coaching notes (optional)"
                      value={it.notes}
                      maxLength={300}
                      onChange={(e) => update(i, { notes: e.target.value })}
                      className={`${inputCls} print:border-0 print:p-0`}
                    />
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 print:hidden">
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => setItems((xs) => moveItem(xs, i, -1))} className={`${ghostBtn} min-h-9 px-2 disabled:opacity-30`}>
                      ↑
                    </button>
                    <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => setItems((xs) => moveItem(xs, i, 1))} className={`${ghostBtn} min-h-9 px-2 disabled:opacity-30`}>
                      ↓
                    </button>
                    <button type="button" aria-label="Remove" onClick={() => setItems((xs) => xs.filter((_, n) => n !== i))} className={`${ghostBtn} min-h-9 px-2 text-danger`}>
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="print:hidden">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Add from the drill library</h2>
        <div className="mt-2 flex gap-2">
          <select aria-label="Sport" value={pickSport} onChange={(e) => setPickSport(e.target.value)} className={inputCls}>
            {DRILL_SPORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
          {pickable.map((d) => (
            <li key={d.id ?? d.key} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 text-sm">
                {d.title} <span className="text-ink-subtle">· {d.mins} min{d.custom ? " · academy" : ""}</span>
              </span>
              <button
                type="button"
                disabled={full}
                onClick={() => add({ drillId: d.id, libraryKey: d.key, title: d.title, durationMin: d.mins, notes: "" })}
                className={`${ghostBtn} min-h-9 shrink-0`}
              >
                Add
              </button>
            </li>
          ))}
          {!pickable.length ? <li className="px-3 py-2 text-sm text-ink-muted">No drills for {sportLabel(pickSport)} yet.</li> : null}
        </ul>
        <div className="mt-3 flex gap-2">
          <input aria-label="Free-text item" placeholder="Free-text item, e.g. Water break" value={freeText} maxLength={120} onChange={(e) => setFreeText(e.target.value)} className={inputCls} />
          <button
            type="button"
            disabled={!freeText.trim() || full}
            onClick={() => {
              add({ drillId: null, libraryKey: null, title: freeText.trim(), durationMin: 5, notes: "" });
              setFreeText("");
            }}
            className={`${ghostBtn} shrink-0`}
          >
            Add item
          </button>
        </div>
        {full ? <p className="mt-2 text-xs text-ink-muted">A plan can have at most {MAX_PLAN_ITEMS} items.</p> : null}
      </section>

      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="submit" disabled={!enabled || !items.length || !title.trim()} className={primaryBtn}>
          {planId ? "Save changes" : "Save plan"}
        </button>
        <button type="button" onClick={() => window.print()} className={ghostBtn}>
          Print this draft
        </button>
      </div>
    </form>
  );
}
