"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LiveSide } from "@/lib/live-match";
import { oversText, type InningsState, type WicketKind } from "@/lib/scoring/cricket";
import { Card, Pill, PlayerPicker, otherSide, rosterFor, sideName, type PanelProps } from "./live-ui";

type Extra = null | "wide" | "noball" | "bye" | "legbye";

const WICKET_KINDS: { key: WicketKind; label: string }[] = [
  { key: "bowled", label: "Bowled" },
  { key: "caught", label: "Caught" },
  { key: "lbw", label: "LBW" },
  { key: "runout", label: "Run out" },
  { key: "stumped", label: "Stumped" },
  { key: "hitwicket", label: "Hit wicket" },
  { key: "retired", label: "Retired" },
];

const EXTRA_LABEL: Record<Exclude<Extra, null>, string> = { wide: "Wide", noball: "No ball", bye: "Bye", legbye: "Leg bye" };

/** Whole numbers to one decimal, without trailing ".0". */
const fmt = (n: number | null, digits = 2) => (n == null ? "–" : n.toFixed(digits));

function legalInOver(symbols: string[]) {
  return symbols.filter((s) => !s.startsWith("wd") && !s.startsWith("nb")).length;
}

/** Engine result text uses "Team batting first/second"; swap in the real names. */
function resultText(text: string, first: string, second: string) {
  return text.replace("Team batting first", first).replace("Team batting second", second);
}

export function CricketPanel({ view, scorer, send, pending, addPlayer }: PanelProps) {
  if (view.detail.family !== "cricket") return null;
  const d = view.detail;
  const c = d.cricket;
  const bpo = d.config.ballsPerOver ?? 6;
  const inn = c.innings[c.current];
  const batting: LiveSide = d.battingSides[c.current] ?? "home";
  const bowling = otherSide(batting);
  const firstName = sideName(view, d.battingSides[0]);
  const secondName = sideName(view, d.battingSides[1]);
  const overDone = inn.legalBalls > 0 && inn.legalBalls % bpo === 0 && legalInOver(inn.thisOver) >= bpo;
  const target = c.target;
  const ballsLeft = d.config.oversPerInnings * bpo - inn.legalBalls;

  return (
    <>
      {/* Score header */}
      <section aria-label="Score" className="rounded-2xl border border-line bg-surface px-4 py-4 sm:px-6">
        {c.innings.length > 1 && (
          <p className="mb-1 text-sm text-ink-muted">
            {firstName} <span className="font-semibold tabular-nums text-ink">{c.innings[0].runs}/{c.innings[0].wickets}</span>{" "}
            <span className="tabular-nums">({oversText(c.innings[0].legalBalls, bpo)})</span>
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-muted">{sideName(view, batting)} batting</p>
            <p className="text-4xl font-black tabular-nums sm:text-5xl">
              {inn.runs}/{inn.wickets}
              <span className="ml-2 text-lg font-semibold text-ink-muted">({oversText(inn.legalBalls, bpo)} ov)</span>
            </p>
          </div>
          <dl className="flex gap-4 text-sm">
            <div>
              <dt className="text-xs text-ink-subtle">Run rate</dt>
              <dd className="font-semibold tabular-nums">{fmt(d.crr)}</dd>
            </div>
            {d.rrr != null && (
              <div>
                <dt className="text-xs text-ink-subtle">Required</dt>
                <dd className="font-semibold tabular-nums">{fmt(d.rrr)}</dd>
              </div>
            )}
            {target != null && c.current === 1 && (
              <div>
                <dt className="text-xs text-ink-subtle">Target</dt>
                <dd className="font-semibold tabular-nums">{target}</dd>
              </div>
            )}
          </dl>
        </div>
        {c.result ? (
          <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">{resultText(c.result, firstName, secondName)}</p>
        ) : target != null && c.current === 1 && ballsLeft > 0 ? (
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold">
            {sideName(view, batting)} need {Math.max(0, target - inn.runs)} from {ballsLeft} ball{ballsLeft === 1 ? "" : "s"}
          </p>
        ) : null}

        {/* At the crease */}
        {(inn.striker || inn.nonStriker || inn.lastBowler) && !c.result && (
          <div className="mt-4 grid gap-2 border-t border-line pt-3 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              {[inn.striker, inn.nonStriker].filter(Boolean).map((p) => {
                const b = inn.batting.find((x) => x.player === p);
                return (
                  <p key={p} className="flex justify-between gap-2">
                    <span className="truncate font-semibold">
                      {p}
                      {p === inn.striker && <span className="text-volt-ink"> *</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {b?.runs ?? 0} <span className="text-ink-subtle">({b?.balls ?? 0})</span>
                    </span>
                  </p>
                );
              })}
              {inn.partnership.balls > 0 && (
                <p className="text-xs text-ink-subtle">
                  Partnership {inn.partnership.runs} ({inn.partnership.balls})
                </p>
              )}
            </div>
            {inn.lastBowler && (
              <div className="sm:text-right">
                {(() => {
                  const w = inn.bowling.find((x) => x.player === inn.lastBowler);
                  return (
                    <p className="flex justify-between gap-2 sm:justify-end">
                      <span className="truncate font-semibold">{inn.lastBowler}</span>
                      <span className="shrink-0 tabular-nums">
                        {w ? `${oversText(w.balls, bpo)}-${w.maidens}-${w.runs}-${w.wickets}` : ""}
                      </span>
                    </p>
                  );
                })()}
                <div className="mt-1 flex flex-wrap gap-1 sm:justify-end" aria-label="This over">
                  {inn.thisOver.map((s, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums",
                        s.includes("W") ? "bg-danger text-white" : s === "4" || s === "6" ? "bg-volt text-volt-fg" : "bg-surface-2 text-ink",
                      )}
                    >
                      {s === "0" ? "•" : s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {scorer && !c.result && (
        <CricketConsole
          key={`${c.current}`}
          view={view}
          inn={inn}
          batting={batting}
          bowling={bowling}
          bpo={bpo}
          overDone={overDone}
          send={send}
          busy={pending.length > 0}
          addPlayer={addPlayer}
          lastBowler={d.lastBall?.bowler ?? null}
          inningsIndex={c.current}
          canEndInnings={c.current === 0 && (d.config.innings ?? 2) >= 2}
        />
      )}

      {c.innings.some((i) => i.batting.length > 0) && <CricketCharts innings={c.innings} names={[firstName, secondName]} overs={d.config.oversPerInnings} />}
      {c.innings.some((i) => i.batting.length > 0) && <Scorecards innings={c.innings} names={[firstName, secondName]} bpo={bpo} />}
    </>
  );
}

function CricketConsole({
  view,
  inn,
  batting,
  bowling,
  bpo,
  overDone,
  send,
  busy,
  addPlayer,
  lastBowler,
  canEndInnings,
}: {
  view: PanelProps["view"];
  inn: InningsState;
  batting: LiveSide;
  bowling: LiveSide;
  bpo: number;
  overDone: boolean;
  send: PanelProps["send"];
  busy: boolean;
  addPlayer: PanelProps["addPlayer"];
  lastBowler: string | null;
  inningsIndex: number;
  canEndInnings: boolean;
}) {
  const [striker, setStriker] = useState(inn.striker ?? "");
  const [nonStriker, setNonStriker] = useState(inn.nonStriker ?? "");
  const [bowler, setBowler] = useState(overDone ? "" : inn.lastBowler ?? "");
  const [extra, setExtra] = useState<Extra>(null);
  const [wicket, setWicket] = useState<null | { kind: WicketKind; out: "striker" | "nonStriker"; fielder: string }>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  // Follow the server after every ball: strike rotation, wickets and over changes come from the engine.
  useEffect(() => {
    if (inn.batting.length > 0) {
      setStriker(inn.striker ?? "");
      setNonStriker(inn.nonStriker ?? "");
    }
    if (overDone) setBowler("");
    else if (inn.lastBowler) setBowler(inn.lastBowler);
    setExtra(null);
    setWicket(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.version]);

  const out = useMemo(() => new Set(inn.batting.filter((b) => b.out).map((b) => b.player)), [inn.batting]);
  const batters = rosterFor(view, batting).filter((n) => !out.has(n));
  const bowlers = rosterFor(view, bowling);
  const newBatter = inn.batting.length > 0 && (!inn.striker || !inn.nonStriker);
  const ready = !!striker && !!nonStriker && !!bowler && striker !== nonStriker;

  const ball = (runs: number) => {
    if (!ready) {
      toast.error(!striker || !nonStriker ? "Pick both batters" : "Pick the bowler");
      return;
    }
    const ev: Record<string, unknown> = { type: "ball", striker, nonStriker, bowler, runs: 0 };
    if (extra === "wide" || extra === "bye" || extra === "legbye") ev.extra = { kind: extra, runs };
    else if (extra === "noball") {
      ev.extra = { kind: "noball" };
      ev.runs = runs;
    } else ev.runs = runs;
    if (wicket) {
      ev.wicket = { kind: wicket.kind, playerOut: wicket.out === "striker" ? striker : nonStriker, ...(wicket.fielder ? { fielder: wicket.fielder } : {}) };
    }
    if (typeof navigator !== "undefined") navigator.vibrate?.(15);
    send(ev);
  };

  const runLabels = [0, 1, 2, 3, 4, 6];
  const needsFielder = wicket && (wicket.kind === "caught" || wicket.kind === "runout" || wicket.kind === "stumped");

  return (
    <Card className="mt-4" title={overDone ? `Over ${Math.floor(inn.legalBalls / bpo)} done · new bowler` : "Score the next ball"}>
      <div className="space-y-4">
        {/* Who's in */}
        {(inn.batting.length === 0 || newBatter) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(inn.batting.length === 0 || !inn.striker) && (
              <PlayerPicker
                label={inn.batting.length === 0 ? "Striker" : "New batter (on strike)"}
                options={batters}
                value={striker}
                onChange={setStriker}
                exclude={[nonStriker]}
                onAdd={(n) => addPlayer(batting, n)}
              />
            )}
            {(inn.batting.length === 0 || !inn.nonStriker) && (
              <PlayerPicker
                label={inn.batting.length === 0 ? "Non-striker" : "New batter (non-striker)"}
                options={batters}
                value={nonStriker}
                onChange={setNonStriker}
                exclude={[striker]}
                onAdd={(n) => addPlayer(batting, n)}
              />
            )}
          </div>
        )}
        {(!bowler || overDone || inn.batting.length === 0) && (
          <PlayerPicker
            label={overDone ? "Bowler for the next over" : "Bowler"}
            options={bowlers}
            value={bowler}
            onChange={setBowler}
            exclude={overDone && lastBowler ? [lastBowler] : []}
            onAdd={(n) => addPlayer(bowling, n)}
          />
        )}
        {ready && inn.batting.length > 0 && !newBatter && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>
              On strike <b className="text-ink">{striker}</b> · bowling <b className="text-ink">{bowler}</b>
            </span>
            <button
              type="button"
              onClick={() => {
                setStriker(nonStriker);
                setNonStriker(striker);
              }}
              className="rounded-full border border-line px-2 py-1 font-semibold text-ink hover:bg-surface-2"
            >
              Swap strike
            </button>
            <button type="button" onClick={() => setBowler("")} className="rounded-full border border-line px-2 py-1 font-semibold text-ink hover:bg-surface-2">
              Change bowler
            </button>
          </div>
        )}

        {/* Extras and wicket */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EXTRA_LABEL) as Exclude<Extra, null>[]).map((k) => (
            <Pill key={k} active={extra === k} onClick={() => setExtra(extra === k ? null : k)} tone="warn">
              {EXTRA_LABEL[k]}
            </Pill>
          ))}
          <Pill active={!!wicket} tone="danger" onClick={() => setWicket(wicket ? null : { kind: "bowled", out: "striker", fielder: "" })}>
            Wicket
          </Pill>
        </div>

        {wicket && (
          <div className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-3">
            <div className="flex flex-wrap gap-1.5">
              {WICKET_KINDS.filter((k) =>
                extra === "wide" ? ["stumped", "runout", "hitwicket", "retired"].includes(k.key) : extra === "noball" ? ["runout", "retired"].includes(k.key) : true,
              ).map((k) => (
                <Pill key={k.key} active={wicket.kind === k.key} onClick={() => setWicket({ ...wicket, kind: k.key })} className="min-h-[40px] px-2.5 text-xs">
                  {k.label}
                </Pill>
              ))}
            </div>
            {(wicket.kind === "runout" || wicket.kind === "retired") && (
              <div className="flex flex-wrap gap-1.5">
                <span className="self-center text-xs font-semibold text-ink-muted">Who&apos;s out?</span>
                <Pill active={wicket.out === "striker"} onClick={() => setWicket({ ...wicket, out: "striker" })} className="min-h-[40px] px-2.5 text-xs">
                  {striker || "Striker"}
                </Pill>
                <Pill active={wicket.out === "nonStriker"} onClick={() => setWicket({ ...wicket, out: "nonStriker" })} className="min-h-[40px] px-2.5 text-xs">
                  {nonStriker || "Non-striker"}
                </Pill>
              </div>
            )}
            {needsFielder && (
              <PlayerPicker
                label={wicket.kind === "stumped" ? "Wicketkeeper" : "Fielder"}
                options={bowlers}
                value={wicket.fielder}
                onChange={(f) => setWicket({ ...wicket, fielder: f })}
                allowNone
                onAdd={(n) => addPlayer(bowling, n)}
              />
            )}
            <p className="text-xs text-ink-muted">Now tap the runs completed on this ball (usually 0).</p>
          </div>
        )}

        {/* Runs */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {runLabels.map((r) => (
            <button
              key={r}
              type="button"
              disabled={busy}
              onClick={() => ball(r)}
              className={cn(
                "flex h-16 flex-col items-center justify-center rounded-2xl border text-2xl font-black tabular-nums transition active:scale-[0.97] disabled:opacity-50 sm:h-20",
                wicket ? "border-danger/40 bg-danger/10 text-danger" : r === 4 || r === 6 ? "border-volt bg-volt text-volt-fg" : "border-line bg-surface hover:bg-surface-2",
              )}
            >
              {r}
              {(extra || wicket) && (
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                  {extra ? (extra === "wide" ? "wd" : extra === "noball" ? "nb" : extra === "bye" ? "b" : "lb") : ""}
                  {wicket ? (extra ? "+W" : "W") : ""}
                </span>
              )}
            </button>
          ))}
        </div>
        {extra === "wide" && <p className="text-xs text-ink-muted">Wide adds 1. Tap the extra runs they ran (0 for a plain wide, 4 if it went to the boundary).</p>}
        {extra === "noball" && <p className="text-xs text-ink-muted">No ball adds 1. Tap the runs off the bat.</p>}

        {canEndInnings && inn.batting.length > 0 && (
          <div className="border-t border-line pt-3">
            <button
              type="button"
              onClick={() => {
                if (!confirmEnd) return setConfirmEnd(true);
                send({ type: "end_innings", reason: "declared" });
                setConfirmEnd(false);
              }}
              className={cn("h-10 rounded-full px-4 text-sm font-semibold", confirmEnd ? "bg-warn/15 text-warn" : "text-ink-muted hover:text-ink")}
            >
              {confirmEnd ? "Tap again to end the innings" : "End innings early"}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function CricketCharts({ innings, names, overs }: { innings: InningsState[]; names: string[]; overs: number }) {
  const colours = ["var(--viz-billed)", "var(--viz-collected)"];
  const maxOvers = Math.max(1, overs, ...innings.map((i) => i.overRuns.length));
  const maxRuns = Math.max(6, ...innings.flatMap((i) => i.overRuns));
  const W = 600;
  const H = 140;
  const slot = W / maxOvers;
  const barW = Math.max(2, (slot - 4) / innings.length);
  const cum = innings.map((i) => i.overRuns.reduce<number[]>((acc, r) => [...acc, (acc[acc.length - 1] ?? 0) + r], []));
  const maxCum = Math.max(10, ...cum.flat());
  return (
    <Card title="Runs per over" className="mt-4">
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-ink-muted">
        {innings.map((_, k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colours[k] }} aria-hidden />
            {names[k]}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none" role="img" aria-label="Runs scored in each over, per innings">
        {innings.map((inn, k) =>
          inn.overRuns.map((r, o) => {
            const h = (r / maxRuns) * (H - 4);
            return <rect key={`${k}-${o}`} x={o * slot + 2 + k * barW} y={H - h} width={barW - 1} height={h} rx={2} fill={colours[k]} />;
          }),
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-ink-subtle">
        <span>Over 1</span>
        <span>Over {maxOvers}</span>
      </div>
      {cum.some((c) => c.length > 1) && (
        <>
          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Worm</h3>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative runs by over for each innings">
            <line x1="0" x2={W} y1={H - 1} y2={H - 1} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            {cum.map((c, k) => (
              <path
                key={k}
                d={[0, ...c].map((v, o) => `${o ? "L" : "M"}${((o / maxOvers) * W).toFixed(1)},${(H - (v / maxCum) * (H - 6)).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={colours[k]}
                strokeWidth="2.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </>
      )}
    </Card>
  );
}

function Scorecards({ innings, names, bpo }: { innings: InningsState[]; names: string[]; bpo: number }) {
  const [tab, setTab] = useState(innings.length - 1);
  const k = Math.min(tab, innings.length - 1);
  const inn = innings[k];
  return (
    <Card
      title="Scorecard"
      className="mt-4"
      action={
        innings.length > 1 ? (
          <div className="flex gap-1">
            {innings.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setTab(i)}
                className={cn("rounded-full px-3 py-1 text-xs font-semibold", i === k ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink")}
              >
                {names[i]}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-subtle">
              <th className="py-1.5 font-semibold">Batter</th>
              <th className="py-1.5 text-right font-semibold">R</th>
              <th className="py-1.5 text-right font-semibold">B</th>
              <th className="hidden py-1.5 text-right font-semibold sm:table-cell">4s</th>
              <th className="hidden py-1.5 text-right font-semibold sm:table-cell">6s</th>
              <th className="py-1.5 text-right font-semibold">SR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {inn.batting.map((b) => (
              <tr key={b.player}>
                <td className="py-2 pr-2">
                  <span className="block font-semibold">{b.player}</span>
                  <span className="block text-xs text-ink-muted">{b.out ?? "not out"}</span>
                </td>
                <td className="py-2 pl-2 text-right font-bold tabular-nums">{b.runs}</td>
                <td className="py-2 pl-2 text-right tabular-nums text-ink-muted">{b.balls}</td>
                <td className="hidden py-2 pl-2 text-right tabular-nums text-ink-muted sm:table-cell">{b.fours}</td>
                <td className="hidden py-2 pl-2 text-right tabular-nums text-ink-muted sm:table-cell">{b.sixes}</td>
                <td className="py-2 pl-2 text-right tabular-nums text-ink-muted">{b.balls ? ((b.runs * 100) / b.balls).toFixed(1) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Extras {inn.extras.total} (wd {inn.extras.wides}, nb {inn.extras.noballs}, b {inn.extras.byes}, lb {inn.extras.legbyes}) · Total{" "}
        <b className="text-ink">
          {inn.runs}/{inn.wickets}
        </b>{" "}
        ({oversText(inn.legalBalls, bpo)} ov)
      </p>
      {inn.fow.length > 0 && (
        <p className="mt-1 text-xs text-ink-muted">
          Fall of wickets: {inn.fow.map((f) => `${f.runs}-${f.wicket} (${f.player}, ${f.overs})`).join(", ")}
        </p>
      )}
      {inn.bowling.length > 0 && (
        <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-subtle">
                <th className="py-1.5 font-semibold">Bowler</th>
                <th className="py-1.5 text-right font-semibold">O</th>
                <th className="py-1.5 text-right font-semibold">M</th>
                <th className="py-1.5 text-right font-semibold">R</th>
                <th className="py-1.5 text-right font-semibold">W</th>
                <th className="py-1.5 text-right font-semibold">Econ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {inn.bowling.map((w) => (
                <tr key={w.player}>
                  <td className="py-2 pr-2 font-semibold">{w.player}</td>
                  <td className="py-2 text-right tabular-nums">{oversText(w.balls, bpo)}</td>
                  <td className="py-2 text-right tabular-nums text-ink-muted">{w.maidens}</td>
                  <td className="py-2 text-right tabular-nums text-ink-muted">{w.runs}</td>
                  <td className="py-2 text-right font-bold tabular-nums">{w.wickets}</td>
                  <td className="py-2 text-right tabular-nums text-ink-muted">{w.balls ? ((w.runs * bpo) / w.balls).toFixed(2) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
