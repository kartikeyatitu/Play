/**
 * Sport-specific skill taxonomies for player evaluation.
 *
 * Each sport defines 4-6 skill dimensions that coaches rate 1-5.
 * The legacy SkillReport fields (technique, fitness, discipline) map to
 * three of these dimensions per sport; additional dimensions live in the
 * SkillReport.metrics JSON column.
 *
 * Adding a new sport: add an entry here. The EvaluateModal and
 * PlayerAnalytics components read this config at runtime — no migration needed.
 */

export interface SkillDimension {
  /** Machine key stored in the metrics JSON (lowercase, no spaces). */
  key: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** One-line helper text for coaches filling in the evaluation. */
  hint: string;
  /** Optional icon name (lucide). Falls back to a generic star. */
  icon?: string;
}

export interface SportConfig {
  /** Display name. */
  name: string;
  /** Emoji for quick visual identification. */
  emoji: string;
  /** Ordered list of skill dimensions (first 3 map to legacy technique/fitness/discipline). */
  dimensions: SkillDimension[];
}

// ─── Sport configs ──────────────────────────────────────────────────────────

const CRICKET: SportConfig = {
  name: "Cricket",
  emoji: "🏏",
  dimensions: [
    { key: "batting", label: "Batting", hint: "Shot selection, timing, footwork" },
    { key: "bowling", label: "Bowling", hint: "Accuracy, pace/spin, variation" },
    { key: "fielding", label: "Fielding", hint: "Catching, ground fielding, throwing" },
    { key: "game_awareness", label: "Game Awareness", hint: "Decision-making, situational play" },
    { key: "fitness", label: "Fitness", hint: "Endurance, speed, agility" },
    { key: "discipline", label: "Discipline", hint: "Punctuality, attitude, teamwork" },
  ],
};

const FOOTBALL: SportConfig = {
  name: "Football",
  emoji: "⚽",
  dimensions: [
    { key: "dribbling", label: "Dribbling", hint: "Ball control, close control, skill moves" },
    { key: "passing", label: "Passing", hint: "Short/long passing accuracy, vision" },
    { key: "shooting", label: "Shooting", hint: "Finishing, power, placement" },
    { key: "positioning", label: "Positioning", hint: "Off-the-ball movement, tactical awareness" },
    { key: "fitness", label: "Fitness", hint: "Stamina, speed, strength" },
    { key: "discipline", label: "Discipline", hint: "Fair play, teamwork, coachability" },
  ],
};

const BADMINTON: SportConfig = {
  name: "Badminton",
  emoji: "🏸",
  dimensions: [
    { key: "strokes", label: "Stroke Technique", hint: "Clears, drops, smashes, net play" },
    { key: "footwork", label: "Footwork", hint: "Court coverage, recovery, split step" },
    { key: "rally_craft", label: "Rally Craft", hint: "Shot selection, deception, placement" },
    { key: "serve", label: "Serve & Return", hint: "Serve consistency, return quality" },
    { key: "fitness", label: "Fitness", hint: "Endurance, agility, reflexes" },
    { key: "discipline", label: "Discipline", hint: "Mental toughness, consistency, attitude" },
  ],
};

const TENNIS: SportConfig = {
  name: "Tennis",
  emoji: "🎾",
  dimensions: [
    { key: "groundstrokes", label: "Groundstrokes", hint: "Forehand/backhand technique, consistency" },
    { key: "serve", label: "Serve", hint: "First serve %, placement, power" },
    { key: "volley", label: "Net Play", hint: "Volleys, overheads, approach shots" },
    { key: "movement", label: "Court Movement", hint: "Footwork, recovery, court coverage" },
    { key: "fitness", label: "Fitness", hint: "Endurance, speed, agility" },
    { key: "match_play", label: "Match Play", hint: "Point construction, mental toughness, strategy" },
  ],
};

const SWIMMING: SportConfig = {
  name: "Swimming",
  emoji: "🏊",
  dimensions: [
    { key: "stroke_technique", label: "Stroke Technique", hint: "Body position, arm pull, kick" },
    { key: "starts", label: "Starts & Turns", hint: "Dive entry, flip turns, push-offs" },
    { key: "endurance", label: "Endurance", hint: "Ability to maintain pace over distance" },
    { key: "speed", label: "Speed", hint: "Sprint performance, reaction time" },
    { key: "breathing", label: "Breathing", hint: "Bilateral breathing, rhythm, timing" },
    { key: "discipline", label: "Discipline", hint: "Training consistency, pool etiquette, attitude" },
  ],
};

const BASKETBALL: SportConfig = {
  name: "Basketball",
  emoji: "🏀",
  dimensions: [
    { key: "shooting", label: "Shooting", hint: "Free throws, mid-range, three-pointers" },
    { key: "ball_handling", label: "Ball Handling", hint: "Dribbling, crossovers, ball security" },
    { key: "passing", label: "Passing", hint: "Court vision, assist ability, entry passes" },
    { key: "defense", label: "Defense", hint: "On-ball defense, help defense, rebounding" },
    { key: "fitness", label: "Fitness", hint: "Conditioning, speed, vertical leap" },
    { key: "basketball_iq", label: "Basketball IQ", hint: "Court awareness, decision-making, teamwork" },
  ],
};

/** Fallback for sports without a dedicated config. */
const GENERIC: SportConfig = {
  name: "General",
  emoji: "🏅",
  dimensions: [
    { key: "technique", label: "Technique", hint: "Core skill execution and form" },
    { key: "tactical", label: "Tactical Awareness", hint: "Game sense, decision-making" },
    { key: "physical", label: "Physical Ability", hint: "Strength, speed, endurance" },
    { key: "mental", label: "Mental Strength", hint: "Focus, resilience, composure under pressure" },
    { key: "fitness", label: "Fitness", hint: "Overall conditioning and stamina" },
    { key: "discipline", label: "Discipline", hint: "Attitude, punctuality, coachability" },
  ],
};

// ─── Registry ───────────────────────────────────────────────────────────────

const SPORT_CONFIGS: Record<string, SportConfig> = {
  cricket: CRICKET,
  football: FOOTBALL,
  soccer: FOOTBALL,
  futsal: FOOTBALL,
  badminton: BADMINTON,
  tennis: TENNIS,
  "table tennis": TENNIS, // close enough
  swimming: SWIMMING,
  basketball: BASKETBALL,
};

/**
 * Get the sport-specific skill config for a batch/org sport string.
 * Falls back to GENERIC for unrecognized sports.
 */
export function getSportConfig(sport?: string | null): SportConfig {
  if (!sport) return GENERIC;
  const key = sport.toLowerCase().trim();
  // Direct match
  if (SPORT_CONFIGS[key]) return SPORT_CONFIGS[key];
  // Substring match (handles "U-14 Cricket", "Girls Football", etc.)
  for (const [slug, config] of Object.entries(SPORT_CONFIGS)) {
    if (key.includes(slug)) return config;
  }
  return GENERIC;
}

/** All registered sport configs for settings/picker UI. */
export function allSportConfigs(): { slug: string; config: SportConfig }[] {
  const seen = new Set<SportConfig>();
  const result: { slug: string; config: SportConfig }[] = [];
  for (const [slug, config] of Object.entries(SPORT_CONFIGS)) {
    if (!seen.has(config)) {
      seen.add(config);
      result.push({ slug, config });
    }
  }
  return result;
}

/**
 * Convert sport-specific metrics JSON + legacy fields into a unified
 * array of { key, label, value } for display.
 *
 * Priority: metrics JSON values > legacy technique/fitness/discipline fields.
 */
export function unifyMetrics(
  sport: string | null | undefined,
  legacy: { technique: number; fitness: number; discipline: number },
  metrics?: Record<string, number> | null
): { key: string; label: string; value: number; hint: string }[] {
  const config = getSportConfig(sport);
  const merged = metrics ? { ...metrics } : {};

  // Map legacy fields as fallback for first 3 dimensions
  const legacyMap: Record<number, number> = {
    0: legacy.technique,
    1: legacy.fitness,
    2: legacy.discipline,
  };

  return config.dimensions.map((dim, idx) => ({
    key: dim.key,
    label: dim.label,
    hint: dim.hint,
    value: merged[dim.key] ?? (idx < 3 ? legacyMap[idx] ?? 3 : 3),
  }));
}
