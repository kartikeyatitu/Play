/**
 * Geometry for a tiny inline SVG trend chart (no chart library). Pure, so it can be tested.
 * One athlete, one test, one protocol per chart: never several athletes on one chart.
 */

export type ChartPoint = { x: number; y: number; value: number; label: string; pb: boolean };

export type TrendGeometry = {
  width: number;
  height: number;
  path: string;
  points: ChartPoint[];
  minValue: number;
  maxValue: number;
  /** y of the min and max value gridlines. */
  yMin: number;
  yMax: number;
};

const PAD = { top: 12, right: 12, bottom: 18, left: 12 };

export function trendGeometry(
  series: { value: number; label: string; pb?: boolean }[],
  width = 320,
  height = 140,
): TrendGeometry | null {
  if (!series.length) return null;
  const values = series.map((s) => s.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const step = series.length > 1 ? innerW / (series.length - 1) : 0;
  const round = (n: number) => Math.round(n * 10) / 10;
  const points = series.map((s, i) => ({
    x: round(series.length > 1 ? PAD.left + i * step : PAD.left + innerW / 2),
    y: round(PAD.top + (1 - (s.value - lo) / (hi - lo)) * innerH),
    value: s.value,
    label: s.label,
    pb: Boolean(s.pb),
  }));
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  return {
    width,
    height,
    path,
    points,
    minValue: Math.min(...values),
    maxValue: Math.max(...values),
    yMin: round(PAD.top + innerH),
    yMax: PAD.top,
  };
}
