"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatMark, parseMark } from "@/lib/live-match";
import type { MeasureKind } from "@/lib/scoring/performance";
import { Card, Pill, PlayerPicker, rosterFor, type PanelProps } from "./live-ui";

const PLACEHOLDER: Record<MeasureKind, string> = { time: "e.g. 12.45 or 1:03.45", distance: "metres, e.g. 6.45", height: "metres, e.g. 1.62", points: "e.g. 8.75" };

/** Athletics, swimming, skating, cycling: enter marks per athlete, live ranking, attempts. */
export function PerformancePanel({ view, scorer, send, pending, addPlayer }: PanelProps) {
  const d = view.detail.family === "performance" ? view.detail : null;
  const [athlete, setAthlete] = useState("");
  const [mark, setMark] = useState("");
  if (!d) return null;
  const measure = d.config.measure;
  const athletes = rosterFor(view, "field");
  const used = (a: string) => d.attempts.filter((x) => x.athlete === a).length;
  const open = athletes.filter((a) => used(a) < d.config.attempts);
  const ranked = d.ranked;
  const unranked = athletes.filter((a) => !ranked.some((r) => r.athlete === a));

  const submit = (status: "OK" | "DNS" | "DNF" | "DQ") => {
    if (!athlete) return toast.error("Pick the athlete");
    if (status === "OK") {
      const v = parseMark(mark, measure);
      if (v == null) return toast.error(`Enter a valid ${measure === "time" ? "time" : "mark"}`);
      send({ type: "result", athlete, value: v, status: "OK" });
    } else send({ type: "result", athlete, value: null, status });
    setMark("");
    setAthlete("");
  };

  return (
    <>
      <Card title={`${d.config.eventName} · ${measure === "time" ? "fastest first" : "best mark first"}`}>
        {ranked.length === 0 && unranked.length === 0 ? (
          <p className="text-sm text-ink-muted">No athletes yet.</p>
        ) : (
          <ol className="divide-y divide-line">
            {ranked.map((r) => (
              <li key={r.athlete} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                    r.rank === 1 ? "bg-volt text-volt-fg" : "bg-surface-2 text-ink",
                  )}
                >
                  {r.rank ?? "–"}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.athlete}</span>
                {d.config.attempts > 1 && (
                  <span className="hidden shrink-0 text-xs tabular-nums text-ink-subtle sm:inline">
                    {d.attempts
                      .filter((x) => x.athlete === r.athlete)
                      .map((x) => (x.status === "OK" ? formatMark(x.value, measure) : x.status))
                      .join(" · ")}
                  </span>
                )}
                <span className="shrink-0 text-base font-bold tabular-nums">{r.status === "OK" ? formatMark(r.best, measure) : r.status}</span>
              </li>
            ))}
            {unranked.map((a) => (
              <li key={a} className="flex items-center gap-3 py-2.5 text-ink-muted">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm">·</span>
                <span className="min-w-0 flex-1 truncate">{a}</span>
                <span className="shrink-0 text-xs">Waiting</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {scorer && (
        <Card title="Enter a result" className="mt-4">
          <div className="space-y-3">
            <PlayerPicker
              label={d.config.attempts > 1 ? `Athlete (${d.config.attempts} attempts each)` : "Athlete"}
              options={open}
              value={athlete}
              onChange={setAthlete}
              onAdd={(n) => addPlayer("field", n)}
            />
            {athlete && d.config.attempts > 1 && <p className="text-xs text-ink-muted">Attempt {used(athlete) + 1} of {d.config.attempts}</p>}
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit("OK");
              }}
            >
              <input
                value={mark}
                onChange={(e) => setMark(e.target.value)}
                inputMode="decimal"
                placeholder={PLACEHOLDER[measure]}
                aria-label={measure === "time" ? "Time" : "Mark"}
                className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-lg tabular-nums focus:border-volt focus:outline-none"
              />
              <button type="submit" disabled={pending.length > 0} className="h-12 rounded-xl bg-volt px-5 text-sm font-semibold text-volt-fg disabled:opacity-40">
                Save
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {measure !== "time" && (
                <Pill tone="warn" className="min-h-[40px] text-xs" onClick={() => submit("DQ")}>
                  Foul / no mark
                </Pill>
              )}
              {(["DNS", "DNF", "DQ"] as const).map((s) => (
                <Pill key={s} className="min-h-[40px] text-xs" onClick={() => submit(s)}>
                  {s === "DNS" ? "Did not start" : s === "DNF" ? "Did not finish" : "Disqualified"}
                </Pill>
              ))}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
