import type { EducationTopic } from "@/lib/mind/education";

export function EducationList({ topics }: { topics: readonly EducationTopic[] }) {
  return (
    <>
      <nav aria-label="Topics on this page" className="rounded-xl border border-line bg-surface p-4">
        <ul className="space-y-1 text-sm">
          {topics.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="text-volt-ink underline underline-offset-2">
                {t.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6 space-y-4">
        {topics.map((t) => (
          <section key={t.id} id={t.id} aria-labelledby={`${t.id}-h`} className="scroll-mt-20 rounded-xl border border-line bg-surface p-4">
            <h2 id={`${t.id}-h`} className="text-base font-semibold text-ink">
              {t.title}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t.summary}</p>
            <h3 className="mt-3 text-xs font-semibold uppercase tracking-wider text-success">Try to</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
              {t.do.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <h3 className="mt-3 text-xs font-semibold uppercase tracking-wider text-warn">Try to avoid</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
              {t.avoid.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
