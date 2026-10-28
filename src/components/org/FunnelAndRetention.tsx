"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getFunnelAndCohorts } from "@/app/actions/insights";
import type { FunnelAndCohorts } from "@/lib/funnel-data";

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

export function FunnelAndRetention() {
  const [data, setData] = useState<FunnelAndCohorts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getFunnelAndCohorts()
      .then((res) => {
        if (!alive) return;
        if (res.success) setData(res.data);
        else setError(res.error);
      })
      .catch(() => alive && setError("Couldn't load the funnel. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-subtle">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading enquiries and retention…
      </p>
    );
  }
  if (error || !data) return <p className="text-sm text-danger">{error ?? "Couldn't load the funnel."}</p>;
  return <FunnelAndRetentionView data={data} />;
}

export function FunnelAndRetentionView({ data }: { data: FunnelAndCohorts }) {
  const { rows, total } = data.funnel;
  const months = data.funnelDays >= 180 ? "6 months" : `${data.funnelDays} days`;
  const anyCohort = data.cohorts.some((c) => c.size > 0);
  const cols = data.cohorts.length;

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="funnel-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="funnel-title" className="text-sm font-semibold text-ink">Where enquiries come from · last {months}</h3>
          {total.enquiries > 0 && (
            <p className="text-xs text-ink-subtle">
              {total.enquiries} enquiries → {total.enrolled} enrolled ({pct(total.enrolRate)})
            </p>
          )}
        </div>
        {total.enquiries === 0 ? (
          <p className="text-sm text-ink-muted">No enquiries recorded in the last {months}. Trial bookings and leads you add show up here.</p>
        ) : (
          <>
          <p className="text-xs text-ink-subtle sm:hidden" aria-hidden>Swipe the table sideways to see more →</p>
          <div className="rounded-xl border border-line bg-surface overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-xs uppercase text-ink-subtle">
                <tr className="border-b border-line">
                  <th className="text-left p-3">Source</th>
                  <th className="text-right p-3">Enquiries</th>
                  <th className="text-right p-3 whitespace-nowrap">Had a trial</th>
                  <th className="text-right p-3">Enrolled</th>
                  <th className="text-left p-3 w-[34%] whitespace-nowrap">Enquiry → enrolled</th>
                </tr>
              </thead>
              <tbody>
                {[...rows, total].map((r) => (
                  <tr key={r.source} className={`border-b border-line last:border-0 ${r.source === "ALL" ? "font-semibold" : ""}`}>
                    <td className="p-3 text-ink whitespace-nowrap">{r.source === "ALL" ? "All sources" : r.label}</td>
                    <td className="p-3 text-right tabular-nums">{r.enquiries}</td>
                    <td className="p-3 text-right tabular-nums">
                      {r.trials} <span className="text-ink-subtle font-normal">({pct(r.trialRate)})</span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{r.enrolled}</td>
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden" aria-hidden>
                          <span className="block h-full rounded-full" style={{ width: `${Math.round((r.enrolRate ?? 0) * 100)}%`, background: "var(--viz-collected)" }} />
                        </span>
                        <span className="w-10 text-right tabular-nums text-ink">{pct(r.enrolRate)}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <p className="text-xs text-ink-subtle">
          An enquiry counts as enrolled when it&apos;s marked enrolled, or when a student with the same parent mobile was added after it. Walk-ins can
          enrol without a trial.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="cohort-title">
        <h3 id="cohort-title" className="text-sm font-semibold text-ink">Do new students keep coming?</h3>
        {!anyCohort ? (
          <p className="text-sm text-ink-muted">No students were added in the last {cols} months.</p>
        ) : (
          <>
          <p className="text-xs text-ink-subtle sm:hidden" aria-hidden>Swipe the table sideways to see more →</p>
          <div className="rounded-xl border border-line bg-surface overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-xs uppercase text-ink-subtle">
                <tr className="border-b border-line">
                  <th className="text-left p-3">Joined</th>
                  <th className="text-right p-3">Students</th>
                  {Array.from({ length: cols }, (_, k) => (
                    <th key={k} className="text-center p-3 whitespace-nowrap">{k === 0 ? "Same month" : `+${k} mo`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((c) => (
                  <tr key={c.month} className="border-b border-line last:border-0">
                    <td className="p-3 text-ink whitespace-nowrap">{c.label}</td>
                    <td className="p-3 text-right tabular-nums">{c.size}</td>
                    {c.retention.map((r, k) => (
                      <td key={k} className="p-1.5">
                        {r == null ? (
                          <span className="block text-center text-ink-subtle">{c.size === 0 ? "" : "·"}</span>
                        ) : (
                          <span
                            className="block rounded-md py-1.5 text-center tabular-nums text-ink"
                            style={{ background: `color-mix(in srgb, var(--viz-billed) ${Math.round(10 + r * 50)}%, transparent)` }}
                          >
                            {pct(r)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <p className="text-xs text-ink-subtle">
          Share of students who attended at least one session in each month after they joined. Students deleted from Triq aren&apos;t included.
        </p>
      </section>
    </div>
  );
}
