"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getConsolidatedReport } from "@/app/actions/enterprise";
import { pct } from "@/lib/business-report";
import { formatCurrency } from "@/lib/currency";

type Result = Extract<Awaited<ReturnType<typeof getConsolidatedReport>>, { success: true }>;

/** V11 Enterprise: consolidated numbers across the academies (and branches) the viewer may report on. */
export function EnterpriseReport({ currentMonth }: { currentMonth: string }) {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getConsolidatedReport(month)
      .then((res) => {
        if (!alive) return;
        if (!res.success) {
          setError(res.error);
          setData(null);
        } else setData(res);
      })
      .catch(() => alive && setError("Couldn't load the consolidated report."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [month]);

  const activeCurrency = data?.orgs.find((o) => o.isActive)?.currency ?? "INR";

  return (
    <section className="space-y-6">
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        Month
        <input
          type="month"
          value={month}
          max={currentMonth}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-ink-subtle"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : data ? (
        <>
          <div className="rounded-xl border border-line bg-surface shadow-hairline overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-ink-subtle">
                <tr className="border-b border-line">
                  <th className="text-left p-3">Academy</th>
                  <th className="text-right p-3">Students</th>
                  <th className="text-right p-3">Billed</th>
                  <th className="text-right p-3">Collected</th>
                  <th className="text-right p-3">Outstanding to date</th>
                  <th className="text-right p-3">Attendance</th>
                  <th className="text-right p-3">Trials → enrolled</th>
                  <th className="text-right p-3">Court received</th>
                </tr>
              </thead>
              <tbody>
                {data.orgs.map((o) => (
                  <tr key={o.orgId} className="border-b border-line">
                    <td className="p-3 text-ink">
                      {o.name}
                      <span className="block text-xs text-ink-subtle">{o.city}{o.isActive ? " · current" : ""}</span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{o.summary.students}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(o.summary.billed, o.currency)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(o.summary.collected, o.currency)} <span className="text-xs text-ink-subtle">{pct(o.summary.collectionRate)}</span></td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(o.summary.outstandingAll, o.currency)}</td>
                    <td className="p-3 text-right tabular-nums">{pct(o.summary.attendanceRate)}</td>
                    <td className="p-3 text-right tabular-nums">{o.summary.trialsBooked} → {o.summary.trialsEnrolled}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(o.summary.courtRevenue, o.currency)}</td>
                  </tr>
                ))}
                {Object.entries(data.totalsByCurrency).map(([cur, t]) => (
                  <tr key={cur} className="font-semibold">
                    <td className="p-3 text-ink">Total ({cur}, {t.orgs} {t.orgs === 1 ? "academy" : "academies"})</td>
                    <td className="p-3 text-right tabular-nums">{t.students}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(t.billed, cur)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(t.collected, cur)} <span className="text-xs text-ink-subtle">{pct(t.collectionRate)}</span></td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(t.outstandingAll, cur)}</td>
                    <td className="p-3 text-right tabular-nums">{pct(t.attendanceRate)}</td>
                    <td className="p-3 text-right tabular-nums">{t.trialsBooked} → {t.trialsEnrolled}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(t.courtRevenue, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(data.skipped > 0 || data.truncated) && (
            <p className="text-xs text-ink-subtle">
              {data.skipped > 0 && `${data.skipped} academy membership(s) not included because you can't view reports there. `}
              {data.truncated && "Only the first 25 academies are shown."}
            </p>
          )}

          {data.branches && data.branches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Branches of the current academy</h3>
              <div className="rounded-xl border border-line bg-surface shadow-hairline overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-ink-subtle">
                    <tr className="border-b border-line">
                      <th className="text-left p-3">Branch</th>
                      <th className="text-right p-3">Batches</th>
                      <th className="text-right p-3">Enrolled</th>
                      <th className="text-right p-3">Sessions</th>
                      <th className="text-right p-3">Attendance</th>
                      <th className="text-right p-3">Billed</th>
                      <th className="text-right p-3">Collected</th>
                      <th className="text-right p-3">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.branches.map((b) => (
                      <tr key={b.branchId} className="border-b border-line last:border-0">
                        <td className="p-3 text-ink">{b.name}</td>
                        <td className="p-3 text-right tabular-nums">{b.batches}</td>
                        <td className="p-3 text-right tabular-nums">{b.enrolled}</td>
                        <td className="p-3 text-right tabular-nums">{b.sessions}</td>
                        <td className="p-3 text-right tabular-nums">{pct(b.attendanceRate)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(b.billed, activeCurrency)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(b.collected, activeCurrency)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(b.outstanding, activeCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-ink-subtle">
            Only academies where you can view reports are included. Different currencies are totalled separately. Opening
            this view is recorded in each academy&apos;s audit log.
          </p>
        </>
      ) : null}
    </section>
  );
}
