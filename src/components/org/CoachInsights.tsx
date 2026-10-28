"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { getCoachInsights } from "@/app/actions/insights";
import type { CoachRow } from "@/lib/coach-insights";
import { monthLabel } from "@/lib/insights";

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

export function CoachInsights() {
  const [data, setData] = useState<{ month: string; coaches: CoachRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    getCoachInsights()
      .then((res) => {
        if (!alive) return;
        if (res.success) setData(res.data);
        else setError(res.error);
      })
      .catch(() => alive && setError("Couldn't load coach insights. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  if (loading) return <p className="flex items-center gap-2 text-sm text-ink-subtle"><Loader2 className="w-4 h-4 animate-spin" /> Loading coaches…</p>;
  if (error || !data) return <p className="text-sm text-danger">{error ?? "Couldn't load coach insights."}</p>;
  return <CoachInsightsView month={data.month} coaches={data.coaches} />;
}

export function CoachInsightsView({ month, coaches }: { month: string; coaches: CoachRow[] }) {
  return (
    <section className="space-y-3" aria-labelledby="coach-insights-title">
      <h3 id="coach-insights-title" className="text-sm font-semibold text-ink">Coaches · {monthLabel(month)} so far</h3>
      {coaches.length === 0 ? (
        <p className="text-sm text-ink-muted">No batches have a coach yet.</p>
      ) : (
        <>
          <p className="text-xs text-ink-subtle sm:hidden" aria-hidden>Swipe the table sideways to see more →</p>
          <div className="rounded-xl border border-line bg-surface overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-xs uppercase text-ink-subtle">
                <tr className="border-b border-line">
                  <th className="text-left p-3">Coach</th>
                  <th className="text-right p-3">Batches</th>
                  <th className="text-right p-3">Students</th>
                  <th className="text-right p-3 whitespace-nowrap">Sessions marked</th>
                  <th className="text-right p-3">Attendance</th>
                  <th className="text-right p-3 whitespace-nowrap">Evaluations done</th>
                </tr>
              </thead>
              <tbody>
                {coaches.map((c) => (
                  <tr key={c.coachId} className="border-b border-line last:border-0">
                    <td className="p-3 text-ink whitespace-nowrap">{c.name}</td>
                    <td className="p-3 text-right tabular-nums">{c.batches}</td>
                    <td className="p-3 text-right tabular-nums">{c.students}</td>
                    <td className={`p-3 text-right tabular-nums whitespace-nowrap ${c.markedRate != null && c.markedRate < 0.8 ? "text-warn" : ""}`}>
                      {c.markedRate != null && c.markedRate < 0.8 && (
                        <AlertTriangle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" aria-label="Below 80%" role="img" />
                      )}
                      {c.sessionsMarked}/{c.sessionsHeld} <span className="text-ink-subtle">({pct(c.markedRate)})</span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{pct(c.attendanceRate)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {c.evaluated}/{c.students} <span className="text-ink-subtle">({pct(c.evaluatedRate)})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-subtle">
            Sessions marked = sessions up to today with attendance recorded; marked with a warning when under 80%. Evaluations = students with this month&apos;s skill report.
          </p>
        </>
      )}
    </section>
  );
}
