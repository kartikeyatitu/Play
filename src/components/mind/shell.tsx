// Server-rendered frame for every /mind page: navigation, the safety note and the support link.
import Link from "next/link";
import type { ReactNode } from "react";
import { SAFETY_NOTE, SUPPORT_LINK_LABEL, SUPPORT_PATH } from "@/lib/mind/support";

const NAV = [
  { href: "/mind", label: "Home" },
  { href: "/mind/match-day", label: "Match day" },
  { href: "/mind/parents", label: "Parents" },
  { href: "/mind/coaches", label: "Coaches" },
];

export function SafetyNote() {
  return (
    <aside aria-label="About this content" className="rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink-muted">
      <p>{SAFETY_NOTE}</p>
      <p className="mt-1">
        <Link href={SUPPORT_PATH} className="font-medium text-volt-ink underline underline-offset-2">
          {SUPPORT_LINK_LABEL}
        </Link>
      </p>
    </aside>
  );
}

export function MindShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-ink">
      <a href="#mind-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <header>
          <div className="flex items-center justify-between gap-3">
            <Link href="/mind" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              TRIQ Mind &amp; Performance
            </Link>
            <Link href={SUPPORT_PATH} className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-2">
              Get support
            </Link>
          </div>
          <nav aria-label="Mind and Performance" className="no-scrollbar -mx-4 mt-3 overflow-x-auto px-4">
            <ul className="flex gap-2">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-surface px-4 text-sm text-ink ring-1 ring-line hover:bg-surface-2">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {intro ? <p className="mt-2 text-base text-ink-muted">{intro}</p> : null}
        </header>
        <div className="mt-4">
          <SafetyNote />
        </div>
        <main id="mind-main" className="mt-6">
          {children}
        </main>
        <footer className="mt-12 border-t border-line pt-4 text-xs text-ink-subtle">
          <p>{SAFETY_NOTE}</p>
          <p className="mt-1">
            Nothing you tick, add or choose on these pages is saved.{" "}
            <Link href={SUPPORT_PATH} className="text-volt-ink underline underline-offset-2">
              {SUPPORT_LINK_LABEL}
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold text-ink">
      {children}
    </h2>
  );
}
