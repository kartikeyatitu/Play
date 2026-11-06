"use client";

import { useState } from "react";
import { ChevronDown, Radio } from "lucide-react";
import type { BoardRound, FixtureCard } from "@/lib/competition/board";
import { fmtIst } from "./styles";

function FixtureRow({ f, onOpen }: { f: FixtureCard; onOpen: (f: FixtureCard) => void }) {
  const done = f.status === "COMPLETED";
  const bye = f.status === "BYE";
  const when = fmtIst(f.scheduledAt);
  const won = (id: string | null) => !!id && f.winnerEntryId === id;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(f)}
        disabled={!f.playable && !done}
        className="flex w-full items-center gap-3 px-4 py-3 text-left enabled:hover:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
            {f.group && <span className="font-semibold uppercase tracking-wider">{f.group}</span>}
            {f.live?.status === "LIVE" && (
              <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-danger">
                <Radio className="h-3 w-3" aria-hidden /> Live
              </span>
            )}
            <span className="truncate">{bye ? "Bye" : f.status === "POSTPONED" ? "Postponed" : f.status === "CANCELLED" ? "Cancelled" : (when ?? "Time to be set")}</span>
            {f.venue && !bye && <span className="truncate">· {f.venue}</span>}
          </div>
          <p className={`truncate text-sm ${won(f.homeEntryId) ? "font-bold text-ink" : "text-ink"}`}>{f.homeName ?? <i className="text-ink-subtle">To be decided</i>}</p>
          <p className={`truncate text-sm ${won(f.awayEntryId) ? "font-bold text-ink" : "text-ink"}`}>{f.awayName ?? <i className="text-ink-subtle">{bye ? "Bye" : "To be decided"}</i>}</p>
        </div>
        <div className="shrink-0 text-right tabular-nums">
          {done ? (
            <>
              <p className="text-sm font-bold text-ink">{f.homeScore}</p>
              <p className="text-sm font-bold text-ink">{f.awayScore}</p>
            </>
          ) : f.playable ? (
            <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted">Score</span>
          ) : null}
        </div>
      </button>
    </li>
  );
}

/** Rounds with their fixtures. Rounds that still have open fixtures start expanded. */
export function FixtureList({ rounds, onOpen }: { rounds: BoardRound[]; onOpen: (f: FixtureCard) => void }) {
  const firstOpen = rounds.findIndex((r) => r.fixtures.some((f) => f.status === "SCHEDULED" || f.status === "POSTPONED"));
  const [open, setOpen] = useState<Set<number>>(() => new Set(rounds.filter((_, i) => i === firstOpen || i === firstOpen + 1).map((r) => r.round)));
  if (rounds.length === 0) return <p className="text-sm text-ink-muted">No fixtures yet. Make the draw in Setup.</p>;
  const toggle = (round: number) => setOpen((s) => (s.has(round) ? (s.delete(round), new Set(s)) : new Set(s.add(round))));
  return (
    <div className="space-y-3">
      {rounds.map((r) => {
        const isOpen = open.has(r.round);
        const played = r.fixtures.filter((f) => f.status === "COMPLETED").length;
        const real = r.fixtures.filter((f) => f.status !== "BYE").length;
        return (
          <section key={r.round} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <button type="button" onClick={() => toggle(r.round)} aria-expanded={isOpen} className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-2 text-left">
              <span className="text-sm font-semibold text-ink">{r.label}</span>
              <span className="flex items-center gap-2 text-xs text-ink-subtle">
                {played}/{real} played
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
              </span>
            </button>
            {isOpen && (
              <>
                <ul className="divide-y divide-line border-t border-line">
                  {r.fixtures.map((f) => (
                    <FixtureRow key={f.id} f={f} onOpen={onOpen} />
                  ))}
                </ul>
                {r.resting.length > 0 && <p className="border-t border-line px-4 py-2 text-xs text-ink-subtle">Resting: {r.resting.join(", ")}</p>}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
