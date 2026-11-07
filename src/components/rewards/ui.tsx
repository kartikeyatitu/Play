"use client";
// Small shared pieces for the Rewards screens. Semantic tokens only; phone-first (44px targets).

import type { ReactNode } from "react";
import { Award, CalendarCheck, Flame, Footprints, Shield, Sparkles, Timer, TrendingUp, Trophy, Users, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  flame: Flame,
  "calendar-check": CalendarCheck,
  trophy: Trophy,
  timer: Timer,
  shield: Shield,
  sparkles: Sparkles,
  users: Users,
  "trending-up": TrendingUp,
};

export function BadgeIcon({ icon, className = "h-5 w-5" }: { icon: string | null | undefined; className?: string }) {
  const I = (icon && ICONS[icon]) || Award;
  return <I className={className} aria-hidden />;
}

export function Panel({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
            value === t.key ? "border-volt bg-volt text-volt-fg" : "border-line bg-surface text-ink-muted hover:text-ink"
          }`}
        >
          {t.label}
          {t.count ? <span className="ml-1.5 tabular-nums opacity-80">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function PrimaryButton({ children, disabled, onClick, type = "button" }: { children: ReactNode; disabled?: boolean; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-volt px-4 text-sm font-semibold text-volt-fg transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, disabled, onClick, tone = "default" }: { children: ReactNode; disabled?: boolean; onClick?: () => void; tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-50 ${
        tone === "danger" ? "text-danger" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}

const STATUS_TONE: Record<string, string> = {
  REQUESTED: "text-warn",
  APPROVED: "text-volt-ink",
  FULFILLED: "text-success",
  CANCELLED: "text-ink-subtle",
};
const STATUS_LABEL: Record<string, string> = { REQUESTED: "Requested", APPROVED: "Approved", FULFILLED: "Handed over", CANCELLED: "Cancelled" };

export function StatusText({ status }: { status: string }) {
  return <span className={`text-xs font-semibold ${STATUS_TONE[status] ?? "text-ink-muted"}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function XpBar({ progress, label }: { progress: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full bg-volt" style={{ width: `${pct}%` }} />
    </div>
  );
}

export const fmtDate = (isoStr: string | null | undefined) =>
  isoStr ? new Date(isoStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export const sportName = (s: string) => (s === "general" ? "All sports" : s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
