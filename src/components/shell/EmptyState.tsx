import type { ReactNode } from "react";

/** Every empty screen says what to do next. `art` (e.g. a <SportMotif />) replaces the small icon. */
export function EmptyState({
  icon,
  art,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  art?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-line bg-surface/30 text-center flex flex-col items-center ${
        compact ? "px-4 py-5 gap-1.5" : "px-6 py-10 gap-2"
      }`}
    >
      {art ? <div className="mb-1">{art}</div> : icon && <div className="text-ink-subtle mb-1">{icon}</div>}
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {description && <p className="text-xs text-ink-subtle max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Primary (accent) and quiet button styles shared by shell screens. 44px touch target, tactile press. */
export const shellButton = {
  primary:
    "press inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl brand-bg text-sm font-semibold hover:opacity-90",
  quiet:
    "press inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl border border-line bg-surface/60 text-sm font-medium text-zinc-200 hover:bg-surface hover:border-zinc-700",
} as const;
