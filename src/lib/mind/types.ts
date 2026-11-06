// TRIQ Mind & Performance, release C1: content only.
// Nothing in src/lib/mind holds, reads or writes personal data. See docs/TRIQ_MIND_AND_PERFORMANCE.md.

/** Reading levels. Chosen by the viewer on screen; no age is ever asked for or stored. */
export type ReadingLevel = "guided" | "teen" | "adult";

export const READING_LEVELS: readonly { id: ReadingLevel; label: string; hint: string }[] = [
  { id: "guided", label: "Under 13, with a grown-up", hint: "Short and simple, for a parent or coach to read with a young athlete." },
  { id: "teen", label: "13 to 17", hint: "Written for teenage athletes." },
  { id: "adult", label: "18 and over", hint: "Full detail for adult athletes." },
] as const;

export const READING_LEVEL_IDS: readonly ReadingLevel[] = READING_LEVELS.map((l) => l.id);

/** When an exercise is meant to be used. */
export type Moment = "training" | "pre-match" | "during" | "after";

export const MOMENT_LABELS: Record<Moment, string> = {
  training: "Training",
  "pre-match": "Before a match",
  during: "During a match",
  after: "After a match",
};

export type SkillId =
  | "focus"
  | "confidence"
  | "competitive-anxiety"
  | "emotional-regulation"
  | "resilience"
  | "motivation"
  | "team";

export interface LevelText {
  /** One or two sentences that set the exercise up. */
  intro: string;
  /** Ordered steps. Every level of one exercise has the same number of steps. */
  steps: string[];
  /** Optional extra tip (for the guided level, a note to the grown-up). */
  tip?: string;
}

export interface Exercise {
  id: string;
  skill: SkillId;
  title: string;
  /** One-line plain summary shown on cards. */
  summary: string;
  /** Rough time to do it once, in minutes. Can be a fraction for quick resets. */
  minutes: number;
  when: Moment[];
  levels: Record<ReadingLevel, LevelText>;
}

export interface Skill {
  id: SkillId;
  title: string;
  tagline: string;
  about: string;
  exercises: Exercise[];
}
