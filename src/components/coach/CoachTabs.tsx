"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarCheck, Users, ClipboardList, MessageCircle, UserRound } from "lucide-react";

export type CoachTab = "today" | "squad" | "plan" | "inbox" | "me";

const TABS: { id: CoachTab; label: string; icon: typeof CalendarCheck }[] = [
  { id: "today", label: "Today", icon: CalendarCheck },
  { id: "squad", label: "Squad", icon: Users },
  { id: "plan", label: "Plan", icon: ClipboardList },
  { id: "inbox", label: "Inbox", icon: MessageCircle },
  { id: "me", label: "Me", icon: UserRound },
];

/**
 * Mobile-first shell for the coach view: fixed bottom tab bar (thumb-reachable on the field).
 * Panels are server-rendered and passed in; only the active one is shown.
 * The active tab is mirrored to ?tab= so refreshes / router.refresh() keep the coach in place.
 */
export function CoachTabs({
  panels,
  badges = {},
  initialTab = "today",
}: {
  panels: Record<CoachTab, ReactNode>;
  badges?: Partial<Record<CoachTab, number>>;
  initialTab?: CoachTab;
}) {
  const [tab, setTab] = useState<CoachTab>(initialTab);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== tab) {
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  }, [tab]);

  function select(next: CoachTab) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      {(Object.keys(panels) as CoachTab[]).map((id) => (
        <section key={id} hidden={id !== tab} aria-label={id} className="focus:outline-none">
          {panels[id]}
        </section>
      ))}

      <nav
        aria-label="Coach navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-4xl mx-auto grid grid-cols-5">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = id === tab;
            const badge = badges[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => select(id)}
                aria-current={active ? "page" : undefined}
                className={`relative h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active ? "brand-text" : "text-ink-subtle hover:text-ink"
                }`}
              >
                {active && <span className="absolute top-0 h-0.5 w-10 rounded-full brand-bar" />}
                <span className="relative">
                  <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.75} />
                  {badge ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] font-semibold flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
