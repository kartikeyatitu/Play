"use client";

import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveSide } from "@/lib/live-match";
import { Card, Momentum, StatRow, sideName, type PanelProps } from "./live-ui";

/** Badminton, table tennis, volleyball, squash, pickleball and tennis: two big buttons, set scores, momentum. */
export function RallyPanel({ view, scorer, send, pending }: PanelProps) {
  if (view.detail.family !== "rally" && view.detail.family !== "tennis") return null;
  const d = view.detail;
  const b = d.board;
  const queued: Record<LiveSide, number> = { home: 0, away: 0 };
  for (const p of pending) if (p.side === "home" || p.side === "away") queued[p.side]++;
  const server: LiveSide | null = d.family === "rally" ? d.lastPoint : null;
  const unit = view.unit === "set" ? "Set" : "Game";

  return (
    <>
      <section aria-label="Score" className="overflow-hidden rounded-2xl border border-line bg-surface">
        {(["home", "away"] as const).map((s, i) => (
          <div key={s} className={cn("flex items-center gap-3 px-4 py-4 sm:px-6", i === 1 && "border-t border-line", b.winner === s && "bg-surface-2")}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span aria-label={server === s ? "Serving" : undefined} className={cn("h-2 w-2 shrink-0 rounded-full", server === s && !b.winner ? "bg-volt" : "bg-transparent")} />
              <span className={cn("truncate text-base font-semibold sm:text-lg", b.winner && b.winner !== s && "text-ink-muted")}>{sideName(view, s)}</span>
              {b.winner === s && <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">Won</span>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {b.periods.map((p, k) => (
                <span key={k} className={cn("w-8 text-center text-sm tabular-nums", p[s] > p[s === "home" ? "away" : "home"] ? "font-bold text-ink" : "text-ink-subtle")}>
                  {p[s]}
                </span>
              ))}
              {b.games && <span className="w-8 text-center text-sm font-semibold tabular-nums text-ink-muted">{b.games[s]}</span>}
              {!b.winner && (
                <span className="ml-2 min-w-[3.5rem] rounded-xl bg-canvas px-2 py-1 text-center text-3xl font-black tabular-nums sm:text-4xl">
                  {b.current[s]}
                  {queued[s] > 0 && <span className="ml-1 align-top text-sm font-bold text-volt-ink">+{queued[s]}</span>}
                </span>
              )}
            </div>
          </div>
        ))}
        {(d.pressure || b.tiebreak) && !b.winner && (
          <div className="flex items-center gap-2 border-t border-line bg-warn/10 px-4 py-2 text-sm font-semibold text-warn sm:px-6">
            <Zap className="h-4 w-4" aria-hidden />
            {b.tiebreak ? "Tiebreak" : `${d.pressure!.kind === "match" ? "Match" : unit} point · ${sideName(view, d.pressure!.side)}`}
          </div>
        )}
      </section>

      {scorer && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["home", "away"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (b.winner) return;
                if (typeof navigator !== "undefined") navigator.vibrate?.(15);
                send({ type: "point", side: s });
              }}
              disabled={!!b.winner}
              className={cn(
                "flex h-36 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 text-center transition active:scale-[0.98] disabled:opacity-40 sm:h-44",
                s === "home" ? "border-volt bg-volt text-volt-fg" : "border-line bg-surface text-ink hover:bg-surface-2",
              )}
            >
              <span className="text-4xl font-black">+1</span>
              <span className="line-clamp-2 text-sm font-semibold">{sideName(view, s)}</span>
            </button>
          ))}
        </div>
      )}

      {view.points > 0 && (
        <Card title="Match stats" className="mt-4">
          {d.momentum.currentRun && d.momentum.currentRun.length >= 3 && view.status === "LIVE" && (
            <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold">
              {sideName(view, d.momentum.currentRun.side)} on a run: {d.momentum.currentRun.length} points in a row
            </p>
          )}
          <dl className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-3 text-sm">
            <StatRow
              label="Points won"
              home={`${d.momentum.pointsWon.home} (${pct(d.momentum.pointsWon, "home")}%)`}
              away={`${d.momentum.pointsWon.away} (${pct(d.momentum.pointsWon, "away")}%)`}
            />
            <StatRow label="Longest run" home={String(d.momentum.longestRun.home)} away={String(d.momentum.longestRun.away)} />
            <StatRow label={view.unit === "set" ? "Sets" : "Games"} home={String(b.periodsWon.home)} away={String(b.periodsWon.away)} />
          </dl>
          {d.momentum.diff.length >= 4 && <Momentum diff={d.momentum.diff} home={view.home} away={view.away} />}
        </Card>
      )}
    </>
  );
}

function pct(won: Record<LiveSide, number>, s: LiveSide) {
  const total = won.home + won.away;
  return total ? Math.round((won[s] / total) * 100) : 0;
}
