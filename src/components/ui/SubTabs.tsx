"use client";
// A small segmented control that joins related screens ("Team | Payroll") so the menu stays short.
// Items either switch the dashboard tab (id) or open a page (href).
import Link from "next/link";

export type SubTab = { id: string; label: string; href?: string; badge?: number };

export function SubTabs({ items, active, onSelect, label }: { items: SubTab[]; active: string; onSelect: (id: string) => void; label: string }) {
  const cls = (on: boolean) =>
    `shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${on ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"}`;
  return (
    <div role="tablist" aria-label={label} className="mb-6 flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-1 w-fit">
      {items.map((t) =>
        t.href ? (
          <Link key={t.id} href={t.href} className={cls(false)}>
            {t.label}
          </Link>
        ) : (
          <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => onSelect(t.id)} className={cls(active === t.id)}>
            {t.label}
            {!!t.badge && <span className="ml-1.5 rounded-full bg-[var(--brand)] px-1.5 text-[11px] text-[#000000]">{t.badge}</span>}
          </button>
        ),
      )}
    </div>
  );
}
