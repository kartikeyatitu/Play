"use client";

// Pre-match routine checklist. Ticks and added items live in React state for this visit only.
// There is no save button on purpose: closing or reloading the page clears everything.
import { useState } from "react";
import { PRE_MATCH_CHECKLIST } from "@/lib/mind/match-day";

interface Item {
  id: string;
  label: string;
  group: string;
}

const START: Item[] = PRE_MATCH_CHECKLIST.flatMap((g) => g.items.map((i) => ({ ...i, group: g.id })));
const MAX_ITEM_LENGTH = 80;
const MAX_ITEMS = 30;

export function RoutineBuilder() {
  const [items, setItems] = useState<Item[]>(START);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [count, setCount] = useState(0);

  const groups = [...PRE_MATCH_CHECKLIST.map((g) => ({ id: g.id, title: g.title })), { id: "mine", title: "My extras" }];
  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-ink-muted">
        Tick things off as you go. Remove what you do not need and add your own. This list is not saved anywhere and clears when you leave the page.
      </p>
      <p className="mt-2 text-sm font-medium text-ink" aria-live="polite">
        {done.size} of {items.length} done
      </p>

      {groups.map((g) => {
        const list = items.filter((i) => i.group === g.id);
        if (!list.length) return null;
        return (
          <fieldset key={g.id} className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{g.title}</legend>
            <ul className="mt-2 space-y-1.5">
              {list.map((i) => (
                <li key={i.id} className="flex items-center gap-2">
                  <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={done.has(i.id)}
                      onChange={() => toggle(i.id)}
                      className="h-5 w-5 accent-[rgb(var(--c-accent))]"
                    />
                    <span className={`text-sm ${done.has(i.id) ? "text-ink-subtle line-through" : "text-ink"}`}>{i.label}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setItems((prev) => prev.filter((x) => x.id !== i.id));
                      setDone((prev) => {
                        const next = new Set(prev);
                        next.delete(i.id);
                        return next;
                      });
                    }}
                    className="min-h-11 min-w-11 rounded-lg text-sm text-ink-subtle hover:bg-surface-2 hover:text-ink"
                    aria-label={`Remove ${i.label}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}

      <form
        className="mt-4 flex gap-2"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          const label = draft.trim().slice(0, MAX_ITEM_LENGTH);
          if (!label || items.length >= MAX_ITEMS) return;
          setItems((prev) => [...prev, { id: `mine-${count}`, label, group: "mine" }]);
          setCount((c) => c + 1);
          setDraft("");
        }}
      >
        <label htmlFor="routine-add" className="sr-only">
          Add a routine step
        </label>
        <input
          id="routine-add"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_ITEM_LENGTH}
          placeholder="Add a step, e.g. listen to one song"
          autoComplete="off"
          className="min-h-11 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle"
        />
        <button type="submit" className="min-h-11 rounded-lg bg-volt px-4 text-sm font-semibold text-volt-fg">
          Add
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setItems(START);
          setDone(new Set());
          setDraft("");
        }}
        className="mt-3 min-h-11 rounded-lg border border-line px-3 text-sm text-ink-muted hover:bg-surface-2"
      >
        Reset list
      </button>
    </div>
  );
}
