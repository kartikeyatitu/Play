"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveSide, LiveView, RosterEntry } from "@/lib/live-match";

/** What every family panel gets from the live screen shell. */
export type PanelProps = {
  view: LiveView;
  /** Scoring controls are shown (scorer on a live match). */
  scorer: boolean;
  /** Queue one event; the shell sends it with a clientId and the current version. */
  send: (event: Record<string, unknown>) => void;
  /** Events queued but not yet confirmed by the server. */
  pending: Record<string, unknown>[];
  /** Adds a player to the match (opposition batter, substitute, late entry). Resolves true on success. */
  addPlayer: (side: "home" | "away" | "field", name: string) => Promise<boolean>;
};

export const sideName = (view: LiveView, s: LiveSide) => (s === "home" ? view.home : view.away);
export const otherSide = (s: LiveSide): LiveSide => (s === "home" ? "away" : "home");
export const rosterFor = (view: LiveView, side: RosterEntry["side"]) => view.roster.filter((r) => r.side === side).map((r) => r.name);

export function Card({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatRow({ label, home, away }: { label: string; home: string; away: string }) {
  return (
    <>
      <dd className="text-left font-semibold tabular-nums">{home}</dd>
      <dt className="text-center text-xs text-ink-subtle">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{away}</dd>
    </>
  );
}

export function Pill({ active, onClick, children, disabled, tone = "default", className }: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: "default" | "accent" | "danger" | "warn";
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40",
        active
          ? "border-volt bg-volt text-volt-fg"
          : tone === "accent"
            ? "border-volt/60 bg-surface text-ink hover:bg-surface-2"
            : tone === "danger"
              ? "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15"
              : tone === "warn"
                ? "border-warn/40 bg-warn/10 text-warn hover:bg-warn/15"
                : "border-line bg-surface text-ink hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Pick a player from a side's list, or add a new name. Used for batters, bowlers, scorers and athletes.
 * Players the server already has are buttons; "Add" creates a player on that side first.
 */
export function PlayerPicker({
  label,
  options,
  value,
  onChange,
  onAdd,
  exclude = [],
  allowNone,
  noneLabel = "Not sure",
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (name: string) => void;
  onAdd?: (name: string) => Promise<boolean>;
  exclude?: string[];
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const list = options.filter((o) => !exclude.includes(o));
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-semibold text-ink-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {allowNone && (
          <Pill active={value === ""} onClick={() => onChange("")} className="min-h-[40px] px-2.5 text-xs">
            {noneLabel}
          </Pill>
        )}
        {list.map((o) => (
          <Pill key={o} active={value === o} onClick={() => onChange(o)} className="min-h-[40px] px-2.5 text-xs">
            {o}
          </Pill>
        ))}
        {onAdd && !adding && (
          <Pill onClick={() => setAdding(true)} className="min-h-[40px] border-dashed px-2.5 text-xs text-ink-muted">
            <Plus className="h-3.5 w-3.5" /> Add
          </Pill>
        )}
      </div>
      {onAdd && adding && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const n = draft.trim();
            if (!n) return;
            setSaving(true);
            const ok = await onAdd(n);
            setSaving(false);
            if (ok) {
              onChange(n.replace(/\s+/g, " "));
              setDraft("");
              setAdding(false);
            }
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={60}
            placeholder="Name"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-volt focus:outline-none"
          />
          <button type="submit" disabled={saving || !draft.trim()} className="h-10 rounded-xl bg-volt px-3 text-sm font-semibold text-volt-fg disabled:opacity-40">
            {saving ? "…" : "Add"}
          </button>
          <button type="button" onClick={() => setAdding(false)} className="h-10 rounded-xl px-2 text-sm text-ink-muted">
            Cancel
          </button>
        </form>
      )}
    </fieldset>
  );
}

/** Running difference sparkline: above the line = first side ahead. */
export function Momentum({ diff, home, away, label = "Momentum" }: { diff: number[]; home: string; away: string; label?: string }) {
  const W = 600;
  const H = 120;
  const max = Math.max(3, ...diff.map((d) => Math.abs(d)));
  const x = (i: number) => (diff.length === 1 ? W : (i / (diff.length - 1)) * W);
  const y = (d: number) => H / 2 - (d / max) * (H / 2 - 6);
  const path = diff.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d).toFixed(1)}`).join(" ");
  const last = diff[diff.length - 1];
  return (
    <figure className="mt-5">
      <figcaption className="mb-2 flex justify-between text-xs text-ink-subtle">
        <span>{label}</span>
        <span className="tabular-nums">{last === 0 ? "Level" : `${last > 0 ? home : away} +${Math.abs(last)}`}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none" role="img" aria-label={`Score difference over the match. ${home} above the line, ${away} below.`}>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={path} fill="none" stroke="var(--viz-billed)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-ink-subtle">
        <span>▲ {home}</span>
        <span>▼ {away}</span>
      </div>
    </figure>
  );
}

/** Two-side score header used by goals, bouts and chess. */
export function HeadToHead({ view, home, away, center, homeExtra, awayExtra }: {
  view: LiveView;
  home: ReactNode;
  away: ReactNode;
  center?: ReactNode;
  homeExtra?: ReactNode;
  awayExtra?: ReactNode;
}) {
  const winner = view.outcome;
  return (
    <section aria-label="Score" className="rounded-2xl border border-line bg-surface px-4 py-5 sm:px-6">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0 text-left">
          <p className={cn("line-clamp-2 text-sm font-semibold sm:text-base", winner && winner !== "home" && winner !== "draw" && "text-ink-muted")}>{view.home}</p>
          {homeExtra}
        </div>
        {home === "" && away === "" ? (
          <div className="text-xl font-bold text-ink-subtle">vs</div>
        ) : (
          <div className="flex items-center gap-3 text-4xl font-black tabular-nums sm:text-5xl">
            <span>{home}</span>
            <span className="text-2xl text-ink-subtle">–</span>
            <span>{away}</span>
          </div>
        )}
        <div className="min-w-0 text-right">
          <p className={cn("line-clamp-2 text-sm font-semibold sm:text-base", winner && winner !== "away" && winner !== "draw" && "text-ink-muted")}>{view.away}</p>
          {awayExtra}
        </div>
      </div>
      {center && <div className="mt-3 text-center text-sm font-semibold text-ink-muted">{center}</div>}
    </section>
  );
}
