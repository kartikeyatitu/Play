"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LiveSide } from "@/lib/live-match";
import { Card, HeadToHead, Pill, sideName, type PanelProps } from "./live-ui";

const POINT_BUTTONS: Record<string, number[]> = {
  karate: [1, 2, 3],
  taekwondo: [1, 2, 3, 4, 5],
  wrestling: [1, 2, 4, 5],
  boxing: [],
};
const METHODS = [
  { key: "KO", label: "KO" },
  { key: "TKO", label: "TKO" },
  { key: "RSC", label: "Referee stop" },
  { key: "pin", label: "Pin / fall" },
  { key: "submission", label: "Submission" },
  { key: "DQ", label: "Disqualification" },
  { key: "injury", label: "Injury" },
] as const;

/** Karate, taekwondo, wrestling and boxing: points by corner, penalties, rounds, judges' cards, stoppages. */
export function BoutPanel({ view, scorer, send }: PanelProps) {
  const d = view.detail.family === "bout" ? view.detail : null;
  const [round, setRound] = useState(d?.round ?? 1);
  const [stop, setStop] = useState<null | { winner: LiveSide | null; method: string | null }>(null);
  const [judge, setJudge] = useState({ name: "", home: "10", away: "9" });
  useEffect(() => {
    if (d) setRound((r) => Math.max(r, d.round));
  }, [d?.round, d]);
  if (!d) return null;
  const b = d.bout;
  const buttons = POINT_BUTTONS[view.sport] ?? [1, 2, 3];
  const judged = view.sport === "boxing";
  const judges = Object.entries(b.judges);
  // Judged bouts (boxing) show the judges' totals; point bouts show points.
  const shown = judged && judges.length
    ? { home: judges.reduce((t, [, j]) => t + j.home, 0), away: judges.reduce((t, [, j]) => t + j.away, 0) }
    : b.points;

  return (
    <>
      <HeadToHead
        view={view}
        home={judged && !judges.length ? "" : shown.home}
        away={judged && !judges.length ? "" : shown.away}
        center={
          b.winner ? (
            <span className="text-success">
              {sideName(view, b.winner)} wins{b.method ? ` · ${b.method}` : ""}
            </span>
          ) : (
            `${view.unit[0].toUpperCase() + view.unit.slice(1)} ${round} of ${d.config.rounds}${d.config.mercyLead ? ` · ${d.config.mercyLead}-point gap wins` : ""}`
          )
        }
        homeExtra={b.penalties.home ? <p className="mt-1 text-xs text-warn">{b.penalties.home} penalt{b.penalties.home === 1 ? "y" : "ies"}</p> : null}
        awayExtra={b.penalties.away ? <p className="mt-1 text-xs text-warn">{b.penalties.away} penalt{b.penalties.away === 1 ? "y" : "ies"}</p> : null}
      />

      {judges.length > 0 && (
        <Card title="Judges' cards" className="mt-4">
          <ul className="space-y-1 text-sm">
            {judges.map(([j, s]) => (
              <li key={j} className="flex justify-between gap-2">
                <span className="truncate">{j}</span>
                <span className="tabular-nums">
                  {s.home}–{s.away}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {scorer && !b.winner && (
        <Card className="mt-4">
          <div className="space-y-4">
            {buttons.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {(["home", "away"] as const).map((s) => (
                  <div key={s} className="space-y-2">
                    <p className={cn("truncate text-sm font-semibold", s === "home" ? "text-danger" : "text-[var(--viz-billed)]")}>{sideName(view, s)}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {buttons.map((n) => (
                        <Pill key={n} tone="accent" className="h-14 text-lg font-black" onClick={() => send({ type: "score", side: s, points: n, round })}>
                          +{n}
                        </Pill>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone="warn" className="min-h-[40px] text-xs" onClick={() => send({ type: "penalty", side: s, round })}>
                        Penalty
                      </Pill>
                      <Pill tone="warn" className="min-h-[40px] text-xs" onClick={() => send({ type: "penalty", side: s, round, awardOpponent: 1 })}>
                        Penalty, +1 to opponent
                      </Pill>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {judged && (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const home = Number(judge.home);
                  const away = Number(judge.away);
                  if (!judge.name.trim() || !Number.isInteger(home) || !Number.isInteger(away)) return;
                  send({ type: "judge_card", judge: judge.name.trim(), round, home, away });
                }}
              >
                <p className="text-sm font-semibold">Judge&apos;s score for round {round}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={judge.name}
                    onChange={(e) => setJudge({ ...judge, name: e.target.value })}
                    placeholder="Judge (e.g. Judge 1)"
                    maxLength={40}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm focus:border-volt focus:outline-none"
                  />
                  <input
                    value={judge.home}
                    onChange={(e) => setJudge({ ...judge, home: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                    inputMode="numeric"
                    aria-label={`${view.home} score`}
                    className="h-11 w-14 rounded-xl border border-line bg-canvas text-center text-sm tabular-nums focus:border-volt focus:outline-none"
                  />
                  <span className="text-ink-subtle">–</span>
                  <input
                    value={judge.away}
                    onChange={(e) => setJudge({ ...judge, away: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                    inputMode="numeric"
                    aria-label={`${view.away} score`}
                    className="h-11 w-14 rounded-xl border border-line bg-canvas text-center text-sm tabular-nums focus:border-volt focus:outline-none"
                  />
                  <button type="submit" className="h-11 rounded-xl bg-volt px-4 text-sm font-semibold text-volt-fg">
                    Add
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              {round < d.config.rounds && (
                <Pill onClick={() => setRound(round + 1)}>Next {view.unit}</Pill>
              )}
              <Pill tone="danger" onClick={() => setStop(stop ? null : { winner: null, method: null })}>
                Stoppage
              </Pill>
            </div>

            {stop && (
              <div className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-3">
                <div className="flex flex-wrap gap-2">
                  <span className="self-center text-xs font-semibold text-ink-muted">Winner</span>
                  {(["home", "away"] as const).map((s) => (
                    <Pill key={s} active={stop.winner === s} onClick={() => setStop({ ...stop, winner: s })} className="min-h-[40px] text-xs">
                      {sideName(view, s)}
                    </Pill>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {METHODS.map((m) => (
                    <Pill key={m.key} active={stop.method === m.key} onClick={() => setStop({ ...stop, method: m.key })} className="min-h-[40px] text-xs">
                      {m.label}
                    </Pill>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!stop.winner || !stop.method}
                  onClick={() => {
                    send({ type: "stoppage", winner: stop.winner, method: stop.method });
                    setStop(null);
                  }}
                  className="h-11 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Confirm stoppage
                </button>
              </div>
            )}
            <p className="text-xs text-ink-muted">
              {judged
                ? "At the final bell, finish the match: the judges' cards decide it."
                : "When time runs out, finish the match: the higher score wins."}
            </p>
          </div>
        </Card>
      )}
    </>
  );
}
