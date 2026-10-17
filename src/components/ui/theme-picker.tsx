"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { THEMES, applyTheme, getStoredTheme, type ThemeId } from "@/lib/theme";

/** Owner Settings: pick a colour theme. Saved on this device only (localStorage). */
export function ThemePicker() {
  const [current, setCurrent] = React.useState<ThemeId | null>(null);
  React.useEffect(() => setCurrent(getStoredTheme()), []);

  return (
    <div className="rounded-xl border border-line/70 bg-surface/40 p-4 sm:p-5">
      <h3 className="text-[15px] font-semibold text-ink">Colour theme</h3>
      <p className="text-xs text-ink-subtle mt-0.5">Changes how Triq looks on this device only. Your data stays the same.</p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Colour theme">
        {THEMES.map((t) => {
          const on = current === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                applyTheme(t.id);
                setCurrent(t.id);
              }}
              className={`group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                on ? "border-volt bg-volt/10" : "border-line hover:border-zinc-600"
              }`}
            >
              <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10" style={{ background: t.swatch[0] }} aria-hidden>
                <span className="absolute left-1.5 right-1.5 top-1.5 h-3 rounded" style={{ background: t.swatch[1] }} />
                <span className="absolute left-1.5 bottom-1.5 h-3 w-6 rounded-full" style={{ background: t.swatch[2] }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{t.name}</span>
                <span className="block text-xs text-ink-subtle leading-snug">{t.description}</span>
              </span>
              {on && <Check className="w-4 h-4 text-volt-ink shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
