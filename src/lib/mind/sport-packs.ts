// TRIQ Mind & Performance C1: sport packs.
// Packs are configuration: each one maps sport situations to exercises in the shared library.
// There is no per-sport logic; adding a sport means adding a template here.
// Each pack must be reviewed by a qualified sports psychologist before launch.
import type { Moment } from "./types";

export interface SportSituation {
  id: string;
  title: string;
  moment: Moment;
  /** A short cue the athlete can carry into the moment. */
  cue: string;
  /** Exercise ids from src/lib/mind/content.ts, in suggested order. */
  exerciseIds: string[];
}

export interface SportPack {
  id: string;
  name: string;
  /** Sports this template is meant to cover. */
  covers: string[];
  intro: string;
  situations: SportSituation[];
  /** Pack-specific safety notes shown prominently. */
  notes?: string[];
}

export const SPORT_PACKS: readonly SportPack[] = [
  {
    id: "racket",
    name: "Badminton and racket sports",
    covers: ["Badminton", "Tennis", "Table tennis", "Squash", "Pickleball"],
    intro: "Racket sports are full of short gaps between points. What you do in those gaps shapes the next rally.",
    situations: [
      { id: "match-point", title: "Match point, for or against", moment: "during", cue: "Same routine, one shot at a time.", exerciseIds: ["focus-between-points", "anxiety-long-exhale", "focus-cue-word"] },
      { id: "unforced-error", title: "After an unforced error", moment: "during", cue: "Brush it off. Next rally.", exerciseIds: ["emotion-mistake-routine", "confidence-coach-voice"] },
      { id: "between-rallies", title: "Staying focused between rallies", moment: "during", cue: "Let go, breathe, plan, go.", exerciseIds: ["focus-between-points", "focus-park-it"] },
      { id: "close-game", title: "Confidence in a close game", moment: "during", cue: "Play your shots, not the score.", exerciseIds: ["confidence-preparation-proof", "focus-cue-word"] },
      { id: "lost-a-game", title: "Recovering after losing a game", moment: "during", cue: "New game, fresh start.", exerciseIds: ["emotion-traffic-lights", "anxiety-control-circle", "focus-between-points"] },
      { id: "momentum", title: "When momentum swings against you", moment: "during", cue: "Slow down your routine.", exerciseIds: ["anxiety-long-exhale", "emotion-traffic-lights"] },
    ],
  },
  {
    id: "cricket",
    name: "Cricket",
    covers: ["Cricket"],
    intro: "Cricket asks for long stretches of attention with short bursts of pressure. Switching focus on and off matters.",
    situations: [
      { id: "batting-pressure", title: "Batting under pressure", moment: "during", cue: "Watch the ball out of the hand.", exerciseIds: ["focus-cue-word", "anxiety-long-exhale", "focus-wide-to-narrow"] },
      { id: "bowling-pressure", title: "Bowling after being hit for runs", moment: "during", cue: "Walk back, reset, hit your area.", exerciseIds: ["emotion-mistake-routine", "focus-between-points"] },
      { id: "fielding-focus", title: "Concentration in the field", moment: "during", cue: "Switch on as the bowler runs in.", exerciseIds: ["focus-wide-to-narrow", "focus-park-it"] },
      { id: "decisions", title: "Clear decisions in tight moments", moment: "during", cue: "Plan, commit, no second-guessing.", exerciseIds: ["anxiety-control-circle", "focus-between-points"] },
      { id: "long-format", title: "Long-format endurance", moment: "training", cue: "One session at a time.", exerciseIds: ["motivation-process-goals", "focus-park-it"] },
      { id: "after-dismissal", title: "After getting out", moment: "after", cue: "Cool down first, review later.", exerciseIds: ["emotion-cool-down-gap", "resilience-three-questions"] },
    ],
  },
  {
    id: "football",
    name: "Football",
    covers: ["Football", "Futsal", "Hockey"],
    intro: "Football moves fast and depends on team-mates. Communication and quick recovery from mistakes are key.",
    situations: [
      { id: "after-mistake", title: "Confidence after a mistake", moment: "during", cue: "Next action. Get back in the game.", exerciseIds: ["emotion-mistake-routine", "confidence-coach-voice"] },
      { id: "team-talk", title: "Team communication", moment: "during", cue: "Name, action, early.", exerciseIds: ["team-clear-calls", "team-shared-focus"] },
      { id: "penalty", title: "Taking a penalty", moment: "during", cue: "Pick your spot, trust it.", exerciseIds: ["anxiety-long-exhale", "focus-wide-to-narrow", "focus-cue-word"] },
      { id: "match-pressure", title: "Big-match pressure", moment: "pre-match", cue: "Nerves mean you are ready.", exerciseIds: ["anxiety-ready-energy", "confidence-picture-it"] },
      { id: "leading-when-behind", title: "Leading when the team is behind", moment: "during", cue: "Calm voice, one clear job.", exerciseIds: ["team-clear-calls", "anxiety-control-circle"] },
    ],
  },
  {
    id: "basketball",
    name: "Basketball",
    covers: ["Basketball", "Netball", "Volleyball"],
    intro: "Basketball swings quickly. Short routines and team confidence help you ride the runs.",
    situations: [
      { id: "free-throw", title: "Free-throw pressure", moment: "during", cue: "Same routine every time.", exerciseIds: ["focus-between-points", "anxiety-long-exhale", "focus-cue-word"] },
      { id: "after-turnover", title: "After a turnover", moment: "during", cue: "Sprint back, next play.", exerciseIds: ["emotion-mistake-routine"] },
      { id: "opponent-run", title: "When the other team goes on a run", moment: "during", cue: "Huddle, breathe, one focus.", exerciseIds: ["team-shared-focus", "anxiety-long-exhale", "emotion-traffic-lights"] },
      { id: "decisions", title: "Decision-making at speed", moment: "training", cue: "Eyes up, see the floor.", exerciseIds: ["focus-wide-to-narrow"] },
      { id: "team-confidence", title: "Team confidence", moment: "after", cue: "Two good, one help.", exerciseIds: ["team-two-and-one", "confidence-strengths-spotlight"] },
    ],
  },
  {
    id: "athletics",
    name: "Athletics",
    covers: ["Running", "Sprints", "Jumps", "Throws", "Swimming"],
    intro: "In athletics you often wait a long time for a short effort. Managing that wait is a skill.",
    situations: [
      { id: "pre-race-nerves", title: "Pre-race nerves", moment: "pre-match", cue: "This is ready energy.", exerciseIds: ["anxiety-ready-energy", "anxiety-long-exhale", "anxiety-release-scan"] },
      { id: "call-room", title: "Waiting in the call room", moment: "pre-match", cue: "Stay in your own lane.", exerciseIds: ["focus-park-it", "confidence-picture-it"] },
      { id: "self-belief", title: "Self-belief on the start line", moment: "pre-match", cue: "I have done the work.", exerciseIds: ["confidence-preparation-proof", "focus-cue-word"] },
      { id: "own-race", title: "Focusing on your own performance", moment: "during", cue: "Your technique, your rhythm.", exerciseIds: ["focus-cue-word", "anxiety-control-circle"] },
      { id: "disappointing-result", title: "After a disappointing result", moment: "after", cue: "One result is information, not a verdict.", exerciseIds: ["emotion-cool-down-gap", "resilience-three-questions", "resilience-comeback-memory"] },
    ],
  },
  {
    id: "combat",
    name: "Combat sports",
    covers: ["Boxing", "Wrestling", "Judo", "Taekwondo", "Karate", "Mixed martial arts"],
    intro: "Combat sports bring strong emotions close to the surface. Calm preparation and controlled aggression matter.",
    notes: [
      "Weight management must only be planned and supervised by qualified professionals such as a registered dietitian and a doctor. TRIQ gives no weight or diet advice.",
    ],
    situations: [
      { id: "pre-bout", title: "Before the bout", moment: "pre-match", cue: "Breathe low, plan simple.", exerciseIds: ["anxiety-long-exhale", "anxiety-ready-energy", "confidence-picture-it"] },
      { id: "between-rounds", title: "Between rounds", moment: "during", cue: "Breathe, listen, one instruction.", exerciseIds: ["focus-between-points", "anxiety-long-exhale"] },
      { id: "provocation", title: "Staying in control when provoked", moment: "during", cue: "Cool head, sharp plan.", exerciseIds: ["emotion-traffic-lights", "emotion-mistake-routine"] },
      { id: "confidence", title: "Confidence going in", moment: "pre-match", cue: "I am prepared for this.", exerciseIds: ["confidence-preparation-proof", "confidence-coach-voice"] },
      { id: "after-competition", title: "Recovering after competition", moment: "after", cue: "Rest first, review later.", exerciseIds: ["emotion-cool-down-gap", "resilience-three-questions"] },
    ],
  },
];

export function getSportPack(id: string): SportPack | undefined {
  return SPORT_PACKS.find((p) => p.id === id);
}
