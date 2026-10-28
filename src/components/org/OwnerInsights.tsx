"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getOwnerInsights } from "@/app/actions/insights";
import type { OwnerInsights as Insights } from "@/lib/insights-data";
import { pctChange, pointChange, type TrendPoint } from "@/lib/insights";
import { formatCurrency } from "@/lib/currency";

/** Read theme colours from CSS variables so charts follow light/dark (SVG attributes can't resolve var()). */
function useThemeColors() {
  const read = () => {
    if (typeof window === "undefined") return null;
    const cs = getComputedStyle(document.documentElement);
    const rgb = (name: string) => `rgb(${cs.getPropertyValue(name).trim().split(/\s+/).join(" ")})`;
    return {
      billed: cs.getPropertyValue("--viz-billed").trim() || "#3987e5",
      collected: cs.getPropertyValue("--viz-collected").trim() || "#6f9f12",
      muted: rgb("--c-text-muted"),
      line: rgb("--c-line"),
      surface: rgb("--c-surface"),
      text: rgb("--c-text"),
    };
  };
  // Start empty and read after mount: the server has no computed styles, so reading during render
  // would make server and client markup differ (hydration mismatch).
  const [colors, setColors] = useState<ReturnType<typeof read>>(null);
  useEffect(() => {
    setColors(read());
    const obs = new MutationObserver(() => setColors(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => obs.disconnect();
  }, []);
  return colors;
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 min-w-0">
      <p className="text-xs uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums truncate ${tone === "warn" ? "text-warn" : "text-ink"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs leading-snug text-ink-subtle">{sub}</p>}
    </div>
  );
}

function Change({ value, kind }: { value: number | null; kind: "pct" | "pts" }) {
  if (value == null) return <span className="text-xs text-ink-subtle">no comparison</span>;
  const shown = kind === "pct" ? `${Math.round(Math.abs(value) * 100)}%` : `${Math.round(Math.abs(value) * 100)} pts`;
  const Icon = Math.abs(value) < 0.005 ? Minus : value > 0 ? TrendingUp : TrendingDown;
  const word = Math.abs(value) < 0.005 ? "same as" : value > 0 ? "up on" : "down on";
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {Math.abs(value) < 0.005 ? "" : `${shown} `}
      {word} last month
    </span>
  );
}

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

export function OwnerInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getOwnerInsights()
      .then((res) => {
        if (!alive) return;
        if (res.success) setData(res.data);
        else setError(res.error);
      })
      .catch(() => alive && setError("Couldn't load insights. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-subtle">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading insights…
      </p>
    );
  }
  if (error || !data) return <p className="text-sm text-danger">{error ?? "Couldn't load insights."}</p>;
  return <OwnerInsightsView data={data} />;
}

/** Pure view (no data fetching) — also used by the local visual preview. */
export function OwnerInsightsView({ data }: { data: Insights }) {
  const [showTable, setShowTable] = useState(false);
  const colors = useThemeColors();
  const money = (n: number) => formatCurrency(n, data.currency);
  const trends = data.trends;
  const cur = trends[trends.length - 1];
  const prev = trends[trends.length - 2];
  const hasHistory = useMemo(() => trends.some((t) => t.billed > 0 || t.attendanceRate != null || t.received > 0), [trends]);
  const maxAgeing = Math.max(1, ...data.ageing.map((b) => b.amount));

  const s = data.snapshot;
  const axis = { fill: colors?.muted ?? "#888", fontSize: 12 };
  const tooltipStyle = {
    background: colors?.surface,
    border: `1px solid ${colors?.line}`,
    borderRadius: 8,
    color: colors?.text,
    fontSize: 12,
  };

  return (
    <section className="space-y-8" aria-labelledby="owner-insights-title">
      <h2 id="owner-insights-title" className="sr-only">Owner insights</h2>

      {/* Today */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Today</h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Tile
            label="Received today"
            value={money(s.receivedToday.amount)}
            sub={`${s.receivedToday.count} payment${s.receivedToday.count === 1 ? "" : "s"} · yesterday ${money(s.receivedYesterday.amount)}`}
          />
          <Tile label="Sessions today" value={String(s.sessionsToday)} sub={`${s.sessionsMarkedToday} with attendance marked`} />
          <Tile label="Trials today" value={String(s.trialsToday)} />
          <Tile label="New enquiries" value={String(s.enquiriesToday)} sub={`yesterday ${s.enquiriesYesterday}`} />
          <Tile
            label="Outstanding fees"
            value={money(s.outstanding.amount)}
            sub={`${s.outstanding.count} unpaid fee${s.outstanding.count === 1 ? "" : "s"}`}
            tone={s.outstanding.amount > 0 ? "warn" : undefined}
          />
        </div>
      </div>

      {/* Fee ageing */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Unpaid fees by how late they are</h3>
          <p className="text-xs text-ink-subtle">A fee is due from the 1st of its month.</p>
        </div>
        {s.outstanding.count === 0 ? (
          <p className="text-sm text-ink-muted">No unpaid fees. Everything recorded so far is paid.</p>
        ) : (
          <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
            {data.ageing.map((b) => (
              <li key={b.key} className="grid grid-cols-[8.5rem_1fr_auto] sm:grid-cols-[10rem_1fr_auto] items-center gap-3 px-4 py-3">
                <span className="text-sm text-ink flex items-center gap-1.5">
                  {b.key === "m3plus" && b.count > 0 && <AlertTriangle className="w-3.5 h-3.5 text-warn" aria-label="Needs attention" />}
                  {b.label}
                </span>
                <span className="h-2 rounded-full bg-surface-2 overflow-hidden" aria-hidden>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(b.amount / maxAgeing) * 100}%`, background: colors?.billed }}
                  />
                </span>
                <span className="text-sm tabular-nums text-ink text-right">
                  {money(b.amount)} <span className="text-ink-subtle">· {b.count}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 12-month trends */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Last 12 months</h3>
          {hasHistory && (
            <button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs font-medium text-ink-muted underline underline-offset-2 hover:text-ink">
              {showTable ? "Show charts" : "Show as table"}
            </button>
          )}
        </div>

        {!hasHistory ? (
          <p className="text-sm text-ink-muted">Trends appear once fees and attendance have been recorded for a month or more.</p>
        ) : (
          <>
            {cur && (
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-line bg-surface p-4">
                  <p className="text-xs uppercase tracking-wide text-ink-subtle">Collected · {cur.label}</p>
                  <p className="mt-1 text-xl font-semibold text-ink tabular-nums">{money(cur.collected)}</p>
                  <Change value={pctChange(cur.collected, prev?.collected ?? null)} kind="pct" />
                </div>
                <div className="rounded-xl border border-line bg-surface p-4">
                  <p className="text-xs uppercase tracking-wide text-ink-subtle">Collection rate</p>
                  <p className="mt-1 text-xl font-semibold text-ink tabular-nums">{pct(cur.collectionRate)}</p>
                  <Change value={pointChange(cur.collectionRate, prev?.collectionRate ?? null)} kind="pts" />
                </div>
                <div className="rounded-xl border border-line bg-surface p-4">
                  <p className="text-xs uppercase tracking-wide text-ink-subtle">Students billed</p>
                  <p className="mt-1 text-xl font-semibold text-ink tabular-nums">{cur.studentsBilled}</p>
                  <Change value={pctChange(cur.studentsBilled, prev?.studentsBilled ?? null)} kind="pct" />
                </div>
                <div className="rounded-xl border border-line bg-surface p-4">
                  <p className="text-xs uppercase tracking-wide text-ink-subtle">Attendance</p>
                  <p className="mt-1 text-xl font-semibold text-ink tabular-nums">{pct(cur.attendanceRate)}</p>
                  <Change value={pointChange(cur.attendanceRate, prev?.attendanceRate ?? null)} kind="pts" />
                </div>
              </div>
            )}

            {showTable ? (
              <TrendTable trends={trends} money={money} />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Fees billed and collected" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trends} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={colors?.line} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={axis} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => compactMoney(v, data.currency)} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
                      <Legend
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value: string) => <span style={{ color: colors?.muted }}>{value}</span>}
                      />
                      <Line type="monotone" dataKey="billed" name="Billed" stroke={colors?.billed} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="collected" name="Collected" stroke={colors?.collected} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Students billed">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={trends} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={colors?.line} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={axis} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: colors?.line, opacity: 0.4 }} />
                      <Bar dataKey="studentsBilled" name="Students billed" fill={colors?.collected} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Attendance rate">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trends.map((t) => ({ ...t, attendancePct: t.attendanceRate == null ? null : Math.round(t.attendanceRate * 100) }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={colors?.line} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={axis} tickLine={false} axisLine={false} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
                      <Line type="monotone" dataKey="attendancePct" name="Attendance" stroke={colors?.collected} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ChartCard({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <figure className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      <figcaption className="mb-2 text-sm font-medium text-ink">{title}</figcaption>
      {children}
    </figure>
  );
}

function TrendTable({ trends, money }: { trends: TrendPoint[]; money: (n: number) => string }) {
  return (
    <div className="rounded-xl border border-line bg-surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-ink-subtle">
          <tr className="border-b border-line">
            <th className="text-left p-3">Month</th>
            <th className="text-right p-3">Billed</th>
            <th className="text-right p-3">Collected</th>
            <th className="text-right p-3">Rate</th>
            <th className="text-right p-3">Received</th>
            <th className="text-right p-3">Students billed</th>
            <th className="text-right p-3">New students</th>
            <th className="text-right p-3">Attendance</th>
          </tr>
        </thead>
        <tbody>
          {[...trends].reverse().map((t) => (
            <tr key={t.month} className="border-b border-line last:border-0">
              <td className="p-3 text-ink">{t.label}</td>
              <td className="p-3 text-right tabular-nums">{money(t.billed)}</td>
              <td className="p-3 text-right tabular-nums">{money(t.collected)}</td>
              <td className="p-3 text-right tabular-nums">{pct(t.collectionRate)}</td>
              <td className="p-3 text-right tabular-nums">{money(t.received)}</td>
              <td className="p-3 text-right tabular-nums">{t.studentsBilled}</td>
              <td className="p-3 text-right tabular-nums">{t.newStudents}</td>
              <td className="p-3 text-right tabular-nums">{pct(t.attendanceRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-ink-subtle">
        Collected = fees for that month marked paid. Received = payments that arrived during that month, for any month&apos;s fee.
      </p>
    </div>
  );
}

/** Axis labels: ₹12k, ₹1.2L style for INR; 12k for others. */
function compactMoney(v: number, currency: string): string {
  if (currency === "INR") {
    if (v >= 100000) return `₹${(v / 100000).toFixed(v >= 1000000 ? 0 : 1)}L`;
    if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
    return `₹${v}`;
  }
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}
