import type { ReactNode } from "react";

/** Every empty screen says what to do next. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 text-center flex flex-col items-center ${
        compact ? "px-4 py-5 gap-1.5" : "px-6 py-10 gap-2"
      }`}
    >
      {icon && <div className="text-zinc-500 mb-1">{icon}</div>}
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {description && <p className="text-xs text-zinc-500 max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Primary (lime) and quiet button styles shared by shell screens. 44px touch target. */
export const shellButton = {
  primary:
    "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl brand-bg text-sm font-semibold hover:opacity-90 transition-opacity",
  quiet:
    "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl border border-zinc-800 bg-zinc-900/60 text-sm font-medium text-zinc-200 hover:bg-zinc-900 hover:border-zinc-700 transition-colors",
} as const;
