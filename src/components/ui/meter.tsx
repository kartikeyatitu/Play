/**
 * Small progress primitives for real ratios (attendance, collection vs expected).
 * Colour encodes state only: `tone` picks success / warn / danger / accent / neutral.
 */
export type MeterTone = "success" | "warn" | "danger" | "accent" | "neutral";

const STROKE: Record<MeterTone, string> = {
  success: "rgb(var(--c-success))",
  warn: "rgb(var(--c-warn))",
  danger: "rgb(var(--c-danger))",
  accent: "rgb(var(--c-accent))",
  neutral: "rgb(var(--n-400))",
};

/** Attendance-style tone: ≥80% good, ≥60% watch, below that needs attention. */
export function rateTone(pct: number): MeterTone {
  return pct >= 80 ? "success" : pct >= 60 ? "warn" : "danger";
}

/** Circular progress ring (WHOOP-style). `value` is 0–100. */
export function Ring({
  value,
  size = 40,
  stroke = 4,
  tone = "accent",
  label,
  className = "",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: MeterTone;
  /** Accessible name; omit when the number is already printed next to it. */
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} {...a11y} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--n-800))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 400ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  );
}

/** Thin horizontal bar. `value` is 0–100. */
export function Bar({ value, tone = "accent", className = "", label }: { value: number; tone?: MeterTone; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span
      className={`block h-1 w-full overflow-hidden rounded-full bg-zinc-800 ${className}`}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-hidden={label ? undefined : true}
    >
      <span
        className="block h-full rounded-full"
        style={{ width: `${pct}%`, background: STROKE[tone], transition: "width 400ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </span>
  );
}
