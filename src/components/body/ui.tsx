// TRIQ Body: small server-renderable UI bits. Phone-first, semantic colour tokens only.
import Link from "next/link";
import type { ReactNode } from "react";

export function BodyShell({
  title,
  eyebrow = "TRIQ Body",
  back,
  children,
  actions,
}: {
  title: string;
  eyebrow?: string;
  back?: { href: string; label: string };
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        {back ? (
          <Link href={back.href} className="text-sm text-ink-muted hover:text-ink print:hidden">
            ← {back.label}
          </Link>
        ) : null}
        <header className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          </div>
          {actions ? <div className="flex flex-wrap gap-2 text-sm print:hidden">{actions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface p-4 ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-ink-muted">{children}</h2>;
}

/** The "flag is off" note shown wherever saving would be. */
export function NotEnabled({ what }: { what: string }) {
  return (
    <p role="note" className="mt-4 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-ink">
      <strong className="font-semibold">Not enabled yet.</strong> {what} You can still browse everything here.
    </p>
  );
}

export function Notice({ error, saved, children }: { error?: string; saved?: boolean; children?: ReactNode }) {
  if (error)
    return (
      <p role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-ink">
        {error.slice(0, 300)}
      </p>
    );
  if (saved)
    return (
      <p role="status" className="mt-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-ink">
        {children ?? "Saved."}
      </p>
    );
  return null;
}

export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "accent" | "good" }) {
  const cls =
    tone === "accent"
      ? "border-volt/40 bg-volt/10 text-volt-ink"
      : tone === "good"
        ? "border-success/40 bg-success/10 text-success"
        : "border-line bg-surface-2 text-ink-muted";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export const inputCls =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-volt/40 sm:text-sm";
export const labelCls = "block text-xs font-medium text-ink-muted";
export const primaryBtn =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-volt-fg hover:bg-volt/90 disabled:cursor-not-allowed disabled:opacity-50";
export const ghostBtn =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-surface-2";

export function one(v: string | string[] | undefined): string {
  return ((Array.isArray(v) ? v[0] : v) ?? "").trim().slice(0, 300);
}

export function dayLabel(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export function BodyNav({ current }: { current: "home" | "athletes" | "drills" | "plans" | "load" }) {
  const links: { key: typeof current; href: string; label: string }[] = [
    { key: "home", href: "/body", label: "Tests" },
    { key: "athletes", href: "/body/athletes", label: "Athletes" },
    { key: "drills", href: "/body/drills", label: "Drills" },
    { key: "plans", href: "/body/plans", label: "Plans" },
    { key: "load", href: "/body/load", label: "Load" },
  ];
  return (
    <nav aria-label="TRIQ Body" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 print:hidden">
      {links.map((l) => (
        <Link
          key={l.key}
          href={l.href}
          aria-current={l.key === current ? "page" : undefined}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
            l.key === current ? "border-volt bg-volt/10 text-ink" : "border-line text-ink-muted hover:text-ink"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
