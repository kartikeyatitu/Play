import type { CSSProperties, ReactNode } from "react";

/**
 * One KPI cell: label, a big tabular number, a hint, and optionally a small meter.
 * Cells sit side by side inside one card (the parent draws the dividers). Real numbers only.
 */
export function KpiTile({
  label,
  value,
  hint,
  tone = "default",
  aside,
  meter,
  onClick,
  className = "",
  style,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** "warn"/"danger" colour the number (state); "brand" is kept for older callers and renders plain. */
  tone?: "default" | "brand" | "warn" | "danger";
  /** Top-right element on wider screens (e.g. a ring). */
  aside?: ReactNode;
  /** Full-width element under the number (e.g. a thin bar). */
  meter?: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const valueColor = tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : "text-ink";
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-[12px] sm:text-[13px] font-medium text-ink-muted leading-tight truncate">{label}</span>
          <span className={`num mt-2 block text-[22px] sm:text-[32px] font-semibold leading-none truncate ${valueColor}`}>{value}</span>
        </span>
        {aside && <span className="hidden sm:block shrink-0">{aside}</span>}
      </span>
      {meter && <span className="mt-3 block">{meter}</span>}
      {hint != null && <span className="mt-2 block text-[12px] text-ink-subtle tabular-nums truncate">{hint}</span>}
    </>
  );
  const cls = `relative min-w-0 text-left p-3 sm:p-5 ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} style={style} className={`${cls} transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2 min-h-[44px]`}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style}>{body}</div>
  );
}
