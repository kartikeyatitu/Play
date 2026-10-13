"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { DirectoryItem } from "@/lib/directory";
import { AcademyCard } from "./academy-card";

const PAGE = 24;
const MAX_AREA_CHIPS = 14;

/** Client-side area filter + progressive "show more" over server-rendered data (keeps pages ISR-cacheable). */
export function DirectoryGrid({ items }: { items: DirectoryItem[] }) {
  const [area, setArea] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const areas = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const i of items) {
      if (!i.area || !i.areaSlug) continue;
      const cur = m.get(i.areaSlug);
      if (cur) cur.count++;
      else m.set(i.areaSlug, { label: i.area, count: 1 });
    }
    return [...m.entries()]
      .map(([slug, v]) => ({ slug, ...v }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, MAX_AREA_CHIPS);
  }, [items]);

  const filtered = useMemo(() => (area ? items.filter((i) => i.areaSlug === area) : items), [items, area]);
  const visible = filtered.slice(0, limit);

  return (
    <div className="min-w-0">
      {areas.length > 1 && (
        <div className="mb-5 flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="size-4 shrink-0 text-zinc-500" aria-hidden />
          <div
            role="group"
            aria-label="Filter by area"
            className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <AreaChip active={area === null} onClick={() => { setArea(null); setLimit(PAGE); }}>
              All areas
            </AreaChip>
            {areas.map((a) => (
              <AreaChip
                key={a.slug}
                active={area === a.slug}
                onClick={() => { setArea(area === a.slug ? null : a.slug); setLimit(PAGE); }}
              >
                {a.label}
                <span className="ml-1 text-zinc-500">{a.count}</span>
              </AreaChip>
            ))}
          </div>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item, idx) => (
          <li key={`${item.kind}-${item.id}`} className="min-w-0">
            <AcademyCard item={item} priority={idx < 3} />
          </li>
        ))}
      </ul>

      {filtered.length > limit && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="h-11 rounded-full border border-white/10 bg-white/[0.03] px-6 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.06]"
          >
            Show more ({filtered.length - limit} left)
          </button>
        </div>
      )}
    </div>
  );
}

function AreaChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-xs font-medium transition ${
        active
          ? "border-lime-400/60 bg-lime-400/10 text-lime-300"
          : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/20 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
