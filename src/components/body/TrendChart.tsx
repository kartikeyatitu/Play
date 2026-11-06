// Inline SVG trend for ONE athlete, ONE test, ONE protocol. No chart library.
import { trendGeometry } from "@/lib/body/chart";

export function TrendChart({
  series,
  better,
  label,
  format,
}: {
  series: { value: number; label: string; pb?: boolean }[];
  better: "lower" | "higher";
  label: string;
  format: (v: number) => string;
}) {
  const g = trendGeometry(series);
  if (!g) return null;
  const last = g.points[g.points.length - 1];
  return (
    <figure className="mt-3">
      <svg
        viewBox={`0 0 ${g.width} ${g.height}`}
        className="h-auto w-full text-volt"
        role="img"
        aria-label={`${label}: ${series.length} results, latest ${format(last.value)}. ${better === "lower" ? "Lower" : "Higher"} is better.`}
      >
        <line x1="0" x2={g.width} y1={g.yMax} y2={g.yMax} className="stroke-line" strokeDasharray="3 4" />
        <line x1="0" x2={g.width} y1={g.yMin} y2={g.yMin} className="stroke-line" strokeDasharray="3 4" />
        {g.points.length > 1 ? <path d={g.path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /> : null}
        {g.points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.pb ? 5 : 3.5} className={p.pb ? "fill-success" : "fill-current"}>
            <title>{`${p.label}: ${format(p.value)}${p.pb ? " (personal best)" : ""}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-ink-subtle">
        <span>
          {format(g.minValue)} – {format(g.maxValue)}
        </span>
        <span>
          {better === "lower" ? "↓ Lower is better" : "↑ Higher is better"} · <span className="text-success">●</span> personal best
        </span>
      </figcaption>
    </figure>
  );
}
