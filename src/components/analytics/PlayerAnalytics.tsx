"use client";

import { useMemo } from "react";
import { getSportConfig, unifyMetrics } from "@/lib/sport-metrics";
import { TrendingUp, TrendingDown, Minus, Star, Target, Award } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SkillReportRow {
  month: string;
  technique: number;
  fitness: number;
  discipline: number;
  sport?: string | null;
  metrics?: Record<string, number> | null;
  notes?: string | null;
}

interface PlayerAnalyticsProps {
  reports: SkillReportRow[];
  sport?: string | null;
  studentName?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function trend(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) return "flat";
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev) return "up";
  if (last < prev) return "down";
  return "flat";
}

const TrendIcon = ({ t }: { t: "up" | "down" | "flat" }) => {
  if (t === "up") return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (t === "down") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-zinc-500" />;
};

// ─── Radar chart (pure SVG) ─────────────────────────────────────────────────

function RadarChart({
  labels,
  values,
  maxValue = 5,
}: {
  labels: string[];
  values: number[];
  maxValue?: number;
}) {
  const n = labels.length;
  if (n < 3) return null;
  const cx = 120, cy = 120, r = 90;
  const angleStep = (2 * Math.PI) / n;

  function point(i: number, scale: number) {
    const angle = -Math.PI / 2 + i * angleStep;
    return {
      x: cx + r * scale * Math.cos(angle),
      y: cy + r * scale * Math.sin(angle),
    };
  }

  function polygon(scale: number) {
    return Array.from({ length: n }, (_, i) => {
      const p = point(i, scale);
      return `${p.x},${p.y}`;
    }).join(" ");
  }

  const dataPolygon = Array.from({ length: n }, (_, i) => {
    const p = point(i, (values[i] || 0) / maxValue);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[240px] mx-auto">
      {/* Grid rings */}
      {[0.2, 0.4, 0.6, 0.8, 1].map((s) => (
        <polygon
          key={s}
          points={polygon(s)}
          fill="none"
          stroke="var(--zinc-800, #27272a)"
          strokeWidth="0.5"
        />
      ))}
      {/* Axis lines */}
      {Array.from({ length: n }, (_, i) => {
        const p = point(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="var(--zinc-800, #27272a)"
            strokeWidth="0.5"
          />
        );
      })}
      {/* Data polygon */}
      <polygon
        points={dataPolygon}
        fill="rgba(163, 230, 53, 0.15)"
        stroke="rgb(163, 230, 53)"
        strokeWidth="2"
      />
      {/* Data dots */}
      {Array.from({ length: n }, (_, i) => {
        const p = point(i, (values[i] || 0) / maxValue);
        return (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="rgb(163, 230, 53)" />
        );
      })}
      {/* Labels */}
      {Array.from({ length: n }, (_, i) => {
        const p = point(i, 1.22);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-zinc-400 text-[9px] font-medium"
          >
            {labels[i]}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Mini bar sparkline ─────────────────────────────────────────────────────

function MiniBarChart({ values, max = 5 }: { values: number[]; max?: number }) {
  const w = 100;
  const barW = Math.min(8, (w - values.length) / values.length);
  const h = 24;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6">
      {values.map((v, i) => {
        const bh = (v / max) * h;
        return (
          <rect
            key={i}
            x={i * (barW + 1)}
            y={h - bh}
            width={barW}
            height={bh}
            rx={1}
            fill={i === values.length - 1 ? "rgb(163, 230, 53)" : "rgba(163, 230, 53, 0.3)"}
          />
        );
      })}
    </svg>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function PlayerAnalytics({ reports, sport, studentName }: PlayerAnalyticsProps) {
  const config = getSportConfig(sport);
  const sorted = useMemo(
    () => [...reports].sort((a, b) => a.month.localeCompare(b.month)),
    [reports]
  );

  const latest = sorted[sorted.length - 1] ?? null;

  // Unified metrics for the most recent report
  const currentMetrics = useMemo(() => {
    if (!latest) return [];
    return unifyMetrics(
      sport ?? latest.sport,
      { technique: latest.technique, fitness: latest.fitness, discipline: latest.discipline },
      latest.metrics as Record<string, number> | undefined
    );
  }, [latest, sport]);

  // Per-dimension trends across all reports
  const dimensionTrends = useMemo(() => {
    return config.dimensions.map((dim, idx) => {
      const values = sorted.map((r) => {
        const m = r.metrics as Record<string, number> | null;
        if (m && m[dim.key] != null) return m[dim.key];
        if (idx === 0) return r.technique;
        if (idx === 1) return r.fitness;
        if (idx === 2) return r.discipline;
        return 3;
      });
      return {
        key: dim.key,
        label: dim.label,
        hint: dim.hint,
        values,
        current: values[values.length - 1] ?? 0,
        average: avg(values),
        trend: trend(values),
      };
    });
  }, [sorted, config.dimensions]);

  // Strengths & weaknesses
  const strengths = useMemo(() => {
    const ranked = [...dimensionTrends].sort((a, b) => b.current - a.current);
    return {
      best: ranked.slice(0, 2),
      weakest: ranked.slice(-2).reverse(),
    };
  }, [dimensionTrends]);

  // Overall rating
  const overallRating = currentMetrics.length
    ? (currentMetrics.reduce((s, m) => s + m.value, 0) / currentMetrics.length).toFixed(1)
    : "—";

  if (!reports.length) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
        <Award className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">No evaluations yet</p>
        <p className="text-xs text-zinc-600 mt-1">
          Coach evaluations will appear here with skill breakdowns
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
          <Target className="w-4 h-4 text-lime-400" />
          {config.emoji} {config.name} Analytics
        </h3>
        <span className="text-xs text-zinc-500">
          {sorted.length} evaluation{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Overall + Radar */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-6">
          {/* Overall rating */}
          <div className="text-center shrink-0">
            <div className="text-3xl font-black text-lime-400 tabular-nums">{overallRating}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">
              Overall
            </div>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3 h-3 ${
                    s <= Math.round(Number(overallRating))
                      ? "fill-lime-400 text-lime-400"
                      : "text-zinc-700"
                  }`}
                />
              ))}
            </div>
          </div>
          {/* Radar */}
          <div className="flex-1 min-w-0">
            <RadarChart
              labels={currentMetrics.map((m) => m.label)}
              values={currentMetrics.map((m) => m.value)}
            />
          </div>
        </div>
      </div>

      {/* Dimension breakdown with trends */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800/50">
        {dimensionTrends.map((dim) => (
          <div key={dim.key} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-200">{dim.label}</span>
                <TrendIcon t={dim.trend as "up" | "down" | "flat"} />
              </div>
              <p className="text-[10px] text-zinc-600 truncate">{dim.hint}</p>
            </div>
            <div className="w-20 shrink-0">
              <MiniBarChart values={dim.values} />
            </div>
            <div className="w-8 text-right">
              <span className="text-sm font-black text-zinc-100 tabular-nums">{dim.current}</span>
              <span className="text-[10px] text-zinc-600">/5</span>
            </div>
          </div>
        ))}
      </div>

      {/* Strengths & Areas to improve */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold mb-2">
            Strengths
          </div>
          {strengths.best.map((s) => (
            <div key={s.key} className="text-xs text-zinc-300 flex items-center gap-1.5 mb-1">
              <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
              {s.label} ({s.current}/5)
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-2">
            Work On
          </div>
          {strengths.weakest.map((s) => (
            <div key={s.key} className="text-xs text-zinc-300 flex items-center gap-1.5 mb-1">
              <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
              {s.label} ({s.current}/5)
            </div>
          ))}
        </div>
      </div>

      {/* Latest coach notes */}
      {latest?.notes && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">
            Latest Coach Notes — {latest.month}
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">{latest.notes}</p>
        </div>
      )}
    </div>
  );
}
