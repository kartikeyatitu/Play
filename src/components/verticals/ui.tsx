// Small shared server-renderable UI bits for the Careers / Wellness / Creators pages.
import type { ReactNode } from "react";

export function Flash({ error, saved }: { error?: string | string[]; saved?: string | string[] }) {
  const err = Array.isArray(error) ? error[0] : error;
  if (err) {
    return (
      <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        {err.slice(0, 300)}
      </p>
    );
  }
  if (saved) {
    return (
      <p role="status" className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
        Saved.
      </p>
    );
  }
  return null;
}

export function Page({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
          </div>
          {actions ? <nav className="flex flex-wrap gap-2 text-sm">{actions}</nav> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">{children}</div>;
}

export function Pill({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "lime" | "amber" | "emerald" | "rose" | "sky" }) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
    lime: "bg-lime-400/15 text-lime-300 ring-lime-400/30",
    amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    rose: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    sky: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tones[tone]}`}>{children}</span>;
}

export const inputCls =
  "w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400/40";
export const labelCls = "block text-xs font-medium text-zinc-400";
export const buttonCls =
  "inline-flex items-center justify-center rounded-lg bg-lime-400 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-lime-300";
export const ghostButtonCls =
  "inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export function ist(d: Date | string) {
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function istDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}
