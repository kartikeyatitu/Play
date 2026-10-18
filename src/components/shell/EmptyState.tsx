import type { ReactNode } from "react";

/** Every empty screen says what to do next. Optional small icon; no illustration. */
export function EmptyState({
  icon,
  art,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  /** @deprecated kept for older call sites; rendered like `icon`. */
  art?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const glyph = icon ?? art;
  return (
    <div
      className={`rounded-xl border border-line bg-surface text-center flex flex-col items-center ${
        compact ? "px-4 py-5 gap-1" : "px-6 py-10 gap-1.5"
      }`}
    >
      {glyph && (
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-subtle [&>svg]:h-[18px] [&>svg]:w-[18px]">
          {glyph}
        </div>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="text-[13px] text-ink-subtle max-w-xs">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Primary (accent) and quiet button styles shared by shell screens. 44px touch target on phones. */
export const shellButton = {
  primary:
    "press inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[40px] px-4 rounded-lg brand-bg text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40 disabled:opacity-60",
  quiet:
    "press inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[40px] px-4 rounded-lg border border-line bg-surface text-sm font-medium text-ink hover:bg-surface-2 hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40 disabled:opacity-60",
} as const;
