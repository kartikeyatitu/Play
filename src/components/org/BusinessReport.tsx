"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { getBusinessReport } from "@/app/actions/business-report";
import { explainBusinessReport, getAiStatus } from "@/app/actions/ai";
import { pct, type BusinessReport as Report } from "@/lib/business-report";
import { formatCurrency } from "@/lib/currency";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface shadow-hairline p-4 min-w-0">
      <p className="text-xs uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink tabular-nums truncate">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-subtle truncate">{sub}</p>}
    </div>
  );
}

/** V1 Business: one month of real numbers — money, attendance, trials and utilisation. */
export function BusinessReport({ currentMonth }: { currentMonth: string }) {
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<Report | null>(null);
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  useEffect(() => {
    getAiStatus("reports.view")
      .then((r) => setAiAvailable(r.available))
      .catch(() => setAiAvailable(false));
  }, []);

  useEffect(() => {
    setExplanation(null);
    setExplainError(null);
  }, [month]);

  async function explain() {
    if (explaining) return;
    setExplaining(true);
    setExplainError(null);
    try {
      const res = await explainBusinessReport(month);
      if (res.success) setExplanation(res.text);
      else setExplainError(res.error);
    } catch {
      setExplainError("Couldn't get an explanation. Please try again.");
    } finally {
      setExplaining(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getBusinessReport(month)
      .then((res) => {
        if (!alive) return;
        if (!res.success) {
          setError(res.error);
          setReport(null);
        } else {
          setReport(res.report);
          setCurrency(res.currency);
        }
      })
      .catch(() => alive && setError("Couldn't load the report."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [month]);

  const m = (n: number) => formatCurrency(n, currency);

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
      {aiAvailable && report && !loading && (
        <div className="rounded-xl border border-line bg-surface shadow-hairline p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">What does this month mean?</p>
            <button
              type="button"
              onClick={explain}
              disabled={explaining}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-volt text-volt-fg text-sm font-semibold hover:bg-volt/90 disabled:opacity-60"
            >
              {explaining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {explaining ? "Reading the numbers…" : explanation ? "Explain again" : "Explain with AI"}
            </button>
          </div>
          {explainError && <p className="text-sm text-red-500">{explainError}</p>}
          {explanation && (
            <>
              <div className="space-y-1.5 text-sm text-ink">
                {explanation.split("\n").filter((l) => l.trim()).map((line, i) => (
                  <p key={i}>{line.replace(/^\s*[-•*]\s*/, "• ")}</p>
                ))}
              </div>
              <p className="text-xs text-ink-subtle">AI summary based only on the numbers on this page. Check them before acting.</p>
            </>
          )}
        </div>
      )}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-ink-subtle"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : report ? (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Tile label="Collected" value={m(report.money.collected)} sub={`of ${m(report.money.billed)} billed · ${pct(report.money.collectionRate)}`} />
            <Tile label="Outstanding this month" value={m(report.money.outstandingMonth)} sub={`${report.money.feeRecords} fee records`} />
            <Tile label="Outstanding to date" value={m(report.money.outstandingAll)} sub={`${report.money.outstandingAllCount} unpaid records up to ${report.month}`} />
            <Tile label="Attendance" value={pct(report.attendance.rate)} sub={`${report.attendance.present}/${report.attendance.marked} marked · ${report.attendance.sessions} sessions, ${report.attendance.cancelled} cancelled`} />
            <Tile label="Students" value={String(report.students.active)} sub={`${report.students.newInMonth} new this month`} />
            <Tile label="Trials" value={String(report.trials.booked)} sub={`${report.trials.enrolled} enrolled · ${pct(report.trials.conversionRate)}`} />
            <Tile label="Batch fill" value={pct(report.batches.utilisation)} sub={report.batches.capacity ? `${report.batches.enrolled} enrolled, capacity ${report.batches.capacity}` : "No batch has a capacity set"} />
            <Tile label="Court use" value={pct(report.facilities.utilisation)} sub={`${report.facilities.bookedHours}/${report.facilities.openHours} h · ${m(report.facilities.revenue)} received`} />
          </div>

          {report.money.feeRecords === 0 && (
            <p className="text-xs text-ink-subtle">No fee records exist for {report.month}. Generate monthly fees to see billing here.</p>
          )}

          <div className="rounded-xl border border-line bg-surface shadow-hairline overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-ink-subtle">
                <tr className="border-b border-line">
                  <th className="text-left p-3">Batch</th>
                  <th className="text-right p-3">Enrolled</th>
                  <th className="text-right p-3">Fill</th>
                  <th className="text-right p-3">Sessions</th>
                  <th className="text-right p-3">Attendance</th>
                  <th className="text-right p-3">Billed</th>
                  <th className="text-right p-3">Collected</th>
                  <th className="text-right p-3">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {report.batches.rows.map((b) => (
                  <tr key={b.id} className="border-b border-line last:border-0">
                    <td className="p-3 text-ink">{b.name}</td>
                    <td className="p-3 text-right tabular-nums">{b.enrolled}{b.capacity ? `/${b.capacity}` : ""}</td>
                    <td className="p-3 text-right tabular-nums">{pct(b.utilisation)}</td>
                    <td className="p-3 text-right tabular-nums">{b.sessions}{b.cancelled ? ` (+${b.cancelled} cancelled)` : ""}</td>
                    <td className="p-3 text-right tabular-nums">{pct(b.attendanceRate)}</td>
                    <td className="p-3 text-right tabular-nums">{m(b.billed)}</td>
                    <td className="p-3 text-right tabular-nums">{m(b.collected)}</td>
                    <td className="p-3 text-right tabular-nums">{m(b.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.facilities.rows.length > 0 && (
            <div className="rounded-xl border border-line bg-surface shadow-hairline overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-ink-subtle">
                  <tr className="border-b border-line">
                    <th className="text-left p-3">Court</th>
                    <th className="text-right p-3">Booked h</th>
                    <th className="text-right p-3">of which batches</th>
                    <th className="text-right p-3">Open h</th>
                    <th className="text-right p-3">Use</th>
                    <th className="text-right p-3">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {report.facilities.rows.map((f) => (
                    <tr key={f.id} className="border-b border-line last:border-0">
                      <td className="p-3 text-ink">{f.name}</td>
                      <td className="p-3 text-right tabular-nums">{f.bookedHours}</td>
                      <td className="p-3 text-right tabular-nums">{f.allocationHours}</td>
                      <td className="p-3 text-right tabular-nums">{f.openHours}</td>
                      <td className="p-3 text-right tabular-nums">{pct(f.utilisation)}</td>
                      <td className="p-3 text-right tabular-nums">{m(f.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-ink-subtle">
            Money is by fee month; a student&apos;s fees count towards their first batch. Court use counts confirmed,
            completed and no-show bookings (batch allocations included) against opening hours for the whole month.
          </p>
        </>
      ) : null}
    </section>
  );
}
