import type { Metadata } from "next";
import Link from "next/link";
import { BreathingPacer } from "@/components/mind/breathing-pacer";
import { ExerciseCard } from "@/components/mind/exercise-card";
import { requireMindC1 } from "@/components/mind/gate";
import { LevelPicker } from "@/components/mind/reading-level";
import { ReflectionPrompts } from "@/components/mind/reflection-prompts";
import { RoutineBuilder } from "@/components/mind/routine-builder";
import { MindShell, SectionTitle } from "@/components/mind/shell";
import { getExercise, getSkill } from "@/lib/mind/content";
import { RESET_CARDS } from "@/lib/mind/match-day";

export const metadata: Metadata = { title: "Match day | Mind & Performance | Triq" };

const VISUALISATION_ID = "confidence-picture-it";

export default function MatchDayPage() {
  requireMindC1();
  const visualisation = getExercise(VISUALISATION_ID);

  return (
    <MindShell
      title="Match day"
      intro="Tools for before, during and after a match. Everything here works only on this screen for this visit. Nothing is saved or sent."
    >
      <nav aria-label="Match day sections" className="flex flex-wrap gap-2">
        {[
          ["#before", "Before"],
          ["#during", "During"],
          ["#after", "After"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-sm text-ink ring-1 ring-line hover:bg-surface-2">
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-6">
        <LevelPicker />
      </div>

      <section aria-labelledby="before" className="mt-10 space-y-4">
        <SectionTitle id="before">Before</SectionTitle>
        <h3 className="text-base font-semibold text-ink">Routine checklist</h3>
        <RoutineBuilder />
        <h3 className="pt-2 text-base font-semibold text-ink">Guided breathing</h3>
        <BreathingPacer />
        {visualisation ? (
          <>
            <h3 className="pt-2 text-base font-semibold text-ink">Visualisation</h3>
            <ExerciseCard exercise={visualisation} />
          </>
        ) : null}
      </section>

      <section aria-labelledby="during" className="mt-10">
        <SectionTitle id="during">During: quick reset cards</SectionTitle>
        <p className="mt-1 text-sm text-ink-muted">Short cues for breaks in play. Tap through to practise the full exercise in training first.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {RESET_CARDS.map((c) => {
            const ex = getExercise(c.exerciseId);
            const skill = ex ? getSkill(ex.skill) : undefined;
            return (
              <li key={c.id} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{c.title}</p>
                <p className="mt-1 text-lg font-semibold text-ink">{c.cue}</p>
                {ex && skill ? (
                  <Link href={`/mind/skills/${skill.id}#${ex.id}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-volt-ink underline underline-offset-2">
                    {ex.title}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="after" className="mt-10">
        <SectionTitle id="after">After: questions to think about</SectionTitle>
        <div className="mt-3">
          <ReflectionPrompts />
        </div>
      </section>
    </MindShell>
  );
}
