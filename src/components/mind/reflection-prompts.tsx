"use client";

// After-match questions to think about or talk through. Display only: no text box, nothing saved.
import { REFLECTION_PROMPTS } from "@/lib/mind/match-day";
import { useReadingLevel } from "./reading-level";

export function ReflectionPrompts() {
  const { level } = useReadingLevel();
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-ink-muted">
        Questions to think about, or talk through with someone you trust. There is nothing to fill in and nothing is saved.
      </p>
      <ul className="mt-3 space-y-2">
        {REFLECTION_PROMPTS[level].map((q) => (
          <li key={q} className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">
            {q}
          </li>
        ))}
      </ul>
    </div>
  );
}
