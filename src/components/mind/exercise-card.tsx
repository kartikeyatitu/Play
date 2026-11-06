"use client";

import { useState } from "react";
import { formatMinutes } from "@/lib/mind/content";
import { MOMENT_LABELS, type Exercise } from "@/lib/mind/types";
import { useReadingLevel } from "./reading-level";

/** Shows one exercise at the viewer's reading level, with an optional one-step-at-a-time guide. */
export function ExerciseCard({
  exercise,
  headingLevel = 3,
  idPrefix = "",
}: {
  exercise: Exercise;
  headingLevel?: 2 | 3;
  /** Keeps element ids unique when one exercise appears more than once on a page. */
  idPrefix?: string;
}) {
  const { level } = useReadingLevel();
  const text = exercise.levels[level];
  const [guided, setGuided] = useState(false);
  const [step, setStep] = useState(0);
  const H = headingLevel === 2 ? "h2" : "h3";
  const anchorId = `${idPrefix}${exercise.id}`;
  const headingId = `${anchorId}-title`;

  return (
    <article id={anchorId} aria-labelledby={headingId} className="scroll-mt-20 rounded-xl border border-line bg-surface p-4">
      <header>
        <H id={headingId} className="text-base font-semibold text-ink">
          {exercise.title}
        </H>
        <p className="mt-1 text-sm text-ink-muted">{exercise.summary}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label="Details">
          <li className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-muted">About {formatMinutes(exercise.minutes)}</li>
          {exercise.when.map((m) => (
            <li key={m} className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-muted">
              {MOMENT_LABELS[m]}
            </li>
          ))}
        </ul>
      </header>

      <p className="mt-3 text-sm text-ink">{text.intro}</p>

      {guided ? (
        <div className="mt-3 rounded-lg bg-surface-2 p-3" role="group" aria-label={`${exercise.title}, guided steps`}>
          <p className="text-xs text-ink-subtle" aria-live="polite">
            Step {step + 1} of {text.steps.length}
          </p>
          <p className="mt-1 text-base text-ink">{text.steps[step]}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="min-h-11 rounded-lg border border-line px-3 text-sm text-ink disabled:opacity-40"
            >
              Back
            </button>
            {step < text.steps.length - 1 ? (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="min-h-11 rounded-lg bg-volt px-4 text-sm font-semibold text-volt-fg">
                Next step
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setGuided(false);
                  setStep(0);
                }}
                className="min-h-11 rounded-lg bg-volt px-4 text-sm font-semibold text-volt-fg"
              >
                Done
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink">
            {text.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => {
              setStep(0);
              setGuided(true);
            }}
            className="mt-3 min-h-11 rounded-lg border border-line px-3 text-sm text-ink hover:bg-surface-2"
          >
            Guide me one step at a time
          </button>
        </>
      )}

      {text.tip ? (
        <p className="mt-3 border-l-2 border-volt pl-3 text-sm text-ink-muted">
          <span className="font-medium text-ink">{level === "guided" ? "For the grown-up: " : "Tip: "}</span>
          {text.tip}
        </p>
      ) : null}
    </article>
  );
}
