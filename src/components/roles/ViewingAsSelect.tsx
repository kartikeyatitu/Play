"use client";

import * as React from "react";
import { toast } from "sonner";
import { switchRole } from "@/app/actions/roles";
import type { Hat } from "@/lib/roles/hats";

/**
 * Phone-first "Viewing as" control: a native <select> (full keyboard and screen-reader support for free).
 * Changing it asks the server to switch; the server re-checks the hat and redirects to its home.
 */
export function ViewingAsSelect({
  current,
  options,
  academyName,
}: {
  current: Hat;
  options: { value: Hat; label: string }[];
  academyName: string | null;
}) {
  const id = React.useId();
  const [value, setValue] = React.useState<Hat>(current);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => setValue(current), [current]);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Hat;
    if (next === value) return;
    setValue(next);
    startTransition(async () => {
      try {
        const res = await switchRole(next);
        // Success redirects (never returns); a returned value is a refusal.
        if (res && !res.ok) {
          toast.error(res.error);
          setValue(current);
        }
      } catch (err: any) {
        // Next.js redirects surface as thrown NEXT_REDIRECT errors in some versions: let them through.
        if (typeof err?.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) throw err;
        toast.error("Couldn't switch view");
        setValue(current);
      }
    });
  }

  return (
    <div
      role="region"
      aria-label="Viewing as"
      className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2 text-[13px]"
    >
      <label htmlFor={id} className="shrink-0 text-ink-muted">
        Viewing as
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={pending}
        aria-busy={pending}
        className="h-9 min-w-0 rounded-lg border border-line bg-canvas px-2 text-[13px] font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {academyName ? (
        <span className="min-w-0 truncate text-ink-muted" title={academyName}>
          · {academyName}
        </span>
      ) : null}
    </div>
  );
}
