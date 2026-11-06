import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseCard } from "@/components/mind/exercise-card";
import { requireMindC1 } from "@/components/mind/gate";
import { LevelPicker } from "@/components/mind/reading-level";
import { MindShell } from "@/components/mind/shell";
import { SKILLS, getSkill } from "@/lib/mind/content";

type Params = Promise<{ skill: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { skill } = await params;
  const s = getSkill(skill);
  return { title: s ? `${s.title} | Mind & Performance | Triq` : "Mind & Performance | Triq" };
}

export default async function SkillPage({ params }: { params: Params }) {
  requireMindC1();
  const { skill } = await params;
  const s = getSkill(skill);
  if (!s) notFound();
  const others = SKILLS.filter((x) => x.id !== s.id);

  return (
    <MindShell title={s.title} intro={s.about}>
      <LevelPicker />
      <div className="mt-6 space-y-4">
        {s.exercises.map((e) => (
          <ExerciseCard key={e.id} exercise={e} headingLevel={2} />
        ))}
      </div>
      <nav aria-label="Other skills" className="mt-10">
        <h2 className="text-sm font-semibold text-ink-muted">Other skills</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {others.map((o) => (
            <li key={o.id}>
              <Link href={`/mind/skills/${o.id}`} className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-sm text-ink ring-1 ring-line hover:bg-surface-2">
                {o.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </MindShell>
  );
}
