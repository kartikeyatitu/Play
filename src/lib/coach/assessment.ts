// Coach assessment logic: input validation and trend against the previous assessment. Pure.

import {
  averageScore,
  cleanScores,
  getRubric,
  isValidScore,
  legacyFromScores,
  RUBRICS,
  type RubricId,
  type RubricScores,
  type SportRubric,
} from "@/lib/skill-rubrics";

export const NOTE_MAX = 1000;

export interface AssessmentInput {
  studentId: string;
  sport: string;
  scores: Record<string, unknown>;
  note?: string | null;
}

export type ValidAssessment = {
  ok: true;
  studentId: string;
  rubric: SportRubric;
  scores: RubricScores;
  note: string | null;
  legacy: { technique: number; fitness: number; discipline: number };
};

/** Validate an assessment. Every rubric skill needs a 1–5 score; unknown keys are rejected. */
export function validateAssessment(input: AssessmentInput): ValidAssessment | { ok: false; error: string } {
  if (!input || typeof input.studentId !== "string" || !input.studentId.trim()) return { ok: false, error: "Pick a student." };
  if (typeof input.sport !== "string") return { ok: false, error: "Pick a sport." };
  const rubric = (RUBRICS as Record<string, SportRubric>)[input.sport] ?? getRubric(input.sport);
  const scores = input.scores && typeof input.scores === "object" ? input.scores : {};
  const { scores: clean, missing, unknown } = cleanScores(rubric, scores);
  if (unknown.length) return { ok: false, error: "Some scores don't belong to this sport's rubric." };
  if (missing.length) {
    const labels = rubric.skills.filter((k) => missing.includes(k.key)).map((k) => k.label);
    return { ok: false, error: `Score every skill (missing: ${labels.join(", ")}).` };
  }
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > NOTE_MAX) return { ok: false, error: `Keep the note under ${NOTE_MAX} characters.` };
  return {
    ok: true,
    studentId: input.studentId.trim(),
    rubric,
    scores: clean,
    note: note || null,
    legacy: legacyFromScores(rubric, clean),
  };
}

/** A stored SkillReport as far as trends care. */
export interface StoredReport {
  month: string;
  sport: string | null;
  technique: number;
  fitness: number;
  discipline: number;
  metrics: unknown;
  notes?: string | null;
}

/** Numeric 1–5 entries of a SkillReport.metrics JSON; anything else is dropped. */
export function metricsOf(raw: unknown): RubricScores {
  const out: RubricScores = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (isValidScore(v)) out[k] = v;
  return out;
}

/** Overall average of a stored report: rubric metrics when present, else the legacy three columns. */
export function reportAverage(r: StoredReport): number | null {
  const m = averageScore(metricsOf(r.metrics));
  if (m != null) return m;
  return averageScore({ technique: r.technique, fitness: r.fitness, discipline: r.discipline });
}

export type TrendDirection = "up" | "down" | "same" | "new";

export interface SkillTrend {
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  direction: TrendDirection;
}

export interface AssessmentTrend {
  previousMonth: string | null;
  sameSport: boolean;
  overall: { current: number | null; previous: number | null; delta: number | null; direction: TrendDirection };
  skills: SkillTrend[];
}

const dir = (cur: number | null, prev: number | null): TrendDirection => {
  if (cur == null || prev == null) return "new";
  const d = Math.round((cur - prev) * 10) / 10;
  return d > 0 ? "up" : d < 0 ? "down" : "same";
};

/**
 * Compare current scores with the previous report. Per-skill deltas only when the previous report was
 * for the same rubric and has that skill; the overall delta always uses the report average.
 */
export function compareWithPrevious(rubric: SportRubric, current: RubricScores, previous: StoredReport | null): AssessmentTrend {
  const prevScores = previous ? metricsOf(previous.metrics) : {};
  const sameSport = !!previous && getRubric(previous.sport).id === rubric.id;
  const skills: SkillTrend[] = rubric.skills.map((k) => {
    const cur = isValidScore(current[k.key]) ? current[k.key] : null;
    const prev = sameSport && isValidScore(prevScores[k.key]) ? prevScores[k.key] : null;
    return { key: k.key, label: k.label, current: cur, previous: prev, delta: cur != null && prev != null ? cur - prev : null, direction: dir(cur, prev) };
  });
  const curAvg = averageScore(Object.fromEntries(rubric.skills.filter((k) => isValidScore(current[k.key])).map((k) => [k.key, current[k.key]])));
  const prevAvg = previous ? reportAverage(previous) : null;
  return {
    previousMonth: previous?.month ?? null,
    sameSport,
    overall: {
      current: curAvg,
      previous: prevAvg,
      delta: curAvg != null && prevAvg != null ? Math.round((curAvg - prevAvg) * 10) / 10 : null,
      direction: dir(curAvg, prevAvg),
    },
    skills,
  };
}

/** Scores to prefill the form from an existing report for the same rubric (this month's draft). */
export function prefillScores(rubricId: RubricId, report: StoredReport | null): RubricScores {
  if (!report || getRubric(report.sport).id !== rubricId) return {};
  const rubric = RUBRICS[rubricId];
  return cleanScores(rubric, metricsOf(report.metrics)).scores;
}

/** "2026-11" → "Nov 2026". */
export function monthLabel(month: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  if (!m) return "";
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const i = Number(m[2]) - 1;
  return i >= 0 && i < 12 ? `${names[i]} ${m[1]}` : "";
}
