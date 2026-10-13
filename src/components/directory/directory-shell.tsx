import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/** Minimal public header/footer for directory pages (no auth, no app chrome). */
export function DirectoryShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-zinc-950 text-zinc-100">
      {/* soft brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(163,230,53,0.10),transparent_70%)]"
      />
      <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/academies" className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-lime-400 text-sm font-black text-zinc-950">T</span>
            <span className="truncate text-[15px] font-semibold tracking-tight text-white">
              Triq <span className="font-normal text-zinc-500">Academies</span>
            </span>
          </Link>
          <Link
            href="/register?ref=directory"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-lime-400/40 hover:text-white"
          >
            List your academy
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <div className="relative">{children}</div>

      <footer className="relative mt-16 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Listings marked &ldquo;On Triq&rdquo; are managed by the academy. Other listings are compiled from public sources
            and may be out of date.
          </p>
          <nav className="flex shrink-0 flex-wrap gap-x-4 gap-y-1">
            <Link href="/" className="hover:text-zinc-300">Triq for academies</Link>
            <Link href="/privacy" className="hover:text-zinc-300">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-300">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500">
        {items.map((it, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-zinc-700">/</span>}
            {it.href ? (
              <Link href={it.href} className="truncate hover:text-zinc-300">
                {it.label}
              </Link>
            ) : (
              <span className="truncate text-zinc-400">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Safe JSON-LD script (escapes "<" so data can't break out of the script tag). */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
