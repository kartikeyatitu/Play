// Pure timing logic for the breathing pacer. One call = one second.
import type { BreathingPattern } from "./match-day";

export interface PacerState {
  running: boolean;
  finished: boolean;
  phase: number;
  left: number;
  round: number;
}

export function startPacer(pattern: BreathingPattern): PacerState {
  return { running: true, finished: false, phase: 0, left: pattern.phases[0].seconds, round: 1 };
}

export function idlePacer(pattern: BreathingPattern, finished = false): PacerState {
  return { running: false, finished, phase: 0, left: pattern.phases[0].seconds, round: 1 };
}

export function tickPacer(state: PacerState, pattern: BreathingPattern): PacerState {
  if (!state.running) return state;
  if (state.left > 1) return { ...state, left: state.left - 1 };
  const next = state.phase + 1;
  if (next < pattern.phases.length) return { ...state, phase: next, left: pattern.phases[next].seconds };
  if (state.round >= pattern.rounds) return idlePacer(pattern, true);
  return { ...state, phase: 0, left: pattern.phases[0].seconds, round: state.round + 1 };
}

/** Circle scale for a phase. A hold keeps the size of the phase before it. */
export function pacerScale(pattern: BreathingPattern, index: number): number {
  for (let i = index; i >= 0; i--) {
    const label = pattern.phases[i].label;
    if (label === "Breathe in") return 1;
    if (label === "Breathe out") return 0.55;
  }
  return 0.55;
}
