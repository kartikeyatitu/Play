// TRIQ Mind & Performance C1: match-day templates.
// Templates only. Anything the viewer ticks or adds lives in browser memory for the visit and is
// never saved, sent or logged.
import type { ReadingLevel } from "./types";

export interface ChecklistGroup {
  id: string;
  title: string;
  items: { id: string; label: string }[];
}

/** A starting pre-match routine. The viewer can tick, remove or add items in memory. */
export const PRE_MATCH_CHECKLIST: readonly ChecklistGroup[] = [
  {
    id: "kit",
    title: "Kit and logistics",
    items: [
      { id: "kit-packed", label: "Kit packed the night before" },
      { id: "kit-spare", label: "Spare essentials (laces, grips, strings, gum shield)" },
      { id: "kit-travel", label: "Know when and where to arrive" },
    ],
  },
  {
    id: "body",
    title: "Body",
    items: [
      { id: "body-water", label: "Water bottle filled" },
      { id: "body-food", label: "Usual pre-match food, eaten at the usual time" },
      { id: "body-warmup", label: "Planned warm-up" },
    ],
  },
  {
    id: "mind",
    title: "Mind",
    items: [
      { id: "mind-cue", label: "Choose my cue word" },
      { id: "mind-breathe", label: "Two minutes of slow breathing" },
      { id: "mind-picture", label: "Picture the first few minutes going well" },
      { id: "mind-focus", label: "Pick one thing in my control to focus on" },
    ],
  },
];

export interface BreathingPhase {
  label: "Breathe in" | "Hold" | "Breathe out";
  seconds: number;
}

export interface BreathingPattern {
  id: string;
  name: string;
  description: string;
  phases: BreathingPhase[];
  rounds: number;
}

/** Gentle, non-clinical pacing patterns. Kept short and comfortable on purpose. */
export const BREATHING_PATTERNS: readonly BreathingPattern[] = [
  {
    id: "gentle",
    name: "Gentle (good for younger athletes)",
    description: "Three counts in, four counts out.",
    phases: [
      { label: "Breathe in", seconds: 3 },
      { label: "Breathe out", seconds: 4 },
    ],
    rounds: 6,
  },
  {
    id: "long-out",
    name: "Longer breath out",
    description: "Four counts in, six counts out.",
    phases: [
      { label: "Breathe in", seconds: 4 },
      { label: "Breathe out", seconds: 6 },
    ],
    rounds: 6,
  },
  {
    id: "square",
    name: "Square breathing",
    description: "In, hold, out, hold, four counts each.",
    phases: [
      { label: "Breathe in", seconds: 4 },
      { label: "Hold", seconds: 4 },
      { label: "Breathe out", seconds: 4 },
      { label: "Hold", seconds: 4 },
    ],
    rounds: 4,
  },
];

export const BREATHING_SAFETY =
  "Breathe gently and comfortably. If you feel dizzy or uncomfortable, stop and breathe normally.";

export interface ResetCard {
  id: string;
  title: string;
  cue: string;
  exerciseId: string;
}

/** Quick cues for use during a match. Each links to the full exercise. */
export const RESET_CARDS: readonly ResetCard[] = [
  { id: "after-mistake", title: "After a mistake", cue: "Notice, brush off, breathe, next.", exerciseId: "emotion-mistake-routine" },
  { id: "between-points", title: "Between points or plays", cue: "Let go, breathe, plan, go.", exerciseId: "focus-between-points" },
  { id: "nerves-rising", title: "Nerves rising", cue: "In for four, out for six.", exerciseId: "anxiety-long-exhale" },
  { id: "losing-focus", title: "Mind wandering", cue: "Say your cue word. Eyes on the target.", exerciseId: "focus-cue-word" },
  { id: "getting-angry", title: "Getting angry", cue: "Amber? Breathe. Red? Step away at the next break.", exerciseId: "emotion-traffic-lights" },
  { id: "team-wobble", title: "Team wobbling", cue: "Huddle. One shared focus.", exerciseId: "team-shared-focus" },
];

/**
 * After-match reflection prompts. Shown as questions to think about or talk through.
 * There is deliberately no text box: nothing is typed, saved or sent.
 */
export const REFLECTION_PROMPTS: Record<ReadingLevel, string[]> = {
  guided: [
    "What was the most fun part of today?",
    "What is one thing you tried really hard at?",
    "Was there a tricky moment? What did you do?",
    "What would you like to practise next time?",
  ],
  teen: [
    "What went well today, and what helped it go well?",
    "What was the toughest moment, and how did you respond?",
    "Did your routines help? Which one would you keep?",
    "What is one thing to work on at your next session?",
    "Is there anything you want to talk about with your coach or a trusted adult?",
  ],
  adult: [
    "Which parts of my performance matched my plan, and which did not?",
    "When did my focus or emotions shift, and what triggered it?",
    "Which mental skills did I use, and how well did they work under pressure?",
    "What is the single most useful change to make before the next event?",
    "What do I need for recovery in the next day or two: rest, food, sleep, people?",
  ],
};
