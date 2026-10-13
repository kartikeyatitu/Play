"use client";

import { ChevronRight } from "lucide-react";
import type { NavGroup } from "@/components/ui/dashboard-shell";

/** Mobile "More" hub: the grouped list (Run · Grow · Admin) — same items the desktop sidebar shows. */
export function MoreScreen({
  groups,
  onNavigate,
  footer,
}: {
  groups: NavGroup[];
  onNavigate: (tab: string) => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">More</h2>
      {groups.map((group) => (
        <section key={group.label}>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{group.label}</p>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 divide-y divide-zinc-800/70 overflow-hidden">
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="w-full min-h-[52px] flex items-center gap-3 px-4 text-left hover:bg-zinc-900 transition-colors"
              >
                <span className="text-zinc-500 shrink-0">{item.icon}</span>
                <span className="flex-1 text-sm font-medium text-zinc-100">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-zinc-600" aria-hidden />
              </button>
            ))}
          </div>
        </section>
      ))}
      {footer}
    </div>
  );
}
