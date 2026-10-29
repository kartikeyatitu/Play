"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LiveSide } from "@/lib/live-match";
import { Card, HeadToHead, Pill, PlayerPicker, rosterFor, sideName, type PanelProps } from "./live-ui";

const SCORE_LABELS: Record<string, string> = {
  goal: "Goal",
  penalty: "Penalty",
  own_goal: "Own goal",
  field_goal: "Field goal",
  penalty_corner: "Penalty corner",
  penalty_stroke: "Penalty stroke",
  seven_metre: "7-metre",
  "3pt": "+3",
  "2pt": "+2",
  ft: "Free throw",
  raid_touch: "Raid point",
  bonus: "Bonus",
  tackle: "Tackle",
  super_tackle: "Super tackle",
  all_out: "All out",
};

const CARDS: Record<string, ("green" | "yellow" | "red")[]> = {
  football: ["yellow", "red"],
  futsal: ["yellow", "red"],
  hockey: ["green", "yellow", "red"],
  handball: ["yellow", "red"],
  kabaddi: ["green", "yellow", "red"],
  basketball: [],
};
const ASSISTS = new Set(["football", "futsal", "hockey", "handball", "basketball"]);
const NO_ASSIST_KINDS = new Set(["own_goal", "ft", "penalty", "penalty_stroke", "seven_metre"]);

type Action =
  | { kind: "score"; side: LiveSide; scoreKind: string; player: string; step: "player" | "assist" }
  | { kind: "card"; side: LiveSide; colour: "green" | "yellow" | "red" }
  | { kind: "foul"; side: LiveSide };

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function useClock(startedAt: string | null) {
  // Starts after mount so the server render and the first client render match.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt || now == null) return null;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

export function GoalsPanel({ view, scorer, send, addPlayer }: PanelProps) {
  const d = view.detail.family === "goals" ? view.detail : null;
  const clock = useClock(d?.goals.live ? d.periodStartedAt : null);
  const [action, setAction] = useState<Action | null>(null);
  if (!d) return null;
  const g = d.goals;
  const cfg = d.config;
  const label = cfg.periodLabel;
  const cards = CARDS[view.sport] ?? ["yellow", "red"];

  const status = g.finished
    ? "Full time"
    : g.live
      ? `${ordinal(g.period)} ${label.toLowerCase()}${clock != null ? ` · ${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}` : ""}`
      : g.period === 0
        ? "Not started"
        : g.period >= cfg.periods
          ? "Full time"
          : `End of ${ordinal(g.period)} ${label.toLowerCase()}`;

  const scorersFor = (s: LiveSide) =>
    g.players
      .filter((p) => p.side === s && p.points > 0)
      .map((p) => `${p.player}${p.points > 1 ? ` ×${p.points}` : ""}`)
      .join(", ");

  const finishScore = (a: Extract<Action, { kind: "score" }>, assist?: string) => {
    send({ type: "score", side: a.side, kind: a.scoreKind, ...(a.player ? { player: a.player } : {}), ...(assist ? { assist } : {}) });
    setAction(null);
  };

  return (
    <>
      <HeadToHead
        view={view}
        home={g.score.home}
        away={g.score.away}
        center={<span className={cn(g.live && "text-danger")}>{status}</span>}
        homeExtra={scorersFor("home") ? <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{scorersFor("home")}</p> : null}
        awayExtra={scorersFor("away") ? <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{scorersFor("away")}</p> : null}
      />

      {scorer && !g.finished && (
        <Card className="mt-4">
          {!g.live ? (
            <button
              type="button"
              onClick={() => send({ type: "period_start", period: g.period + 1 })}
              className="h-14 w-full rounded-2xl bg-volt text-base font-bold text-volt-fg hover:brightness-110"
            >
              {g.period === 0 ? "Kick off" : `Start ${ordinal(g.period + 1)} ${label.toLowerCase()}`}
            </button>
          ) : action == null ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {(["home", "away"] as const).map((s) => (
                  <div key={s} className="space-y-2">
                    <p className="truncate text-sm font-semibold">{sideName(view, s)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(cfg.scoreTypes).map((k) => (
                        <Pill
                          key={k}
                          tone={k === "own_goal" ? "default" : "accent"}
                          className={cn("h-14 text-base", k === "own_goal" && "text-sm text-ink-muted")}
                          onClick={() => setAction({ kind: "score", side: s, scoreKind: k, player: "", step: "player" })}
                        >
                          {SCORE_LABELS[k] ?? k}
                        </Pill>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cards.map((c) => (
                        <Pill key={c} onClick={() => setAction({ kind: "card", side: s, colour: c })} className="min-h-[40px] text-xs">
                          <span
                            aria-hidden
                            className={cn("h-3.5 w-2.5 rounded-[2px]", c === "yellow" ? "bg-[#e5b800]" : c === "red" ? "bg-[#d0312d]" : "bg-[#2e9e4f]")}
                          />
                          {c[0].toUpperCase() + c.slice(1)}
                        </Pill>
                      ))}
                      {view.sport === "basketball" && (
                        <Pill onClick={() => setAction({ kind: "foul", side: s })} className="min-h-[40px] text-xs">
                          Foul
                        </Pill>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => send({ type: "period_end", period: g.period })}
                  className="h-11 rounded-full border border-line px-4 text-sm font-semibold hover:bg-surface-2"
                >
                  {g.period >= cfg.periods ? "Full time" : `End ${ordinal(g.period)} ${label.toLowerCase()}`}
                </button>
              </div>
            </div>
          ) : (
            <ActionStep view={view} action={action} setAction={setAction} send={send} addPlayer={addPlayer} finishScore={finishScore} />
          )}
        </Card>
      )}

      {g.players.some((p) => p.points > 0 || p.assists > 0) && (
        <Card title="Players" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["home", "away"] as const).map((s) => {
              const rows = g.players.filter((p) => p.side === s && (p.points || p.assists || p.yellow || p.red || p.fouls)).sort((a, b) => b.points - a.points);
              return (
                <div key={s}>
                  <p className="mb-1 truncate text-xs font-semibold text-ink-subtle">{sideName(view, s)}</p>
                  {rows.length === 0 ? (
                    <p className="text-sm text-ink-subtle">–</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {rows.map((p) => (
                        <li key={p.player} className="flex justify-between gap-2">
                          <span className="truncate">{p.player}</span>
                          <span className="shrink-0 tabular-nums text-ink-muted">
                            {[
                              p.assists > 0 ? `${p.assists} ast` : "",
                              view.sport === "basketball" && p.fouls > 0 ? `${p.fouls} PF` : "",
                              p.yellow > 0 ? `${p.yellow} yellow` : "",
                              p.red > 0 ? "red" : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {p.points > 0 && <b className="ml-2 text-ink">{p.points}</b>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {g.byPeriod.length > 0 && (
        <Card title={`By ${label.toLowerCase()}`} className="mt-4">
          <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink-subtle">
                  <th className="py-1 text-left font-semibold" />
                  {g.byPeriod.map((_, i) => (
                    <th key={i} className="py-1 text-right font-semibold">
                      {label[0]}
                      {i + 1}
                    </th>
                  ))}
                  <th className="py-1 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(["home", "away"] as const).map((s) => (
                  <tr key={s}>
                    <td className="max-w-[10rem] truncate py-2 pr-2 font-semibold">{sideName(view, s)}</td>
                    {g.byPeriod.map((p, i) => (
                      <td key={i} className="py-2 text-right tabular-nums text-ink-muted">
                        {p[s]}
                      </td>
                    ))}
                    <td className="py-2 text-right font-bold tabular-nums">{g.score[s]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {g.timeline.length > 0 && (
        <Card title="Timeline" className="mt-4">
          <ol className="space-y-2 text-sm">
            {[...g.timeline].reverse().map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-10 shrink-0 text-right tabular-nums text-ink-subtle">{t.minute != null ? `${t.minute}'` : ""}</span>
                <span className="min-w-0">{prettyTimeline(t.text, view)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}

/** Engine timeline says "(home)"/"(away)"; show team names and nicer score words instead. */
function prettyTimeline(text: string, view: PanelProps["view"]) {
  let t = text.replace("(home)", `· ${view.home}`).replace("(away)", `· ${view.away}`);
  for (const [k, v] of Object.entries(SCORE_LABELS)) {
    const raw = k.replace(/_/g, " ");
    if (t.startsWith(raw)) {
      t = (v.startsWith("+") ? `${v} points` : v) + t.slice(raw.length);
      break;
    }
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function ActionStep({
  view,
  action,
  setAction,
  send,
  addPlayer,
  finishScore,
}: {
  view: PanelProps["view"];
  action: Action;
  setAction: (a: Action | null) => void;
  send: PanelProps["send"];
  addPlayer: PanelProps["addPlayer"];
  finishScore: (a: Extract<Action, { kind: "score" }>, assist?: string) => void;
}) {
  const roster = rosterFor(view, action.side);
  const team = sideName(view, action.side);
  const cancel = (
    <button type="button" onClick={() => setAction(null)} className="h-10 rounded-full px-3 text-sm font-semibold text-ink-muted hover:text-ink">
      Cancel
    </button>
  );

  if (action.kind === "score" && action.step === "player") {
    const ownGoal = action.scoreKind === "own_goal";
    const wantsAssist = ASSISTS.has(view.sport) && !NO_ASSIST_KINDS.has(action.scoreKind);
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">
          {SCORE_LABELS[action.scoreKind] ?? action.scoreKind} · {team}
          {ownGoal && <span className="block text-xs font-normal text-ink-muted">Pick the {team} player who scored it. The goal counts for the other team.</span>}
        </p>
        <PlayerPicker
          label={ownGoal ? "Player" : "Scorer"}
          options={roster}
          value={action.player}
          onChange={(p) => {
            const next = { ...action, player: p };
            if (wantsAssist && p) setAction({ ...next, step: "assist" });
            else finishScore(next);
          }}
          allowNone
          noneLabel="Not sure"
          onAdd={(n) => addPlayer(action.side, n)}
        />
        {cancel}
      </div>
    );
  }
  if (action.kind === "score" && action.step === "assist") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">Assist for {action.player}?</p>
        <PlayerPicker
          label="Assist"
          options={roster}
          value=""
          exclude={[action.player]}
          onChange={(p) => finishScore(action, p || undefined)}
          allowNone
          noneLabel="No assist"
          onAdd={(n) => addPlayer(action.side, n)}
        />
        {cancel}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">
        {action.kind === "card" ? `${action.colour[0].toUpperCase() + action.colour.slice(1)} card` : "Foul"} · {team}
      </p>
      <PlayerPicker
        label="Player"
        options={roster}
        value=""
        allowNone={action.kind === "foul"}
        noneLabel="Team foul"
        onChange={(p) => {
          if (action.kind === "card") {
            if (!p) return;
            send({ type: "card", side: action.side, colour: action.colour, player: p });
          } else send({ type: "foul", side: action.side, ...(p ? { player: p } : {}) });
          setAction(null);
        }}
        onAdd={(n) => addPlayer(action.side, n)}
      />
      {cancel}
    </div>
  );
}
