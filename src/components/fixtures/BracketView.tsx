import { Trophy } from "lucide-react";
import type { BracketRound, FixtureCard } from "@/lib/competition/board";

function Side({ name, score, won, placeholder }: { name: string | null; score: number | null; won: boolean; placeholder: string }) {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 ${won ? "font-bold text-ink" : "text-ink-muted"}`}>
      <span className={`truncate text-sm ${name ? "" : "italic text-ink-subtle"}`}>{name ?? placeholder}</span>
      <span className="shrink-0 tabular-nums text-sm">{score ?? ""}</span>
    </div>
  );
}

function Match({ f, onOpen }: { f: FixtureCard; onOpen: (f: FixtureCard) => void }) {
  const bye = f.status === "BYE";
  return (
    <button
      type="button"
      onClick={() => onOpen(f)}
      disabled={!f.playable && f.status !== "COMPLETED"}
      className="block w-full divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-left enabled:hover:border-volt"
    >
      <Side name={f.homeName} score={f.homeScore} won={!!f.winnerEntryId && f.winnerEntryId === f.homeEntryId} placeholder={bye ? "Bye" : "To be decided"} />
      <Side name={f.awayName} score={f.awayScore} won={!!f.winnerEntryId && f.winnerEntryId === f.awayEntryId} placeholder={bye ? "Bye" : "To be decided"} />
    </button>
  );
}

/** Knockout bracket: one column per round, scrolling sideways on a phone. */
export function BracketView({ rounds, champion, onOpen }: { rounds: BracketRound[]; champion: string | null; onOpen: (f: FixtureCard) => void }) {
  if (rounds.length === 0) return <p className="text-sm text-ink-muted">No knockout in this draw.</p>;
  return (
    <div className="space-y-3">
      {champion && (
        <div className="flex items-center gap-2 rounded-2xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm font-semibold text-ink">
          <Trophy className="h-4 w-4 text-volt" aria-hidden /> Champion: {champion}
        </div>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex gap-3" style={{ minWidth: `${rounds.length * 13}rem` }}>
          {rounds.map((r) => (
            <section key={r.label} className="flex w-48 shrink-0 flex-col">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{r.label}</h3>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {r.fixtures.map((f) => (
                  <Match key={f.id} f={f} onOpen={onOpen} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
