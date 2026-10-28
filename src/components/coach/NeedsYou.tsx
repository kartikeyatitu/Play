import { AlertTriangle, ChevronRight, Info } from "lucide-react";
import type { NeedsYouItem } from "@/lib/coach-today";

/** "Needs you" list for the coach: only things that need an action, each linking to where it's done. */
export function NeedsYou({ items, className = "" }: { items: NeedsYouItem[]; className?: string }) {
  return (
    <section aria-labelledby="needs-you-title" className={`rounded-2xl border border-line bg-surface p-4 space-y-2 ${className}`}>
      <h3 id="needs-you-title" className="text-sm font-semibold text-ink">Needs you</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">You&apos;re all caught up.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.key}>
              <a href={i.href} className="flex items-center gap-3 py-2.5 min-h-[48px] group">
                {i.tone === "warn" ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-warn" aria-label="Needs attention" role="img" />
                ) : (
                  <Info className="w-4 h-4 shrink-0 text-ink-subtle" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{i.label}</span>
                  <span className="block text-xs text-ink-subtle">{i.detail}</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-ink-subtle group-hover:text-ink" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
