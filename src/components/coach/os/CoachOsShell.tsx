import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export type CoachOsSection = "day" | "roster" | "assess" | "availability";

const LINKS: { id: CoachOsSection; label: string; href: string }[] = [
  { id: "day", label: "Today", href: "/coach/day" },
  { id: "roster", label: "Roster", href: "/coach/roster" },
  { id: "assess", label: "Assess", href: "/coach/assess" },
  { id: "availability", label: "Availability", href: "/coach/availability" },
];

/** Page frame for Coach OS screens: back to the coach home, title, section tabs and optional scope toggle. */
export function CoachOsShell({
  section,
  title,
  subtitle,
  scope,
  canViewAll = false,
  children,
}: {
  section: CoachOsSection;
  title: string;
  subtitle?: string;
  scope?: "mine" | "all";
  canViewAll?: boolean;
  children: ReactNode;
}) {
  const base = LINKS.find((l) => l.id === section)?.href ?? "/coach";
  const q = (href: string) => (canViewAll && scope === "all" ? `${href}?scope=all` : href);
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href="/coach" className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:text-ink" aria-label="Back to coach home">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
            {subtitle && <p className="truncate text-xs text-ink-subtle">{subtitle}</p>}
          </div>
        </div>
        <nav aria-label="Coach tools" className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
          {LINKS.map((l) => (
            <Link
              key={l.id}
              href={q(l.href)}
              aria-current={l.id === section ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium ${
                l.id === section ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-4">
        {canViewAll && (
          <nav aria-label="Which batches" className="mb-4 inline-flex rounded-lg border border-line p-0.5 text-xs font-semibold">
            <Link href={base} aria-current={scope !== "all" ? "page" : undefined} className={`inline-flex h-9 items-center rounded-md px-3 ${scope !== "all" ? "bg-surface-2 text-ink" : "text-ink-muted"}`}>
              My batches
            </Link>
            <Link href={`${base}?scope=all`} aria-current={scope === "all" ? "page" : undefined} className={`inline-flex h-9 items-center rounded-md px-3 ${scope === "all" ? "bg-surface-2 text-ink" : "text-ink-muted"}`}>
              All batches
            </Link>
          </nav>
        )}
        {children}
      </main>
    </div>
  );
}
