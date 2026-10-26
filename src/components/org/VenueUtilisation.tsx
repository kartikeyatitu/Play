"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getVenueUtilisation } from "@/app/actions/turf-bookings";
import type { UtilRow } from "@/lib/venue-utilisation";
import { rupees } from "@/lib/turf";

/**
 * TRIQ Spaces utilisation report (flag spacesOps). Numbers come straight from booking rows; definitions
 * live in src/lib/venue-utilisation.ts. "Recorded" money is what was recorded, not gateway-verified.
 */
type Range = { days: 7 | 30 | 90; direction: "past" | "next" };
const RANGES: { key: string; label: string; r: Range }[] = [
  { key: "p7", label: "Last 7 days", r: { days: 7, direction: "past" } },
  { key: "p30", label: "Last 30 days", r: { days: 30, direction: "past" } },
  { key: "n7", label: "Next 7 days", r: { days: 7, direction: "next" } },
];

const pct = (u: number | null) => (u === null ? "—" : `${Math.round(u * 100)}%`);

export function VenueUtilisation() {
  const [key, setKey] = useState("p7");
  const [data, setData] = useState<{ from: string; to: string; rows: UtilRow[]; total: UtilRow } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = RANGES.find((x) => x.key === key)!.r;
    let alive = true;
    setLoading(true);
    getVenueUtilisation(r.days, r.direction).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.success) {
        setData(res);
        setError(null);
      } else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 space-y-3" aria-label="Utilisation">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Utilisation</h3>
          {data && <p className="text-[11px] text-zinc-500">{data.from} → {data.to}</p>}
        </div>
        <div className="flex gap-1">
          {RANGES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setKey(x.key)}
              className={`min-h-[32px] px-2.5 rounded-full text-xs border ${x.key === key ? "brand-bg border-transparent" : "border-zinc-800 text-zinc-300"}`}
            >
              {x.label}
            </button>
          ))}
          {loading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500 self-center" />}
        </div>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {data && data.total.bookings === 0 && data.total.blockedHours === 0 && data.total.cancellations === 0 ? (
        <p className="text-xs text-zinc-400">No bookings in this period yet.</p>
      ) : data ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-zinc-500">
              <tr className="text-left">
                <th className="py-1 pr-2 font-normal">Court</th>
                <th className="py-1 px-1 font-normal text-right">Used</th>
                <th className="py-1 px-1 font-normal text-right">Booked h</th>
                <th className="py-1 px-1 font-normal text-right">Blocked h</th>
                <th className="py-1 px-1 font-normal text-right">Bookings</th>
                <th className="py-1 px-1 font-normal text-right">Value</th>
                <th className="py-1 px-1 font-normal text-right">Recorded</th>
                <th className="py-1 pl-1 font-normal text-right">Cancel / no-show</th>
              </tr>
            </thead>
            <tbody>
              {[...data.rows, data.total].map((r) => (
                <tr key={r.facilityId} className={`border-t border-zinc-800 ${r.facilityId === "ALL" ? "font-semibold text-zinc-100" : "text-zinc-300"}`}>
                  <td className="py-1.5 pr-2">{r.name}</td>
                  <td className="py-1.5 px-1 text-right">{pct(r.utilisation)}</td>
                  <td className="py-1.5 px-1 text-right">{r.bookedHours}</td>
                  <td className="py-1.5 px-1 text-right">{r.blockedHours}</td>
                  <td className="py-1.5 px-1 text-right">
                    {r.bookings}
                    <span className="text-zinc-500"> ({r.online} online)</span>
                  </td>
                  <td className="py-1.5 px-1 text-right">{rupees(r.bookedValue)}</td>
                  <td className="py-1.5 px-1 text-right">{rupees(r.recorded)}</td>
                  <td className="py-1.5 pl-1 text-right">
                    {r.cancellations} / {r.noShows}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-zinc-500 mt-2">
            Used = booked hours ÷ (opening hours − blocked hours), using each court&apos;s current hours. Recorded = money marked as received; refunds aren&apos;t tracked here.
          </p>
        </div>
      ) : null}
    </section>
  );
}
