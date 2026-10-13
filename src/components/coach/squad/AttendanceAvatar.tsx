"use client";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return (first + last).toUpperCase();
}

/** Tone for an attendance percentage: emerald ≥80, amber 60–79, rose <60, zinc when there is no data. */
export function attendanceTone(pct: number | null): string {
  if (pct === null) return "text-zinc-700";
  if (pct >= 80) return "text-emerald-500";
  if (pct >= 60) return "text-amber-400";
  return "text-rose-500";
}

/**
 * Initials avatar wrapped in an SVG progress ring showing recent attendance %.
 * Pure presentational, no interactivity (the parent row is the tap target).
 */
export function AttendanceAvatar({ name, pct, size = 44 }: { name: string; pct: number | null; size?: number }) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const offset = c * (1 - clamped / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 block">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-zinc-800" />
        {pct !== null && clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className={attendanceTone(pct)}
          />
        )}
      </svg>
      <span className="absolute inset-[5px] rounded-full bg-zinc-900 flex items-center justify-center text-[13px] font-bold text-zinc-300 select-none">
        {initialsOf(name)}
      </span>
    </div>
  );
}
