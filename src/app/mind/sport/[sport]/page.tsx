import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExerciseCard } from "@/components/mind/exercise-card";
import { requireMindC1 } from "@/components/mind/gate";
import { LevelPicker } from "@/components/mind/reading-level";
import { MindShell } from "@/components/mind/shell";
import { getExercise } from "@/lib/mind/content";
import { getSportPack } from "@/lib/mind/sport-packs";
import { MOMENT_LABELS, type Exercise } from "@/lib/mind/types";

type Params = Promise<{ sport: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { sport } = await params;
  const p = getSportPack(sport);
  return { title: p ? `${p.name} | Mind & Performance | Triq` : "Mind & Performance | Triq" };
}

export default async function SportPackPage({ params }: { params: Params }) {
  requireMindC1();
  const { sport } = await params;
  const pack = getSportPack(sport);
  if (!pack) notFound();

  return (
    <MindShell title={pack.name} intro={pack.intro}>
      <p className="text-sm text-ink-subtle">Also useful for: {pack.covers.join(", ")}.</p>
      {pack.notes?.map((n) => (
        <p key={n} role="note" className="mt-3 rounded-xl border border-warn/40 bg-surface p-3 text-sm text-ink">
          {n}
        </p>
      ))}

      <nav aria-label="Situations" className="mt-4 rounded-xl border border-line bg-surface p-4">
        <ul className="space-y-1 text-sm">
          {pack.situations.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-volt-ink underline underline-offset-2">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6">
        <LevelPicker />
      </div>

      <div className="mt-6 space-y-10">
        {pack.situations.map((s) => {
          const exercises = s.exerciseIds.map(getExercise).filter((e): e is Exercise => Boolean(e));
          return (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-20">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{MOMENT_LABELS[s.moment]}</p>
              <h2 id={`${s.id}-h`} className="mt-1 text-lg font-semibold text-ink">
                {s.title}
              </h2>
              <p className="mt-2 rounded-lg bg-volt/10 px-3 py-2 text-base font-medium text-ink">“{s.cue}”</p>
              <div className="mt-3 space-y-3">
                {exercises.map((e) => (
                  <ExerciseCard key={e.id} exercise={e} idPrefix={`${s.id}-`} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </MindShell>
  );
}
