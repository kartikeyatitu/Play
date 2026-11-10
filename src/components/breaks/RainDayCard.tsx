"use client";
// Owner Today: rain or a ground problem cancels every batch today in one go, tells parents, and can
// owe each child a make-up session. Below it, the make-up sessions still owed.
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CloudRain, Check, Loader2 } from "lucide-react";
import { cancelAllToday, listOpenMakeups, markMakeupGiven } from "@/app/actions/breaks";

const REASONS = ["Rain", "Ground unavailable", "Coach unavailable", "Holiday"];
type Owed = { id: string; name: string; date: string; batchName: string };

export function RainDayCard() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Rain");
  const [makeup, setMakeup] = useState(true);
  const [owed, setOwed] = useState<Owed[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [pending, start] = useTransition();

  const load = () =>
    listOpenMakeups()
      .then((r) => r.success && setOwed(r.items))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const cancel = () =>
    start(async () => {
      const r = await cancelAllToday({ reason, makeup });
      if (!r.success) return void toast.error(r.error);
      setOpen(false);
      toast.success(`${r.batches} batch${r.batches === 1 ? "" : "es"} cancelled and parents told.${r.makeups ? ` ${r.makeups} make-up sessions owed.` : ""}`);
      load();
    });

  const given = (id: string) =>
    start(async () => {
      const r = await markMakeupGiven(id);
      if (!r.success) return void toast.error(r.error);
      setOwed((o) => o.filter((x) => x.id !== id));
    });

  const shown = showAll ? owed : owed.slice(0, 4);
  const chip = "rounded-full border px-3 py-1.5 text-xs font-semibold";

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CloudRain className="h-4 w-4 text-sky-500" aria-hidden /> Rain or ground closed?
        </p>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2">
            Cancel today&apos;s batches
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
            {REASONS.map((r) => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={`${chip} ${reason === r ? "brand-bg border-transparent" : "border-line text-ink-muted hover:text-ink"}`}>
                {r}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={makeup} onChange={(e) => setMakeup(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
            Owe every child a make-up session
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={cancel} disabled={pending} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-danger text-sm font-semibold text-white disabled:opacity-50">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Cancel all and tell parents
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-xl px-4 text-sm text-ink-muted hover:text-ink">
              Back
            </button>
          </div>
        </div>
      )}
      {owed.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-semibold text-ink-muted">Make-up sessions owed ({owed.length})</p>
          <ul className="mt-2 divide-y divide-line">
            {shown.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{o.name}</span>
                  <span className="block truncate text-xs text-ink-subtle">
                    {o.batchName}, {o.date ? new Date(`${o.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : ""}
                  </span>
                </span>
                <button type="button" onClick={() => given(o.id)} disabled={pending} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2 disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" aria-hidden /> Given
                </button>
              </li>
            ))}
          </ul>
          {owed.length > 4 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs font-semibold brand-text">
              {showAll ? "Show fewer" : `Show all ${owed.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
