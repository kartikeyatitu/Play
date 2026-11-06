"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { saveAssessment } from "@/app/actions/coach-os";
import { SportIcon } from "@/components/sport/SportIcon";
import { RUBRICS, RUBRIC_IDS, SCALE, scaleFor, rubricIdFor, type RubricId, type RubricScores } from "@/lib/skill-rubrics";
import { compareWithPrevious, monthLabel, NOTE_MAX, prefillScores, type StoredReport, type TrendDirection } from "@/lib/coach/assessment";

function TrendBadge({ direction, delta }: { direction: TrendDirection; delta: number | null }) {
  if (direction === "new" || delta == null) return <span className="text-xs text-ink-subtle">New</span>;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const tone = direction === "up" ? "text-success" : direction === "down" ? "text-danger" : "text-ink-subtle";
  const sign = delta > 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {sign}
      {delta}
      <span className="sr-only">{direction === "up" ? " better" : direction === "down" ? " lower" : " unchanged"} than last time</span>
    </span>
  );
}

export function AssessmentForm({
  student,
  defaultSport,
  batchSports,
  currentMonth,
  thisMonth,
  previous,
}: {
  student: { id: string; name: string };
  defaultSport: RubricId;
  batchSports: RubricId[];
  currentMonth: string;
  thisMonth: StoredReport | null;
  previous: StoredReport | null;
}) {
  const [sport, setSport] = useState<RubricId>(thisMonth ? rubricIdFor(thisMonth.sport) : defaultSport);
  const [scores, setScores] = useState<RubricScores>(() => prefillScores(sport, thisMonth));
  const [note, setNote] = useState(thisMonth?.notes ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rubric = RUBRICS[sport];
  const trend = useMemo(() => compareWithPrevious(rubric, scores, previous), [rubric, scores, previous]);
  const scored = rubric.skills.filter((k) => scores[k.key] != null).length;
  const complete = scored === rubric.skills.length;

  const otherSports = RUBRIC_IDS.filter((id) => !batchSports.includes(id));

  const changeSport = (id: RubricId) => {
    setSport(id);
    setScores(prefillScores(id, thisMonth));
    setSaved(null);
  };

  const submit = () => {
    startTransition(async () => {
      const res = await saveAssessment({ studentId: student.id, sport, scores, note });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(res.month);
      toast.success(`Assessment saved for ${monthLabel(res.month)}`);
    });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete && !pending) submit();
      }}
    >
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-subtle">Assessing</p>
            <p className="truncate text-lg font-semibold">{student.name}</p>
          </div>
          <Link href={`/athlete/${student.id}`} className="shrink-0 text-sm text-ink-muted underline-offset-2 hover:underline">
            Athlete page
          </Link>
        </div>
        <label className="mt-3 block text-xs font-semibold text-ink-muted" htmlFor="assess-sport">
          Sport rubric
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2">
            <SportIcon sport={sport} className="h-5 w-5" />
          </span>
          <select
            id="assess-sport"
            value={sport}
            onChange={(e) => changeSport(e.target.value as RubricId)}
            className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm"
          >
            {batchSports.length > 0 && (
              <optgroup label="Their batches">
                {batchSports.map((id) => (
                  <option key={id} value={id}>
                    {RUBRICS[id].label}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={batchSports.length ? "Other sports" : "Sports"}>
              {otherSports.map((id) => (
                <option key={id} value={id}>
                  {RUBRICS[id].label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <p className="mt-3 text-xs text-ink-subtle">
          {thisMonth ? `Updating the ${monthLabel(currentMonth)} assessment.` : `New assessment for ${monthLabel(currentMonth)}.`}{" "}
          {previous ? `Compared with ${monthLabel(previous.month)}.` : "No earlier assessment to compare with."}
        </p>
      </section>

      <ol className="space-y-3">
        {rubric.skills.map((skill) => {
          const value = scores[skill.key] ?? null;
          const t = trend.skills.find((x) => x.key === skill.key);
          const level = value ? scaleFor(value) : null;
          return (
            <li key={skill.key} className="rounded-2xl border border-line bg-surface p-4">
              <fieldset>
                <div className="flex items-start justify-between gap-3">
                  <legend className="text-sm font-semibold">{skill.label}</legend>
                  {value != null && t && t.previous != null && <TrendBadge direction={t.direction} delta={t.delta} />}
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">{skill.look}</p>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {SCALE.map((lv) => {
                    const on = value === lv.score;
                    return (
                      <label
                        key={lv.score}
                        className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border text-base font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink-subtle ${
                          on ? "border-volt bg-volt text-volt-fg" : "border-line bg-canvas text-ink-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`skill-${skill.key}`}
                          value={lv.score}
                          checked={on}
                          onChange={() => {
                            setScores((cur) => ({ ...cur, [skill.key]: lv.score }));
                            setSaved(null);
                          }}
                          className="sr-only"
                          aria-label={`${lv.score}, ${lv.label}`}
                        />
                        {lv.score}
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between gap-4 text-[11px] text-ink-subtle">
                  <span>1 · {skill.low}</span>
                  <span className="text-right">5 · {skill.high}</span>
                </div>
                {level && (
                  <p className="mt-2 text-xs text-ink">
                    <span className="font-semibold">{level.label}:</span> {value === 1 ? skill.low : value === 5 ? skill.high : level.descriptor}
                    {t?.previous != null && <span className="text-ink-subtle"> · last time {t.previous}</span>}
                  </p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <label htmlFor="assess-note" className="text-sm font-semibold">
          Coach&apos;s note
        </label>
        <p className="text-xs text-ink-muted">What to work on next. Parents may see this with the report.</p>
        <textarea
          id="assess-note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          rows={4}
          maxLength={NOTE_MAX}
          className="mt-2 w-full rounded-xl border border-line bg-canvas p-3 text-sm"
          placeholder="e.g. Footwork on the back foot is improving; keep working on the pull shot."
        />
        <p className="text-right text-[11px] text-ink-subtle">
          {note.length}/{NOTE_MAX}
        </p>
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold">
              Overall {trend.overall.current ?? "–"}
              {trend.overall.previous != null && <span className="font-normal text-ink-subtle"> (was {trend.overall.previous})</span>}
            </p>
            <p className="flex items-center gap-1 text-ink-subtle">
              {scored}/{rubric.skills.length} scored
              {trend.overall.previous != null && trend.overall.current != null && (
                <>
                  <ArrowRight className="h-3 w-3" aria-hidden />
                  <TrendBadge direction={trend.overall.direction} delta={trend.overall.delta} />
                </>
              )}
              {!trend.sameSport && previous && <span> · last report was a different sport</span>}
            </p>
          </div>
          <button
            type="submit"
            disabled={!complete || pending}
            className="inline-flex h-12 shrink-0 items-center rounded-xl bg-volt px-5 text-sm font-semibold text-volt-fg disabled:opacity-50"
          >
            {pending ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
