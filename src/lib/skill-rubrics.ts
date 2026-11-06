// Sport skill rubrics for coach assessments. Pure and client-safe: no DB or server-only imports.
//
// Each rubric has 5–8 skills scored 1–5. Every skill belongs to one legacy "area" (technique, fitness
// or discipline) so a rubric assessment can still fill SkillReport.technique/fitness/discipline with
// area averages for older screens. Where src/lib/sport-metrics.ts already has a key for the same skill
// (e.g. cricket "batting"), the rubric reuses it so existing parent and passport views keep showing it.

export type RubricId =
  | "cricket"
  | "football"
  | "badminton"
  | "tennis"
  | "table_tennis"
  | "basketball"
  | "swimming"
  | "athletics"
  | "hockey"
  | "kabaddi"
  | "karate"
  | "chess"
  | "generic";

/** Which legacy SkillReport column a skill feeds. */
export type SkillArea = "technique" | "fitness" | "discipline";

export interface RubricSkill {
  /** Key stored in SkillReport.metrics (lowercase snake case). */
  key: string;
  label: string;
  area: SkillArea;
  /** What the coach watches for. */
  look: string;
  /** What a 1 looks like. */
  low: string;
  /** What a 5 looks like. */
  high: string;
}

export interface SportRubric {
  id: RubricId;
  label: string;
  skills: RubricSkill[];
}

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

/** The shared 1–5 scale. */
export const SCALE: { score: number; label: string; descriptor: string }[] = [
  { score: 1, label: "Beginning", descriptor: "Needs constant help; rarely shows the skill" },
  { score: 2, label: "Developing", descriptor: "Shows it with help or in easy drills" },
  { score: 3, label: "Competent", descriptor: "Reliable in drills, patchy under pressure" },
  { score: 4, label: "Strong", descriptor: "Reliable in games most of the time" },
  { score: 5, label: "Excellent", descriptor: "Consistent in matches; a model for others" },
];

const s = (key: string, label: string, area: SkillArea, look: string, low: string, high: string): RubricSkill => ({
  key,
  label,
  area,
  look,
  low,
  high,
});

const COMMITMENT = s(
  "discipline",
  "Discipline",
  "discipline",
  "Punctuality, attitude, listening, effort",
  "Often late or distracted",
  "Always ready, coachable, lifts others",
);

export const RUBRICS: Record<RubricId, SportRubric> = {
  cricket: {
    id: "cricket",
    label: "Cricket",
    skills: [
      s("batting", "Batting", "technique", "Stance, footwork, shot selection, timing", "Swings across the line, feet stuck", "Picks length early, scores all round"),
      s("bowling", "Bowling", "technique", "Run-up, action, line and length", "Action breaks down, sprays the ball", "Hits a length on demand, has variations"),
      s("fielding", "Fielding", "technique", "Catching, ground fielding, throwing", "Drops simple catches, slow to the ball", "Safe hands, attacks the ball, accurate throws"),
      s("wicket_keeping", "Keeping / running", "technique", "Glove work or running between wickets", "Fumbles takes, poor calling", "Clean takes, sharp calls and turns"),
      s("game_awareness", "Game awareness", "discipline", "Reads match situations, field placements", "Plays every ball the same", "Adapts to score, pitch and bowler"),
      s("fitness", "Fitness", "fitness", "Speed, endurance, agility", "Tires within a few overs", "Sharp through a full innings"),
      COMMITMENT,
    ],
  },
  football: {
    id: "football",
    label: "Football",
    skills: [
      s("dribbling", "Dribbling", "technique", "Close control, both feet, change of pace", "Loses the ball under light pressure", "Beats players with control at speed"),
      s("passing", "Passing", "technique", "Accuracy, weight, vision", "Passes go astray or behind", "Weighted, accurate, sees the forward pass"),
      s("shooting", "Shooting", "technique", "Technique, placement, composure", "Rarely on target", "Picks corners with either foot"),
      s("first_touch", "First touch", "technique", "Receiving, body shape", "Ball bounces off", "Sets up next action with first touch"),
      s("positioning", "Positioning", "discipline", "Off-ball movement, shape, pressing", "Ball-watches, out of shape", "Finds space and holds team shape"),
      s("fitness", "Fitness", "fitness", "Stamina, speed, strength", "Fades early in the session", "High intensity for the full match"),
      COMMITMENT,
    ],
  },
  badminton: {
    id: "badminton",
    label: "Badminton",
    skills: [
      s("grip", "Grip & racket skills", "technique", "Forehand/backhand grip changes", "One grip for every shot", "Quick, relaxed grip changes"),
      s("strokes", "Stroke technique", "technique", "Clears, drops, smashes, net play", "Short clears, flat smashes", "Full range with control and power"),
      s("serve", "Serve & return", "technique", "Low/high serve, return quality", "Serves faulted or lifted", "Tight serve, attacking return"),
      s("footwork", "Footwork", "fitness", "Split step, court coverage, recovery", "Flat-footed, late to corners", "Reaches all corners and recovers to base"),
      s("rally_craft", "Rally craft", "discipline", "Shot selection, deception, placement", "Hits to the middle", "Builds rallies and creates openings"),
      s("fitness", "Fitness", "fitness", "Endurance, agility, reflexes", "Breathless after long rallies", "Holds pace for three games"),
      COMMITMENT,
    ],
  },
  tennis: {
    id: "tennis",
    label: "Tennis",
    skills: [
      s("groundstrokes", "Groundstrokes", "technique", "Forehand/backhand technique, depth", "Mostly in the net or long", "Deep, consistent, directs the ball"),
      s("serve", "Serve", "technique", "Toss, motion, placement", "Double-faults often", "Reliable first serve with placement"),
      s("volley", "Net play", "technique", "Volleys, overheads, approach", "Avoids the net", "Finishes points at the net"),
      s("movement", "Court movement", "fitness", "Split step, recovery, balance", "Late to the ball, off balance", "Arrives early and recovers fast"),
      s("match_play", "Match play", "discipline", "Point construction, composure", "Gives up after errors", "Plans points and stays calm"),
      s("fitness", "Fitness", "fitness", "Endurance, speed, agility", "Drops off after one set", "Strong deep into matches"),
      COMMITMENT,
    ],
  },
  table_tennis: {
    id: "table_tennis",
    label: "Table tennis",
    skills: [
      s("forehand", "Forehand", "technique", "Drive, loop, consistency", "Misses simple forehands", "Loops with spin and placement"),
      s("backhand", "Backhand", "technique", "Push, block, flick", "Avoids the backhand", "Attacks and defends on the backhand"),
      s("serve", "Serve", "technique", "Legal toss, spin variation, length", "Serves faulted or easy to read", "Varied spin, short and long"),
      s("receive", "Receive", "technique", "Reading spin, returning serves", "Misreads most serves", "Reads spin, returns with intent"),
      s("footwork", "Footwork", "fitness", "Stance, side-to-side movement", "Reaches with the arm only", "Moves feet into every shot"),
      s("tactics", "Tactics", "discipline", "Placement, variation, game plan", "Same shot every time", "Changes plan to beat the opponent"),
      COMMITMENT,
    ],
  },
  basketball: {
    id: "basketball",
    label: "Basketball",
    skills: [
      s("shooting", "Shooting", "technique", "Form, free throws, range", "Inconsistent form, short shots", "Smooth form, reliable from range"),
      s("ball_handling", "Ball handling", "technique", "Both hands, protection, change of pace", "Watches the ball, loses it", "Head up, protects the ball, both hands"),
      s("passing", "Passing", "technique", "Vision, chest/bounce/entry passes", "Telegraphed passes", "Finds the open player on time"),
      s("defense", "Defense", "discipline", "Stance, help defense, rebounding", "Beaten off the dribble", "Stays in front, helps, boxes out"),
      s("basketball_iq", "Basketball IQ", "discipline", "Spacing, decisions, teamwork", "Stands still, forces shots", "Moves without the ball, right decisions"),
      s("fitness", "Fitness", "fitness", "Conditioning, speed, vertical", "Walks back on defense", "Runs the floor all game"),
      COMMITMENT,
    ],
  },
  swimming: {
    id: "swimming",
    label: "Swimming",
    skills: [
      s("stroke_technique", "Stroke technique", "technique", "Body position, catch, pull, kick", "Head up, legs sinking", "Long, balanced, efficient stroke"),
      s("breathing", "Breathing", "technique", "Rhythm, bilateral breathing", "Lifts head, breath-holds", "Smooth bilateral rhythm"),
      s("starts", "Starts & turns", "technique", "Dive entry, turns, push-offs", "Belly-flop starts, open turns", "Clean entries and tight turns"),
      s("water_safety", "Water confidence", "discipline", "Comfort in deep water, floating", "Anxious away from the wall", "Relaxed in deep water"),
      s("endurance", "Endurance", "fitness", "Holding pace over distance", "Stops every length", "Holds pace over long sets"),
      s("speed", "Speed", "fitness", "Sprint pace, reaction", "Slow off the wall", "Fast sprint and reaction"),
      COMMITMENT,
    ],
  },
  athletics: {
    id: "athletics",
    label: "Athletics",
    skills: [
      s("running_form", "Running form", "technique", "Posture, arm drive, foot strike", "Upright, arms across body", "Tall, relaxed, efficient stride"),
      s("starts", "Starts", "technique", "Set position, reaction, drive phase", "Stands up early", "Explosive, low drive phase"),
      s("event_technique", "Event technique", "technique", "Jump/throw/hurdle technique for their event", "Basic movement pattern only", "Consistent technique under competition"),
      s("speed", "Speed", "fitness", "Acceleration and top speed", "Slow to accelerate", "Quick acceleration, holds top speed"),
      s("endurance", "Endurance", "fitness", "Pacing and stamina", "Goes out too fast, fades", "Even pacing, strong finish"),
      s("strength", "Strength & mobility", "fitness", "Core, power, flexibility", "Weak core, tight hips", "Strong, mobile, powerful"),
      COMMITMENT,
    ],
  },
  hockey: {
    id: "hockey",
    label: "Hockey",
    skills: [
      s("stick_work", "Stick work", "technique", "Grip, dribbling, Indian dribble", "Ball runs away from the stick", "Tight control at speed"),
      s("passing", "Passing & receiving", "technique", "Push, hit, slap, trapping", "Passes go astray, poor trap", "Accurate passes, clean reception"),
      s("shooting", "Shooting", "technique", "Hit, flick, deflections in the D", "Weak or wide shots", "Accurate, varied finishing"),
      s("tackling", "Tackling", "technique", "Channelling, jab, block tackle", "Lunges and fouls", "Patient, clean tackles"),
      s("positioning", "Positioning", "discipline", "Structure, marking, leads", "Bunches around the ball", "Holds structure, makes leads"),
      s("fitness", "Fitness", "fitness", "Speed, stamina, low body position", "Stands upright, tires", "Low and quick all match"),
      COMMITMENT,
    ],
  },
  kabaddi: {
    id: "kabaddi",
    label: "Kabaddi",
    skills: [
      s("raiding", "Raiding", "technique", "Entry, toe touch, hand touch, escape", "Caught easily, no plan", "Varied raids, scores and escapes"),
      s("tackling", "Tackling", "technique", "Ankle hold, thigh hold, block", "Mistimed tackles", "Clean, well-timed holds"),
      s("chain_play", "Chain & cover", "discipline", "Coordination with teammates", "Breaks the chain", "Moves as one with the chain"),
      s("cant", "Cant & breath control", "fitness", "Continuous chant, breath management", "Loses cant mid-raid", "Steady cant through long raids"),
      s("agility", "Agility", "fitness", "Footwork, dodges, balance", "Slow to change direction", "Sharp dodges and recovery"),
      s("strength", "Strength", "fitness", "Grip and core strength", "Easily pushed off", "Strong holds and stable base"),
      COMMITMENT,
    ],
  },
  karate: {
    id: "karate",
    label: "Karate",
    skills: [
      s("stances", "Stances", "technique", "Zenkutsu, kokutsu, kiba dachi", "Unstable, wrong weight", "Low, stable, correct weight"),
      s("strikes", "Strikes & blocks", "technique", "Punches, blocks, hikite", "Loose, no hip rotation", "Sharp, with hip and focus"),
      s("kicks", "Kicks", "technique", "Mae, mawashi, yoko geri", "Low, off balance", "High, controlled, retracted"),
      s("kata", "Kata", "technique", "Sequence, rhythm, kime", "Forgets sequence", "Precise with rhythm and power"),
      s("kumite", "Kumite", "discipline", "Distance, timing, control", "Rushes in or freezes", "Controls distance and timing"),
      s("fitness", "Fitness & flexibility", "fitness", "Stamina, flexibility, explosiveness", "Stiff and tires fast", "Flexible, explosive, lasts"),
      s("discipline", "Discipline & etiquette", "discipline", "Dojo etiquette, focus, respect", "Ignores etiquette", "Exemplary focus and respect"),
    ],
  },
  chess: {
    id: "chess",
    label: "Chess",
    skills: [
      s("openings", "Openings", "technique", "Principles, development, repertoire", "Moves the same piece twice", "Sound repertoire with ideas"),
      s("tactics", "Tactics", "technique", "Forks, pins, combinations", "Misses one-move threats", "Spots multi-move combinations"),
      s("strategy", "Strategy", "technique", "Plans, pawn structure, piece activity", "No plan after the opening", "Forms and follows plans"),
      s("endgames", "Endgames", "technique", "Basic mates, king activity, pawn endings", "Cannot mate with K+Q", "Converts technical endgames"),
      s("calculation", "Calculation", "fitness", "Depth and accuracy of lines", "Moves on impulse", "Calculates forcing lines accurately"),
      s("time_management", "Time management", "discipline", "Clock use, avoids time trouble", "Often flags or rushes", "Spends time where it matters"),
      s("discipline", "Discipline", "discipline", "Focus, sportsmanship, game review", "Distracted, skips review", "Focused, reviews every game"),
    ],
  },
  generic: {
    id: "generic",
    label: "General",
    skills: [
      s("technique", "Technique", "technique", "Core skill execution and form", "Basic form breaks down", "Clean form under pressure"),
      s("tactical", "Tactical awareness", "technique", "Game sense, decision-making", "Same choice every time", "Reads play and adapts"),
      s("physical", "Physical ability", "fitness", "Strength, speed, coordination", "Struggles with basic movement", "Strong, fast, coordinated"),
      s("fitness", "Fitness", "fitness", "Conditioning and stamina", "Tires early", "Lasts the whole session"),
      s("mental", "Mental strength", "discipline", "Focus, resilience, composure", "Gives up after mistakes", "Calm and resilient"),
      COMMITMENT,
    ],
  },
};

export const RUBRIC_IDS = Object.keys(RUBRICS) as RubricId[];

// Longest aliases first so "table tennis" wins over "tennis" and "field hockey" over "hockey".
const ALIASES: [string, RubricId][] = (
  [
    ["table tennis", "table_tennis"],
    ["table-tennis", "table_tennis"],
    ["table_tennis", "table_tennis"],
    ["ping pong", "table_tennis"],
    ["tabletennis", "table_tennis"],
    ["field hockey", "hockey"],
    ["track and field", "athletics"],
    ["track & field", "athletics"],
    ["cricket", "cricket"],
    ["football", "football"],
    ["soccer", "football"],
    ["futsal", "football"],
    ["badminton", "badminton"],
    ["tennis", "tennis"],
    ["basketball", "basketball"],
    ["swimming", "swimming"],
    ["swim", "swimming"],
    ["athletics", "athletics"],
    ["running", "athletics"],
    ["sprint", "athletics"],
    ["hockey", "hockey"],
    ["kabaddi", "kabaddi"],
    ["karate", "karate"],
    ["chess", "chess"],
    ["tt", "table_tennis"],
  ] as [string, RubricId][]
).sort((a, b) => b[0].length - a[0].length);

/** Rubric id for a free-text sport ("U-14 Cricket", "Table Tennis", "soccer"); "generic" when unknown. */
export function rubricIdFor(sport: string | null | undefined): RubricId {
  const text = (sport ?? "").toLowerCase().trim();
  if (!text) return "generic";
  if ((RUBRIC_IDS as string[]).includes(text)) return text as RubricId;
  const words = ` ${text.replace(/[^a-z&_-]+/g, " ")} `;
  for (const [alias, id] of ALIASES) {
    // Whole-word match so "tt" doesn't match inside other words.
    if (words.includes(` ${alias} `)) return id;
  }
  for (const [alias, id] of ALIASES) {
    if (alias.length > 3 && text.includes(alias)) return id;
  }
  return "generic";
}

export function getRubric(sport: string | null | undefined): SportRubric {
  return RUBRICS[rubricIdFor(sport)];
}

export function scaleFor(score: number) {
  return SCALE.find((x) => x.score === score) ?? null;
}

export type RubricScores = Record<string, number>;

/** True for an integer 1–5. */
export function isValidScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= MIN_SCORE && v <= MAX_SCORE;
}

/**
 * Keep only valid scores for this rubric's skills. Returns `missing` for skills without a score and
 * `unknown` for keys the rubric doesn't have.
 */
export function cleanScores(rubric: SportRubric, input: Record<string, unknown> | null | undefined) {
  const scores: RubricScores = {};
  const missing: string[] = [];
  const keys = new Set(rubric.skills.map((k) => k.key));
  for (const skill of rubric.skills) {
    const v = input?.[skill.key];
    if (isValidScore(v)) scores[skill.key] = v;
    else missing.push(skill.key);
  }
  const unknown = Object.keys(input ?? {}).filter((k) => !keys.has(k));
  return { scores, missing, unknown };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Mean of the given scores rounded to one decimal, or null when there are none. */
export function averageScore(scores: RubricScores): number | null {
  const a = avg(Object.values(scores).filter((v) => typeof v === "number" && Number.isFinite(v)));
  return a == null ? null : Math.round(a * 10) / 10;
}

/**
 * Legacy SkillReport columns from rubric scores: the rounded average of each area's skills, falling
 * back to the overall average (then 3) when an area has no scores. Always an integer 1–5.
 */
export function legacyFromScores(rubric: SportRubric, scores: RubricScores): { technique: number; fitness: number; discipline: number } {
  const all = avg(rubric.skills.map((k) => scores[k.key]).filter(isValidScore));
  const area = (a: SkillArea) => {
    const v = avg(rubric.skills.filter((k) => k.area === a).map((k) => scores[k.key]).filter(isValidScore)) ?? all ?? 3;
    return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(v)));
  };
  return { technique: area("technique"), fitness: area("fitness"), discipline: area("discipline") };
}
