import type { CSSProperties, ReactNode } from "react";

/**
 * Compact KPI tile: label, one big scoreboard number, optional hint. Real numbers only.
 * Faint court lines sit behind the number; a "brand" tile gets a soft accent glow.
 */
export function KpiTile({
  label,
  value,
  hint,
  tone = "default",
  onClick,
  className = "",
  style,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "brand" | "warn";
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const valueColor = tone === "brand" ? "brand-text num-glow" : tone === "warn" ? "text-warn" : "text-ink";
  const body = (
    <>
      <span className="texture-court pointer-events-none absolute inset-0" aria-hidden />
      {tone === "brand" && (
        <span
          className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-32 rounded-full blur-2xl"
          style={{ background: "color-mix(in srgb, var(--brand) 22%, transparent)" }}
          aria-hidden
        />
      )}
      <span className="relative block text-[11px] font-medium text-ink-subtle leading-tight">{label}</span>
      <span className={`relative mt-1.5 block font-heading text-[24px] sm:text-[34px] font-bold leading-none tracking-tight tabular-nums truncate ${valueColor}`}>{value}</span>
      {hint != null && <span className="relative mt-1 block text-[11px] text-ink-subtle tabular-nums truncate">{hint}</span>}
    </>
  );
  const cls = `relative min-w-0 overflow-hidden text-left rounded-xl border border-line/80 bg-surface/50 p-3 sm:p-4 ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} style={style} className={`${cls} press hover:bg-surface hover:border-zinc-700 min-h-[44px]`}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style}>{body}</div>
  );
}
