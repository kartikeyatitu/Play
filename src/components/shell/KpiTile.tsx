import type { ReactNode } from "react";

/** Compact KPI tile: label, one big tabular number, optional hint. Real numbers only. */
export function KpiTile({
  label,
  value,
  hint,
  tone = "default",
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "brand" | "warn";
  onClick?: () => void;
}) {
  const valueColor = tone === "brand" ? "brand-text" : tone === "warn" ? "text-amber-400" : "text-zinc-50";
  const body = (
    <>
      <p className="text-[11px] font-medium text-zinc-500 leading-tight">{label}</p>
      <p className={`mt-1.5 text-xl sm:text-2xl font-semibold tracking-tight tabular-nums truncate ${valueColor}`}>{value}</p>
      {hint != null && <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums truncate">{hint}</p>}
    </>
  );
  const cls = "min-w-0 text-left rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 sm:p-4";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:bg-zinc-900 hover:border-zinc-700 transition-colors min-h-[44px]`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
