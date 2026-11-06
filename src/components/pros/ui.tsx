// TRIQ Connect UI primitives (server-renderable, semantic Tailwind tokens only).
import type { ReactNode } from "react";
import type { ProVerificationState } from "@/lib/pros/verification";
import { PRO_VERIFICATION_LABELS, isVerified } from "@/lib/pros/verification";

export const fieldCls =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-volt/40";
export const labelCls = "block text-xs font-medium text-ink-muted";
export const primaryBtn =
  "inline-flex items-center justify-center rounded-lg bg-volt px-3 py-2 text-sm font-semibold text-volt-fg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-volt/50";
export const ghostBtn =
  "inline-flex items-center justify-center rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-volt/50";
export const dangerBtn =
  "inline-flex items-center justify-center rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10";

export function Shell({ eyebrow, title, actions, children }: { eyebrow: string; title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-ink">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          </div>
          {actions ? <nav className="flex flex-wrap gap-2 text-sm">{actions}</nav> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Block({ title, id, children, hint }: { title: string; id?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-ink-subtle">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface p-4 ${className}`}>{children}</div>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const cls = tone === "warn" ? "border-warn/40 bg-warn/10 text-ink" : "border-line bg-surface-2 text-ink-muted";
  return <div className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function FlashMsg({ error, saved }: { error?: string | string[]; saved?: string | string[] }) {
  const err = Array.isArray(error) ? error[0] : error;
  if (err) {
    return (
      <p role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-ink">
        {err.slice(0, 300)}
      </p>
    );
  }
  if (saved) {
    return (
      <p role="status" className="mt-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-ink">
        Saved.
      </p>
    );
  }
  return null;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted ring-1 ring-line">{children}</span>;
}

/** The only place Connect renders "Verified". Anything not ops-verified reads "Not yet verified". */
export function VerificationBadge({ state }: { state: ProVerificationState }) {
  if (isVerified(state)) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success ring-1 ring-success/40"
        title="Triq ops checked this professional's credentials with the issuer"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 fill-current">
          <path d="M6.5 11.2 3.3 8l1.1-1.1 2.1 2.1 5.1-5.1 1.1 1.1z" />
        </svg>
        {PRO_VERIFICATION_LABELS.VERIFIED}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted ring-1 ring-line">
      {PRO_VERIFICATION_LABELS[state]}
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className={labelCls}>{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink-subtle">{hint}</span> : null}
    </label>
  );
}

export function CheckGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
}) {
  return (
    <fieldset>
      <legend className={labelCls}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink has-[:checked]:border-volt has-[:checked]:bg-volt/10">
            <input type="checkbox" name={name} value={o.value} defaultChecked={selected.includes(o.value)} className="accent-current" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function istDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(d);
}
