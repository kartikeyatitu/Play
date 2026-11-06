"use client";

// Reading level choice for Mind & Performance. Held in React state only for this visit:
// no cookie, no storage, no URL, no analytics, and no age is asked for.
import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { READING_LEVELS, type ReadingLevel } from "@/lib/mind/types";

const LevelContext = createContext<{ level: ReadingLevel; setLevel: (l: ReadingLevel) => void }>({
  level: "teen",
  setLevel: () => {},
});

export function LevelProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState<ReadingLevel>("teen");
  return <LevelContext.Provider value={{ level, setLevel }}>{children}</LevelContext.Provider>;
}

export function useReadingLevel() {
  return useContext(LevelContext);
}

export function LevelPicker() {
  const { level, setLevel } = useReadingLevel();
  const name = useId();
  const current = READING_LEVELS.find((l) => l.id === level);
  return (
    <fieldset className="rounded-xl border border-line bg-surface p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">Reading level</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {READING_LEVELS.map((l) => {
          const on = l.id === level;
          return (
            <label
              key={l.id}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-volt/40 ${
                on ? "border-volt bg-volt/10 text-ink" : "border-line text-ink-muted hover:bg-surface-2"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={l.id}
                checked={on}
                onChange={() => setLevel(l.id)}
                className="h-4 w-4 accent-[rgb(var(--c-accent))]"
              />
              {l.label}
            </label>
          );
        })}
      </div>
      {current ? <p className="mt-2 text-xs text-ink-subtle">{current.hint} Your choice is not saved.</p> : null}
    </fieldset>
  );
}
