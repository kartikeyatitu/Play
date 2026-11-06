"use client";

// Guided breathing pacer. Runs only in the browser for this visit. Nothing is recorded.
// Respects prefers-reduced-motion: the circle does not grow or shrink; a text count is shown instead.
import { useEffect, useState, useSyncExternalStore } from "react";
import { BREATHING_PATTERNS, BREATHING_SAFETY } from "@/lib/mind/match-day";
import { idlePacer, pacerScale, startPacer, tickPacer } from "@/lib/mind/pacer";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(QUERY).matches : false),
    () => true, // server render: assume reduced motion so nothing animates before hydration
  );
}

export function BreathingPacer({ defaultPatternId = "long-out" }: { defaultPatternId?: string }) {
  const reduced = useReducedMotion();
  const [patternId, setPatternId] = useState(defaultPatternId);
  const pattern = BREATHING_PATTERNS.find((p) => p.id === patternId) ?? BREATHING_PATTERNS[0];
  const [state, setState] = useState(() => idlePacer(pattern));

  useEffect(() => {
    if (!state.running) return;
    const t = setInterval(() => setState((s) => tickPacer(s, pattern)), 1000);
    return () => clearInterval(t);
  }, [state.running, pattern]);

  const current = pattern.phases[state.phase];
  const scale = state.running ? pacerScale(pattern, state.phase) : 0.55;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <label className="block text-sm font-medium text-ink" htmlFor="breathing-pattern">
        Pattern
      </label>
      <select
        id="breathing-pattern"
        value={patternId}
        disabled={state.running}
        onChange={(e) => {
          const next = BREATHING_PATTERNS.find((p) => p.id === e.target.value) ?? BREATHING_PATTERNS[0];
          setPatternId(next.id);
          setState(idlePacer(next));
        }}
        className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink disabled:opacity-60"
      >
        {BREATHING_PATTERNS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-ink-subtle">
        {pattern.description} {pattern.rounds} rounds.
      </p>

      <div className="mt-4 flex flex-col items-center">
        <div className="relative flex h-48 w-48 items-center justify-center" aria-hidden="true">
          {reduced ? (
            <div className="absolute inset-4 rounded-full border-2 border-volt/50" />
          ) : (
            <div
              className="absolute inset-0 rounded-full bg-volt/20 ring-2 ring-volt/50"
              style={{
                transform: `scale(${scale})`,
                transitionProperty: "transform",
                transitionTimingFunction: "ease-in-out",
                transitionDuration: state.running ? `${current.seconds}s` : "300ms",
              }}
            />
          )}
          <span className="relative text-4xl font-semibold tabular-nums text-ink">{state.running ? state.left : "–"}</span>
        </div>

        <p className="mt-3 min-h-7 text-lg font-medium text-ink" aria-live="polite" aria-atomic="true">
          {state.running ? current.label : state.finished ? "Finished. Breathe normally." : "Press start when you are ready."}
        </p>
        {state.running ? (
          <p className="text-xs text-ink-subtle">
            Round {state.round} of {pattern.rounds}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          {state.running ? (
            <button type="button" onClick={() => setState(idlePacer(pattern))} className="min-h-11 rounded-lg border border-line px-5 text-sm font-medium text-ink">
              Stop
            </button>
          ) : (
            <button type="button" onClick={() => setState(startPacer(pattern))} className="min-h-11 rounded-lg bg-volt px-5 text-sm font-semibold text-volt-fg">
              Start
            </button>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-subtle">{BREATHING_SAFETY}</p>
    </div>
  );
}
