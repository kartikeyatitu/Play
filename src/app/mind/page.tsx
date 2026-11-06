import Link from "next/link";
import { requireMindC1 } from "@/components/mind/gate";
import { MindShell, SectionTitle } from "@/components/mind/shell";
import { SKILLS } from "@/lib/mind/content";
import { SPORT_PACKS } from "@/lib/mind/sport-packs";

const card = "block rounded-xl border border-line bg-surface p-4 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40";

export default function MindHomePage() {
  requireMindC1();
  return (
    <MindShell
      title="Train your mind like you train your body"
      intro="Short, practical mental-skills exercises for athletes, with versions for young athletes and their grown-ups, teenagers and adults. No sign-in, nothing to fill in, nothing saved."
    >
      <Link href="/mind/match-day" className={`${card} border-volt/40`}>
        <span className="text-base font-semibold text-ink">Match day</span>
        <span className="mt-1 block text-sm text-ink-muted">Routine checklist, guided breathing, reset cards and after-match questions.</span>
      </Link>

      <section aria-labelledby="skills-h" className="mt-8">
        <SectionTitle id="skills-h">Mental skills</SectionTitle>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {SKILLS.map((s) => (
            <li key={s.id}>
              <Link href={`/mind/skills/${s.id}`} className={card}>
                <span className="text-base font-semibold text-ink">{s.title}</span>
                <span className="mt-1 block text-sm text-ink-muted">{s.tagline}</span>
                <span className="mt-2 block text-xs text-ink-subtle">{s.exercises.length} exercises</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sports-h" className="mt-8">
        <SectionTitle id="sports-h">By sport</SectionTitle>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {SPORT_PACKS.map((p) => (
            <li key={p.id}>
              <Link href={`/mind/sport/${p.id}`} className={card}>
                <span className="text-base font-semibold text-ink">{p.name}</span>
                <span className="mt-1 block text-xs text-ink-subtle">{p.situations.length} situations</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="adults-h" className="mt-8">
        <SectionTitle id="adults-h">For parents and coaches</SectionTitle>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          <li>
            <Link href="/mind/parents" className={card}>
              <span className="text-base font-semibold text-ink">Parents and guardians</span>
              <span className="mt-1 block text-sm text-ink-muted">Supporting your child, pressure, losses, and when to get help.</span>
            </Link>
          </li>
          <li>
            <Link href="/mind/coaches" className={card}>
              <span className="text-base font-semibold text-ink">Coaches</span>
              <span className="mt-1 block text-sm text-ink-muted">Positive coaching, mistakes, burnout, and when to suggest a professional.</span>
            </Link>
          </li>
        </ul>
      </section>
    </MindShell>
  );
}
