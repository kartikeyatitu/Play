"use client";
// Owner setting: sibling discount on monthly fees. Off by default; applies from the next fee generation.

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSiblingDiscountSettings, saveSiblingDiscountSettings } from "@/app/actions/auto-fees";

export function SiblingDiscountCard() {
  const [enabled, setEnabled] = useState(false);
  const [second, setSecond] = useState("10");
  const [third, setThird] = useState("15");
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    getSiblingDiscountSettings()
      .then((s) => {
        setEnabled(s.enabled);
        if (s.secondChildPercent > 0) setSecond(String(s.secondChildPercent));
        if (s.thirdPlusPercent > 0) setThird(String(s.thirdPlusPercent));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = (on: boolean) =>
    start(async () => {
      const r = await saveSiblingDiscountSettings({ enabled: on, secondChildPercent: Number(second), thirdPlusPercent: Number(third) });
      if (!r.success) return void toast.error(r.error);
      setEnabled(r.settings.enabled);
      toast.success(r.settings.enabled ? "Sibling discount on. It applies from the next fee generation." : "Sibling discount off.");
    });

  const input = "h-10 w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-right text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand,#22c55e)]";

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 text-zinc-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-zinc-100">Sibling discount {enabled ? <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">On</span> : <span className="ml-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">Off</span>}</p>
            <p className="mt-0.5 max-w-prose text-xs text-zinc-400">
              Brothers and sisters with the same parent or guardian. The child with the highest fee pays in full; the others get the discount. Past months are never changed.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="text-xs text-zinc-400">
          2nd child
          <span className="mt-1 flex items-center gap-1">
            <input className={input} inputMode="decimal" value={second} onChange={(e) => setSecond(e.target.value)} disabled={!loaded || pending} aria-label="Second child discount percent" />
            <span className="text-sm text-zinc-300">%</span>
          </span>
        </label>
        <label className="text-xs text-zinc-400">
          3rd child and more
          <span className="mt-1 flex items-center gap-1">
            <input className={input} inputMode="decimal" value={third} onChange={(e) => setThird(e.target.value)} disabled={!loaded || pending} aria-label="Third and later child discount percent" />
            <span className="text-sm text-zinc-300">%</span>
          </span>
        </label>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save(true)} disabled={!loaded || pending}>{enabled ? "Save" : "Turn on"}</Button>
          {enabled && <Button size="sm" variant="ghost" onClick={() => save(false)} disabled={pending}>Turn off</Button>}
        </div>
      </div>
    </div>
  );
}
