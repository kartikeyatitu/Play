"use client";

import { useState } from "react";
import { HeadToHead, Card, Pill, type PanelProps } from "./live-ui";

/** One chess game: White (first side) against Black, result and optional move count. */
export function ChessPanel({ view, scorer, send }: PanelProps) {
  const [moves, setMoves] = useState("");
  if (view.detail.family !== "chess") return null;
  const d = view.detail;
  const score = d.result === "1-0" ? ["1", "0"] : d.result === "0-1" ? ["0", "1"] : d.result ? ["½", "½"] : ["", ""];
  const record = (result: "1-0" | "0-1" | "1/2-1/2") => {
    const m = Number(moves);
    send({ type: "result", result, ...(Number.isInteger(m) && m > 0 ? { moves: m } : {}) });
  };
  return (
    <>
      <HeadToHead
        view={view}
        home={score[0]}
        away={score[1]}
        homeExtra={<p className="mt-1 text-xs text-ink-muted">White</p>}
        awayExtra={<p className="mt-1 text-xs text-ink-muted">Black</p>}
        center={
          d.result
            ? `${d.result === "1/2-1/2" ? "Draw" : `${d.result === "1-0" ? view.home : view.away} wins`}${d.moves ? ` · ${d.moves} moves` : ""}`
            : view.status === "LIVE" || view.status === "SCHEDULED"
              ? "Game in progress"
              : null
        }
      />
      {scorer && !d.result && (
        <Card title="Record the result" className="mt-4">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Pill tone="accent" className="h-14" onClick={() => record("1-0")}>
                White wins
              </Pill>
              <Pill className="h-14" onClick={() => record("1/2-1/2")}>
                Draw
              </Pill>
              <Pill tone="accent" className="h-14" onClick={() => record("0-1")}>
                Black wins
              </Pill>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              Moves (optional)
              <input
                value={moves}
                onChange={(e) => setMoves(e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
                className="h-10 w-20 rounded-xl border border-line bg-canvas px-3 text-sm tabular-nums text-ink focus:border-volt focus:outline-none"
              />
            </label>
          </div>
        </Card>
      )}
    </>
  );
}
