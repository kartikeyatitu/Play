"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaggableStudent = { id: string; name: string };

/** Manual player tagging. There is no face recognition: staff pick names. */
export function TagPicker({
  students,
  selected,
  onChange,
  disabled,
}: {
  students: TaggableStudent[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const chosen = useMemo(() => new Set(selected), [selected]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? students.filter((s) => s.name.toLowerCase().includes(term)) : students;
    return list.slice(0, 80);
  }, [q, students]);

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
        <Search className="h-4 w-4 text-ink-subtle" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
          aria-label="Search players to tag"
          disabled={disabled}
        />
      </label>
      {selected.length > 0 && (
        <p className="text-xs text-ink-muted">
          {selected.length} tagged · only parents whose consent allows it will see these photos
        </p>
      )}
      <ul className="flex max-h-48 flex-wrap gap-2 overflow-y-auto" role="listbox" aria-multiselectable>
        {shown.map((s) => {
          const on = chosen.has(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(s.id)}
                disabled={disabled}
                className={cn(
                  "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                  on ? "border-volt bg-volt text-volt-fg" : "border-line bg-surface text-ink hover:bg-surface-2",
                )}
              >
                {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                {s.name}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="text-sm text-ink-muted">No players match.</li>}
      </ul>
    </div>
  );
}
