/**
 * TRIQ Body: standard fitness test catalogue and pure helpers (no database, no React).
 *
 * Safety rules (TRIQ blueprint):
 * - A result is only ever compared with results of the SAME test, the SAME protocol version and the
 *   SAME age band. Different age groups, disciplines or protocols are never ranked together.
 * - These are physical performance measures, not medical assessments. Nothing here diagnoses anything.
 */

export type BetterDirection = "lower" | "higher";
export type FitnessUnit = "s" | "cm" | "level" | "reps";

export type FitnessTest = {
  key: string;
  name: string;
  /** What the test mainly looks at, in plain words. */
  measures: string;
  unit: FitnessUnit;
  better: BetterDirection;
  /** Protocol version. Results recorded under a different protocol are never compared. */
  protocol: string;
  /** Youngest age (years) the test is suggested for; younger athletes can do it as play, unscored. */
  minAge: number;
  ageNotes: string;
  /** Step-by-step protocol, in TRIQ's own words. */
  protocolSteps: string[];
  equipment: string[];
  /** Plausible bounds used to catch typing mistakes (inclusive). */
  min: number;
  max: number;
  /** Decimal places shown. */
  decimals: number;
};

export const FITNESS_TESTS: readonly FitnessTest[] = [
  {
    key: "sprint_30m",
    name: "30 m sprint",
    measures: "Acceleration and straight-line speed",
    unit: "s",
    better: "lower",
    protocol: "v1",
    minAge: 7,
    ageNotes: "Fine from about 7 years. Keep it to two or three timed runs for young children, with full rest between.",
    protocolSteps: [
      "Mark a start line and a finish line 30 m apart on a flat, non-slip surface, with 10 m of run-out after the finish.",
      "Athlete starts still, one foot just behind the line, in a standing split stance.",
      "Timing starts on the athlete's first movement and stops when the chest crosses the finish line.",
      "Two runs with at least two minutes of walking rest. Record the faster time in seconds.",
    ],
    equipment: ["Measuring tape", "Cones", "Stopwatch or timing gates"],
    min: 3,
    max: 15,
    decimals: 2,
  },
  {
    key: "shuttle_5105",
    name: "5-10-5 shuttle",
    measures: "Change of direction and body control",
    unit: "s",
    better: "lower",
    protocol: "v1",
    minAge: 8,
    ageNotes: "Suits 8 years and up. Walk the route first so younger athletes know where to turn.",
    protocolSteps: [
      "Place three cones in a line, 5 m apart (10 m end to end). The athlete stands at the middle cone.",
      "On 'go', run 5 m to one end cone and touch the line with a hand.",
      "Turn and run 10 m to the far cone and touch that line.",
      "Turn and sprint 5 m back through the middle cone. Time stops as the athlete passes it.",
      "Two attempts, one starting to each side. Record the faster time in seconds.",
    ],
    equipment: ["Cones", "Measuring tape", "Stopwatch"],
    min: 3,
    max: 15,
    decimals: 2,
  },
  {
    key: "beep_test",
    name: "Beep test (20 m multistage)",
    measures: "Aerobic endurance",
    unit: "level",
    better: "higher",
    protocol: "v1",
    minAge: 10,
    ageNotes:
      "Maximal test: suggested from about 10 years. For younger children use it as a fun run without a score. Stop any athlete who looks unwell, and do not push through pain.",
    protocolSteps: [
      "Mark two lines 20 m apart and play a standard multistage audio track.",
      "Athletes run between the lines, reaching each line before the next beep. Beeps get closer together every level.",
      "A first miss is a warning. Two misses in a row ends the test for that athlete.",
      "Record the last level and shuttle completed as a decimal, for example level 7 shuttle 5 as 7.5.",
    ],
    equipment: ["Audio track and speaker", "Cones", "Measuring tape"],
    min: 1,
    max: 21,
    decimals: 1,
  },
  {
    key: "vertical_jump",
    name: "Vertical jump",
    measures: "Lower-body power",
    unit: "cm",
    better: "higher",
    protocol: "v1",
    minAge: 8,
    ageNotes: "Fine from about 8 years. Teach a soft two-foot landing before scoring.",
    protocolSteps: [
      "Athlete stands side-on to a wall and reaches up with the near hand, feet flat. Mark that standing reach.",
      "From standing, dip and jump as high as possible, touching the wall at the top. No step or run-up.",
      "Measure the distance between the standing reach and the jump mark in centimetres.",
      "Three attempts with short rest. Record the best.",
    ],
    equipment: ["Wall", "Chalk or marker", "Measuring tape"],
    min: 5,
    max: 110,
    decimals: 1,
  },
  {
    key: "standing_long_jump",
    name: "Standing long jump",
    measures: "Lower-body power and coordination",
    unit: "cm",
    better: "higher",
    protocol: "v1",
    minAge: 7,
    ageNotes: "Fine from about 7 years. Use a surface that does not slip, ideally a mat or grass.",
    protocolSteps: [
      "Athlete stands with toes just behind a line, feet about hip-width apart.",
      "Swing the arms and jump forward with both feet together, landing on both feet.",
      "Measure from the line to the back of the nearest heel in centimetres. A fall backwards is a re-try.",
      "Three attempts. Record the best.",
    ],
    equipment: ["Measuring tape", "Mat or flat grass"],
    min: 30,
    max: 380,
    decimals: 0,
  },
  {
    key: "sit_reach",
    name: "Sit-and-reach",
    measures: "Hamstring and lower-back flexibility",
    unit: "cm",
    better: "higher",
    protocol: "v1",
    minAge: 6,
    ageNotes: "Fine at any age after a short warm-up. Never bounce or force the stretch.",
    protocolSteps: [
      "Athlete sits with legs straight and the soles of the feet flat against a box or a step.",
      "Zero is the line of the toes. Reaching past the toes scores positive centimetres; stopping short scores negative.",
      "With one hand on top of the other, reach slowly forward and hold the furthest point for two seconds.",
      "Two attempts. Record the best, in centimetres relative to the toes.",
    ],
    equipment: ["Sit-and-reach box or step", "Ruler"],
    min: -40,
    max: 50,
    decimals: 1,
  },
  {
    key: "plank_hold",
    name: "Plank hold",
    measures: "Trunk endurance",
    unit: "s",
    better: "higher",
    protocol: "v1",
    minAge: 8,
    ageNotes: "Suggested from about 8 years. For under-12s, stop the test at 2 minutes; longer holds add little.",
    protocolSteps: [
      "Athlete rests on forearms and toes, elbows under the shoulders, body in a straight line from head to heels.",
      "Start the clock once the position is set.",
      "Give one warning if the hips sag or lift. Stop the clock at the second break in form.",
      "Record the time held in seconds. One attempt.",
    ],
    equipment: ["Mat", "Stopwatch"],
    min: 1,
    max: 900,
    decimals: 0,
  },
  {
    key: "run_1km",
    name: "1 km run",
    measures: "Aerobic endurance and pacing",
    unit: "s",
    better: "lower",
    protocol: "v1",
    minAge: 9,
    ageNotes:
      "Suggested from about 9 years. Walking is allowed. Do not run it in strong heat; give water before and after.",
    protocolSteps: [
      "Use a measured 1 km route: a 400 m track (2.5 laps) or a marked flat loop.",
      "Start together on 'go'. Athletes run, or run and walk, at their own pace.",
      "Record the finishing time in seconds (4:30 is 270 seconds).",
    ],
    equipment: ["Measured track or loop", "Stopwatch"],
    min: 120,
    max: 1200,
    decimals: 0,
  },
  {
    key: "pushups_60s",
    name: "Push-ups in 60 seconds",
    measures: "Upper-body muscular endurance",
    unit: "reps",
    better: "higher",
    protocol: "v1",
    minAge: 9,
    ageNotes:
      "Suggested from about 9 years. This protocol is full push-ups only. Knee push-ups are a different protocol: note them, but they are not compared with full push-up scores.",
    protocolSteps: [
      "Start at the top of a push-up: hands under the shoulders, body straight.",
      "Lower until the elbows reach about 90 degrees, then push back to straight arms. That is one rep.",
      "Count only reps with a straight body and full range. Resting at the top is allowed.",
      "Record the number of good reps in 60 seconds.",
    ],
    equipment: ["Mat", "Stopwatch"],
    min: 0,
    max: 150,
    decimals: 0,
  },
];

const BY_KEY = new Map(FITNESS_TESTS.map((t) => [t.key, t]));

export function getFitnessTest(key: string | null | undefined): FitnessTest | null {
  return key ? BY_KEY.get(key) ?? null : null;
}

export const UNIT_LABELS: Record<FitnessUnit, string> = { s: "seconds", cm: "cm", level: "level", reps: "reps" };

/** Format a value for display; long times (1 km run) show as m:ss. */
export function formatFitnessValue(test: FitnessTest, value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (test.unit === "s" && value >= 120) {
    const m = Math.floor(value / 60);
    const s = Math.round(value - m * 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const v = value.toFixed(test.decimals);
  return test.unit === "level" ? `level ${v}` : `${v} ${test.unit}`;
}

/**
 * Parse a value typed by a coach. Accepts decimals with "." or ",", and m:ss for times (1:05 → 65).
 * Returns null when the input is not a number or is outside the test's plausible range.
 */
export function parseFitnessValue(test: FitnessTest, raw: string): number | null {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (!text) return null;
  let value: number;
  const mmss = /^(\d{1,2}):([0-5]\d(?:\.\d+)?)$/.exec(text);
  if (mmss && test.unit === "s") value = Number(mmss[1]) * 60 + Number(mmss[2]);
  else if (/^-?\d+(\.\d+)?$/.test(text)) value = Number(text);
  else return null;
  if (!Number.isFinite(value) || value < test.min || value > test.max) return null;
  const f = 10 ** Math.max(test.decimals, 3);
  return Math.round(value * f) / f;
}

/** True when `a` is a better result than `b` for this test. Equal is not better. */
export function isBetter(test: Pick<FitnessTest, "better">, a: number, b: number): boolean {
  return test.better === "lower" ? a < b : a > b;
}

// ---- Age bands ---------------------------------------------------------------------------------

export const AGE_BANDS = ["U8", "U10", "U12", "U14", "U16", "U18", "18+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number] | "Unknown";

/** Whole years of age on a date (UTC calendar). */
export function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/** Age band at the date of the test. Without a date of birth the band is Unknown and never compared. */
export function ageBandOn(dob: Date | null | undefined, on: Date): AgeBand {
  if (!dob || Number.isNaN(dob.getTime())) return "Unknown";
  const age = ageOn(dob, on);
  if (age < 0) return "Unknown";
  if (age < 8) return "U8";
  if (age < 10) return "U10";
  if (age < 12) return "U12";
  if (age < 14) return "U14";
  if (age < 16) return "U16";
  if (age < 18) return "U18";
  return "18+";
}

// ---- Results, personal bests, trends -----------------------------------------------------------

export type ResultLike = {
  id: string;
  testKey: string;
  value: number;
  unit: string;
  recordedAt: Date;
};

/**
 * The protocol a stored result belongs to. FitnessResult has no protocol column, so the protocol is
 * the test key plus the unit it was recorded in; a unit that does not match the catalogue is treated
 * as a different protocol and never compared.
 */
export function protocolKey(r: { testKey: string; unit: string }): string {
  const t = getFitnessTest(r.testKey);
  const proto = t && t.unit === r.unit ? t.protocol : `other-${r.unit}`;
  return `${r.testKey}:${proto}`;
}

/** Results for one test and protocol, oldest first. */
export function seriesFor<T extends ResultLike>(results: T[], testKey: string): T[] {
  const test = getFitnessTest(testKey);
  if (!test) return [];
  const want = `${testKey}:${test.protocol}`;
  return results
    .filter((r) => r.testKey === testKey && protocolKey(r) === want)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
}

/** The best result in a list for this test (earliest wins a tie), or null. */
export function personalBest<T extends ResultLike>(results: T[], testKey: string): T | null {
  const test = getFitnessTest(testKey);
  if (!test) return null;
  let best: T | null = null;
  for (const r of seriesFor(results, testKey)) if (!best || isBetter(test, r.value, best.value)) best = r;
  return best;
}

/** Ids of results that were a new personal best at the time they were recorded. */
export function personalBestIds<T extends ResultLike>(results: T[], testKey: string): Set<string> {
  const test = getFitnessTest(testKey);
  const ids = new Set<string>();
  if (!test) return ids;
  let best: number | null = null;
  for (const r of seriesFor(results, testKey)) {
    if (best === null || isBetter(test, r.value, best)) {
      best = r.value;
      ids.add(r.id);
    }
  }
  return ids;
}

/** Would `value` be a new personal best against the previous results? (First result counts as a PB.) */
export function wouldBePersonalBest(results: ResultLike[], testKey: string, value: number): boolean {
  const test = getFitnessTest(testKey);
  if (!test) return false;
  const pb = personalBest(results, testKey);
  return !pb || isBetter(test, value, pb.value);
}

export type TrendSummary = { direction: "improved" | "declined" | "same" | "none"; change: number; text: string };

/** Change from the previous result to the latest one, described in plain words. */
export function latestChange(results: ResultLike[], testKey: string): TrendSummary {
  const test = getFitnessTest(testKey);
  const s = seriesFor(results, testKey);
  if (!test || s.length < 2) return { direction: "none", change: 0, text: "Not enough results yet to show a change." };
  const prev = s[s.length - 2].value;
  const last = s[s.length - 1].value;
  const change = Math.round((last - prev) * 1000) / 1000;
  if (change === 0) return { direction: "same", change, text: "Same as the previous result." };
  const better = isBetter(test, last, prev);
  const amount = `${Math.abs(change).toFixed(test.decimals)} ${UNIT_LABELS[test.unit]}`;
  return {
    direction: better ? "improved" : "declined",
    change,
    text: better ? `Better than last time by ${amount}.` : `Down on last time by ${amount}. One result is not a trend.`,
  };
}

// ---- Same-cohort comparison (same test, protocol, age band) ------------------------------------

export type CohortResult = ResultLike & { studentId: string; ageBand: AgeBand };

/** Smallest group shown, so a single child's result can never be singled out. */
export const MIN_COHORT = 5;

/**
 * Median of each athlete's best result among athletes in the SAME test, protocol and age band.
 * Unknown age band is never compared. Returns null below MIN_COHORT athletes.
 */
export function cohortMedian(
  results: CohortResult[],
  testKey: string,
  ageBand: AgeBand,
): { median: number; athletes: number; ageBand: AgeBand } | null {
  const test = getFitnessTest(testKey);
  if (!test || ageBand === "Unknown") return null;
  const want = `${testKey}:${test.protocol}`;
  const bestByStudent = new Map<string, number>();
  for (const r of results) {
    if (r.testKey !== testKey || r.ageBand !== ageBand || protocolKey(r) !== want) continue;
    const cur = bestByStudent.get(r.studentId);
    if (cur === undefined || isBetter(test, r.value, cur)) bestByStudent.set(r.studentId, r.value);
  }
  const values = [...bestByStudent.values()].sort((a, b) => a - b);
  if (values.length < MIN_COHORT) return null;
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return { median, athletes: values.length, ageBand };
}
