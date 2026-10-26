"use client";

import { useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { allocateBatchToFacility, cancelBatchAllocation, listBatchAllocations } from "@/app/actions/facility-allocation";
import { WEEKDAYS, type AllocationRow, type Weekday } from "@/lib/facility-allocation";
import { MAX_HOURS_PER_BOOKING, MAX_LEASE_WEEKS, formatHour, todayIstStr } from "@/lib/turf";

type Facility = { id: string; name: string; openHour: number; closeHour: number };

const field =
  "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lime-400";

/** V1 Business: allocate batches to courts as weekly bookings that block the court for public bookings. */
export function FacilityAllocation() {
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [batchId, setBatchId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [startDate, setStartDate] = useState(todayIstStr());
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [startHour, setStartHour] = useState(16);
  const [hours, setHours] = useState(1);
  const [weeks, setWeeks] = useState(4);

  async function refresh() {
    const res = await listBatchAllocations();
    if (!res.success) setError(res.error);
    else {
      setError(null);
      setRows(res.rows);
      setBatches(res.batches);
      setFacilities(res.facilities);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const facility = facilities.find((f) => f.id === facilityId);
  const hourOptions = facility
    ? Array.from({ length: Math.max(0, facility.closeHour - facility.openHour) }, (_, i) => facility.openHour + i)
    : Array.from({ length: 24 }, (_, i) => i);

  function toggleDay(d: Weekday) {
    setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  async function onAllocate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await allocateBatchToFacility({ batchId, facilityId, startDate, weekdays, startHour, hours, weeks });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Allocated ${res.created} slot${res.created === 1 ? "" : "s"}` +
          (res.conflicts.length ? `. Skipped ${res.conflicts.length} already-booked date(s): ${res.conflicts.slice(0, 5).join(", ")}${res.conflicts.length > 5 ? "…" : ""}` : ""),
      );
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onCancel(r: AllocationRow) {
    if (!confirm(`Cancel the ${r.upcoming} upcoming slot(s) of ${r.batchName ?? "this batch"} on ${r.facilityName}?`)) return;
    setBusy(r.groupId);
    try {
      const res = await cancelBatchAllocation(r.groupId);
      if (!res.success) toast.error(res.error);
      else toast.success(`Cancelled ${res.cancelled} slot(s)`);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-subtle">Loading…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <section className="rounded-xl border border-line bg-surface shadow-hairline p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-ink">Court allocation for batches</h3>
        <p className="text-xs text-ink-subtle">
          Reserves a court for a batch every week. The slots appear on the Bookings board and can&apos;t be booked by anyone else.
        </p>
      </div>

      {facilities.length === 0 ? (
        <p className="text-sm text-ink-subtle">Add a court or facility first (Bookings or Operations).</p>
      ) : batches.length === 0 ? (
        <p className="text-sm text-ink-subtle">Create a batch first.</p>
      ) : (
        <form onSubmit={onAllocate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs text-ink-muted">
            Batch
            <select className={field} value={batchId} onChange={(e) => setBatchId(e.target.value)} required>
              <option value="">Choose…</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-ink-muted">
            Court / facility
            <select className={field} value={facilityId} onChange={(e) => setFacilityId(e.target.value)} required>
              <option value="">Choose…</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name} ({formatHour(f.openHour)}–{formatHour(f.closeHour)})</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-ink-muted">
            Starting
            <input type="date" className={field} value={startDate} min={todayIstStr()} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <fieldset className="space-y-1 text-xs text-ink-muted sm:col-span-2 lg:col-span-3">
            <legend>Days</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={weekdays.includes(d)}
                  onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-md border text-sm ${weekdays.includes(d) ? "border-lime-500 bg-lime-500/15 text-ink" : "border-line text-ink-muted"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="space-y-1 text-xs text-ink-muted">
            Start time
            <select className={field} value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
              {hourOptions.map((h) => <option key={h} value={h}>{formatHour(h)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-ink-muted">
            Hours
            <select className={field} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {Array.from({ length: MAX_HOURS_PER_BOOKING }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-ink-muted">
            Weeks
            <input type="number" className={field} min={1} max={MAX_LEASE_WEEKS} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
          </label>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <Button type="submit" disabled={saving || weekdays.length === 0}>
              {saving ? "Allocating…" : "Allocate court"}
            </Button>
          </div>
        </form>
      )}

      <div>
        <h4 className="text-sm font-semibold text-ink mb-2">Upcoming allocations</h4>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-subtle">None yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.groupId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {r.batchName ?? "Deleted batch"} · {r.facilityName}
                  </p>
                  <p className="text-xs text-ink-subtle truncate">
                    {r.weekdays.join("/")} {formatHour(r.startHour)}–{formatHour(r.endHour)} · {r.upcoming} upcoming · next {r.nextDate}, last {r.lastDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onCancel(r)}
                  disabled={busy === r.groupId}
                  aria-label={`Cancel allocation for ${r.batchName ?? "batch"}`}
                  className="p-2 rounded-md text-ink-muted hover:text-red-500 disabled:opacity-50"
                >
                  {busy === r.groupId ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
