"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { autoScheduleFixtures, generateDraw, seedKnockoutFromGroups } from "@/app/actions/fixtures";
import type { FixturesBoard } from "@/lib/competition/board";
import { drawModesFor, planDraw } from "@/lib/competition/draw";
import type { DrawMode } from "@/lib/competition/phase";
import { card, ghostBtn, inputCls, labelCls, MODE_LABEL, primaryBtn } from "./styles";

type Seeds = { id: string; seed: number | null; createdAt: string }[];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DrawSection({ board, seeds, onDone }: { board: FixturesBoard; seeds: Seeds; onDone: () => Promise<void> }) {
  const c = board.competition;
  const modes = drawModesFor(c.format);
  const [mode, setMode] = useState<DrawMode>(board.hasFixtures ? board.mode : modes[0]);
  const [double, setDouble] = useState(c.legs === 2);
  const [groups, setGroups] = useState(board.groupStage?.groups ?? Math.max(2, Math.min(8, Math.floor(seeds.length / 4))));
  const [advance, setAdvance] = useState(board.groupStage?.advance ?? 2);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(
    () => planDraw(seeds.map((s) => ({ ...s, createdAt: new Date(s.createdAt) })), { mode, double, groups, advance }),
    [seeds, mode, double, groups, advance]
  );
  const canDraw = (c.status === "OPEN" && !board.hasFixtures) || (c.status === "SCHEDULED" && !board.hasResults);

  const run = async (regenerate: boolean) => {
    setBusy(true);
    const r = await generateDraw(c.id, { mode, double, groups, advance, regenerate });
    setBusy(false);
    if (r.success) {
      toast.success(`Draw made: ${r.created} fixtures`);
      setConfirming(false);
      await onDone();
    } else if (r.confirm) setConfirming(true);
    else toast.error(r.error);
  };

  return (
    <section className={card}>
      <h3 className="text-sm font-semibold text-ink">Draw</h3>
      <p className="mt-1 text-xs text-ink-muted">
        {seeds.length} entries. Seeded entries are placed first, then by registration order. The same entries always give the same draw.
      </p>
      {!canDraw ? (
        <p className="mt-3 text-sm text-ink-muted">
          {c.status === "SCHEDULED" ? "Results are in, so the draw is locked." : "Open registration on the Competitions screen first."}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {modes.map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`${ghostBtn} ${mode === m ? "border-volt bg-volt/10" : ""}`}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          {mode !== "KNOCKOUT" && (
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-ink">
              <input type="checkbox" className="h-5 w-5 accent-current" checked={double} onChange={(e) => setDouble(e.target.checked)} />
              Play everyone twice (home and away){mode === "GROUPS" ? " in the groups" : ""}
            </label>
          )}
          {mode === "GROUPS" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="d-groups">Groups</label>
                <input id="d-groups" className={inputCls} type="number" inputMode="numeric" min={2} max={16} value={groups} onChange={(e) => setGroups(Number(e.target.value))} />
              </div>
              <div>
                <label className={labelCls} htmlFor="d-advance">Go through per group</label>
                <input id="d-advance" className={inputCls} type="number" inputMode="numeric" min={1} max={8} value={advance} onChange={(e) => setAdvance(Number(e.target.value))} />
              </div>
            </div>
          )}
          <p className={`text-sm ${preview.ok ? "text-ink-muted" : "text-danger"}`}>
            {preview.ok
              ? `${preview.plan.matches} matches over ${preview.plan.rounds} rounds${preview.plan.groups ? ` · groups of ${preview.plan.groups.map((g) => g.length).join(", ")}` : ""}`
              : preview.error}
          </p>
          {confirming ? (
            <div className="rounded-xl border border-warn/50 bg-warn/10 p-3">
              <p className="text-sm text-ink">Fixtures already exist. Make the draw again? Current fixtures and their times will be replaced.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className={primaryBtn} disabled={busy} onClick={() => run(true)}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Replace draw
                </button>
                <button type="button" className={ghostBtn} disabled={busy} onClick={() => setConfirming(false)}>Keep current</button>
              </div>
            </div>
          ) : (
            <button type="button" className={`${primaryBtn} w-full sm:w-auto`} disabled={busy || !preview.ok} onClick={() => run(false)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {board.hasFixtures ? "Make the draw again" : "Make the draw"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function GroupKnockoutSection({ board, onDone }: { board: FixturesBoard; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const g = board.groupStage;
  if (!g) return null;
  const run = async () => {
    setBusy(true);
    const r = await seedKnockoutFromGroups(board.competition.id);
    setBusy(false);
    if (r.success) toast.success(`Knockout drawn: ${r.qualifiers} qualifiers`);
    else toast.error(r.error);
    await onDone();
  };
  return (
    <section className={card}>
      <h3 className="text-sm font-semibold text-ink">Knockout from groups</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Top {g.advance} from each of {g.groups} groups go through. Group winners get any byes, and teams from the same group are kept apart in the first round.
      </p>
      <button type="button" className={`${primaryBtn} mt-3 w-full sm:w-auto`} disabled={busy || !g.complete} onClick={run}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {g.seeded ? "Draw the knockout again" : "Draw the knockout"}
      </button>
      {!g.complete && <p className="mt-2 text-xs text-ink-subtle">Available once every group fixture has a result.</p>}
    </section>
  );
}

function ScheduleSection({ board, onDone }: { board: FixturesBoard; onDone: () => Promise<void> }) {
  const c = board.competition;
  const [f, setF] = useState({
    startDate: c.startDate ?? new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10),
    days: "",
    slotsPerDay: "6",
    firstSlotTime: "09:00",
    slotMinutes: "60",
    courts: "2",
    courtNames: "",
  });
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  if (c.status !== "SCHEDULED") return null;

  const run = async () => {
    setBusy(true);
    const r = await autoScheduleFixtures(c.id, {
      startDate: f.startDate,
      weekdays,
      days: f.days ? Number(f.days) : null,
      slotsPerDay: Number(f.slotsPerDay),
      firstSlotTime: f.firstSlotTime,
      slotMinutes: Number(f.slotMinutes),
      courts: Number(f.courts),
      courtNames: f.courtNames ? f.courtNames.split(",").map((s) => s.trim()) : undefined,
    });
    setBusy(false);
    if (r.success) toast.success(`${r.scheduled} fixtures scheduled over ${r.matchDays} match day${r.matchDays === 1 ? "" : "s"}`);
    else toast.error(r.error);
    await onDone();
  };

  return (
    <section className={card}>
      <h3 className="text-sm font-semibold text-ink">Schedule</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Sets a time and court for every fixture without a result ({board.unscheduled} still need a time). Nobody plays twice in one slot, and knockout rounds wait for the round before.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls} htmlFor="s-start">Start date</label>
          <input id="s-start" type="date" className={inputCls} value={f.startDate} onChange={set("startDate")} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls} htmlFor="s-days">Match days available</label>
          <input id="s-days" type="number" inputMode="numeric" min={1} placeholder="As many as needed" className={inputCls} value={f.days} onChange={set("days")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="s-first">First slot</label>
          <input id="s-first" type="time" className={inputCls} value={f.firstSlotTime} onChange={set("firstSlotTime")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="s-len">Minutes per slot</label>
          <input id="s-len" type="number" inputMode="numeric" min={5} className={inputCls} value={f.slotMinutes} onChange={set("slotMinutes")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="s-slots">Slots per day</label>
          <input id="s-slots" type="number" inputMode="numeric" min={1} className={inputCls} value={f.slotsPerDay} onChange={set("slotsPerDay")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="s-courts">Courts</label>
          <input id="s-courts" type="number" inputMode="numeric" min={1} className={inputCls} value={f.courts} onChange={set("courts")} />
        </div>
        <div className="col-span-2">
          <label className={labelCls} htmlFor="s-names">Court names (optional, comma separated)</label>
          <input id="s-names" className={inputCls} placeholder="Court 1, Court 2" value={f.courtNames} onChange={set("courtNames")} />
        </div>
      </div>
      <fieldset className="mt-3">
        <legend className={labelCls}>Play on (none picked = every day)</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d, i) => {
            const on = weekdays.includes(i);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== i) : [...w, i].sort()))}
                className={`min-h-[44px] min-w-[44px] rounded-xl border px-2 text-sm ${on ? "border-volt bg-volt/10 font-semibold text-ink" : "border-line text-ink-muted"}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </fieldset>
      <button type="button" className={`${primaryBtn} mt-4 w-full sm:w-auto`} disabled={busy || !board.hasFixtures} onClick={run}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Schedule fixtures
      </button>
    </section>
  );
}

export function SetupPanel({ board, seeds, onDone }: { board: FixturesBoard; seeds: Seeds; onDone: () => Promise<void> }) {
  return (
    <div className="space-y-4">
      <DrawSection board={board} seeds={seeds} onDone={onDone} />
      {board.mode === "GROUPS" && board.hasFixtures && <GroupKnockoutSection board={board} onDone={onDone} />}
      <ScheduleSection board={board} onDone={onDone} />
    </div>
  );
}
